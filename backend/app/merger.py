from typing import Dict, List, Any, Tuple

def merge_multi_panel_results(panel_results_map: Dict[str, List[Dict[str, Any]]]) -> Tuple[List[Dict[str, Any]], str]:
    """
    Merges extracted fields across Front, Back, and Neck panels.
    If a field is PASS in ANY image panel, it counts as PASS (with highest confidence panel recorded).
    """
    if not panel_results_map:
        return [], "FAIL"

    # Collect all field keys present across rules
    first_panel_key = list(panel_results_map.keys())[0]
    sample_fields = panel_results_map[first_panel_key]
    
    merged_fields = []
    
    for sample_f in sample_fields:
        key = sample_f["field_key"]
        
        # Gather all versions of this field across panels
        candidates = []
        for panel_name, f_list in panel_results_map.items():
            for f in f_list:
                if f["field_key"] == key:
                    c = dict(f)
                    c["source_panel"] = panel_name
                    candidates.append(c)
                    
        if not candidates:
            continue
            
        # Priority 1: Pick best PASS candidate
        pass_candidates = [c for c in candidates if c["status"] == "PASS"]
        if pass_candidates:
            best = max(pass_candidates, key=lambda x: x["confidence"])
            merged_fields.append(best)
            continue
            
        # Priority 2: Pick best NEEDS_HUMAN_REVIEW candidate
        review_candidates = [c for c in candidates if c["status"] == "NEEDS_HUMAN_REVIEW"]
        if review_candidates:
            best = max(review_candidates, key=lambda x: x["confidence"])
            merged_fields.append(best)
            continue

        # Priority 3: Pick candidate with longest non-empty extracted text or first candidate
        best = max(candidates, key=lambda x: len(x.get("extracted_text", "")))
        merged_fields.append(best)

    # Compute overall compliance status
    statuses = [f["status"] for f in merged_fields]
    if "FAIL" in statuses:
        overall = "FAIL"
    elif "NEEDS_HUMAN_REVIEW" in statuses:
        overall = "NEEDS_HUMAN_REVIEW"
    else:
        overall = "PASS"

    return merged_fields, overall
