import os
import logging
import cv2
import numpy as np
from typing import Tuple, Dict, Any, List

logger = logging.getLogger(__name__)

_yolo_model = None

def get_yolo_model():
    global _yolo_model
    if _yolo_model is None:
        try:
            from ultralytics import YOLO
            logger.info("Initializing pretrained Ultralytics YOLOv8 detector (yolov8n.pt)...")
            _yolo_model = YOLO("yolov8n.pt")
            logger.info("Ultralytics YOLOv8 detector initialized.")
        except Exception as e:
            logger.warning(f"Ultralytics YOLOv8 initialization note (using heuristic fallback): {e}")
            _yolo_model = False
    return _yolo_model if _yolo_model else None

def detect_and_crop_regions(image_bytes: bytes) -> Tuple[Dict[str, bytes], Dict[str, Any]]:
    """
    Detection Stage:
    1. Uses Ultralytics YOLOv8 pretrained model to locate general product/container bounding box if available.
    2. Uses honest fixed-region slicing heuristic (`fixed_region_heuristic_cropper`) as a robust fallback.
    """
    regions_map = {}
    metadata = {"methods": []}

    if not image_bytes:
        return {
            "header": b"",
            "declarations": b"",
            "manufacturer": b"",
            "barcode": b""
        }, {"methods": ["failed_empty_input"]}

    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Failed to decode image bytes into OpenCV matrix")

        h, w, _ = img.shape
        metadata["original_size"] = [w, h]

        # 1. Attempt Real YOLOv8 Object Detection
        target_crop = img
        yolo_model = get_yolo_model()
        if yolo_model is not None:
            try:
                results = yolo_model(img, verbose=False)
                if results and len(results) > 0 and len(results[0].boxes) > 0:
                    # Pick bounding box with largest area
                    best_box = None
                    max_area = 0
                    for box in results[0].boxes:
                        xyxy = box.xyxy[0].cpu().numpy()
                        bw = xyxy[2] - xyxy[0]
                        bh = xyxy[3] - xyxy[1]
                        area = bw * bh
                        if area > max_area:
                            max_area = area
                            best_box = xyxy

                    if best_box is not None and max_area > (0.05 * w * h):
                        bx1, by1, bx2, by2 = map(int, best_box)
                        bx1, by1 = max(0, bx1), max(0, by1)
                        bx2, by2 = min(w, bx2), min(h, by2)
                        target_crop = img[by1:by2, bx1:bx2]
                        metadata["methods"].append("ultralytics_yolov8_object_detection")
                        metadata["detected_bbox"] = [bx1, by1, bx2, by2]
            except Exception as e:
                logger.warning(f"YOLOv8 inference note (falling back to region heuristic): {e}")

        # 2. Slice cropped product area into functional regions using fixed-region heuristic
        ch, cw, _ = target_crop.shape
        metadata["methods"].append("fixed_region_heuristic_cropper")

        # Top / Header (0-35% height)
        _, header_enc = cv2.imencode('.jpg', target_crop[0:int(ch * 0.35), 0:cw])
        regions_map["header"] = header_enc.tobytes()

        # Center / Declarations (20-80% height)
        _, decl_enc = cv2.imencode('.jpg', target_crop[int(ch * 0.20):int(ch * 0.80), 0:cw])
        regions_map["declarations"] = decl_enc.tobytes()

        # Lower / Manufacturer (50-100% height)
        _, mfg_enc = cv2.imencode('.jpg', target_crop[int(ch * 0.50):ch, 0:cw])
        regions_map["manufacturer"] = mfg_enc.tobytes()

        # Lower Right / Barcode (55-100% height, 40-100% width)
        _, bc_enc = cv2.imencode('.jpg', target_crop[int(ch * 0.55):ch, int(cw * 0.40):cw])
        regions_map["barcode"] = bc_enc.tobytes()

        return regions_map, metadata

    except Exception as e:
        logger.error(f"Region detection error: {e}", exc_info=True)

    regions_map = {
        "header": image_bytes,
        "declarations": image_bytes,
        "manufacturer": image_bytes,
        "barcode": image_bytes
    }
    metadata["methods"].append("raw_image_fallback")
    return regions_map, metadata

def crop_label_region(image_bytes: bytes) -> Tuple[bytes, Dict[str, Any]]:
    """
    Main product label region crop.
    """
    regions, meta = detect_and_crop_regions(image_bytes)
    return regions.get("declarations", image_bytes), meta
