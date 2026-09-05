from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

def check_image_quality(image_bytes: bytes) -> Dict[str, Any]:
    """
    Checks blurriness and brightness level using OpenCV Laplacian variance.
    If image analysis fails, explicitly returns passed=False rather than fake scores.
    """
    if not image_bytes:
        return {
            "passed": False,
            "blur_score": 0.0,
            "brightness_score": 0.0,
            "is_blurry": True,
            "is_too_dark": False,
            "is_too_bright": False,
            "message": "Empty or missing image file — please retake photo"
        }

    try:
        import cv2
        import numpy as np
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is not None:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
            brightness_score = float(np.mean(gray))

            is_blurry = blur_score < 30.0
            is_too_dark = brightness_score < 30.0
            is_too_bright = brightness_score > 235.0

            passed = not is_blurry and not is_too_dark and not is_too_bright

            messages = []
            if is_blurry:
                messages.append(f"Image appears blurry (score: {blur_score:.1f})")
            if is_too_dark:
                messages.append("Image is too dark")
            if is_too_bright:
                messages.append("Image is overexposed")

            return {
                "passed": passed,
                "blur_score": round(blur_score, 2),
                "brightness_score": round(brightness_score, 2),
                "is_blurry": is_blurry,
                "is_too_dark": is_too_dark,
                "is_too_bright": is_too_bright,
                "message": "; ".join(messages) if messages else "Image quality suitable for inspection"
            }
    except Exception as e:
        logger.error(f"Image quality check analysis exception: {e}", exc_info=True)

    return {
        "passed": False,
        "blur_score": 0.0,
        "brightness_score": 0.0,
        "is_blurry": True,
        "is_too_dark": False,
        "is_too_bright": False,
        "message": "Unable to analyze image — file may be corrupted or un-decodable, please retake"
    }
