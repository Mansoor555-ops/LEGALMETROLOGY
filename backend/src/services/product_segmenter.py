import cv2
import io
import numpy as np
import logging
from typing import Tuple, Optional
from PIL import Image

logger = logging.getLogger(__name__)

def segment_and_crop_product(image_bytes: bytes, safety_margin_pct: float = 0.04) -> Tuple[bytes, bool, int, int]:
    """
    OpenCV Product Auto-Segmentation & Background Removal Engine:
    Detects the main packaged commodity contour, crops out non-product background clutter
    (tables, hands, floor, room background), tightens focus 100% on the product text,
    and returns compressed segmented product image bytes.

    Returns:
      segmented_bytes: bytes
      was_segmented: bool
      original_size_bytes: int
      segmented_size_bytes: int
    """
    if not image_bytes:
        return image_bytes, False, 0, 0

    orig_len = len(image_bytes)

    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return image_bytes, False, orig_len, orig_len

        h, w, _ = img.shape
        if h < 100 or w < 100:
            return image_bytes, False, orig_len, orig_len

        # 1. Grayscale & Gaussian Blur
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        # 2. Morphological Edge & Threshold Detection
        # Use Otsu binarization + Canny edge detection
        thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
        edges = cv2.Canny(blurred, 30, 150)
        combined = cv2.bitwise_or(thresh, edges)

        # Morphological Closing to connect product boundaries
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
        closed = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel, iterations=2)

        # 3. Find Product Bounding Contours
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return image_bytes, False, orig_len, orig_len

        # Sort contours by area to find primary product object
        large_contours = [c for c in contours if cv2.contourArea(c) > (w * h * 0.05)]
        if not large_contours:
            # Fallback to max contour
            best_contour = max(contours, key=cv2.contourArea)
        else:
            best_contour = max(large_contours, key=cv2.contourArea)

        contour_area = cv2.contourArea(best_contour)
        if contour_area < (w * h * 0.08):
            # Object too small, return original
            return image_bytes, False, orig_len, orig_len

        # Get Bounding Rectangle
        x, y, bw, bh = cv2.boundingRect(best_contour)

        # Add Safety Margin Padding (default 4%)
        margin_x = int(bw * safety_margin_pct)
        margin_y = int(bh * safety_margin_pct)

        x1 = max(0, x - margin_x)
        y1 = max(0, y - margin_y)
        x2 = min(w, x + bw + margin_x)
        y2 = min(h, y + bh + margin_y)

        # If bounding crop covers > 92% of original frame, segmentation is redundant
        crop_area = (x2 - x1) * (y2 - y1)
        if crop_area >= (w * h * 0.92):
            return image_bytes, False, orig_len, orig_len

        # Execute Bounding Crop
        cropped_img = img[y1:y2, x1:x2]

        # Convert to compressed JPEG
        is_success, buffer = cv2.imencode(".jpg", cropped_img, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
        if not is_success:
            return image_bytes, False, orig_len, orig_len

        segmented_bytes = buffer.tobytes()
        new_len = len(segmented_bytes)

        logger.info(f"Product Segmenter: Auto-cropped product ({w}x{h} -> {x2-x1}x{y2-y1}px). Byte size: {orig_len} -> {new_len} bytes (-{round((1 - new_len/orig_len)*100, 1)}%).")
        return segmented_bytes, True, orig_len, new_len

    except Exception as e:
        logger.warning(f"Product segmenter note: {e}")
        return image_bytes, False, orig_len, orig_len
