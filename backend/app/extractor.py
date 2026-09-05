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
    Rely strictly on generic keyword patterns (mfd by, packed by, etc.)
    and corporate suffix patterns (Pvt Ltd, Ltd, Inc).
    NO HARDCODED FICTIONAL BRANDS.
    """
    mfg_keywords = [
        r"(mfd|manufactured|marketed|packed|imported)\s?(by|for)?[:\s]?",
        r"mfg\.?\s?by[:\s]?",
        r"packed\s?&\s?marketed\s?by[:\s]?"
    ]

    extracted_company = ""
    confidence = 0.0

    for idx, l in enumerate(lines):
        line_text = l.get("text", "")
        line_conf = l.get("confidence", 0.70)
        for kw in mfg_keywords:
            if re.search(kw, line_text, re.IGNORECASE):
                match = re.split(kw, line_text, flags=re.IGNORECASE)
                candidate = match[-1].strip() if len(match) > 1 else line_text.strip()
                address_parts = [candidate]
                if idx + 1 < len(lines):
                    next_line = lines[idx + 1].get("text", "")
                    if any(addr_kw in next_line.lower() for addr_kw in ["plot", "sector", "phase", "ind", "area", "estate", "road", "street", "delhi", "mumbai", "bengaluru", "kolkata", "chennai", "pin", "pvt", "ltd", "hr", "mh", "hp"]):
                        address_parts.append(next_line.strip())

                extracted_company = ", ".join([p for p in address_parts if p])
                confidence = float(line_conf)
                break
        if extracted_company:
            break

    if not extracted_company:
        corp_match = re.search(r"([A-Za-z0-9\s]{3,40}\s?(Pvt\.?\s?Ltd|Private Limited|Ltd|Limited|Organics|Foods|Industries|Enterprises|Chemicals|Inc|Corp|Products))", full_text, re.IGNORECASE)
        if corp_match:
            extracted_company = f"Manufactured by {corp_match.group(1).strip()}"
            # Find matching line confidence
            for l in lines:
                if corp_match.group(1).strip() in l.get("text", ""):
                    confidence = float(l.get("confidence", 0.65))
                    break
            if confidence == 0.0:
                confidence = 0.65

    if not extracted_company:
        return "Not found", 0.0

    return extracted_company, round(confidence, 2)

def classify_product_category(full_text: str) -> str:
    text_lower = full_text.lower()
    if any(k in text_lower for k in ["ml", "l", "litre", "liter", "water", "juice", "beverage", "drink", "soda", "cola"]):
        return "Beverages"
    if any(k in text_lower for k in ["wash", "lotion", "cream", "shampoo", "soap", "serum", "cosmetic", "glow", "skin"]):
        return "Cosmetics & Personal Care"
    if any(k in text_lower for k in ["atta", "flour", "rice", "wheat", "snack", "biscuit", "food", "grain", "oil", "sugar", "chocolate", "honey"]):
        return "Packaged Food"
    if any(k in text_lower for k in ["detergent", "cleaner", "dish", "powder", "soap"]):
        return "Household Goods"
    return "Packaged Commodity"

def evaluate_rules_for_panel(ocr_result: Dict[str, Any], category: str = "", panel_name: str = "front") -> List[Dict[str, Any]]:
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
        must_contain_phrases = rule.get("must_contain_phrase", [])

        extracted_text = ""
        confidence = 0.0
        bbox = [0, 0, 0, 0]
        status = "FAIL"

        # 1. Manufacturer / Company Name & Address
        if field_key == "manufacturer_name_address":
            comp_name, comp_conf = extract_company_name_and_address(full_text, lines)
            if comp_name != "Not found":
                extracted_text = comp_name
                confidence = comp_conf
                if confidence >= 0.70:
                    status = "PASS"
                elif confidence >= 0.40:
                    status = "NEEDS_HUMAN_REVIEW"
                else:
                    status = "FAIL"
            else:
                extracted_text = "Not found"
                confidence = 0.0
                status = "FAIL"

        # 2. Maximum Retail Price (MRP)
        elif field_key == "mrp":
            mrp_patterns = [
                r"(mrp|rs\.?|₹|price)\s*:?\s*(₹|rs\.?)?\s*(\d+(\.\d{1,2})?)",
                r"(\d+(\.\d{1,2})?)\s*(incl|inclusive)",
                r"mrp\s*:?\s*(\d+(\.\d{1,2})?)",
                r"₹\s*\d+(\.\d{1,2})?",
                r"rs\.?\s*\d+(\.\d{1,2})?"
            ]
            mrp_match = None
            for pattern in mrp_patterns:
                m = re.search(pattern, full_text, re.IGNORECASE)
                if m:
                    mrp_match = m.group(0)
                    break
            
            if mrp_match:
                has_tax_phrase = any(phrase in full_text.lower() for phrase in must_contain_phrases) or "tax" in full_text.lower() or "incl" in full_text.lower() or "inclusive" in full_text.lower()
                
                for l in lines:
                    if mrp_match in l.get("text", "") or re.search(r"mrp|rs|₹|price", l.get("text", ""), re.IGNORECASE):
                        extracted_text = l["text"]
                        confidence = float(l.get("confidence", 0.70))
                        bbox = l.get("bbox", [0, 0, 0, 0])
                        break
                if not extracted_text:
                    extracted_text = mrp_match
                    confidence = 0.65

                if has_tax_phrase:
                    if "inclusive" not in extracted_text.lower() and "incl" not in extracted_text.lower():
                        extracted_text += " (inclusive of all taxes)"
                    if confidence >= 0.70:
                        status = "PASS"
                    elif confidence >= 0.40:
                        status = "NEEDS_HUMAN_REVIEW"
                    else:
                        status = "FAIL"
                else:
                    status = "FAIL"
                    extracted_text += " [MISSING MANDATORY CLAUSE: 'inclusive of all taxes']"
            else:
                status = "FAIL"
                extracted_text = "Not found"
                confidence = 0.0

        # 3. Net Quantity
        elif field_key == "net_quantity":
            qty_patterns = [
                r"net\s*(qty|wt|weight|vol|volume)?[:\s]*(\d+(\.\d+)?)\s*(g|kg|ml|l|litre|liter|gram|gm)\b",
                r"(\d+(\.\d+)?)\s*(g|kg|ml|l|litre|liter|gram|gm)\b",
                r"\b\d+\s?(g|kg|ml|l)\b"
            ]
            qty_match = None
            for pattern in qty_patterns:
                m = re.search(pattern, full_text, re.IGNORECASE)
                if m:
                    qty_match = m.group(0)
                    break

            if qty_match:
                extracted_text = qty_match
                # Derive confidence directly from OCR line
                for l in lines:
                    if qty_match.lower() in l.get("text", "").lower():
                        confidence = float(l.get("confidence", 0.75))
                        bbox = l.get("bbox", [0, 0, 0, 0])
                        break
                if confidence == 0.0:
                    confidence = 0.70

                if confidence >= 0.70:
                    status = "PASS"
                elif confidence >= 0.40:
                    status = "NEEDS_HUMAN_REVIEW"
                else:
                    status = "FAIL"
            else:
                extracted_text = "Not found"
                confidence = 0.0
                status = "FAIL"

        # 4. Month & Year of Manufacture
        elif field_key == "mfg_date":
            date_patterns = [
                r"(mfg|pkd|packed|date)[:\s]*(0[1-9]|1[0-2])[/-]\d{2,4}",
                r"(0[1-9]|1[0-2])[/-]\d{2,4}",
                r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s?\d{4}\b"
            ]
            date_match = None
            for pattern in date_patterns:
                m = re.search(pattern, full_text, re.IGNORECASE)
                if m:
                    date_match = m.group(0)
                    break

            if date_match:
                extracted_text = date_match
                for l in lines:
                    if date_match.lower() in l.get("text", "").lower():
                        confidence = float(l.get("confidence", 0.75))
                        bbox = l.get("bbox", [0, 0, 0, 0])
                        break
                if confidence == 0.0:
                    confidence = 0.70

                if confidence >= 0.70:
                    status = "PASS"
                elif confidence >= 0.40:
                    status = "NEEDS_HUMAN_REVIEW"
                else:
                    status = "FAIL"
            else:
                extracted_text = "Not found"
                confidence = 0.0
                status = "FAIL"

        # 5. Consumer Care Details
        elif field_key == "consumer_care":
            cc_patterns = [
                r"(customer|consumer)\s?care[:\s]*[\w\d\s\-\.\@]+",
                r"1800[-\s]?\d{2,3}[-\s]?\d{3,4}",
                r"care@[\w\.-]+",
                r"helpline|toll free"
            ]
            cc_match = None
            for pattern in cc_patterns:
                m = re.search(pattern, full_text, re.IGNORECASE)
                if m:
                    cc_match = m.group(0)
                    break

            if cc_match:
                extracted_text = cc_match
                for l in lines:
                    if cc_match.lower() in l.get("text", "").lower():
                        confidence = float(l.get("confidence", 0.75))
                        bbox = l.get("bbox", [0, 0, 0, 0])
                        break
                if confidence == 0.0:
                    confidence = 0.70

                if confidence >= 0.70:
                    status = "PASS"
                elif confidence >= 0.40:
                    status = "NEEDS_HUMAN_REVIEW"
                else:
                    status = "FAIL"
            else:
                extracted_text = "Not found"
                confidence = 0.0
                status = "FAIL"

        # 6. Common / Generic Name
        elif field_key == "generic_name":
            # NO lines[0] FALLBACK! Reference list starting set:
            commodities = [
                "packaged drinking water", "mineral water", "refined sunflower oil", "whole wheat atta",
                "wheat flour", "organic honey", "almond milk", "tea powder", "face wash", "dark chocolate",
                "fruit juice", "potato chips", "biscuit", "shampoo", "hand wash", "detergent powder", "liquid soap"
            ]
            name_match = None
            matching_line_conf = 0.0

            for comm in commodities:
                if comm in full_text.lower():
                    name_match = comm.title()
                    for l in lines:
                        if comm in l.get("text", "").lower():
                            matching_line_conf = float(l.get("confidence", 0.85))
                            break
                    break

            if name_match:
                extracted_text = name_match
                confidence = matching_line_conf if matching_line_conf > 0 else 0.80
                status = "PASS" if confidence >= 0.70 else "NEEDS_HUMAN_REVIEW"
            else:
                # Heuristic noun phrase check: short line near top excluding brand words
                heuristic_match = None
                for l in lines[:3]:
                    txt = l.get("text", "").strip()
                    if 3 <= len(txt) <= 35 and not re.search(r"(mrp|rs|₹|pvt|ltd|mfg|net|batch)", txt, re.IGNORECASE):
                        heuristic_match = txt
                        matching_line_conf = float(l.get("confidence", 0.55))
                        break

                if heuristic_match:
                    extracted_text = f"{heuristic_match} (Heuristic match)"
                    confidence = round(matching_line_conf * 0.9, 2)
                    status = "NEEDS_HUMAN_REVIEW"
                else:
                    extracted_text = "Not confidently detected"
                    confidence = 0.0
                    status = "NEEDS_HUMAN_REVIEW"

        # 7. Country of Origin
        elif field_key == "country_of_origin":
            origin_match = re.search(r"(country of origin|made in|product of|imported from)\s*:?\s*([a-zA-Z\s]+)", full_text, re.IGNORECASE)
            if origin_match:
                extracted_text = origin_match.group(0).strip()
                for l in lines:
                    if origin_match.group(0).strip().lower() in l.get("text", "").lower():
                        confidence = float(l.get("confidence", 0.85))
                        break
                if confidence == 0.0:
                    confidence = 0.80
                status = "PASS" if confidence >= 0.70 else "NEEDS_HUMAN_REVIEW"
            else:
                # If imported keyword is present without origin, FAIL. Otherwise NOT_APPLICABLE for domestic goods.
                if re.search(r"import(ed|er)?", full_text, re.IGNORECASE):
                    extracted_text = "Missing mandatory origin declaration for imported commodity"
                    confidence = 0.0
                    status = "FAIL"
                else:
                    extracted_text = "Not specified (Optional for domestic commodities)"
                    confidence = 1.0
                    status = "NOT_APPLICABLE"

        field_results.append({
            "rule_id": rule_id,
            "field_key": field_key,
            "label": label,
            "rule_name": label,
            "mandatory": mandatory,
            "legal_reference": legal_ref,
            "status": status,
            "confidence": round(confidence, 2),
            "extracted_text": extracted_text,
            "bbox": bbox,
            "panel": panel_name
        })

    return field_results
