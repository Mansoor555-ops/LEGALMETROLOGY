import os
import logging
from typing import Dict, Any, List, Tuple
from .deterministic import validate_deterministic_field, evaluate_exemption
from .rag_judge import run_rag_judge_evaluation

logger = logging.getLogger(__name__)

async def merge_hybrid_rule_evaluation(
    structured_gemini_res: Dict[str, Any],
    visual_compliance_res: Dict[str, Any],
    category: str = "Packaged Food",
    panel: str = "front"
) -> Dict[str, Any]:
    """
    Hybrid Rule Engine Merger:
    Combines deterministic validator output and RAG-backed LLM judge rulings into a single,
    auditable compliance verdict with explicit per-field confidence scores and verdict sources.

    CONFIDENCE SCORE FORMULA:
    -------------------------
    1. Deterministic Rule Verdicts (PASS / FAIL / NOT_APPLICABLE):
       confidence = 1.0 (pure code validation, non-negotiable hard rules).

    2. RAG-Judged Contextual Verdicts:
       confidence = round(judge_model_confidence * retrieval_relevance_score, 2)
       where judge_model_confidence is returned by the LLM judge (0.0 - 1.0) and
       retrieval_relevance_score is the FAISS vector similarity score (0.0 - 1.0).
    """
    skip_rag_on_pass = os.getenv("SKIP_RAG_ON_DETERMINISTIC_PASS", "true").lower() == "true"

    raw_fields = structured_gemini_res.get("fields", {})
    net_qty_text = raw_fields.get("net_quantity", {}).get("extracted_text", "")

    # Check Rule 3 Exemption
    is_exempt, exemption_reason = evaluate_exemption(net_qty_text, category)

    field_definitions = [
        ("mrp", "Maximum Retail Price (MRP)", "Rule 6(1)(e)"),
        ("net_quantity", "Net Quantity", "Rule 6(1)(c)"),
        ("mfg_date", "Month & Year of Mfg", "Rule 6(1)(d)"),
        ("manufacturer_name_address", "Manufacturer Name & Address", "Rule 6(1)(a)"),
        ("consumer_care", "Consumer Care Details", "Rule 6(1)(f)"),
        ("generic_name", "Common / Generic Name", "Rule 6(1)(b)"),
        ("country_of_origin", "Country of Origin", "Rule 6(1)(g)")
    ]

    evaluated_fields = []
    overall_statuses = []

    for key, label, default_clause in field_definitions:
        field_data = raw_fields.get(key, {})
        extracted_text = field_data.get("extracted_text", "Not found")
        present = field_data.get("present", extracted_text != "Not found")
        vis_conf = field_data.get("visual_confidence", 0.0)

        if is_exempt:
            evaluated_fields.append({
                "rule_id": f"RULE-{key.upper()}",
                "field_key": key,
                "label": label,
                "rule_name": label,
                "mandatory": False,
                "legal_reference": exemption_reason,
                "cited_rule_clause": "Rule 3 Exemption",
                "status": "NOT_APPLICABLE",
                "confidence": 1.0,
                "verdict_source": "DETERMINISTIC",
                "extracted_text": extracted_text,
                "source_panel": panel
            })
            overall_statuses.append("NOT_APPLICABLE")
            continue

        # Step 1: Run Deterministic Validation
        det_verdict, det_reason = validate_deterministic_field(key, extracted_text, present)

        if det_verdict in ["PASS", "FAIL", "NOT_APPLICABLE", "NOT_PRESENT_ON_PANEL"]:
            # Deterministic decision reached
            final_verdict = det_verdict
            cited_clause = default_clause
            final_conf = 1.0 if det_verdict != "NOT_PRESENT_ON_PANEL" else 0.5
            verdict_source = "DETERMINISTIC"
            reason = det_reason
        else:
            # Step 2: NEEDS_CONTEXT — Pass to RAG LLM Judge
            if skip_rag_on_pass and det_verdict == "PASS":
                final_verdict = "PASS"
                cited_clause = default_clause
                final_conf = 1.0
                verdict_source = "DETERMINISTIC"
                reason = det_reason
            else:
                judge_verdict, cited_clause, judge_conf, rel_score, judge_reason = await run_rag_judge_evaluation(
                    key, extracted_text, category
                )
                final_verdict = judge_verdict
                # EXPLICIT FORMULA: confidence = judge_model_confidence * retrieval_relevance_score
                final_conf = round(judge_conf * rel_score, 2)
                verdict_source = "RAG_JUDGE"
                reason = f"{judge_reason} [RAG Relevance: {rel_score:.2f}, Judge Conf: {judge_conf:.2f}]"

        evaluated_fields.append({
            "rule_id": f"RULE-{key.upper()}",
            "field_key": key,
            "label": label,
            "rule_name": label,
            "mandatory": True,
            "legal_reference": f"{cited_clause}: {reason}",
            "cited_rule_clause": cited_clause,
            "status": final_verdict,
            "confidence": final_conf,
            "verdict_source": verdict_source,
            "extracted_text": extracted_text,
            "source_panel": panel
        })
        overall_statuses.append(final_verdict)

    # Add Visual Layout Evaluation Field
    vis_data = visual_compliance_res if visual_compliance_res else {}
    grouping_ok = vis_data.get("grouping_compliant", True)
    vis_notes = vis_data.get("notes", "Visual layout compliant.")

    evaluated_fields.append({
        "rule_id": "RULE-7-LAYOUT",
        "field_key": "visual_grouping_prominence",
        "label": "Declaration Layout & Prominence",
        "rule_name": "Visual Layout Compliance",
        "mandatory": True,
        "legal_reference": f"Rule 6(1): {vis_notes}",
        "cited_rule_clause": "Rule 6(1)",
        "status": "PASS" if grouping_ok else "NEEDS_HUMAN_REVIEW",
        "confidence": round(vis_data.get("confidence", 0.90), 2),
        "verdict_source": "RAG_JUDGE",
        "extracted_text": vis_notes,
        "source_panel": panel
    })

    # Overall Inspection Verdict Determination (PASS if extracted fields pass)
    if any(s == "FAIL" for s in overall_statuses):
        overall_verdict = "FAIL"
    elif any(s == "NEEDS_HUMAN_REVIEW" for s in overall_statuses) or not grouping_ok:
        overall_verdict = "NEEDS_HUMAN_REVIEW"
    elif any(s == "PASS" for s in overall_statuses):
        overall_verdict = "PASS"
    else:
        overall_verdict = "PASS"

    return {
        "overall_status": overall_verdict,
        "fields": evaluated_fields,
        "is_exempt": is_exempt,
        "exemption_reason": exemption_reason
    }
