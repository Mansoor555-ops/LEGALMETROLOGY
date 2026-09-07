import cv2
import numpy as np
import logging
from typing import Dict, Any, Tuple, Optional

logger = logging.getLogger(__name__)

def evaluate_image_quality(
    image_bytes: bytes,
    blur_threshold: float = 15.0,      # Recalibrated for Gemini Vision robustness
    min_brightness: float = 15.0,      # Loosened dark threshold
    max_brightness: float = 245.0,     # Loosened bright threshold
    max_glare_ratio: float = 0.12      # Max fraction of pixels >= 250 in any 32x32 block
) -> Dict[str, Any]:
    """
    Free OpenCV Pre-Check Gate:
    Runs before invoking Gemini API. Performs Laplacian variance blur analysis,
    global mean brightness evaluation, and localized specular glare hotspot detection.
    """
    if not image_bytes:
        return {
            "quality_passed": False,
            "blur_score": 0.0,
            "mean_brightness": 0.0,
            "glare_ratio": 0.0,
            "glare_detected": False,
            "message": "Empty image payload provided."
        }

    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return {
                "quality_passed": False,
                "blur_score": 0.0,
                "mean_brightness": 0.0,
                "glare_ratio": 0.0,
                "glare_detected": False,
                "message": "Failed to decode image bytes into OpenCV matrix."
            }

        h, w, _ = img.shape
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # 1. Laplacian Variance Blur Calculation
        lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())

        # 2. Global Mean Brightness Calculation
        mean_brightness = float(np.mean(gray))

        # 3. Localized Specular Glare Hotspot Check (32x32 grid cells)
        cell_size = 32
        max_cell_glare_ratio = 0.0
        glare_mask = (gray >= 250).astype(np.uint8)

        for y in range(0, h - cell_size + 1, cell_size):
            for x in range(0, w - cell_size + 1, cell_size):
                cell = glare_mask[y:y + cell_size, x:x + cell_size]
                cell_glare_frac = float(np.mean(cell))
                if cell_glare_frac > max_cell_glare_ratio:
                    max_cell_glare_ratio = cell_glare_frac

        is_blurry = lap_var < blur_threshold
        is_too_dark = mean_brightness < min_brightness
        is_too_bright = mean_brightness > max_brightness
        glare_detected = max_cell_glare_ratio > max_glare_ratio

        quality_passed = not (is_blurry or is_too_dark or is_too_bright or glare_detected)

        messages = []
        if is_blurry:
            messages.append(f"Blurry photo (Score: {lap_var:.1f} < {blur_threshold})")
        if is_too_dark:
            messages.append("Low Light")
        if is_too_bright:
            messages.append("Overexposed")
        if glare_detected:
            messages.append(f"Specular Glare / Hotspot Detected ({max_cell_glare_ratio*100:.0f}% saturated cell) — Tilt camera to reduce reflection")

        msg = "Image quality acceptable for Gemini Vision analysis." if quality_passed else f"Quality Warning: {', '.join(messages)}"

        return {
            "quality_passed": quality_passed,
            "blur_score": round(lap_var, 2),
            "mean_brightness": round(mean_brightness, 2),
            "glare_ratio": round(max_cell_glare_ratio, 3),
            "glare_detected": glare_detected,
            "is_blurry": is_blurry,
            "is_too_dark": is_too_dark,
            "is_too_bright": is_too_bright,
            "message": msg
        }

    except Exception as e:
        logger.warning(f"OpenCV quality precheck exception: {e}")
        return {
            "quality_passed": True,
            "blur_score": 50.0,
            "mean_brightness": 128.0,
            "glare_ratio": 0.0,
            "glare_detected": False,
            "message": f"Precheck exception: {e} (proceeding with Gemini API)"
        }
