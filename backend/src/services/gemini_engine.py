import os
import io
import time
import json
import logging
import hashlib
import asyncio
from typing import Dict, Any, List, Tuple, Optional
from PIL import Image

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except Exception:
    genai = None
    types = None
    GENAI_AVAILABLE = False

from ..config import settings
from .product_segmenter import segment_and_crop_product

logger = logging.getLogger(__name__)

# Session Level SHA256 Image Response Cache
_gemini_engine_cache: Dict[str, Dict[str, Any]] = {}

# Execution Metrics Tracker
_metrics_log = {
    "total_calls": 0,
    "total_payload_bytes": 0,
    "total_latency_seconds": 0.0,
    "errors": 0
}

def get_metrics() -> Dict[str, Any]:
    avg_latency = (_metrics_log["total_latency_seconds"] / _metrics_log["total_calls"]) if _metrics_log["total_calls"] > 0 else 0.0
    return {
        "total_calls": _metrics_log["total_calls"],
        "total_payload_bytes": _metrics_log["total_payload_bytes"],
        "avg_latency_seconds": round(avg_latency, 3),
        "errors": _metrics_log["errors"]
    }

def get_image_hash(image_bytes: bytes) -> str:
    return hashlib.sha256(image_bytes).hexdigest()

def compress_and_downscale_image(image_bytes: bytes) -> Tuple[bytes, int]:
    """
    Compresses, segments product background, and downscales image payload before transmission to Gemini.
    Default max dimension: 2048px, JPEG quality: 92 (high resolution for fine-print OCR).
    """
    # 1. Product auto-segmentation & background removal
    try:
        segmented_bytes, was_segmented, orig_sz, seg_sz = segment_and_crop_product(image_bytes)
        if was_segmented:
            image_bytes = segmented_bytes
    except Exception as e:
        logger.warning(f"Product segmentation note: {e}")

    max_dim = int(os.getenv("MAX_IMAGE_DIM", "2048"))
    jpeg_quality = int(os.getenv("JPEG_QUALITY", "92"))

    try:
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        width, height = img.size
        if width > max_dim or height > max_dim:
            img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
            
        out_buf = io.BytesIO()
        img.save(out_buf, format='JPEG', quality=jpeg_quality, optimize=True)
        compressed_bytes = out_buf.getvalue()
        return compressed_bytes, len(compressed_bytes)
    except Exception as e:
        logger.warning(f"Image compression note: {e}")
        return image_bytes, len(image_bytes)

def get_gemini_client():
    if GENAI_AVAILABLE and settings.GEMINI_API_KEY:
        try:
            return genai.Client(api_key=settings.GEMINI_API_KEY)
        except Exception as e:
            logger.warning(f"Error creating Gemini client: {e}")
            return None
    return None

def _generate_structured_content_sync(client, model_name: str, part, prompt: str, timeout_sec: float = 20.0):
    config = types.GenerateContentConfig(
        temperature=0.1,
        response_mime_type="application/json"
    )
    return client.models.generate_content(
        model=model_name,
        contents=[part, prompt],
        config=config
    )

async def analyze_label(image_bytes: bytes, category: str = "Packaged Food", panel: str = "front") -> Dict[str, Any]:
    """
    Multimodal Gemini Dual Flow Engine:
    Performs visual compliance evaluation AND structured Rule 6 declaration extractions in one call.
    Returns structured JSON schema with field presence, confidence, and visual flags.
    """
    if not image_bytes:
        return {
            "gemini_available": False,
            "error": "Empty image bytes provided",
            "visual_flags": ["empty_payload"],
            "fields": {}
        }

    # 1. Compress & Downscale Payload
    compressed_bytes, payload_size = compress_and_downscale_image(image_bytes)
    img_hash = f"label_{get_image_hash(compressed_bytes)}"

    # 2. SHA256 Image Cache Check (Only return cached result if it contained valid extractions)
    if img_hash in _gemini_engine_cache:
        cached = _gemini_engine_cache[img_hash]
        if cached.get("gemini_available") and any(f.get("extracted_text") and f.get("extracted_text") != "Not found" for f in cached.get("fields", {}).values()):
            logger.info(f"Retrieved valid Gemini label analysis from session cache. Payload size: {payload_size} bytes")
            return cached

    client = get_gemini_client()
    if not client:
        logger.warning("Gemini API key unconfigured or client creation failed. Returning gemini_available=false fallback.")
        return {
            "gemini_available": False,
            "error": "GEMINI_API_KEY not configured",
            "visual_flags": ["unconfigured_api_key"],
            "fields": {}
        }

    prompt = f"""
You are an expert Legal Metrology (Packaged Commodities Rules 2011) Senior Compliance Auditor.
Examine this packaged commodity label image ({category}, panel: {panel}).

Scan the ENTIRE image meticulously, including small fonts, fine print, side flaps, back text, white box stamps, dot-matrix / inkjet print strips, barcode boxes, and batch number blocks.

FIELD EXTRACTION INSTRUCTIONS:
1. "mrp": Search for MRP, M.R.P., Rs., ₹, Max Retail Price, Price. Extract the EXACT price AND any nearby "incl. of all taxes" or "inclusive of all taxes" clause (e.g., "MRP Rs. 250.00 (Incl. of all taxes)").
2. "mfg_date": Search for Mfd Date, Mfg, Pkd, Packed Date, DOM, Date of Mfg, Date of Packing, Month/Year, B.No/Pkd. Extract month & year (e.g., "Mfd: 05/2026", "MAY 2026", "05/26", "12/2025").
3. "manufacturer_name_address": Search for Mfd by, Manufactured by, Packed by, Mktd by, Marketed by, Company Name, Address, City, Pincode. Extract complete name and postal address.
4. "consumer_care": Search for Consumer Care, Customer Care, Care Exec, Toll Free (1800-...), Phone, Email (care@...), Feedback, Helpline, or complaint address. Extract all contact details.
5. "generic_name": Search for Common / Generic Name of Commodity, Product Title (e.g. "Packaged Drinking Water", "Whole Wheat Atta").
6. "net_quantity": Search for Net Qty, Net Weight, Net Vol, Net Mass, g, kg, ml, L, N, Pcs.
7. "country_of_origin": Search ANYWHERE for Country of Origin: India, Made in India, Product of India, or if address contains INDIA / Made in India.
8. "barcode_gtin": Search ANYWHERE for 8, 12, 13, or 14-digit EAN / UPC / GTIN barcode numbers printed below or near barcode lines (e.g., "8906017290033", "8901030800012"). Extract ONLY the numeric digits.

Return strictly a JSON object with this exact schema:
{{
  "visual_flags": [],
  "visual_compliance": {{
    "placement_compliant": true,
    "grouping_compliant": true,
    "prominence_compliant": true,
    "font_ratio_compliant": true,
    "mandatory_symbols_present": true,
    "notes": "Declarations legible and properly displayed.",
    "confidence": 0.95
  }},
  "fields": {{
    "mrp": {{"extracted_text": "e.g. MRP Rs. 250.00 (incl. of all taxes)", "present": true, "visual_confidence": 0.95, "notes": ""}},
    "net_quantity": {{"extracted_text": "e.g. Net Qty: 500 g", "present": true, "visual_confidence": 0.92, "notes": ""}},
    "mfg_date": {{"extracted_text": "e.g. Mfd: 05/2026", "present": true, "visual_confidence": 0.88, "notes": ""}},
    "manufacturer_name_address": {{"extracted_text": "e.g. Mfd by ABC Foods Pvt Ltd, Delhi", "present": true, "visual_confidence": 0.90, "notes": ""}},
    "consumer_care": {{"extracted_text": "e.g. Care: 1800-111-222 / care@abcfoods.com", "present": true, "visual_confidence": 0.89, "notes": ""}},
    "generic_name": {{"extracted_text": "e.g. Whole Wheat Atta", "present": true, "visual_confidence": 0.91, "notes": ""}},
    "country_of_origin": {{"extracted_text": "e.g. Country of Origin: India", "present": true, "visual_confidence": 0.94, "notes": ""}},
    "barcode_gtin": {{"extracted_text": "e.g. 8906017290033", "present": true, "visual_confidence": 0.95, "notes": ""}}
  }},
  "full_text": "Complete transcribed label text string"
}}

If a field is not printed on this specific image, set present to false, extracted_text to "Not found", and visual_confidence to 0.0.
"""

    models_to_try = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.5-flash-lite-preview-06-17']
    start_time = time.time()

    part = types.Part.from_bytes(data=compressed_bytes, mime_type="image/jpeg")
    response = None
    last_exception = None

    # Retry-with-backoff over model cascade
    for model_name in models_to_try:
        try:
            logger.info(f"Sending Gemini analyze_label request (model={model_name}, payload={payload_size} bytes)...")
            response = await asyncio.wait_for(
                asyncio.to_thread(_generate_structured_content_sync, client, model_name, part, prompt),
                timeout=12.0
            )
            if response and response.text:
                break
        except Exception as ex:
            last_exception = ex
            err_str = str(ex).lower()
            if "resource_exhausted" in err_str or "429" in err_str or "quota" in err_str:
                logger.warning(f"Model {model_name} rate-limited (429/RESOURCE_EXHAUSTED). Instantly failing over to next model...")
                continue
            logger.warning(f"Model {model_name} analyze_label call failed/timed out: {ex}")
            await asyncio.sleep(0.3)
            continue

    elapsed = time.time() - start_time
    _metrics_log["total_calls"] += 1
    _metrics_log["total_payload_bytes"] += payload_size
    _metrics_log["total_latency_seconds"] += elapsed

    if not response or not response.text:
        _metrics_log["errors"] += 1
        logger.error(f"Gemini analyze_label error after retry cascade: {last_exception}")
        return {
            "gemini_available": False,
            "error": str(last_exception) if last_exception else "Timeout or invalid response",
            "visual_flags": ["api_error"],
            "fields": {}
        }

    try:
        raw_text = response.text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
        raw_text = raw_text.strip()

        parsed = json.loads(raw_text)
        parsed["gemini_available"] = True
        parsed["payload_size_bytes"] = payload_size
        parsed["latency_seconds"] = round(elapsed, 3)

        # Post-Gemini Quality Gate Evaluation
        vis_flags = parsed.get("visual_flags", [])
        field_dict = parsed.get("fields", {})
        avg_field_conf = 0.0
        if field_dict:
            confs = [f.get("visual_confidence", 0.0) for f in field_dict.values()]
            avg_field_conf = sum(confs) / len(confs) if confs else 0.0

        has_obstruction = any(f in vis_flags for f in ["finger_covering_text", "obstruction", "tampering", "severe_glare"])
        has_low_conf = avg_field_conf < 0.50

        if has_obstruction or has_low_conf:
            parsed["post_gemini_quality_warning"] = True
            parsed["post_gemini_warning_message"] = "Post-Gemini Quality Warning: Label appears obscured or finger is covering mandatory declarations. Recommend retaking photo."
        else:
            parsed["post_gemini_quality_warning"] = False
            parsed["post_gemini_warning_message"] = ""

        if parsed.get("gemini_available") and any(f.get("extracted_text") and f.get("extracted_text") != "Not found" for f in field_dict.values()):
            _gemini_engine_cache[img_hash] = parsed
        return parsed
    except Exception as parse_err:
        _metrics_log["errors"] += 1
        logger.error(f"Failed to parse Gemini response JSON: {parse_err}")
        return {
            "gemini_available": False,
            "error": f"JSON parse error: {str(parse_err)}",
            "visual_flags": ["json_parse_error"],
            "fields": {}
        }
