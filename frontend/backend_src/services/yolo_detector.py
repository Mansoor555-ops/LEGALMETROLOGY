import os
import logging
import cv2
import numpy as np
from typing import Tuple, Dict, Any, List, Optional

logger = logging.getLogger(__name__)

_yolo_model = None

# COCO class ids that plausibly correspond to a packaged product being held up to camera.
# We DELIBERATELY prefer these over "largest box wins", because on a real inspection photo
# (officer's hand holding the product against a cluttered background) the largest detected
# box is very often the "person" class (hand/arm/torso), not the product.
PRODUCT_LIKE_CLASSES = {
    39: "bottle",
    41: "cup",
    45: "bowl",
    73: "book",       # boxes/cartons are frequently misclassified as "book" by COCO models
    84: "book",
}
# Classes we actively refuse to crop to, even if they're the largest box.
EXCLUDED_CLASSES = {0, 15, 16, 17, 18, 19, 20}  # person + common animals


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


def _yolo_best_box(img: np.ndarray) -> Optional[np.ndarray]:
    """
    Runs YOLOv8 and returns the best candidate bounding box for the product,
    or None if nothing usable was found. Prefers product-like COCO classes;
    never returns a person/animal box; only falls back to "largest box of any
    other class" if no product-like class was seen at all.
    """
    yolo_model = get_yolo_model()
    if yolo_model is None:
        return None

    h, w = img.shape[:2]
    try:
        results = yolo_model(img, verbose=False)
    except Exception as e:
        logger.warning(f"YOLOv8 inference note (falling back to heuristic): {e}")
        return None

    if not results or len(results) == 0 or len(results[0].boxes) == 0:
        return None

    product_candidates = []
    other_candidates = []

    for box in results[0].boxes:
        cls_id = int(box.cls[0].item()) if box.cls is not None else -1
        if cls_id in EXCLUDED_CLASSES:
            continue
        xyxy = box.xyxy[0].cpu().numpy()
        conf = float(box.conf[0].item()) if box.conf is not None else 0.0
        bw = xyxy[2] - xyxy[0]
        bh = xyxy[3] - xyxy[1]
        area = bw * bh
        if area < (0.03 * w * h):
            continue
        entry = (area, conf, xyxy)
        if cls_id in PRODUCT_LIKE_CLASSES:
            product_candidates.append(entry)
        else:
            other_candidates.append(entry)

    pool = product_candidates if product_candidates else other_candidates
    if not pool:
        return None

    # Largest area within whichever pool we're using
    pool.sort(key=lambda e: e[0], reverse=True)
    return pool[0][2]


def _text_density_crop(img: np.ndarray, pad_frac: float = 0.08) -> np.ndarray:
    """
    Classic-CV fallback localizer: finds the sub-region of the image with the
    highest density of text-like blobs (via MSER) and crops to it, with padding.
    This targets *where the printed declarations actually are* instead of blindly
    slicing the full frame by fixed percentages — which fails badly whenever the
    photo has background clutter (the common real-world case: officer's hand,
    furniture, clothing, etc. filling most of the frame).
    Falls back to a conservative center-crop if MSER finds nothing usable.
    """
    h, w = img.shape[:2]
    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        mser = cv2.MSER_create()
        mser.setMinArea(30)
        mser.setMaxArea(int(0.05 * w * h))
        regions, _ = mser.detectRegions(gray)

        if regions and len(regions) >= 8:
            # Build a density map: accumulate a point for every MSER region centroid
            pts = np.array([r.mean(axis=0) for r in regions], dtype=np.float32)

            # Use a grid histogram to find the densest neighborhood of text blobs,
            # then take the tight bounding box of points near that peak.
            grid_x, grid_y = 12, 12
            hist, xedges, yedges = np.histogram2d(
                pts[:, 0], pts[:, 1], bins=[grid_x, grid_y], range=[[0, w], [0, h]]
            )
            peak_idx = np.unravel_index(np.argmax(hist), hist.shape)
            peak_cx = (xedges[peak_idx[0]] + xedges[peak_idx[0] + 1]) / 2
            peak_cy = (yedges[peak_idx[1]] + yedges[peak_idx[1] + 1]) / 2

            # Keep points within a generous radius of the densest cell (covers the
            # whole label block, not just one grid cell) and take their bbox.
            radius = 0.30 * max(w, h)
            dists = np.sqrt((pts[:, 0] - peak_cx) ** 2 + (pts[:, 1] - peak_cy) ** 2)
            keep = pts[dists <= radius]
            if len(keep) >= 6:
                x1, y1 = keep[:, 0].min(), keep[:, 1].min()
                x2, y2 = keep[:, 0].max(), keep[:, 1].max()

                pad_x = (x2 - x1) * pad_frac + 0.02 * w
                pad_y = (y2 - y1) * pad_frac + 0.02 * h
                x1 = max(0, int(x1 - pad_x))
                y1 = max(0, int(y1 - pad_y))
                x2 = min(w, int(x2 + pad_x))
                y2 = min(h, int(y2 + pad_y))

                # Sanity: don't accept a degenerate sliver crop
                if (x2 - x1) > 0.15 * w and (y2 - y1) > 0.10 * h:
                    return img[y1:y2, x1:x2]
    except Exception as e:
        logger.warning(f"MSER text-density localization failed, using center-crop: {e}")

    # Fallback: conservative center-crop (removes photo edges/background margins,
    # which is still strictly better than using the full raw frame).
    cx1, cy1 = int(w * 0.12), int(h * 0.08)
    cx2, cy2 = int(w * 0.88), int(h * 0.92)
    return img[cy1:cy2, cx1:cx2]


def detect_and_crop_regions(image_bytes: bytes) -> Tuple[Dict[str, bytes], Dict[str, Any]]:
    """
    Detection Stage:
    1. Uses Ultralytics YOLOv8, filtered to product-like classes (bottle/cup/book) and
       explicitly excluding person/animal classes, to locate the product if possible.
    2. If YOLO is unavailable or finds nothing usable, falls back to an MSER-based
       text-density localizer that crops to wherever printed text actually clusters
       in the frame, instead of blindly slicing the full (possibly cluttered) photo.
    3. Slices whichever crop we end up with into functional regions for per-region OCR.
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

        # 1. Attempt real, class-filtered YOLOv8 detection
        target_crop = None
        best_box = _yolo_best_box(img)
        if best_box is not None:
            bx1, by1, bx2, by2 = map(int, best_box)
            bx1, by1 = max(0, bx1), max(0, by1)
            bx2, by2 = min(w, bx2), min(h, by2)
            target_crop = img[by1:by2, bx1:bx2]
            metadata["methods"].append("ultralytics_yolov8_class_filtered_detection")
            metadata["detected_bbox"] = [bx1, by1, bx2, by2]

        # 2. Fallback: MSER text-density localization (NOT the full raw frame)
        if target_crop is None or target_crop.size == 0:
            target_crop = _text_density_crop(img)
            metadata["methods"].append("mser_text_density_localizer")

        # 3. Slice the localized product/label area into functional regions
        ch, cw = target_crop.shape[:2]
        metadata["methods"].append("fixed_region_heuristic_cropper")
        metadata["localized_crop_size"] = [cw, ch]

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

        # Also expose the full localized crop (undivided) — some OCR passes benefit
        # from reading it as one block rather than only via the 4 sub-slices, since
        # real labels don't always follow the assumed header/body/footer layout.
        _, full_enc = cv2.imencode('.jpg', target_crop)
        regions_map["full_localized"] = full_enc.tobytes()

        return regions_map, metadata

    except Exception as e:
        logger.error(f"Region detection error: {e}", exc_info=True)

    regions_map = {
        "header": image_bytes,
        "declarations": image_bytes,
        "manufacturer": image_bytes,
        "barcode": image_bytes,
        "full_localized": image_bytes
    }
    metadata["methods"].append("raw_image_fallback")
    return regions_map, metadata


def crop_label_region(image_bytes: bytes) -> Tuple[bytes, Dict[str, Any]]:
    """
    Main product label region crop.
    """
    regions, meta = detect_and_crop_regions(image_bytes)
    return regions.get("declarations", image_bytes), meta
