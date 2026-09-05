import os
from PIL import Image, ImageDraw, ImageFont

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

def create_front_panel():
    img = Image.new("RGB", (600, 800), color=(245, 247, 250))
    draw = ImageDraw.Draw(img)
    
    # Border
    draw.rectangle([20, 20, 580, 780], outline=(11, 61, 110), width=4)
    
    # Text
    draw.text((180, 80), "PURE WHEAT ATTA", fill=(11, 61, 110))
    draw.text((200, 140), "Whole Wheat Flour", fill=(50, 50, 50))
    draw.text((220, 220), "Net Qty: 500 g", fill=(0, 100, 0))
    draw.text((210, 300), "Country of Origin: India", fill=(50, 50, 50))
    
    img_path = os.path.join(UPLOADS_DIR, "sample_front.jpg")
    img.save(img_path)
    print(f"Created {img_path}")

def create_back_panel():
    img = Image.new("RGB", (600, 800), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    # Border
    draw.rectangle([20, 20, 580, 780], outline=(71, 85, 105), width=3)
    
    # Text
    draw.text((50, 60), "MANDATORY PRODUCT DECLARATIONS", fill=(15, 23, 42))
    draw.text((50, 120), "MRP ₹250.00 (inclusive of all taxes)", fill=(0, 0, 0))
    draw.text((50, 180), "Mfg Date: 08/2026", fill=(0, 0, 0))
    draw.text((50, 240), "Manufactured by: PureFoods India Pvt Ltd", fill=(0, 0, 0))
    draw.text((50, 280), "Plot 42, Okhla Ind Area, New Delhi - 110020", fill=(0, 0, 0))
    draw.text((50, 340), "Customer Care: 1800-11-2233", fill=(0, 0, 0))
    draw.text((50, 380), "Email: care@purefoods.in", fill=(0, 0, 0))
    
    img_path = os.path.join(UPLOADS_DIR, "sample_back.jpg")
    img.save(img_path)
    print(f"Created {img_path}")

def create_violation_back_panel():
    img = Image.new("RGB", (600, 800), color=(255, 250, 245))
    draw = ImageDraw.Draw(img)
    
    # Border
    draw.rectangle([20, 20, 580, 780], outline=(185, 28, 28), width=3)
    
    # Text with missing mandatory clauses
    draw.text((50, 60), "GLOWCARE ORGANICS FACE WASH", fill=(15, 23, 42))
    draw.text((50, 120), "MRP Rs 180", fill=(0, 0, 0)) # Missing "inclusive of all taxes"
    draw.text((50, 180), "Packed: Jul 2026", fill=(0, 0, 0))
    draw.text((50, 240), "Mfg by GlowCare Organics, Peenya, Bengaluru", fill=(0, 0, 0))
    draw.text((50, 300), "Contact Manager for feedback", fill=(0, 0, 0)) # Missing email/toll-free
    
    img_path = os.path.join(UPLOADS_DIR, "sample_violation_back.jpg")
    img.save(img_path)
    print(f"Created {img_path}")

if __name__ == "__main__":
    create_front_panel()
    create_back_panel()
    create_violation_back_panel()
