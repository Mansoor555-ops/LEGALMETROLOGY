from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from ...db.mongo import get_inspections, get_inspection_by_id, get_violations, get_database
from ...services.report_generator import generate_pdf_report
from ...services.gemini_engine import get_metrics

router = APIRouter(tags=["Reports & Debug"])

@router.get("/api/inspections/{insp_id}/pdf")
async def download_pdf_endpoint(insp_id: str):
    insp = await get_inspection_by_id(insp_id)
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection record not found")

    pdf_path = generate_pdf_report(insp)
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"Legal_Metrology_Inspection_{insp_id}.pdf"
    )

@router.get("/reports/list")
async def list_reports_endpoint(limit: int = Query(50, ge=1, le=200)):
    inspections_list = await get_inspections(limit=limit)
    return {
        "total_reports": len(inspections_list),
        "reports": inspections_list
    }

@router.get("/violations/details")
async def get_violations_details_endpoint(limit: int = Query(50, ge=1, le=200)):
    violations_list = await get_violations(limit=limit)
    return {
        "total_violations": len(violations_list),
        "violations": violations_list
    }

@router.get("/products/lookup/{gtin}")
async def lookup_product_endpoint(gtin: str):
    db = get_database()
    if db is not None:
        try:
            prod = await db.products.find_one({"barcode": gtin}, {"_id": 0})
            if prod:
                return prod
        except Exception:
            pass
    return {
        "barcode": gtin,
        "found": False,
        "message": f"Product with GTIN {gtin} not found in master catalog."
    }

@router.get("/api/debug/stats")
async def get_debug_metrics_endpoint():
    """
    Cost & Latency Guardrails Debug Endpoint:
    Logs per-inspection Gemini call count, total payload bytes, average latency, and error counts.
    """
    metrics = get_metrics()
    return {
        "status": "healthy",
        "gemini_guardrails": metrics
    }
