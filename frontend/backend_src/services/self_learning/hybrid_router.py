import logging
from typing import Dict, Any
from .feedback_collector import save_scan_training_sample, get_dataset_stats
from .train_local_model import get_local_model_state
from .local_ocr_engine import run_local_ocr_extraction
from ..gemini_engine import analyze_label

logger = logging.getLogger(__name__)

async def route_label_analysis(
    image_bytes: bytes,
    category: str = "Packaged Food",
    panel: str = "panel",
    inspection_id: str = "INSP-LIVE"
) -> Dict[str, Any]:
    """
    Hybrid Self-Learning Model Router:
    1. Uses Gemini Vision API while saving training pairs to backend/data/training_dataset/.
    2. Once local model accuracy passes >90% or offline mode is forced, routes directly to local engine!
    """
    model_state = get_local_model_state()
    use_local_primary = model_state.get("primary_engine_ready", False)

    if use_local_primary:
        logger.info("Hybrid Router: Routing to Locally Trained Vision Engine (Primary Engine Ready).")
        analysis = run_local_ocr_extraction(image_bytes, category)
    else:
        logger.info("Hybrid Router: Routing to Gemini Multimodal Engine (Collecting Training Dataset).")
        analysis = await analyze_label(image_bytes, category=category, panel=panel)

    # Save training pair into self-learning dataset store
    if analysis.get("fields"):
        fields_list = []
        for fk, fval in analysis.get("fields", {}).items():
            fields_list.append({
                "field_key": fk,
                "extracted_text": fval.get("extracted_text", ""),
                "status": "PASS" if fval.get("present") else "FAIL",
                "confidence": fval.get("visual_confidence", 0.90)
            })
        save_scan_training_sample(
            image_bytes=image_bytes,
            inspection_id=inspection_id,
            extracted_fields=fields_list,
            category=category,
            source_panel=panel
        )

    return analysis
