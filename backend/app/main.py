import os
import shutil
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from .database import (
    init_db,
    save_inspection,
    get_inspections,
    get_inspection_by_id,
    update_manual_override,
    update_rectification_remark,
    get_dashboard_stats
)
from .quality import check_image_quality
from .yolo_detector import crop_label_region
from .ocr_engine import extract_text_from_image
from .extractor import evaluate_exemption, evaluate_rules_for_panel, load_rules, load_panel_expectations
from .merger import merge_multi_panel_results
from .pdf_generator import generate_pdf_report

app = FastAPI(
    title="Legal Metrology Compliance Assistant API",
    description="Backend API for Legal Metrology (Packaged Commodities) Rules 2011 compliance checking",
    version="1.0.0"
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup upload directory & static mount
UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

@app.on_event("startup")
def startup_event():
    init_db()

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/api/rules")
def get_rules_endpoint():
    return load_rules()

@app.get("/api/config/panel-expectations")
def get_panel_expectations_endpoint():
    return load_panel_expectations()

@app.post("/api/inspect/live-check")
async def live_check_endpoint(
    image: UploadFile = File(...),
    panel: str = Form("front"),
    category: Optional[str] = Form("Packaged Food")
):
    """
    Fast live-check pass for the camera viewfinder UX polling loop.
    Downscaled JPEG (~800px) is sent every ~1.5 seconds.
    Note: The FINAL high-quality OCR pass still runs once on the captured full-resolution
    image after capture, regardless of what the live-check loop found — the live check is a UX guide.
    """
    if not image or not image.filename:
        raise HTTPException(status_code=400, detail="Image file required")
    
    file_bytes = await image.read()
    
    # 1. Quality Check
    q_res = check_image_quality(file_bytes)
    if not q_res["passed"]:
        return {
            "quality_passed": False,
            "quality_message": q_res["message"],
            "panel": panel,
            "detected_fields": [],
            "all_expected_detected": False,
            "expected_fields": load_panel_expectations().get(panel.lower(), ["mrp", "net_quantity", "generic_name"])
        }

    # 2. Fast OCR pass
    from .ocr_engine import extract_structured_field_regions
    ocr_region_map = extract_structured_field_regions(file_bytes)
    
    combined_lines = []
    combined_full_text = []
    for reg_name, ocr_res in ocr_region_map.items():
        combined_lines.extend(ocr_res.get("lines", []))
        if ocr_res.get("full_text"):
            combined_full_text.append(ocr_res["full_text"])

    fast_ocr_res = {
        "full_text": " ".join(combined_full_text),
        "lines": combined_lines,
        "avg_confidence": 0.90 if combined_lines else 0.0
    }

    # 3. Rule evaluation for panel
    evaluated_fields = evaluate_rules_for_panel(fast_ocr_res, category or "Packaged Food", panel.lower())
    
    # Map expected fields
    panel_expectations_map = load_panel_expectations()
    expected_keys = panel_expectations_map.get(panel.lower(), ["mrp", "net_quantity", "generic_name"])
    
    detected_fields = []
    detected_keys_set = set()
    
    label_map = {
        "mrp": "Maximum Retail Price",
        "net_quantity": "Net Quantity",
        "generic_name": "Common/Generic Name",
        "manufacturer_name_address": "Manufacturer Name & Address",
        "mfg_date": "Month & Year of Mfg",
        "consumer_care": "Consumer Care Details",
        "country_of_origin": "Country of Origin"
    }

    for f in evaluated_fields:
        key = f.get("field_key")
        extracted_text = f.get("extracted_text", "")
        status = f.get("status", "FAIL")
        conf = f.get("confidence", 0.0)
        
        is_detected = (status == "PASS") or (extracted_text and "Not detected" not in extracted_text and "Not found" not in extracted_text and conf >= 0.4)
        
        if key in expected_keys:
            if is_detected:
                detected_keys_set.add(key)
            detected_fields.append({
                "field_key": key,
                "label": label_map.get(key, f.get("rule_name", key)),
                "detected": is_detected,
                "confidence": round(conf * 100) if is_detected else 0,
                "extracted_text": extracted_text if is_detected else ""
            })
            
    # Add any expected field that wasn't in evaluated_fields
    for exp_key in expected_keys:
        if not any(df["field_key"] == exp_key for df in detected_fields):
            detected_fields.append({
                "field_key": exp_key,
                "label": label_map.get(exp_key, exp_key),
                "detected": False,
                "confidence": 0,
                "extracted_text": ""
            })

    all_expected_detected = all(k in detected_keys_set for k in expected_keys)

    return {
        "quality_passed": True,
        "quality_message": "Image quality passed",
        "panel": panel,
        "detected_fields": detected_fields,
        "all_expected_detected": all_expected_detected,
        "expected_fields": expected_keys
    }

@app.get("/api/barcode/lookup/{code}")
def barcode_lookup_endpoint(code: str):
    from .database import lookup_barcode
    res = lookup_barcode(code)
    if res:
        return {"found": True, "product": res}
    return {"found": False, "message": f"Barcode {code} not registered in database, manual entry required."}

class OverrideRequest(BaseModel):
    field_key: str
    override_status: str # PASS or FAIL
    override_note: str
    officer_notes: Optional[str] = None

class RectificationRequest(BaseModel):
    inspection_id: str
    remark: str

@app.post("/api/inspect")
async def create_inspection(
    shop_name: str = Form(""),
    location: str = Form(""),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    accuracy: Optional[float] = Form(None),
    category: str = Form("Packaged Food"),
    net_quantity: Optional[str] = Form(""),
    is_institutional: Optional[bool] = Form(False),
    barcode_code: Optional[str] = Form(None),
    front_image: Optional[UploadFile] = File(None),
    back_image: Optional[UploadFile] = File(None),
    neck_image: Optional[UploadFile] = File(None),
    barcode_image: Optional[UploadFile] = File(None),
    images: Optional[List[UploadFile]] = File(None)
):
    # 1. Exemption Pre-check
    is_exempt_flag, exemption_reason = evaluate_exemption(net_quantity or "", is_institutional or False)

    # Collect all uploaded photo files
    all_files = []
    if images:
        all_files.extend([f for f in images if f and f.filename])
    if front_image and front_image.filename and front_image not in all_files:
        all_files.append(front_image)
    if back_image and back_image.filename and back_image not in all_files:
        all_files.append(back_image)
    if neck_image and neck_image.filename and neck_image not in all_files:
        all_files.append(neck_image)
    if barcode_image and barcode_image.filename and barcode_image not in all_files:
        all_files.append(barcode_image)

    saved_image_paths = []
    panel_results_map = {}
    quality_warnings = []

    # Generate unique Inspection ID
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    insp_id = f"INSP-{datetime.now().strftime('%Y')}-{timestamp_str[-6:]}"

    if not is_exempt_flag and all_files:
        for idx, file_obj in enumerate(all_files):
            panel_name = f"photo_{idx+1}"
            file_bytes = await file_obj.read()
            
            # Quality Check
            q_res = check_image_quality(file_bytes)
            if not q_res["passed"]:
                quality_warnings.append(f"Photo #{idx+1} warning: {q_res['message']}")

            # Save raw image
            ext = file_obj.filename.split(".")[-1] if "." in file_obj.filename else "jpg"
            filename = f"{insp_id}_photo_{idx+1}.{ext}"
            filepath = os.path.join(UPLOADS_DIR, filename)
            with open(filepath, "wb") as f:
                f.write(file_bytes)
            saved_image_paths.append(f"/uploads/{filename}")

            # YOLOv8 region detection & crop
            cropped_bytes, yolo_meta = crop_label_region(file_bytes)

            # Detection-First Stage 2 & 3: Isolated per-region OCR
            from .ocr_engine import extract_structured_field_regions
            ocr_region_map = extract_structured_field_regions(file_bytes)

            # Combine regional OCR results for field extraction
            combined_lines = []
            combined_full_text = []
            for reg_name, ocr_res in ocr_region_map.items():
                combined_lines.extend(ocr_res.get("lines", []))
                if ocr_res.get("full_text"):
                    combined_full_text.append(ocr_res["full_text"])

            ocr_res = {
                "full_text": " ".join(combined_full_text),
                "lines": combined_lines,
                "avg_confidence": 0.90 if combined_lines else 0.0
            }

            # Rule extraction
            panel_fields = evaluate_rules_for_panel(ocr_res, category, panel_name)
            panel_results_map[panel_name] = panel_fields

        # Merge fields across all uploaded photos
        merged_fields, overall_status = merge_multi_panel_results(panel_results_map)

        # Extract detected company name for auto-fill
        mfg_field = next((f for f in merged_fields if f["field_key"] == "manufacturer_name_address"), None)
        detected_company = mfg_field["extracted_text"] if (mfg_field and mfg_field.get("extracted_text") and "Not found" not in mfg_field["extracted_text"]) else ""

        final_shop_name = shop_name.strip() if (shop_name and shop_name.strip()) else (f"{detected_company}" if detected_company else "Enforcement Field Site")
    else:
        merged_fields = []
        overall_status = "EXEMPT" if is_exempt_flag else "FAIL"
        final_shop_name = shop_name.strip() or "Enforcement Field Site"

    inspection_record = {
        "id": insp_id,
        "shop_name": final_shop_name,
        "location": location,
        "latitude": latitude,
        "longitude": longitude,
        "accuracy": accuracy,
        "category": category,
        "net_quantity": net_quantity,
        "is_institutional": is_institutional,
        "is_exempt": is_exempt_flag,
        "exemption_reason": exemption_reason,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "overall_status": overall_status,
        "officer_notes": f"Inspection recorded via Enforcement Assistant app. GPS Accuracy: ±{accuracy:.1f}m. Quality warnings: {'; '.join(quality_warnings)}" if (quality_warnings or accuracy) else "Initial inspection submitted.",
        "image_paths": saved_image_paths,
        "fields": merged_fields
    }

    # Save to Database
    save_inspection(inspection_record)
    
    return {
        "success": True,
        "inspection": inspection_record,
        "quality_warnings": quality_warnings
    }

@app.get("/api/inspections")
def list_inspections_endpoint(limit: int = 50):
    return get_inspections(limit)

@app.get("/api/inspections/{insp_id}")
def get_inspection_endpoint(insp_id: str):
    insp = get_inspection_by_id(insp_id)
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection record not found")
    return insp

@app.post("/api/inspections/{insp_id}/override")
def override_field_endpoint(insp_id: str, req: OverrideRequest):
    success = update_manual_override(
        insp_id=insp_id,
        field_key=req.field_key,
        override_status=req.override_status,
        override_note=req.override_note,
        officer_notes=req.officer_notes
    )
    if not success:
        raise HTTPException(status_code=400, detail="Failed to update override")
    
    updated_insp = get_inspection_by_id(insp_id)
    return {"success": True, "inspection": updated_insp}

@app.get("/api/inspections/{insp_id}/pdf")
def download_pdf_endpoint(insp_id: str):
    insp = get_inspection_by_id(insp_id)
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    pdf_path = generate_pdf_report(insp)
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"Legal_Metrology_Inspection_{insp_id}.pdf"
    )

@app.get("/api/dashboard-stats")
def dashboard_stats_endpoint():
    return get_dashboard_stats()

@app.post("/api/manufacturer/rectify")
def rectify_remark_endpoint(req: RectificationRequest):
    success = update_rectification_remark(req.inspection_id, req.remark)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to submit rectification remark")
    return {"success": True, "message": "Rectification remark submitted successfully"}
