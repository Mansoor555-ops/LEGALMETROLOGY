import re
import logging
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
from ..db.mongo import get_database

logger = logging.getLogger(__name__)

# Fallback in-memory master store for offline/unconnected dev mode
_memory_product_master: Dict[str, Dict[str, Any]] = {}

async def register_or_update_product_mrp(
    barcode: str,
    product_name: str,
    mrp_text: str,
    seller_location: str,
    inspection_id: str,
    category: str = "Packaged Food"
) -> Tuple[bool, Optional[str]]:
    """
    Part F: Barcode/GTIN-Linked Product Master Logic.
    Detects if the exact same GTIN is declared at different MRPs across sellers/locations.
    Returns: (has_mrp_mismatch, variation_summary_message)
    """
    if not barcode or barcode.strip() == "":
        return False, None

    gtin = barcode.strip()
    
    # Extract numerical price from mrp_text
    mrp_match = re.search(r"(\d+(\.\d{1,2})?)", mrp_text)
    numeric_mrp = float(mrp_match.group(1)) if mrp_match else 0.0

    if numeric_mrp <= 0:
        return False, None

    new_mrp_entry = {
        "mrp": numeric_mrp,
        "mrp_text": mrp_text,
        "seller_location": seller_location or "Field Inspection Site",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "inspection_id": inspection_id
    }

    db = get_database()
    product_record = None

    if db is not None:
        try:
            product_record = await db.products.find_one({"barcode": gtin})
        except Exception as e:
            logger.warning(f"MongoDB product lookup note: {e}")

    if product_record is None and gtin in _memory_product_master:
        product_record = _memory_product_master[gtin]

    has_mrp_mismatch = False
    variation_summary = None

    if product_record:
        existing_mrps = product_record.get("declared_mrps", [])
        existing_mrps.append(new_mrp_entry)

        # Check for price discrepancies across recorded locations
        mrp_values = [entry["mrp"] for entry in existing_mrps if entry.get("mrp", 0) > 0]
        min_mrp = min(mrp_values)
        max_mrp = max(mrp_values)

        if (max_mrp - min_mrp) > 0.05 * min_mrp:
            has_mrp_mismatch = True
            variation_summary = f"MRP Discrepancy Detected! Price varies from ₹{min_mrp:.2f} to ₹{max_mrp:.2f} across sellers/locations."

        updated_data = {
            "gtin": gtin,
            "barcode": gtin,
            "product_name": product_name or product_record.get("product_name", f"Product #{gtin}"),
            "category": category,
            "declared_mrps": existing_mrps,
            "has_mrp_mismatch": has_mrp_mismatch,
            "mrp_variation_range": f"₹{min_mrp:.2f} - ₹{max_mrp:.2f}" if has_mrp_mismatch else f"₹{numeric_mrp:.2f}",
            "last_scanned": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        if db is not None:
            try:
                await db.products.update_one({"barcode": gtin}, {"$set": updated_data}, upsert=True)
            except Exception as e:
                logger.warning(f"MongoDB product update note: {e}")
        _memory_product_master[gtin] = updated_data
    else:
        initial_data = {
            "gtin": gtin,
            "barcode": gtin,
            "product_name": product_name or f"Product #{gtin}",
            "category": category,
            "declared_mrps": [new_mrp_entry],
            "has_mrp_mismatch": False,
            "mrp_variation_range": f"₹{numeric_mrp:.2f}",
            "last_scanned": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        if db is not None:
            try:
                await db.products.insert_one(initial_data)
            except Exception as e:
                logger.warning(f"MongoDB product insert note: {e}")
        _memory_product_master[gtin] = initial_data

    return has_mrp_mismatch, variation_summary

async def get_product_by_gtin(gtin: str) -> Optional[Dict[str, Any]]:
    db = get_database()
    if db is not None:
        try:
            prod = await db.products.find_one({"barcode": gtin}, {"_id": 0})
            if prod:
                return prod
        except Exception:
            pass
    return _memory_product_master.get(gtin)

async def list_all_products_master() -> list:
    db = get_database()
    if db is not None:
        try:
            cursor = db.products.find({}, {"_id": 0})
            return await cursor.to_list(length=100)
        except Exception:
            pass
    return list(_memory_product_master.values())
