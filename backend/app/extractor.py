import json
import re
import os
from typing import Dict, Any, List, Optional, Tuple

RULES_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "rules_config.json")

def load_rules() -> List[Dict[str, Any]]:
    if os.path.exists(RULES_PATH):
        with open(RULES_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict):
                return data.get("rules", [])
            elif isinstance(data, list):
                return data
    return []

def load_panel_expectations() -> Dict[str, List[str]]:
    default_expectations = {
        "front": ["mrp", "net_quantity", "generic_name"],
        "back": ["manufacturer_name_address", "mfg_date", "consumer_care"],
        "neck": ["mfg_date"]
    }
    if os.path.exists(RULES_PATH):
        with open(RULES_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict):
                return data.get("panel_expectations", default_expectations)
    return default_expectations

def evaluate_exemption(net_qty_str: str, is_institutional: bool) -> Tuple[bool, str]:
    """
    Rule 3 Exemption Check:
    Exempt if Net Quantity > 25kg or > 25L, or marked for Industrial/Institutional use.
    """
    if is_institutional:
        return True, "Exempt under Rule 3: Declared for Institutional / Industrial use."

    if not net_qty_str:
        return False, ""

    match = re.search(r"(\d+(\.\d+)?)\s*(g|kg|ml|l|litre|liter|gram|gm)\b", net_qty_str.lower())
    if match:
        val = float(match.group(1))
        unit = match.group(3)
        if unit in ["kg", "kilogram"] and val > 25.0:
            return True, f"Exempt under Rule 3: Net quantity ({val} kg) exceeds 25 kg threshold."
        if unit in ["l", "litre", "liter"] and val > 25.0:
            return True, f"Exempt under Rule 3: Net volume ({val} L) exceeds 25 Litres threshold."

    return False, ""

def extract_company_name_and_address(full_text: str, lines: List[Dict[str, Any]]) -> Tuple[str, float]:
    """
    Empirically extracts Manufacturer / Company Name and Address from OCR text lines.
    Returns 'Not found' if no company name is detected in the image.
    """
    mfg_keywords = [
        r"(mfd|manufactured|marketed|packed|imported)\s?(by|for)?[:\s]?",
        r"mfg\.?\s?by[:\s]?",
        r"packed\s?&\s?marketed\s?by[:\s]?"
    ]

    extracted_company = ""
    confidence = 0.0

    # 1. Search lines for manufacturer prefix
    for idx, l in enumerate(lines):
        line_text = l["text"]
        for kw in mfg_keywords:
            if re.search(kw, line_text, re.IGNORECASE):
                match = re.split(kw, line_text, flags=re.IGNORECASE)
                candidate = match[-1].strip() if len(match) > 1 else line_text.strip()
                
                address_parts = [candidate]
                if idx + 1 < len(lines):
                    next_line = lines[idx + 1]["text"]
                    if any(addr_kw in next_line.lower() for addr_kw in ["plot", "sector", "phase", "ind", "area", "estate", "road", "street", "delhi", "mumbai", "bengaluru", "kolkata", "chennai", "pin", "pvt", "ltd"]):
                        address_parts.append(next_line.strip())

                extracted_company = ", ".join([p for p in address_parts if p])
                confidence = l["confidence"]
                break
        if extracted_company:
            break

    # 2. Search for corporate entity patterns in full text
    if not extracted_company:
        m = re.search(r"(Manufactured|Mfd|Marketed|Packed)\s?by[:\s]?([A-Za-z0-9\s,\.\-]{5,80})", full_text, re.IGNORECASE)
        if m:
            extracted_company = m.group(0).strip()
            confidence = 0.88

    if not extracted_company:
        corp_match = re.search(r"([A-Za-z0-9\s]{3,30}\s?(Pvt\.?\s?Ltd|Ltd|Organics|Foods|Industries|Enterprises|Chemicals|Inc|Corp))", full_text, re.IGNORECASE)
        if corp_match:
            extracted_company = f"Manufactured by {corp_match.group(1).strip()}"
            confidence = 0.82

    if not extracted_company:
        return "Not found", 0.0

    return extracted_company, confidence

def classify_product_category(full_text: str) -> str:
    """
    Auto-classifies product category based on extracted text tokens.
    """
    text_lower = full_text.lower()
    
    if any(k in text_lower for k in ["ml", "l", "litre", "liter", "water", "juice", "beverage", "drink", "soda", "cola"]):
        return "Beverages"
    if any(k in text_lower for k in ["wash", "lotion", "cream", "shampoo", "soap", "serum", "cosmetic", "glow", "skin"]):
        return "Cosmetics & Personal Care"
    if any(k in text_lower for k in ["atta", "flour", "rice", "wheat", "snack", "biscuit", "food", "grain", "oil", "sugar", "chocolate"]):
        return "Packaged Food"
    if any(k in text_lower for k in ["detergent", "cleaner", "dish", "powder", "soap"]):
        return "Household Goods"
    if any(k in text_lower for k in ["industrial", "resin", "sack", "chemical", "polymer"]):
        return "Industrial Raw Materials"
        
    return "General Packaged Commodity"

def evaluate_rules_for_panel(ocr_result: Dict[str, Any], category: str = "", panel_name: str = "front") -> List[Dict[str, Any]]:
    """
    Evaluates OCR extracted text lines against rules_config.json.
    Returns per-field compliance status, confidence score, bounding box, and matched text.
    """
    rules = load_rules()
    full_text = ocr_result.get("full_text", "")
    lines = ocr_result.get("lines", [])

    field_results = []
    inferred_category = classify_product_category(full_text) if not category else category

    for rule in rules:
        field_key = rule["field"]
        rule_id = rule["rule_id"]
        label = rule["label"]
        mandatory = rule.get("mandatory", True)
        legal_ref = rule.get("legal_reference", "")
        regex_patterns = rule.get("regex_patterns", [])
        must_contain_phrases = rule.get("must_contain_phrase", [])

        extracted_text = ""
        confidence = 0.0
        bbox = [0, 0, 0, 0]
        status = "FAIL"
        matched = False

        # 1. Manufacturer / Company Name & Address
        if field_key == "manufacturer_name_address":
            comp_name, comp_conf = extract_company_name_and_address(full_text, lines)
            if comp_name != "Not found":
                extracted_text = comp_name
                confidence = comp_conf
                status = "PASS" if confidence >= 0.6 else "NEEDS_HUMAN_REVIEW"
            else:
                extracted_text = "Not found"
                confidence = 0.0
                status = "FAIL"

        # 2. Maximum Retail Price (MRP)
        elif field_key == "mrp":
            mrp_match = None
            for pattern in regex_patterns:
                m = re.search(pattern, full_text, re.IGNORECASE)
                if m:
                    mrp_match = m.group(0)
                    break
            
            if mrp_match:
                has_tax_phrase = any(phrase in full_text.lower() for phrase in must_contain_phrases)
                
                for l in lines:
                    if mrp_match in l["text"] or re.search(r"mrp|rs|₹", l["text"], re.IGNORECASE):
                        extracted_text = l["text"]
                        confidence = l["confidence"]
                        bbox = l.get("bbox")
                        break
                if not extracted_text:
                    extracted_text = mrp_match
                    confidence = 0.85

                if has_tax_phrase:
                    if "inclusive" not in extracted_text.lower() and "incl" not in extracted_text.lower():
                        extracted_text += " (inclusive of all taxes)"
                    status = "PASS" if confidence >= 0.6 else "NEEDS_HUMAN_REVIEW"
                else:
                    status = "FAIL" # Missing mandatory tax clause
                    extracted_text += " [MISSING MANDATORY CLAUSE: 'inclusive of all taxes']"
            else:
                status = "FAIL"
                extracted_text = "Not found"

        # 3. Common / Generic Name
        elif field_key == "generic_name":
            if lines and len(lines) > 0:
                header = lines[0]["text"]
                extracted_text = f"{header}"
                confidence = lines[0].get("confidence", 0.80)
                status = "PASS" if confidence >= 0.6 else "NEEDS_HUMAN_REVIEW"
            else:
                extracted_text = inferred_category
                confidence = 0.70
                status = "PASS"

        # 4. General Regex Field Matching
        else:
            for pattern in regex_patterns:
                m = re.search(pattern, full_text, re.IGNORECASE)
                if m:
                    matched = True
                    matched_snippet = m.group(0)
                    
                    for l in lines:
                        if re.search(pattern, l["text"], re.IGNORECASE):
                            extracted_text = l["text"]
                            confidence = l["confidence"]
                            bbox = l.get("bbox")
                            break
                    if not extracted_text:
                        extracted_text = matched_snippet
                        confidence = 0.85

                    status = "PASS" if confidence >= 0.6 else "NEEDS_HUMAN_REVIEW"
                    break

            if not matched:
                if mandatory:
                    status = "FAIL"
                    extracted_text = "Not found"
                    confidence = 0.0
                else:
                    status = "PASS"
                    extracted_text = "Not specified (Optional)"
                    confidence = 1.0

        field_results.append({
            "field_key": field_key,
            "rule_id": rule_id,
            "label": label,
            "legal_reference": legal_ref,
            "status": status,
            "extracted_text": extracted_text,
            "confidence": confidence,
            "source_panel": panel_name,
            "bbox": bbox,
            "manual_override": False,
            "override_status": None,
            "override_note": None
        })

    return field_results
