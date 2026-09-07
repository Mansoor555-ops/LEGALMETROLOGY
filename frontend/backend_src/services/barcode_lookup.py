import logging
import requests
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

def decode_barcode_from_image(image_bytes: bytes) -> Optional[str]:
    """
    Decodes 1D/2D barcode or QR code GTIN directly from image bytes using OpenCV.
    Returns barcode number string if found, otherwise None.
    """
    if not image_bytes:
        return None
    try:
        import cv2
        import numpy as np
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return None

        # 1. Try OpenCV 1D BarcodeDetector
        if hasattr(cv2, "barcode"):
            detector = cv2.barcode.BarcodeDetector()
            ok, decoded_info, decoded_type, _ = detector.detectAndDecode(img)
            if ok and decoded_info:
                for code in decoded_info:
                    if code and code.strip():
                        return code.strip()

        # 2. Try OpenCV QRCodeDetector
        qr_detector = cv2.QRCodeDetector()
        val, _, _ = qr_detector.detectAndDecode(img)
        if val and val.strip():
            return val.strip()

    except Exception as e:
        logger.warning(f"OpenCV barcode decoding note: {e}")

    return None

def lookup_external_gtin(code: str) -> Dict[str, Any]:
    """
    External GTIN Registry Lookup Fallback.
    Queries the Open Food Facts international GTIN registry (which includes Indian packaged commodities).
    Returns structured product details or found=False dict if not present.
    """
    clean_code = code.strip()
    if not clean_code or len(clean_code) < 6:
        return {
            "found": False,
            "source": "none",
            "message": "Invalid barcode format"
        }

    try:
        # Open Food Facts v2 API (Free, authoritative international GTIN registry)
        url = f"https://world.openfoodfacts.org/api/v2/product/{clean_code}.json"
        headers = {"User-Agent": "LegalMetrologyComplianceAssistant/2.0"}
        
        response = requests.get(url, headers=headers, timeout=4.0)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == 1 and "product" in data:
                prod = data["product"]
                product_name = prod.get("product_name") or prod.get("product_name_en") or f"Product #{clean_code}"
                brand = prod.get("brands") or prod.get("brand_owner") or "Generic Brand"
                manufacturer = prod.get("manufacturing_places") or prod.get("brands") or brand
                category = prod.get("categories") or "Packaged Food"
                net_qty = prod.get("quantity") or ""

                return {
                    "found": True,
                    "source": "OpenFoodFacts_GTIN_Registry",
                    "product": {
                        "barcode": clean_code,
                        "gtin": clean_code,
                        "product_name": product_name.strip(),
                        "brand": brand.strip(),
                        "manufacturer": manufacturer.strip(),
                        "category": "Packaged Food",
                        "net_quantity": net_qty.strip(),
                        "registered_date": "Live Registry Lookup"
                    }
                }
    except Exception as e:
        logger.warning(f"External GTIN lookup exception for {clean_code}: {e}")

    return {
        "found": False,
        "source": "none",
        "message": f"GTIN {clean_code} not found in local catalog or external registries."
    }
