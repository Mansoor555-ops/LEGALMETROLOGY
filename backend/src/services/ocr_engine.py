import re
import logging
import cv2
import numpy as np
from typing import Dict, Any, List, Tuple, Optional

logger = logging.getLogger(__name__)

easyocr_module = None
reader_instance = None
ocr_init_error = None


def get_ocr_reader():
    global easyocr_module, reader_instance, ocr_init_error
    if reader_instance is None and ocr_init_error is None:
        try:
            import easyocr
            easyocr_module = easyocr
            logger.info("Initializing EasyOCR Reader (English, CPU mode)...")
            reader_instance = easyocr.Reader(['en'], gpu=False)
            logger.info("EasyOCR Reader initialized successfully.")
        except Exception as e:
            ocr_init_error = f"EasyOCR initialization failed: {str(e)}"
            logger.error(ocr_init_error, exc_info=True)
            reader_instance = False
    return reader_instance, ocr_init_error


def preprocess_image_for_ocr(image_bytes: bytes) -> Tuple[Optional[Any], Optional[Any], Optional[Any]]:
    """
    Produces OCR-ready variants of the input image.

    IMPORTANT: earlier versions of this pipeline applied CLAHE + an aggressive
    unsharp-mask kernel unconditionally before OCR. On real photos (plastic/glass
    texture, JPEG compression, fabric backgrounds) that combination amplifies
    high-frequency noise far more than it sharpens actual letterforms, and was
    measured to make PyTesseract's hit rate on real product photos WORSE, not
    better (it turned readable label text into a wall of noise). We now:
      - keep the ORIGINAL color image as the primary OCR input (best for EasyOCR,
        which has its own internal preprocessing tuned on natural photos), and
      - offer a *mild* CLAHE-only grayscale variant (no sharpening kernel) as a
        secondary pass for low-contrast/dim photos.
    Callers should try the raw image first and only fall back to the mild variant
    if the raw pass returns little/no text.
    """
    if not image_bytes:
        return None, None, None

    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return None, None, None

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Mild CLAHE only — no sharpening kernel (see note above).
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    mild_enhanced = clahe.apply(gray)

    return img, gray, mild_enhanced


def _run_easyocr(reader, image: Any) -> List[Dict[str, Any]]:
    lines = []
    try:
        results = reader.readtext(image)
        for bbox, text, conf in results:
            clean_text = text.strip()
            if clean_text and len(clean_text) >= 2:
                pts = [[int(pt[0]), int(pt[1])] for pt in bbox]
                xs = [pt[0] for pt in pts]
                ys = [pt[1] for pt in pts]
                lines.append({
                    "text": clean_text,
                    "confidence": round(float(conf), 3),
                    "bbox": [min(xs), min(ys), max(xs), max(ys)]
                })
    except Exception as e:
        logger.error(f"EasyOCR extraction error: {e}", exc_info=True)
    return lines


def _run_tesseract(image: Any, psm: int, min_conf: float = 35.0) -> List[Dict[str, Any]]:
    lines = []
    try:
        import pytesseract
        data = pytesseract.image_to_data(image, config=f"--psm {psm}", output_type=pytesseract.Output.DICT)
        n_boxes = len(data.get('text', []))
        for i in range(n_boxes):
            text = data['text'][i].strip()
            conf = float(data['conf'][i])
            if text and len(text) >= 2 and conf > min_conf:
                x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
                lines.append({
                    "text": text,
                    "confidence": round(conf / 100.0, 3),
                    "bbox": [x, y, x + w, y + h]
                })
    except Exception as e:
        logger.warning(f"PyTesseract pass (psm {psm}) unavailable: {e}")
    return lines


def _score(lines: List[Dict[str, Any]]) -> float:
    """Ranks a candidate OCR pass: more lines and higher confidence is better,
    but a huge pile of low-confidence junk (noise) should score worse than a
    small set of confident lines — so we weight by confidence, not just count."""
    if not lines:
        return 0.0
    return sum(l["confidence"] for l in lines if l["confidence"] >= 0.4)


def extract_text_from_image(image_bytes: bytes) -> Dict[str, Any]:
    """
    Multi-Angle Text Extraction Engine.
    Combines EasyOCR (primary) and PyTesseract (fallback), each tried against
    a couple of light preprocessing variants, keeping whichever pass actually
    produced the best (confidence-weighted) result instead of a single fixed
    pipeline that can silently fail on real-world photos.
    """
    img, gray, mild_enhanced = preprocess_image_for_ocr(image_bytes)
    if img is None:
        return {
            "full_text": "",
            "lines": [],
            "avg_confidence": 0.0,
            "ocr_available": False,
            "error_message": "Invalid or un-decodable image bytes"
        }

    ocr_reader, init_err = get_ocr_reader()
    engine_used = None
    best_lines: List[Dict[str, Any]] = []
    best_score = -1.0

    # 1. Primary Path: EasyOCR — try raw color first, then mild-enhanced if weak.
    if ocr_reader and easyocr_module:
        for variant_name, variant_img in [("raw", img), ("mild_enhanced", mild_enhanced)]:
            lines = _run_easyocr(ocr_reader, variant_img)
            sc = _score(lines)
            if sc > best_score:
                best_score = sc
                best_lines = lines
                engine_used = f"EasyOCR ({variant_name})"
            # Raw color is usually best for EasyOCR; only try the second variant
            # if the first one found basically nothing.
            if best_score > 1.5:
                break

    # 2. Fallback Path: PyTesseract — try raw color + mild-enhanced, across two
    #    page-segmentation modes (3 = full block, 11 = sparse text), since label
    #    layouts vary a lot and a single psm setting misses many real labels.
    if best_score <= 0.0:
        for variant_name, variant_img in [("raw", img), ("mild_enhanced", mild_enhanced)]:
            for psm in (3, 11):
                lines = _run_tesseract(variant_img, psm=psm)
                sc = _score(lines)
                if sc > best_score:
                    best_score = sc
                    best_lines = lines
                    engine_used = f"PyTesseract (psm{psm}, {variant_name})"

    extracted_lines = best_lines
    full_text = " ".join(l["text"] for l in extracted_lines)
    ocr_available = (engine_used is not None) or (len(extracted_lines) > 0)
    avg_conf = round(sum(l["confidence"] for l in extracted_lines) / len(extracted_lines), 3) if extracted_lines else 0.0

    return {
        "full_text": full_text,
        "lines": extracted_lines,
        "avg_confidence": avg_conf,
        "ocr_available": ocr_available,
        "engine_used": engine_used,
        "error_message": init_err if not ocr_available else None
    }


def extract_structured_field_regions(image_bytes: bytes) -> Dict[str, Dict[str, Any]]:
    """
    Crops the photo to the localized product/label area (see yolo_detector.py),
    slices it into spatial declaration regions (Header, Declarations,
    Manufacturer, Barcode) plus one undivided full-label region, and runs
    isolated per-region OCR to prevent line interleaving between regions.
    """
    from .yolo_detector import detect_and_crop_regions
    regions_map, _ = detect_and_crop_regions(image_bytes)

    ocr_results_by_region = {}
    for region_name, cropped_bytes in regions_map.items():
        ocr_res = extract_text_from_image(cropped_bytes)
        ocr_results_by_region[region_name] = ocr_res

    return ocr_results_by_region
