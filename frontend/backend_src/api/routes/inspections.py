import os
import asyncio
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Body
from ...config import settings
from ...db.mongo import save_inspection, get_inspection_by_id, get_inspections, save_correction
from ...services.gemini_engine import analyze_label
from ...services.rule_engine.merge import merge_hybrid_rule_evaluation
from ...services.product_master import register_or_update_product_mrp
from ...models.inspection import OverrideRequest, RectificationRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Inspections"])

@router.post("/inspect")
async def create_inspection_endpoint(
    shop_name: str = Form(""),
    location: str = Form(""),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    accuracy: Optional[float] = Form(None),
    category: str = Form("Packaged Food"),
    net_quantity: Optional[str] = Form(""),
    is_institutional: Optional[bool] = Form(False),
    barcode_code: Optional[str] = Form(None),
    images: Optional[List[UploadFile]] = File(None),
    front_image: Optional[UploadFile] = File(None),
    back_image: Optional[UploadFile] = File(None)
):
    """
    Main Inspection Ingest API Endpoint:
    Processes multimodal Gemini Dual Engine (Extractions + Visual Layout),
    Hybrid Rule Engine (Deterministic + FAISS RAG LLM Judge), GTIN MRP tracking, and MongoDB storage.
    """
    all_files = []
    if images:
        all_files.extend([f for f in images if f and f.filename])
    if front_image and front_image.filename and front_image not in all_files:
        all_files.append(front_image)
    if back_image and back_image.filename and back_image not in all_files:
        all_files.append(back_image)

    saved_image_paths = []
    quality_warnings = []
    
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    insp_id = f"INSP-{datetime.now().strftime('%Y')}-{timestamp_str[-6:]}"

    panel_fields_map = {}
    visual_compliance_res = None
    ai_service_status = "HEALTHY"
    raw_gemini_responses = []

    if all_files:
        for idx, file_obj in enumerate(all_files):
            panel_name = f"photo_{idx+1}"
            file_bytes = await file_obj.read()
            
            # Save upload image
            ext = file_obj.filename.split(".")[-1] if "." in file_obj.filename else "jpg"
            filename = f"{insp_id}_photo_{idx+1}.{ext}"
            filepath = os.path.join(settings.UPLOADS_DIR, filename)
            with open(filepath, "wb") as f:
                f.write(file_bytes)
            saved_image_paths.append(f"/uploads/{filename}")

            # PART 1: Free OpenCV Pre-Check Gate & Automatic Barcode Decoding
            from ...services.quality import evaluate_image_quality
            from ...services.barcode_lookup import decode_barcode_from_image
            precheck = evaluate_image_quality(file_bytes)
            if not precheck["quality_passed"]:
                quality_warnings.append(f"Pre-Check Warning ({panel_name}): {precheck['message']}")

            decoded_barcode = decode_barcode_from_image(file_bytes)
            if decoded_barcode and not barcode_code:
                barcode_code = decoded_barcode

            # PART 2: Hybrid Self-Learning Model Router (Gemini + Local Dataset Auto-Save)
            from ...services.self_learning.hybrid_router import route_label_analysis
            gemini_analysis = await route_label_analysis(file_bytes, category=category, panel=panel_name, inspection_id=insp_id)
            raw_gemini_responses.append(gemini_analysis)

            if gemini_analysis.get("post_gemini_quality_warning"):
                quality_warnings.append(f"Post-Analysis Warning ({panel_name}): {gemini_analysis.get('post_gemini_warning_message')}")

            if not gemini_analysis.get("gemini_available", True):
                ai_service_status = "AI_SERVICE_UNAVAILABLE"

            vis_res = gemini_analysis.get("visual_compliance", {})
            visual_compliance_res = vis_res

            # Hybrid Rule Engine Evaluation (Deterministic + RAG LLM Judge)
            hybrid_eval = await merge_hybrid_rule_evaluation(gemini_analysis, vis_res, category, panel_name)
            panel_fields_map[panel_name] = hybrid_eval.get("fields", [])

    # Smart Multi-Panel Field Merging: Prioritize valid extractions across all uploaded label photos
    best_field_map = {}
    for panel_name, fields_list in panel_fields_map.items():
        for f in fields_list:
            key = f.get("field_key")
            if not key:
                continue

            text = (f.get("extracted_text") or "").strip()
            status = f.get("status", "FAIL")
            is_valid = status in ["PASS", "NEEDS_CONTEXT"] and text != "" and text.lower() != "not found"

            if key not in best_field_map:
                best_field_map[key] = f
            else:
                existing = best_field_map[key]
                existing_text = (existing.get("extracted_text") or "").strip()
                existing_status = existing.get("status", "FAIL")
                existing_valid = existing_status in ["PASS", "NEEDS_CONTEXT"] and existing_text != "" and existing_text.lower() != "not found"

                # If current panel has valid extraction and existing does not, overwrite with valid extraction
                if is_valid and not existing_valid:
                    best_field_map[key] = f
                elif is_valid and existing_valid:
                    # If current is PASS and existing was only NEEDS_CONTEXT, upgrade to PASS
                    if status == "PASS" and existing_status != "PASS":
                        best_field_map[key] = f
                    elif f.get("confidence", 0) > existing.get("confidence", 0):
                        best_field_map[key] = f

    merged_fields = list(best_field_map.values())

    # Overall Inspection Status
    statuses = [f["status"] for f in merged_fields]
    if any(s == "FAIL" for s in statuses):
        overall_status = "FAIL"
    elif any(s == "NEEDS_HUMAN_REVIEW" for s in statuses):
        overall_status = "NEEDS_HUMAN_REVIEW"
    elif len(statuses) > 0 and all(s in ["PASS", "NOT_APPLICABLE"] for s in statuses):
        overall_status = "PASS"
    else:
        overall_status = "NEEDS_HUMAN_REVIEW"

    # GTIN Product Lookup & Cross-Seller MRP Inconsistency Audit (Rule 18)
    gtin_code = barcode_code or ""

    # Automatic Barcode/GTIN Extraction from uploaded images (Gemini + OpenCV)
    if not gtin_code:
        for panel_name, fields_list in panel_fields_map.items():
            gtin_f = next((f for f in fields_list if f.get("field_key") == "barcode_gtin"), None)
            if gtin_f and gtin_f.get("extracted_text") and gtin_f.get("extracted_text") != "Not found":
                import re
                clean = re.sub(r"\D", "", gtin_f["extracted_text"])
                if len(clean) in [8, 12, 13, 14]:
                    gtin_code = clean
                    break
    product_details = {
        "barcode": gtin_code if gtin_code else "NOT_SCANNED",
        "product_name": "General Packaged Commodity",
        "brand_company": "Unregistered / Custom Brand",
        "category": category,
        "source": "Field Inspection Entry"
    }

    if gtin_code:
        from ...services.barcode_lookup import lookup_external_gtin
        from ...services.product_master import get_product_by_gtin
        local_prod = await get_product_by_gtin(gtin_code)
        if local_prod:
            product_details["product_name"] = local_prod.get("product_name") or local_prod.get("brand") or f"Product #{gtin_code}"
            product_details["brand_company"] = local_prod.get("brand") or local_prod.get("manufacturer") or "Registered Brand"
            product_details["source"] = "Local_Product_Master"
        else:
            ext_res = lookup_external_gtin(gtin_code)
            if ext_res.get("found") and ext_res.get("product"):
                ext_p = ext_res["product"]
                product_details["product_name"] = ext_p.get("product_name") or ext_p.get("brand") or f"Product #{gtin_code}"
                product_details["brand_company"] = ext_p.get("brand") or ext_p.get("manufacturer") or "Registered Manufacturer"
                product_details["source"] = ext_res.get("source", "OpenFoodFacts_GTIN_Registry")

    mrp_mismatch_flag = False
    mrp_field = next((f for f in merged_fields if f["field_key"] == "mrp"), None)
    
    if gtin_code and mrp_field and mrp_field.get("extracted_text"):
        mrp_mismatch_flag, var_msg = await register_or_update_product_mrp(
            barcode=gtin_code,
            product_name=product_details["product_name"],
            mrp_text=mrp_field["extracted_text"],
            seller_location=location or shop_name,
            inspection_id=insp_id,
            category=category
        )
        if mrp_mismatch_flag and var_msg:
            quality_warnings.append(var_msg)

    acc_str = f"±{accuracy:.1f}m" if accuracy is not None else "N/A"
    inspection_record = {
        "id": insp_id,
        "shop_name": shop_name.strip() or "Enforcement Field Site",
        "location": location,
        "latitude": latitude,
        "longitude": longitude,
        "accuracy": accuracy,
        "category": category,
        "net_quantity": net_quantity,
        "is_institutional": is_institutional,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "overall_status": overall_status,
        "ai_service_status": ai_service_status,
        "officer_notes": f"Inspection recorded via Assistant app. GPS Accuracy: {acc_str}. Warnings: {'; '.join(quality_warnings)}" if quality_warnings else "Inspection submitted.",
        "image_paths": saved_image_paths,
        "fields": merged_fields,
        "visual_compliance": visual_compliance_res,
        "barcode_gtin": gtin_code,
        "product_details": product_details,
        "mrp_mismatch_flag": mrp_mismatch_flag,
        "raw_gemini_output": raw_gemini_responses
    }

    # Save to MongoDB
    await save_inspection(inspection_record)

    return {
        "success": True,
        "inspection": inspection_record,
        "quality_warnings": quality_warnings
    }

@router.get("/inspections")
async def list_inspections_endpoint(limit: int = 50):
    inspections_list = await get_inspections(limit=limit)
    return {"inspections": inspections_list}

@router.get("/inspections/{inspection_id}")
async def get_inspection_endpoint(inspection_id: str):
    inspection = await get_inspection_by_id(inspection_id)
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return inspection

@router.post("/inspections/{inspection_id}/override")
async def submit_officer_override_endpoint(inspection_id: str, request: OverrideRequest):
    """
    Officer Feedback Loop Endpoint:
    Stores officer field corrections alongside original Gemini extractions and deterministic verdicts.
    NOTE: Feedback corrections are stored in the 'corrections' collection and re-injected as
    few-shot prompt context / RAG documents. This is NOT literal model fine-tuning.
    """
    inspection = await get_inspection_by_id(inspection_id)
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection record not found")

    correction_doc = {
        "correction_id": f"CORR-{inspection_id}-{request.field_key}",
        "inspection_id": inspection_id,
        "field_key": request.field_key,
        "original_extracted_text": request.original_text,
        "officer_corrected_text": request.corrected_text,
        "officer_notes": request.officer_notes,
        "new_status": request.new_status,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "raw_gemini_output": inspection.get("raw_gemini_output", []),
        "reinjection_type": "few_shot_prompt_context"
    }

    await save_correction(correction_doc)
    logger.info(f"Officer correction persisted for inspection {inspection_id}, field {request.field_key}")

    # Update Self-Learning Dataset Ground Truth with Officer Correction
    from ...services.self_learning.feedback_collector import update_ground_truth_from_officer_override
    update_ground_truth_from_officer_override(inspection_id, request.field_key, request.corrected_text, request.new_status)

    return {
        "success": True,
        "message": f"Officer correction for field '{request.field_key}' saved to self-learning feedback loop.",
        "correction": correction_doc
    }

@router.get("/model/stats")
async def get_self_learning_stats_endpoint():
    from ...services.self_learning.feedback_collector import get_dataset_stats
    from ...services.self_learning.train_local_model import get_local_model_state
    return {
        "success": True,
        "dataset_stats": get_dataset_stats(),
        "local_model_state": get_local_model_state()
    }

@router.post("/model/train")
async def train_self_learning_model_endpoint():
    from ...services.self_learning.train_local_model import train_and_fine_tune_local_model
    res = train_and_fine_tune_local_model()
    return res
