from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

class FieldResultModel(BaseModel):
    rule_id: str
    field_key: str
    label: str
    rule_name: Optional[str] = None
    mandatory: bool = True
    legal_reference: Optional[str] = None
    status: str # PASS, FAIL, NEEDS_HUMAN_REVIEW, NOT_APPLICABLE
    confidence: float
    extracted_text: str
    cited_rule_clause: Optional[str] = None
    bbox: Optional[List[int]] = None
    source_panel: Optional[str] = "front"

class VisualComplianceResultModel(BaseModel):
    placement_compliant: bool
    grouping_compliant: bool
    prominence_compliant: bool
    font_ratio_compliant: bool
    mandatory_symbols_present: bool
    notes: Optional[str] = None
    confidence: float = 0.85

class InspectionRecordModel(BaseModel):
    id: str
    shop_name: str
    location: Optional[str] = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy: Optional[float] = None
    category: str = "Packaged Food"
    net_quantity: Optional[str] = ""
    is_institutional: Optional[bool] = False
    is_exempt: Optional[bool] = False
    exemption_reason: Optional[str] = ""
    timestamp: str = Field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    overall_status: str # PASS, FAIL, NEEDS_HUMAN_REVIEW, EXEMPT
    ocr_available: bool = True
    ai_service_status: str = "HEALTHY" # HEALTHY or AI_SERVICE_UNAVAILABLE
    officer_notes: Optional[str] = ""
    image_paths: List[str] = []
    fields: List[FieldResultModel] = []
    visual_compliance: Optional[VisualComplianceResultModel] = None
    barcode_gtin: Optional[str] = None
    mrp_mismatch_flag: Optional[bool] = False
    rectification_remark: Optional[str] = None

class OverrideRequest(BaseModel):
    field_key: str
    override_status: str
    override_note: str
    officer_notes: Optional[str] = None

class RectificationRequest(BaseModel):
    inspection_id: str
    remark: str
