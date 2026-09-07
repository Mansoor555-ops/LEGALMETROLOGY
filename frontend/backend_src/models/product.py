from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

class MRPDeclarationEntry(BaseModel):
    mrp: float
    mrp_text: str
    seller_location: str
    timestamp: str = Field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    inspection_id: str

class ProductMasterModel(BaseModel):
    gtin: str
    barcode: str
    product_name: str
    category: str = "Packaged Food"
    manufacturer_name: Optional[str] = ""
    declared_mrps: List[MRPDeclarationEntry] = []
    has_mrp_mismatch: bool = False
    mrp_variation_range: Optional[str] = None
    last_scanned: str = Field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
