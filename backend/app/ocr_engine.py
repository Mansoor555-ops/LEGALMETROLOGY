import re
import cv2
import numpy as np
from typing import Dict, Any, List
from .yolo_detector import detect_and_crop_regions

easyocr_module = None
reader_instance = None

def get_ocr_reader():
    global easyocr_module, reader_instance
    if reader_instance is None:
        try:
            import easyocr
            easyocr_module = easyocr
            reader_instance = easyocr.Reader(['en'], gpu=False)
        except Exception as e:
            print(f"EasyOCR init note: {e}")
            reader_instance = False
    return reader_instance

def preprocess_image_for_ocr(image_bytes: bytes):
    """
    Applies CLAHE contrast enhancement & image sharpening for label OCR
    """
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
    """
    extracted_lines = []
    full_text_list = []

    img, enhanced = preprocess_image_for_ocr(image_bytes)
    if enhanced is None:
        return {
            "full_text": "",
            "lines": [],
            "avg_confidence": 0.0
        }

    # 1. Try EasyOCR Engine
    ocr = get_ocr_reader()
    if ocr and easyocr_module:
        try:
            results = ocr.readtext(enhanced)
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
            print(f"EasyOCR extraction note: {e}")

    # 2. Try PyTesseract Engine as fallback or complement
    if not extracted_lines:
        try:
            import pytesseract
            data = pytesseract.image_to_data(enhanced, output_type=pytesseract.Output.DICT)
            n_boxes = len(data.get('text', []))
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
            print(f"PyTesseract extraction note: {e}")

    full_text = " ".join(full_text_list)
    avg_conf = round(sum(l["confidence"] for l in extracted_lines) / len(extracted_lines), 3) if extracted_lines else 0.0

    return {
        "full_text": full_text,
        "lines": extracted_lines,
        "avg_confidence": avg_conf
    }

def extract_structured_field_regions(image_bytes: bytes) -> Dict[str, Dict[str, Any]]:
    """
    Detection-First Stage 2 & 3:
    Crops label into spatial declaration regions (Header, Declarations, Manufacturer)
    and executes isolated per-region OCR to prevent line interleaving.
    """
    regions_map, _ = detect_and_crop_regions(image_bytes)

    ocr_results_by_region = {}
    for region_name, cropped_bytes in regions_map.items():
        ocr_res = extract_text_from_image(cropped_bytes)
        ocr_results_by_region[region_name] = ocr_res

    return ocr_results_by_region
