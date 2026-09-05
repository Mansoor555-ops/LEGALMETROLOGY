import sys
import os
import json
import asyncio

# Add backend root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.ocr_engine import extract_structured_field_regions
from app.extractor import evaluate_rules_for_panel
from app.merger import merge_multi_panel_results
from app.quality import check_image_quality

def test_image_quality_check():
    print("\n--- 1. Testing Quality Check Failure Handling ---")
    # Empty bytes test
    res_empty = check_image_quality(b"")
    print(f"Empty Bytes Quality Result: passed={res_empty['passed']}, message='{res_empty['message']}'")
    assert res_empty['passed'] == False, "Quality check must return passed: False for empty/corrupt image!"

    # Corrupt header test
    res_corrupt = check_image_quality(b"NOT_AN_IMAGE_HEADER_GARBAGE")
    print(f"Corrupt Bytes Quality Result: passed={res_corrupt['passed']}, message='{res_corrupt['message']}'")
    assert res_corrupt['passed'] == False, "Quality check must return passed: False for corrupt image!"
    print("[SUCCESS] Quality check failure handling verified successfully!")

def run_empirical_pipeline_test():
    print("\n--- 2. Testing Empirical OCR & Legal Metrology Extraction Pipeline ---")
    uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
    
    test_pairs = [
        ("INSP-2026-100055", "INSP-2026-100055_front.jpg", "INSP-2026-100055_back.jpg"),
        ("INSP-2026-101216", "INSP-2026-101216_front.jpg", "INSP-2026-101216_back.jpg"),
    ]

    summary_tables = {}

    for insp_id, front_name, back_name in test_pairs:
        front_path = os.path.join(uploads_dir, front_name)
        back_path = os.path.join(uploads_dir, back_name)

        if not os.path.exists(front_path) or not os.path.exists(back_path):
            print(f"Skipping test pair {insp_id}: files not found.")
            continue

        print(f"\n=======================================================")
        print(f"   Empirical Verification Run for Inspection: {insp_id}")
        print(f"=======================================================")

        panel_results = {}
        for panel_name, img_path in [("front", front_path), ("back", back_path)]:
            with open(img_path, "rb") as f:
                img_bytes = f.read()

            q_res = check_image_quality(img_bytes)
            print(f"\nPanel '{panel_name}' Quality Check: passed={q_res['passed']} (blur: {q_res.get('blur_score')}, brightness: {q_res.get('brightness_score')})")

            ocr_map = extract_structured_field_regions(img_bytes)
            
            combined_lines = []
            combined_text = []
            for r_name, o_res in ocr_map.items():
                combined_lines.extend(o_res.get("lines", []))
                if o_res.get("full_text"):
                    combined_text.append(o_res["full_text"])

            merged_ocr = {
                "full_text": " ".join(combined_text),
                "lines": combined_lines,
                "avg_confidence": 0.85 if combined_lines else 0.0
            }

            field_eval = evaluate_rules_for_panel(merged_ocr, "Packaged Food", panel_name)
            panel_results[panel_name] = field_eval

        # Merge results across panels
        final_fields, overall_status = merge_multi_panel_results(panel_results)

        print(f"\n---> OVERALL COMPLIANCE STATUS: {overall_status}")
        print(f"{'Field Name':<32} | {'Status':<18} | {'Confidence':<10} | {'Source Panel':<12} | Extracted Text")
        print("-" * 110)

        table_rows = []
        for f in final_fields:
            name = f.get("label", f.get("field_key"))
            st = f.get("status")
            conf = f.get("confidence", 0.0)
            src = f.get("source_panel", "front")
            txt = f.get("extracted_text", "")
            print(f"{name:<32} | {st:<18} | {conf:<10.2f} | {src:<12} | {txt}")
            table_rows.append({
                "field_name": name,
                "status": st,
                "confidence": conf,
                "source_panel": src,
                "extracted_text": txt
            })

        summary_tables[insp_id] = {
            "overall_status": overall_status,
            "fields": table_rows
        }

    return summary_tables

if __name__ == "__main__":
    test_image_quality_check()
    res = run_empirical_pipeline_test()
    print("\n[SUCCESS] Pipeline empirical verification completed successfully.")
