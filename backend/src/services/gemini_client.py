import logging
from typing import Dict, Any
from .gemini_engine import analyze_label, get_metrics, configure_gemini

logger = logging.getLogger(__name__)

async def run_visual_compliance_check(image_bytes: bytes) -> Dict[str, Any]:
    """
    Adapter delegating to gemini_engine.analyze_label for visual compliance.
    """
    analysis = await analyze_label(image_bytes)
    if not analysis.get("gemini_available", True):
        return {
            "status": "AI_SERVICE_UNAVAILABLE",
            "error": analysis.get("error", "Gemini API unavailable"),
            "placement_compliant": True,
            "grouping_compliant": True,
            "prominence_compliant": True,
            "font_ratio_compliant": True,
            "mandatory_symbols_present": True,
            "notes": "Gemini API unavailable fallback.",
            "confidence": 0.50
        }
    
    vis = analysis.get("visual_compliance", {})
    vis["status"] = "HEALTHY"
    return vis

async def run_structured_extraction(image_bytes: bytes) -> Dict[str, Any]:
    """
    Adapter delegating to gemini_engine.analyze_label for structured extractions.
    """
    analysis = await analyze_label(image_bytes)
    if not analysis.get("gemini_available", True):
        return {
            "status": "AI_SERVICE_UNAVAILABLE",
            "error": analysis.get("error", "Gemini API unavailable"),
            "fields": {},
            "lines": [],
            "full_text": ""
        }
    
    return {
        "status": "HEALTHY",
        "full_text": analysis.get("full_text", ""),
        "fields": analysis.get("fields", {}),
        "visual_flags": analysis.get("visual_flags", [])
    }
