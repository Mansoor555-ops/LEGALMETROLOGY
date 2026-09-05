import os
import json
import io
from PIL import Image, ImageDraw
from app.extractor import load_panel_expectations, evaluate_rules_for_panel
from app.quality import check_image_quality

def test_live_check_logic():
    print("=== Testing Panel Expectations Config ===")
    expectations = load_panel_expectations()
    print("Panel Expectations:", json.dumps(expectations, indent=2))
    assert "front" in expectations
    assert "back" in expectations
    assert "mrp" in expectations["front"]

    print("\n=== Testing Live Check Image Generation & Quality ===")
    img = Image.new("RGB", (800, 600), color=(240, 240, 240))
    draw = ImageDraw.Draw(img)
    draw.text((50, 50), "MRP Rs 250.00 inclusive of all taxes", fill=(0,0,0))
    draw.text((50, 100), "Net Qty: 500g", fill=(0,0,0))
    draw.text((50, 150), "Generic Name: Packaged Water", fill=(0,0,0))
    
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='JPEG', quality=85)
    img_bytes = img_byte_arr.getvalue()

    q_res = check_image_quality(img_bytes)
    print("Quality result:", q_res)

    ocr_mock = {
        "full_text": "MRP Rs 250.00 inclusive of all taxes Net Qty: 500g Generic Name: Packaged Water",
        "lines": [
            {"text": "MRP Rs 250.00 inclusive of all taxes", "confidence": 0.95},
            {"text": "Net Qty: 500g", "confidence": 0.92},
            {"text": "Generic Name: Packaged Water", "confidence": 0.88}
        ],
        "avg_confidence": 0.92
    }

    evaluated = evaluate_rules_for_panel(ocr_mock, "Packaged Food", "front")
    print("\nEvaluated Front Panel Fields:")
    for f in evaluated:
        print(f" - [{f['status']}] {f['field_key']}: {f.get('extracted_text')}")

    print("\nAll live-check unit tests passed successfully!")

if __name__ == "__main__":
    test_live_check_logic()
