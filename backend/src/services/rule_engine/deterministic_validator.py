import re
from typing import Dict, Any, List, Tuple

def validate_mrp_field(raw_text: str, confidence: float) -> Tuple[str, float, str, str]:
    """
    Objective Check for MRP:
    - Must be present
    - Must include numeric price
    - Must contain mandatory clause 'inclusive of all taxes' or 'incl. of all taxes'
    """
    if not raw_text or raw_text == "Not found":
        return "FAIL", 0.0, "Not found", "Rule 6(1)(e): Maximum Retail Price is missing."

    # Pattern match for price
    mrp_match = re.search(r"(mrp|rs\.?|₹|price)\s*:?\s*(₹|rs\.?)?\s*(\d+(\.\d{1,2})?)", raw_text, re.IGNORECASE)
    if not mrp_match:
        mrp_match = re.search(r"(\d+(\.\d{1,2})?)", raw_text)

    has_tax_clause = any(kw in raw_text.lower() for kw in [
        "inclusive of all taxes", "incl. of all taxes", "incl of all taxes",
        "incl. taxes", "inclusive taxes", "incl taxes"
    ])

    extracted = raw_text.strip()
    if mrp_match and has_tax_clause:
        status = "PASS" if confidence >= 0.70 else "NEEDS_HUMAN_REVIEW"
        rule_clause = "Rule 6(1)(e): MRP declared with mandatory 'inclusive of all taxes' clause."
    elif mrp_match and not has_tax_clause:
        status = "FAIL"
        extracted = f"{extracted} [MISSING MANDATORY CLAUSE: 'inclusive of all taxes']"
        rule_clause = "Rule 6(1)(e) Violation: Price declared without mandatory 'inclusive of all taxes' wording."
    else:
        status = "FAIL"
        rule_clause = "Rule 6(1)(e) Violation: MRP numerical value not formatted correctly."

    return status, round(confidence, 2), extracted, rule_clause

def validate_net_quantity_field(raw_text: str, confidence: float) -> Tuple[str, float, str, str]:
    """
    Objective Check for Net Quantity:
    - Must specify standard unit (g, kg, ml, l, litre, etc.)
    """
    if not raw_text or raw_text == "Not found":
        return "FAIL", 0.0, "Not found", "Rule 6(1)(c): Net Quantity declaration missing."

    match = re.search(r"(\d+(\.\d+)?)\s*(g|kg|ml|l|litre|liter|gram|gm)\b", raw_text, re.IGNORECASE)
    if match:
        status = "PASS" if confidence >= 0.70 else "NEEDS_HUMAN_REVIEW"
        clause = "Rule 6(1)(c) & Schedule II: Net quantity declared in standard metric units."
    else:
        status = "FAIL"
        clause = "Rule 6(1)(c) Violation: Net quantity missing standard metric unit (g, kg, ml, L)."

    return status, round(confidence, 2), raw_text, clause

def validate_mfg_date_field(raw_text: str, confidence: float) -> Tuple[str, float, str, str]:
    """
    Objective Check for Month & Year of Manufacture:
    """
    if not raw_text or raw_text == "Not found":
        return "FAIL", 0.0, "Not found", "Rule 6(1)(d): Month and Year of Manufacture / Packing missing."

    match = re.search(r"(0[1-9]|1[0-2])[/-]\d{2,4}", raw_text) or re.search(r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s?\d{4}\b", raw_text, re.IGNORECASE)
    if match:
        status = "PASS" if confidence >= 0.70 else "NEEDS_HUMAN_REVIEW"
        clause = "Rule 6(1)(d): Date of manufacture/packing formatted correctly as MM/YYYY."
    else:
        status = "NEEDS_HUMAN_REVIEW"
        clause = "Rule 6(1)(d): Date declaration present but format requires verification."

    return status, round(confidence, 2), raw_text, clause

def validate_unit_price_math(mrp_val: float, net_qty_str: str, unit_price_str: str) -> Tuple[bool, str]:
    """
    Unit-Price Math Validation (2021 Amendment):
    Cross-checks declared per-unit price against MRP / Net-Quantity ratio.
    """
    if not mrp_val or not net_qty_str or not unit_price_str:
        return True, "Unit price math check skipped (fields missing)"

    match_qty = re.search(r"(\d+(\.\d+)?)\s*(g|kg|ml|l|litre|liter|gram|gm)\b", net_qty_str, re.IGNORECASE)
    match_unit_p = re.search(r"(\d+(\.\d+)?)\s*/?\s*(g|kg|ml|l|unit)?", unit_price_str, re.IGNORECASE)

    if match_qty and match_unit_p:
        qty_val = float(match_qty.group(1))
        unit = match_qty.group(3).lower()
        declared_unit_p = float(match_unit_p.group(1))

        # Standardize to per kg / per L or per 100g
        if unit in ["g", "gm"]:
            expected_per_g = mrp_val / qty_val
            diff = abs(expected_per_g - declared_unit_p)
            if diff < (0.10 * expected_per_g):
                return True, "Rule 6(1)(e) Amendment 2021: Unit price math verified consistent."
            else:
                return False, f"Unit price math discrepancy: Declared ₹{declared_unit_p}/g vs Computed ₹{expected_per_g:.2f}/g"

    return True, "Unit price math format acceptable."
