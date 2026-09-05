import os
import random
from PIL import Image, ImageDraw

DATASET_DIR = os.path.abspath("dataset")
TRAIN_IMG_DIR = os.path.join(DATASET_DIR, "images", "train")
VAL_IMG_DIR = os.path.join(DATASET_DIR, "images", "val")
TRAIN_LBL_DIR = os.path.join(DATASET_DIR, "labels", "train")
VAL_LBL_DIR = os.path.join(DATASET_DIR, "labels", "val")

os.makedirs(TRAIN_IMG_DIR, exist_ok=True)
os.makedirs(VAL_IMG_DIR, exist_ok=True)
os.makedirs(TRAIN_LBL_DIR, exist_ok=True)
os.makedirs(VAL_LBL_DIR, exist_ok=True)

CLASSES = [
    "brand_header",          # 0
    "generic_name",          # 1
    "net_qty",               # 2
    "mrp_declaration",       # 3
    "mfg_date",              # 4
    "manufacturer_details",  # 5
    "customer_care",         # 6
    "barcode"                # 7
]

# Write dataset.yaml
yaml_path = os.path.join(DATASET_DIR, "dataset.yaml")
yaml_content = f"""path: {DATASET_DIR}
train: images/train
val: images/val

names:
  0: brand_header
  1: generic_name
  2: net_qty
  3: mrp_declaration
  4: mfg_date
  5: manufacturer_details
  6: customer_care
  7: barcode
"""

with open(yaml_path, "w") as f:
    f.write(yaml_content)

print(f"[DATASET] Wrote YOLO dataset configuration to {yaml_path}")

BRANDS = ["PURE HARVEST", "AQUA LIFE", "NUTRI-SELECT", "ROYAL SPICE", "HERBAL CARE", "GOLDEN GRAIN", "SUNSHINE OILS"]
PRODUCTS = ["Packaged Drinking Water", "Refined Sunflower Oil", "Whole Wheat Atta", "Organic Honey", "Almond Milk", "Tea Powder"]
QTYS = ["Net Qty: 1.5 Litres", "Net Wt: 500g", "Net Vol: 750 ml", "Net Qty: 5 kg", "Net Qty: 1 L"]
MRPS = ["MRP Rs 250.00 (inclusive of all taxes)", "MRP Rs. 45.00 incl. of all taxes", "MRP Rs 120.00 (INCL. OF ALL TAXES)"]
DATES = ["Mfg Date: 08/2026", "PKD: 12/2025", "MFG 01/2026", "Packed: 05/2026"]
MANUFACTURERS = [
    "Mfd by: PureFoods India Pvt Ltd, Plot 42, Sector 18, Gurugram, HR - 122015",
    "Mkt by: Apex Consumer Products Ltd, MIDC Phase 2, Pune, MH - 411018",
    "Packed by: Nature Fresh Foods, Industrial Area, Solan, HP - 173212"
]
HELPLINES = [
    "Consumer Helpline: 1800-11-2233 | Email: care@purefoods.in",
    "Customer Care: 1800-22-9988 | feedback@apexproducts.com",
    "Toll Free: 1800-425-0000 | support@naturefresh.co.in"
]

def generate_sample_image(idx, is_val=False):
    width, height = 640, 640
    # Background color
    bg_color = (random.randint(235, 255), random.randint(235, 255), random.randint(235, 255))
    img = Image.new("RGB", (width, height), color=bg_color)
    draw = ImageDraw.Draw(img)

    # Draw simulated container / label border
    container_box = [40, 40, 600, 600]
    draw.rectangle(container_box, outline=(60, 60, 60), width=4)

    boxes = []

    # 0. Brand Header
    brand_text = random.choice(BRANDS)
    y0 = 60
    draw.rectangle([60, y0, 580, y0 + 60], fill=(random.randint(180, 220), random.randint(200, 240), random.randint(220, 250)))
    draw.text((70, y0 + 15), brand_text, fill=(20, 20, 80))
    boxes.append((0, 60, y0, 520, 60))

    # 1. Generic Name
    prod_text = random.choice(PRODUCTS)
    y1 = 140
    draw.rectangle([60, y1, 580, y1 + 45], fill=(240, 240, 240))
    draw.text((70, y1 + 10), f"Commodity: {prod_text}", fill=(10, 10, 10))
    boxes.append((1, 60, y1, 520, 45))

    # 2. Net Qty
    qty_text = random.choice(QTYS)
    y2 = 200
    draw.rectangle([60, y2, 300, y2 + 40], fill=(230, 245, 230))
    draw.text((70, y2 + 10), qty_text, fill=(0, 100, 0))
    boxes.append((2, 60, y2, 240, 40))

    # 3. MRP Declaration
    mrp_text = random.choice(MRPS)
    y3 = 250
    draw.rectangle([60, y3, 580, y3 + 45], fill=(255, 235, 235))
    draw.text((70, y3 + 10), mrp_text, fill=(180, 0, 0))
    boxes.append((3, 60, y3, 520, 45))

    # 4. Mfg Date
    date_text = random.choice(DATES)
    y4 = 305
    draw.rectangle([320, y2, 580, y2 + 40], fill=(235, 235, 245))
    draw.text((330, y2 + 10), date_text, fill=(0, 0, 120))
    boxes.append((4, 320, y2, 260, 40))

    # 5. Manufacturer Details
    mfg_text = random.choice(MANUFACTURERS)
    y5 = 360
    draw.rectangle([60, y5, 580, y5 + 60], fill=(250, 250, 240))
    draw.text((70, y5 + 10), mfg_text[:45], fill=(30, 30, 30))
    draw.text((70, y5 + 30), mfg_text[45:], fill=(30, 30, 30))
    boxes.append((5, 60, y5, 520, 60))

    # 6. Customer Care
    cc_text = random.choice(HELPLINES)
    y6 = 430
    draw.rectangle([60, y6, 580, y6 + 45], fill=(245, 245, 250))
    draw.text((70, y6 + 10), cc_text, fill=(40, 40, 40))
    boxes.append((6, 60, y6, 520, 45))

    # 7. Barcode
    y7 = 490
    draw.rectangle([180, y7, 460, y7 + 90], fill=(255, 255, 255), outline=(0, 0, 0), width=2)
    for bx in range(200, 440, 6):
        w_line = random.choice([2, 3, 4])
        draw.rectangle([bx, y7 + 10, bx + w_line, y7 + 65], fill=(0, 0, 0))
    draw.text((220, y7 + 70), "8901234567890", fill=(0, 0, 0))
    boxes.append((7, 180, y7, 280, 90))

    target_img_dir = VAL_IMG_DIR if is_val else TRAIN_IMG_DIR
    target_lbl_dir = VAL_LBL_DIR if is_val else TRAIN_LBL_DIR

    img_filename = f"sample_{'val' if is_val else 'train'}_{idx:03d}.jpg"
    lbl_filename = f"sample_{'val' if is_val else 'train'}_{idx:03d}.txt"

    img_path = os.path.join(target_img_dir, img_filename)
    lbl_path = os.path.join(target_lbl_dir, lbl_filename)

    img.save(img_path, quality=95)

    yolo_lines = []
    for cls_id, x, y, w, h in boxes:
        cx = (x + w / 2.0) / width
        cy = (y + h / 2.0) / height
        nw = w / width
        nh = h / height
        yolo_lines.append(f"{cls_id} {cx:.6f} {cy:.6f} {nw:.6f} {nh:.6f}")

    with open(lbl_path, "w") as f:
        f.write("\n".join(yolo_lines) + "\n")

print("[DATASET GENERATOR] Generating 40 training samples and 10 validation samples...")
for i in range(40):
    generate_sample_image(i, is_val=False)
for i in range(10):
    generate_sample_image(i, is_val=True)

print("[DATASET GENERATOR] Synthetic Legal Metrology dataset generated successfully.")

def run_training():
    try:
        from ultralytics import YOLO
        print("[TRAINING] Ultralytics imported successfully. Starting YOLOv8 fine-tuning...")
        model = YOLO("yolov8n.pt")
        
        results = model.train(
            data=yaml_path,
            epochs=5,
            imgsz=640,
            batch=8,
            project=os.path.abspath("runs"),
            name="legal_metrology_yolo",
            exist_ok=True,
            verbose=True
        )
        print("[TRAINING] YOLOv8 model training complete!")
        
        models_dir = os.path.abspath(os.path.join("app", "models"))
        os.makedirs(models_dir, exist_ok=True)
        best_pt = os.path.join("runs", "legal_metrology_yolo", "weights", "best.pt")
        target_pt = os.path.join(models_dir, "legal_metrology_yolo.pt")
        
        if os.path.exists(best_pt):
            import shutil
            shutil.copy(best_pt, target_pt)
            print(f"[MODEL SAVED] Best trained model copied to: {target_pt}")
        else:
            print(f"[MODEL SAVED] Check runs/legal_metrology_yolo for weights.")
            
    except Exception as e:
        print(f"[TRAINING ERROR] {e}")

if __name__ == "__main__":
    run_training()
