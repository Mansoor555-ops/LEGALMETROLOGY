import io
import urllib.request
import json
from PIL import Image, ImageDraw

def test_api():
    img = Image.new("RGB", (800, 600), color=(160, 160, 160))
    draw = ImageDraw.Draw(img)
    draw.rectangle([50, 50, 750, 550], fill=(200, 200, 200), outline=(0, 0, 0), width=4)
    draw.text((80, 80), "MRP Rs 250.00 inclusive of all taxes", fill=(0, 0, 0))
    draw.text((80, 140), "Net Qty 500g", fill=(0, 0, 0))
    draw.text((80, 200), "Packaged Drinking Water", fill=(0, 0, 0))

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80)
    img_bytes = buf.getvalue()

    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = bytearray()
    
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(b'Content-Disposition: form-data; name="image"; filename="frame.jpg"\r\n')
    body.extend(b"Content-Type: image/jpeg\r\n\r\n")
    body.extend(img_bytes)
    body.extend(b"\r\n")

    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(b'Content-Disposition: form-data; name="panel"\r\n\r\nfront\r\n')

    body.extend(f"--{boundary}--\r\n".encode("utf-8"))

    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/inspect/live-check",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )

    try:
        response = urllib.request.urlopen(req)
        res_data = json.loads(response.read().decode("utf-8"))
        print("[SUCCESS] /api/inspect/live-check endpoint response:")
        print(json.dumps(res_data, indent=2))
    except Exception as e:
        print("[ERROR]", e)

if __name__ == "__main__":
    test_api()
