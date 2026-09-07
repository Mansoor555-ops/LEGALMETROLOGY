import re
from typing import Dict, Any, Tuple, Optional

def evaluate_exemption(net_quantity_str: str, category: str = "Packaged Food") -> Tuple[bool, str]:
    """
    Rule 3 Exemption Threshold Math (Legal Metrology Packaged Commodities Rules 2011):
    - Packages <= 10g or <= 10ml for food products are exempt from declaration rules.
    - Agricultural commodities > 50kg or > 50L in wholesale packages are exempt.
    """
    if not net_quantity_str or net_quantity_str == "Not found":
        return False, "Standard commodity package (No Rule 3 exemption applicable)."

    match = re.search(r"(\d+(\.\d+)?)\s*(g|kg|ml|l|litre|liter|gram|gm)\b", net_quantity_str, re.IGNORECASE)
    if match:
        val = float(match.group(1))
        unit = match.group(3).lower()

        # Small package exemption (<= 10g or <= 10ml)
        if unit in ["g", "gm", "ml"] and val <= 10.0:
            return True, f"Rule 3 Exemption: Small package ({val}{unit} <= 10g/ml) is exempt from Rule 6 mandatory declarations."

        # Bulk package exemption (> 50kg or > 50L)
        if unit in ["kg", "l", "litre", "liter"] and val > 50.0:
            return True, f"Rule 3 Exemption: Bulk wholesale package ({val}{unit} > 50kg/L) is exempt under Rule 3."

    return False, "Standard package — Rule 6 mandatory declarations required."

def validate_mrp_deterministic(raw_text: str) -> Tuple[str, str]:
    if not raw_text or raw_text.strip() == "Not found":
        return "FAIL", "Rule 6(1)(e) Violation: Maximum Retail Price (MRP) declaration is missing."

    # Search for numeric price value
    price_match = re.search(r"(mrp|rs\.?|₹|price)\s*:?\s*(₹|rs\.?)?\s*(\d+(\.\d{1,2})?)", raw_text, re.IGNORECASE)
    if not price_match:
        price_match = re.search(r"(\d+(\.\d{1,2})?)", raw_text)

    has_tax_clause = any(kw in raw_text.lower() for kw in [
        "inclusive of all taxes", "incl. of all taxes", "incl of all taxes",
        "incl. taxes", "inclusive taxes", "incl taxes", "incl.all taxes",
        "incl. all taxes", "tax incl", "taxes incl", "tax inclusive", "incl.tax", "incl tax"
    ])

    if price_match and has_tax_clause:
        return "PASS", "Rule 6(1)(e): MRP declared with mandatory 'inclusive of all taxes' clause."
    elif price_match and not has_tax_clause:
        return "NEEDS_CONTEXT", "Rule 6(1)(e): MRP numeric value present; tax clause requires contextual RAG verification."
    else:
        return "FAIL", "Rule 6(1)(e) Violation: MRP numeric value not properly formatted."

def validate_net_quantity_deterministic(raw_text: str) -> Tuple[str, str]:
    if not raw_text or raw_text.strip() == "Not found":
        return "FAIL", "Rule 6(1)(c) Violation: Net Quantity declaration is missing."

    match = re.search(r"(\d+(\.\d+)?)\s*[\.\-]?\s*(g|kg|ml|l|litre|liter|gram|gm|m|cm|mm|sq m|unit|n|pcs)\b", raw_text, re.IGNORECASE)
    if match:
        return "PASS", "Rule 6(1)(c) & Schedule II: Net quantity declared in valid metric/standard units."
    else:
        return "FAIL", "Rule 6(1)(c) Violation: Net quantity missing standard metric unit (g, kg, ml, L, unit)."

def validate_mfg_date_deterministic(raw_text: str) -> Tuple[str, str]:
    if not raw_text or raw_text.strip() == "Not found":
        return "FAIL", "Rule 6(1)(d) Violation: Month and Year of manufacture/packing missing."

    # Flexible MM/YY, MM/YYYY, Month YY, Month YYYY, DD/MM/YYYY regex match
    match = (
        re.search(r"(0[1-9]|1[0-2])[/\.\-](20)?\d{2}", raw_text) or
        re.search(r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\.\-\s/\,]*(20)?\d{2}\b", raw_text, re.IGNORECASE) or
        re.search(r"\b\d{1,2}[/\.\-](0[1-9]|1[0-2])[/\.\-](20)?\d{2}\b", raw_text)
    )
    if match:
        return "PASS", "Rule 6(1)(d): Month & Year of manufacture/packing formatted correctly."
    else:
        return "NEEDS_CONTEXT", "Rule 6(1)(d): Date declaration present but requires RAG clause verification."

def validate_deterministic_field(field_key: str, extracted_text: str, present: bool) -> Tuple[str, str]:
    """
    Pure-code deterministic validator.
    Returns verdict: PASS | FAIL | NOT_PRESENT_ON_PANEL | NEEDS_CONTEXT
    """
    if not present or not extracted_text or extracted_text.strip() == "Not found":
        return "NOT_PRESENT_ON_PANEL", f"Field '{field_key}' is not present on the scanned image/panel."

    if field_key == "mrp":
        return validate_mrp_deterministic(extracted_text)

    elif field_key == "net_quantity":
        return validate_net_quantity_deterministic(extracted_text)

    elif field_key == "mfg_date":
        return validate_mfg_date_deterministic(extracted_text)

    elif field_key in ["manufacturer_name_address", "consumer_care"]:
        # Address completeness and consumer contact details require contextual RAG judgment
        return "NEEDS_CONTEXT", f"Field '{field_key}' requires contextual RAG legal clause evaluation."

    elif field_key in ["generic_name", "country_of_origin"]:
        if len(extracted_text.strip()) >= 2:
            return "PASS", f"Rule 6(1): {field_key.replace('_', ' ').title()} declaration present."
        else:
            return "FAIL", f"Rule 6(1) Violation: {field_key.replace('_', ' ').title()} is incomplete."

    return "NEEDS_CONTEXT", f"Field '{field_key}' marked for RAG clause evaluation."
