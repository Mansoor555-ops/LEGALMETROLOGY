import re
import logging
import cv2
import numpy as np
from typing import Dict, Any, List, Tuple

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

def preprocess_image_for_ocr(image_bytes: bytes) -> Tuple[Any, Any]:
    """
    Applies CLAHE contrast enhancement & image sharpening for label OCR.
    """
    if not image_bytes:
        return None, None

    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return None, None

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 1. CLAHE Contrast Limited Adaptive Histogram Equalization
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # 2. Sharpening filter kernel
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    sharpened = cv2.filter2D(enhanced, -1, kernel)

    return img, sharpened

def extract_text_from_image(image_bytes: bytes) -> Dict[str, Any]:
    """
    100% Empirical Multi-Angle Text Extraction Engine.
    Combines EasyOCR, PyTesseract, and OpenCV image pre-processing.
    Returns clear ocr_available status if OCR engines fail to initialize.
    """
    extracted_lines = []
    full_text_list = []

    img, enhanced = preprocess_image_for_ocr(image_bytes)
    if enhanced is None:
        return {
            "full_text": "",
            "lines": [],
            "avg_confidence": 0.0,
            "ocr_available": False,
            "error_message": "Invalid or un-decodable image bytes"
        }

    ocr_reader, init_err = get_ocr_reader()
    engine_used = None

    # 1. Primary Path: EasyOCR Engine
    if ocr_reader and easyocr_module:
        try:
            results = ocr_reader.readtext(enhanced)
            engine_used = "EasyOCR"
            for bbox, text, conf in results:
                clean_text = text.strip()
                if clean_text and len(clean_text) >= 2:
                    pts = [[int(pt[0]), int(pt[1])] for pt in bbox]
                    xs = [pt[0] for pt in pts]
                    ys = [pt[1] for pt in pts]
                    extracted_lines.append({
                        "text": clean_text,
                        "confidence": round(float(conf), 3),
                        "bbox": [min(xs), min(ys), max(xs), max(ys)]
                    })
                    full_text_list.append(clean_text)
        except Exception as e:
            logger.error(f"EasyOCR extraction error: {e}", exc_info=True)

    # 2. Fallback Path: PyTesseract Engine
    if not extracted_lines:
        try:
            import pytesseract
            data = pytesseract.image_to_data(enhanced, output_type=pytesseract.Output.DICT)
            n_boxes = len(data.get('text', []))
            engine_used = "PyTesseract"
            for i in range(n_boxes):
                text = data['text'][i].strip()
                conf = float(data['conf'][i])
                if text and len(text) >= 2 and conf > 35:
                    x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
                    extracted_lines.append({
                        "text": text,
                        "confidence": round(conf / 100.0, 3),
                        "bbox": [x, y, x + w, y + h]
                    })
                    full_text_list.append(text)
        except Exception as e:
            logger.warning(f"PyTesseract fallback unavailable: {e}")

    ocr_available = (engine_used is not None) or (len(extracted_lines) > 0)
    full_text = " ".join(full_text_list)
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
    Detection-First Stage 2 & 3:
    Crops label into spatial declaration regions (Header, Declarations, Manufacturer)
    and executes isolated per-region OCR to prevent line interleaving.
    """
    from .yolo_detector import detect_and_crop_regions
    regions_map, _ = detect_and_crop_regions(image_bytes)

    ocr_results_by_region = {}
    for region_name, cropped_bytes in regions_map.items():
        ocr_res = extract_text_from_image(cropped_bytes)
        ocr_results_by_region[region_name] = ocr_res

    return ocr_results_by_region
