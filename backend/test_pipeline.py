import json
from app.extractor import evaluate_rules_for_panel, evaluate_exemption
from app.merger import merge_multi_panel_results

def test_mock_pipeline():
    print("=== Testing Exemption Logic ===")
    is_ex, reason = evaluate_exemption("50 kg", True)
    print(f"50kg + Institutional -> Exempt: {is_ex} ({reason})")

    is_ex2, reason2 = evaluate_exemption("500 g", False)
    print(f"500g + Non-Institutional -> Exempt: {is_ex2}")

    print("\n=== Testing Rule Extraction Engine ===")
    ocr_front = {
        "full_text": "PURE WHEAT ATTA Net Qty 500g Made in India",
        "lines": [
            {"text": "PURE WHEAT ATTA", "confidence": 0.90, "bbox": [10, 10, 200, 40]},
            {"text": "Net Qty 500g", "confidence": 0.95, "bbox": [10, 50, 150, 80]},
            {"text": "Made in India", "confidence": 0.92, "bbox": [10, 90, 150, 120]}
        ]
    }

    ocr_back = {
        "full_text": "MRP Rs 250.00 inclusive of all taxes Mfg Date 08/2026 Mfd by PureFoods Pvt Ltd Customer Care 1800-11-2233 care@purefoods.in",
        "lines": [
            {"text": "MRP Rs 250.00 inclusive of all taxes", "confidence": 0.94, "bbox": [10, 10, 300, 40]},
            {"text": "Mfg Date 08/2026", "confidence": 0.89, "bbox": [10, 50, 200, 80]},
            {"text": "Mfd by PureFoods Pvt Ltd", "confidence": 0.91, "bbox": [10, 90, 250, 120]},
            {"text": "Customer Care 1800-11-2233 care@purefoods.in", "confidence": 0.88, "bbox": [10, 130, 350, 160]}
        ]
    }

    front_fields = evaluate_rules_for_panel(ocr_front, category="Packaged Food", panel_name="front")
    back_fields = evaluate_rules_for_panel(ocr_back, category="Packaged Food", panel_name="back")

    panel_map = {
        "front": front_fields,
        "back": back_fields
    }

    merged_fields, overall_status = merge_multi_panel_results(panel_map)

    print(f"\nOverall Compliance Status: {overall_status}")
    print("\nMerged Declarations Evaluation:")
    for f in merged_fields:
        print(f" - [{f['status']}] {f['label']}: '{f['extracted_text']}' (Conf: {f['confidence']*100:.0f}%, Panel: {f['source_panel']})")

if __name__ == "__main__":
    test_mock_pipeline()
