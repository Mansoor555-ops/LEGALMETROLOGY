import sqlite3
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "legal_metrology.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create inspections table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inspections (
        id TEXT PRIMARY KEY,
        shop_name TEXT NOT NULL,
        location TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        accuracy REAL,
        category TEXT NOT NULL,
        net_quantity TEXT,
        is_institutional INTEGER DEFAULT 0,
        is_exempt INTEGER DEFAULT 0,
        exemption_reason TEXT,
        timestamp TEXT NOT NULL,
        overall_status TEXT NOT NULL,
        officer_notes TEXT,
        rectification_remark TEXT,
        image_paths TEXT
    )
    """)

    # Create barcodes table for quick GTIN/EAN product lookup
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS barcodes (
        code TEXT PRIMARY KEY,
        product_name TEXT NOT NULL,
        brand TEXT NOT NULL,
        category TEXT NOT NULL,
        net_quantity TEXT NOT NULL,
        manufacturer TEXT NOT NULL
    )
    """)
    
    # Seed sample GTIN/EAN barcodes if empty
    cursor.execute("SELECT COUNT(*) FROM barcodes")
    if cursor.fetchone()[0] == 0:
        seed_barcodes(conn)
    
    # Create inspection_fields table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inspection_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inspection_id TEXT NOT NULL,
        field_key TEXT NOT NULL,
        rule_id TEXT NOT NULL,
        label TEXT NOT NULL,
        legal_reference TEXT,
        status TEXT NOT NULL,
        extracted_text TEXT,
        confidence REAL DEFAULT 0.0,
        source_panel TEXT,
        bbox TEXT,
        manual_override INTEGER DEFAULT 0,
        override_status TEXT,
        override_note TEXT,
        FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
    )
    """)
    
    conn.commit()
    
    # Check if empty to insert pre-seeded inspections
    cursor.execute("SELECT COUNT(*) FROM inspections")
    count = cursor.fetchone()[0]
    if count == 0:
        seed_initial_data(conn)
        
    conn.close()

def seed_barcodes(conn):
    cursor = conn.cursor()
    sample_barcodes = [
        ("8901030800012", "Whole Wheat Flour Atta", "PureFoods", "Packaged Food", "500 g", "PureFoods India Pvt Ltd"),
        ("8901234567890", "Organics Face Wash Lotion", "GlowCare", "Cosmetics & Personal Care", "250 ml", "GlowCare Organics Pvt Ltd"),
        ("8909876543210", "Industrial Polymer Resin Sack", "ChemIndustrial", "Industrial Raw Materials", "50 kg", "ChemIndustrial Chemicals Ltd"),
        ("7613032123456", "Dark Chocolate Slab", "Apex Import", "Imported Commodity", "150 g", "Swiss Chocolatier SA / Imp by Apex Trading")
    ]
    for b in sample_barcodes:
        cursor.execute("INSERT OR REPLACE INTO barcodes (code, product_name, brand, category, net_quantity, manufacturer) VALUES (?, ?, ?, ?, ?, ?)", b)
    conn.commit()

def lookup_barcode(code: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM barcodes WHERE code = ?", (code,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def seed_initial_data(conn):
    cursor = conn.cursor()
    
    seeds = [
        {
            "id": "INSP-2026-0901",
            "shop_name": "Metro Mart Pvt Ltd",
            "location": "Connaught Place, New Delhi",
            "category": "Packaged Food",
            "net_quantity": "500 g",
            "is_institutional": 0,
            "is_exempt": 0,
            "exemption_reason": "",
            "timestamp": "2026-09-01 11:30:00",
            "overall_status": "PASS",
            "officer_notes": "All mandatory declarations verified on front and back panels.",
            "rectification_remark": "",
            "image_paths": json.dumps(["/uploads/seed_1_front.jpg", "/uploads/seed_1_back.jpg"]),
            "fields": [
                {"field_key": "mrp", "rule_id": "LM_MRP", "label": "Maximum Retail Price", "legal_reference": "Rule 6(1)(f)", "status": "PASS", "extracted_text": "MRP ₹250.00 (inclusive of all taxes)", "confidence": 0.95, "source_panel": "back"},
                {"field_key": "net_quantity", "rule_id": "LM_NET_QTY", "label": "Net Quantity", "legal_reference": "Rule 6(1)(c)", "status": "PASS", "extracted_text": "Net Qty: 500g", "confidence": 0.92, "source_panel": "front"},
                {"field_key": "mfg_date", "rule_id": "LM_MFG_DATE", "label": "Month & Year of Packing", "legal_reference": "Rule 6(1)(d)", "status": "PASS", "extracted_text": "Mfg Date: 08/2026", "confidence": 0.88, "source_panel": "back"},
                {"field_key": "manufacturer_name_address", "rule_id": "LM_MANUFACTURER", "label": "Manufacturer Details", "legal_reference": "Rule 6(1)(a)", "status": "PASS", "extracted_text": "Manufactured by PureFoods India Pvt Ltd, Plot 42, Okhla Ind Area, New Delhi", "confidence": 0.91, "source_panel": "back"},
                {"field_key": "consumer_care", "rule_id": "LM_CONSUMER_CARE", "label": "Consumer Care Details", "legal_reference": "Rule 6(1)(f)", "status": "PASS", "extracted_text": "Customer Care: 1800-11-2233 email: care@purefoods.in", "confidence": 0.89, "source_panel": "back"},
                {"field_key": "generic_name", "rule_id": "LM_GENERIC_NAME", "label": "Generic Name", "legal_reference": "Rule 6(1)(b)", "status": "PASS", "extracted_text": "Whole Wheat Atta", "confidence": 0.85, "source_panel": "front"},
                {"field_key": "country_of_origin", "rule_id": "LM_COUNTRY_ORIGIN", "label": "Country of Origin", "legal_reference": "Rule 6(1)(a)", "status": "PASS", "extracted_text": "Country of Origin: India", "confidence": 0.94, "source_panel": "back"}
            ]
        },
        {
            "id": "INSP-2026-0902",
            "shop_name": "Royal Supermarket",
            "location": "Indiranagar, Bengaluru",
            "category": "Cosmetics & Beverages",
            "net_quantity": "250 ml",
            "is_institutional": 0,
            "is_exempt": 0,
            "exemption_reason": "",
            "timestamp": "2026-09-03 14:15:00",
            "overall_status": "FAIL",
            "officer_notes": "Violation detected: Consumer care email/number missing and MRP declaration lacks mandatory 'inclusive of all taxes' phrase.",
            "rectification_remark": "We have halted distribution of Batch #882 and updated new packaging layout to include 1800 toll-free and full MRP clause.",
            "image_paths": json.dumps(["/uploads/seed_2_front.jpg", "/uploads/seed_2_back.jpg"]),
            "fields": [
                {"field_key": "mrp", "rule_id": "LM_MRP", "label": "Maximum Retail Price", "legal_reference": "Rule 6(1)(f)", "status": "FAIL", "extracted_text": "MRP Rs 180", "confidence": 0.87, "source_panel": "back"},
                {"field_key": "net_quantity", "rule_id": "LM_NET_QTY", "label": "Net Quantity", "legal_reference": "Rule 6(1)(c)", "status": "PASS", "extracted_text": "250 ml", "confidence": 0.94, "source_panel": "front"},
                {"field_key": "mfg_date", "rule_id": "LM_MFG_DATE", "label": "Month & Year of Packing", "legal_reference": "Rule 6(1)(d)", "status": "PASS", "extracted_text": "Packed: Jul 2026", "confidence": 0.82, "source_panel": "back"},
                {"field_key": "manufacturer_name_address", "rule_id": "LM_MANUFACTURER", "label": "Manufacturer Details", "legal_reference": "Rule 6(1)(a)", "status": "PASS", "extracted_text": "Mfg by GlowCare Organics, Peenya Stage 2, Bengaluru", "confidence": 0.90, "source_panel": "back"},
                {"field_key": "consumer_care", "rule_id": "LM_CONSUMER_CARE", "label": "Consumer Care Details", "legal_reference": "Rule 6(1)(f)", "status": "FAIL", "extracted_text": "Contact Manager", "confidence": 0.45, "source_panel": "back"},
                {"field_key": "generic_name", "rule_id": "LM_GENERIC_NAME", "label": "Generic Name", "legal_reference": "Rule 6(1)(b)", "status": "NEEDS_HUMAN_REVIEW", "extracted_text": "Face Wash Lotion", "confidence": 0.58, "source_panel": "front"},
                {"field_key": "country_of_origin", "rule_id": "LM_COUNTRY_ORIGIN", "label": "Country of Origin", "legal_reference": "Rule 6(1)(a)", "status": "PASS", "extracted_text": "Made in India", "confidence": 0.93, "source_panel": "back"}
            ]
        },
        {
            "id": "INSP-2026-0903",
            "shop_name": "Quality Traders & Wholesalers",
            "location": "Bhiwandi, Maharashtra",
            "category": "Industrial Raw Materials",
            "net_quantity": "50 kg",
            "is_institutional": 1,
            "is_exempt": 1,
            "exemption_reason": "Exempt under Rule 3: Net quantity > 25kg & marked for Institutional/Industrial consumption.",
            "timestamp": "2026-09-04 09:45:00",
            "overall_status": "EXEMPT",
            "officer_notes": "Industrial bulk sack inspected. Verified non-retail institutional consumption documentation.",
            "rectification_remark": "",
            "image_paths": json.dumps(["/uploads/seed_3_sack.jpg"]),
            "fields": []
        },
        {
            "id": "INSP-2026-0904",
            "shop_name": "Apex General Stores",
            "location": "Park Street, Kolkata",
            "category": "Imported Confectionery",
            "net_quantity": "150 g",
            "is_institutional": 0,
            "is_exempt": 0,
            "exemption_reason": "",
            "timestamp": "2026-09-04 16:20:00",
            "overall_status": "NEEDS_HUMAN_REVIEW",
            "officer_notes": "Importer declaration label partially smudge-damaged during transit; routed for manual officer verification.",
            "rectification_remark": "",
            "image_paths": json.dumps(["/uploads/seed_4_front.jpg", "/uploads/seed_4_sticker.jpg"]),
            "fields": [
                {"field_key": "mrp", "rule_id": "LM_MRP", "label": "Maximum Retail Price", "legal_reference": "Rule 6(1)(f)", "status": "PASS", "extracted_text": "MRP Rs. 350.00 incl. of all taxes", "confidence": 0.91, "source_panel": "back"},
                {"field_key": "net_quantity", "rule_id": "LM_NET_QTY", "label": "Net Quantity", "legal_reference": "Rule 6(1)(c)", "status": "PASS", "extracted_text": "150g", "confidence": 0.95, "source_panel": "front"},
                {"field_key": "mfg_date", "rule_id": "LM_MFG_DATE", "label": "Month & Year of Packing", "legal_reference": "Rule 6(1)(d)", "status": "NEEDS_HUMAN_REVIEW", "extracted_text": "Exp/Mfg 04/?2026", "confidence": 0.52, "source_panel": "back"},
                {"field_key": "manufacturer_name_address", "rule_id": "LM_MANUFACTURER", "label": "Manufacturer Details", "legal_reference": "Rule 6(1)(a)", "status": "NEEDS_HUMAN_REVIEW", "extracted_text": "Imp by Apex Trading Ltd Kol...", "confidence": 0.55, "source_panel": "back"},
                {"field_key": "consumer_care", "rule_id": "LM_CONSUMER_CARE", "label": "Consumer Care Details", "legal_reference": "Rule 6(1)(f)", "status": "PASS", "extracted_text": "customercare@apextrading.in 1800-425-9000", "confidence": 0.89, "source_panel": "back"},
                {"field_key": "generic_name", "rule_id": "LM_GENERIC_NAME", "label": "Generic Name", "legal_reference": "Rule 6(1)(b)", "status": "PASS", "extracted_text": "Dark Chocolate Slab", "confidence": 0.82, "source_panel": "front"},
                {"field_key": "country_of_origin", "rule_id": "LM_COUNTRY_ORIGIN", "label": "Country of Origin", "legal_reference": "Rule 6(1)(a)", "status": "PASS", "extracted_text": "Product of Switzerland", "confidence": 0.94, "source_panel": "back"}
            ]
        }
    ]
    
    for s in seeds:
        cursor.execute("""
        INSERT INTO inspections (id, shop_name, location, category, net_quantity, is_institutional, is_exempt, exemption_reason, timestamp, overall_status, officer_notes, rectification_remark, image_paths)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (s["id"], s["shop_name"], s["location"], s["category"], s["net_quantity"], s["is_institutional"], s["is_exempt"], s["exemption_reason"], s["timestamp"], s["overall_status"], s["officer_notes"], s["rectification_remark"], s["image_paths"]))
        
        for f in s.get("fields", []):
            cursor.execute("""
            INSERT INTO inspection_fields (inspection_id, field_key, rule_id, label, legal_reference, status, extracted_text, confidence, source_panel, bbox, manual_override, override_status, override_note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL)
            """, (s["id"], f["field_key"], f["rule_id"], f["label"], f["legal_reference"], f["status"], f["extracted_text"], f["confidence"], f["source_panel"], json.dumps([50, 50, 300, 100])))

def save_inspection(inspection_data: Dict[str, Any]) -> str:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    insp_id = inspection_data["id"]
    cursor.execute("""
    INSERT INTO inspections (id, shop_name, location, latitude, longitude, accuracy, category, net_quantity, is_institutional, is_exempt, exemption_reason, timestamp, overall_status, officer_notes, rectification_remark, image_paths)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        insp_id,
        inspection_data["shop_name"],
        inspection_data["location"],
        inspection_data.get("latitude"),
        inspection_data.get("longitude"),
        inspection_data.get("accuracy"),
        inspection_data["category"],
        inspection_data.get("net_quantity", ""),
        1 if inspection_data.get("is_institutional") else 0,
        1 if inspection_data.get("is_exempt") else 0,
        inspection_data.get("exemption_reason", ""),
        inspection_data.get("timestamp", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
        inspection_data["overall_status"],
        inspection_data.get("officer_notes", ""),
        "",
        json.dumps(inspection_data.get("image_paths", []))
    ))
    
    for f in inspection_data.get("fields", []):
        cursor.execute("""
        INSERT INTO inspection_fields (inspection_id, field_key, rule_id, label, legal_reference, status, extracted_text, confidence, source_panel, bbox, manual_override, override_status, override_note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            insp_id,
            f["field_key"],
            f["rule_id"],
            f["label"],
            f.get("legal_reference", ""),
            f["status"],
            f.get("extracted_text", ""),
            f.get("confidence", 0.0),
            f.get("source_panel", "front"),
            json.dumps(f.get("bbox", [])),
            1 if f.get("manual_override") else 0,
            f.get("override_status"),
            f.get("override_note")
        ))
        
    conn.commit()
    conn.close()
    return insp_id

def get_inspections(limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM inspections ORDER BY timestamp DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    
    results = []
    for r in rows:
        item = dict(r)
        item["image_paths"] = json.loads(item["image_paths"]) if item["image_paths"] else []
        item["is_institutional"] = bool(item["is_institutional"])
        item["is_exempt"] = bool(item["is_exempt"])
        results.append(item)
        
    conn.close()
    return results

def get_inspection_by_id(insp_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM inspections WHERE id = ?", (insp_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
        
    insp = dict(row)
    insp["image_paths"] = json.loads(insp["image_paths"]) if insp["image_paths"] else []
    insp["is_institutional"] = bool(insp["is_institutional"])
    insp["is_exempt"] = bool(insp["is_exempt"])
    
    cursor.execute("SELECT * FROM inspection_fields WHERE inspection_id = ?", (insp_id,))
    fields_rows = cursor.fetchall()
    
    fields = []
    for f in fields_rows:
        fd = dict(f)
        fd["bbox"] = json.loads(fd["bbox"]) if fd["bbox"] else []
        fd["manual_override"] = bool(fd["manual_override"])
        fields.append(fd)
        
    insp["fields"] = fields
    conn.close()
    return insp

def update_manual_override(insp_id: str, field_key: str, override_status: str, override_note: str, officer_notes: str = None) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
    UPDATE inspection_fields 
    SET manual_override = 1, override_status = ?, override_note = ?
    WHERE inspection_id = ? AND field_key = ?
    """, (override_status, override_note, insp_id, field_key))
    
    if officer_notes:
        cursor.execute("UPDATE inspections SET officer_notes = ? WHERE id = ?", (officer_notes, insp_id))
        
    # Re-evaluate overall status
    cursor.execute("SELECT status, manual_override, override_status FROM inspection_fields WHERE inspection_id = ?", (insp_id,))
    all_fields = cursor.fetchall()
    
    final_statuses = []
    for f in all_fields:
        st = f["override_status"] if f["manual_override"] and f["override_status"] else f["status"]
        final_statuses.append(st)
        
    if "FAIL" in final_statuses:
        new_overall = "FAIL"
    elif "NEEDS_HUMAN_REVIEW" in final_statuses:
        new_overall = "NEEDS_HUMAN_REVIEW"
    else:
        new_overall = "PASS"
        
    cursor.execute("UPDATE inspections SET overall_status = ? WHERE id = ?", (new_overall, insp_id))
    
    conn.commit()
    conn.close()
    return True

def update_rectification_remark(insp_id: str, remark: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE inspections SET rectification_remark = ? WHERE id = ?", (remark, insp_id))
    conn.commit()
    conn.close()
    return True

def get_dashboard_stats() -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM inspections")
    total_inspections = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM inspections WHERE overall_status = 'PASS'")
    pass_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM inspections WHERE overall_status = 'FAIL'")
    fail_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM inspections WHERE overall_status = 'NEEDS_HUMAN_REVIEW'")
    review_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM inspections WHERE is_exempt = 1")
    exempt_count = cursor.fetchone()[0]
    
    cursor.execute("""
    SELECT rule_id, label, COUNT(*) as count 
    FROM inspection_fields 
    WHERE status = 'FAIL' OR override_status = 'FAIL'
    GROUP BY rule_id
    ORDER BY count DESC
    """)
    rule_violations = [dict(r) for r in cursor.fetchall()]
    
    cursor.execute("""
    SELECT id, shop_name, location, category, overall_status, timestamp 
    FROM inspections 
    WHERE overall_status = 'FAIL' OR overall_status = 'NEEDS_HUMAN_REVIEW'
    ORDER BY timestamp DESC
    LIMIT 10
    """)
    flagged_cases = [dict(r) for r in cursor.fetchall()]
    
    conn.close()
    return {
        "total_inspections": total_inspections,
        "pass_count": pass_count,
        "fail_count": fail_count,
        "review_count": review_count,
        "exempt_count": exempt_count,
        "rule_violations": rule_violations,
        "flagged_cases": flagged_cases
    }
