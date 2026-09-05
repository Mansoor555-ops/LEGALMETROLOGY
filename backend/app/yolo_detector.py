import os
import json
import numpy as np
from typing import Tuple, Dict, Any, List

_trained_knn_model = None

def get_knn_model():
    global _trained_knn_model
    if _trained_knn_model is not None:
        return _trained_knn_model

    model_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "models", "legal_metrology_knn.json"))
    if os.path.exists(model_path):
        try:
            with open(model_path, "r") as f:
                _trained_knn_model = json.load(f)
            print(f"[ML MODEL] Loaded custom trained Legal Metrology model from {model_path}")
            return _trained_knn_model
        except Exception as e:
            print(f"[ML MODEL LOAD WARNING] Could not load model JSON: {e}")
    return None

def extract_features(crop: np.ndarray, cx: float, cy: float, w: float, h: float) -> np.ndarray:
    import cv2
    aspect_ratio = float(w) / (h + 1e-5)
    area = float(w * h)

    mean_val, std_val = cv2.meanStdDev(crop)
    r_mean, g_mean, b_mean = float(mean_val[2][0]), float(mean_val[1][0]), float(mean_val[0][0])
    r_std, g_std, b_std = float(std_val[2][0]), float(std_val[1][0]), float(std_val[0][0])

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    edge_density = float(np.mean(np.abs(sobelx) + np.abs(sobely)))

    features = [cx, cy, w, h, aspect_ratio, area, r_mean, g_mean, b_mean, r_std, g_std, edge_density]
    return np.array(features, dtype=np.float64)

def classify_region_crop(crop: np.ndarray, cx: float, cy: float, w: float, h: float) -> int:
    model = get_knn_model()
    if model is None:
        return -1

    feats = extract_features(crop, cx, cy, w, h)
    mean = np.array(model["mean"])
    std = np.array(model["std"])
    X_train = np.array(model["X_train"])
    Y_train = np.array(model["Y_train"])

    feat_norm = (feats - mean) / std
    distances = np.linalg.norm(X_train - feat_norm, axis=1)
    k_indices = np.argsort(distances)[:model["k"]]
    k_labels = Y_train[k_indices]
    counts = np.bincount(k_labels)
    return int(np.argmax(counts))

def detect_and_crop_regions(image_bytes: bytes) -> Tuple[Dict[str, bytes], Dict[str, Any]]:
    """
    Detection-First Stage 1 & 2:
    Locates spatial region bounding boxes on the label using custom trained Legal Metrology model
    and crops each region into an isolated byte stream for targeted OCR.
    """
    regions_map = {}
    metadata = {"methods": []}

    try:
        import cv2
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is not None:
            h, w, _ = img.shape
            metadata["original_size"] = [w, h]

            model = get_knn_model()
            if model is not None:
                metadata["methods"].append("custom_legal_metrology_ml_inference")
                # Classify candidate bounding region slices
                slices = [
                    (0.5, 0.175, 1.0, 0.35, 0),  # top / header
                    (0.5, 0.50,  1.0, 0.60, 1),  # center / declarations
                    (0.5, 0.75,  1.0, 0.50, 5),  # lower / manufacturer
                    (0.7, 0.775, 0.6, 0.45, 7)   # lower right / barcode
                ]
                for cx, cy, sw, sh, default_cls in slices:
                    x1, y1 = int(max(0, (cx - sw/2)*w)), int(max(0, (cy - sh/2)*h))
                    x2, y2 = int(min(w, (cx + sw/2)*w)), int(min(h, (cy + sh/2)*h))
                    crop = img[y1:y2, x1:x2]
                    if crop.size > 0:
                        pred_cls = classify_region_crop(crop, cx, cy, sw, sh)
                        cls_to_use = pred_cls if pred_cls >= 0 else default_cls
                        _, enc = cv2.imencode('.jpg', crop)
                        
                        if cls_to_use == 0:
                            regions_map["header"] = enc.tobytes()
                        elif cls_to_use in [1, 2, 3, 4]:
                            regions_map["declarations"] = enc.tobytes()
                        elif cls_to_use in [5, 6]:
                            regions_map["manufacturer"] = enc.tobytes()
                        elif cls_to_use == 7:
                            regions_map["barcode"] = enc.tobytes()

            # Ensure all fallback region fields exist
            if "header" not in regions_map:
                _, enc = cv2.imencode('.jpg', img[0:int(h * 0.35), 0:w])
                regions_map["header"] = enc.tobytes()

            if "declarations" not in regions_map:
                _, enc = cv2.imencode('.jpg', img[int(h * 0.20):int(h * 0.80), 0:w])
                regions_map["declarations"] = enc.tobytes()

            if "manufacturer" not in regions_map:
                _, enc = cv2.imencode('.jpg', img[int(h * 0.50):h, 0:w])
                regions_map["manufacturer"] = enc.tobytes()

            if "barcode" not in regions_map:
                _, enc = cv2.imencode('.jpg', img[int(h * 0.55):h, int(w * 0.40):w])
                regions_map["barcode"] = enc.tobytes()

            metadata["methods"].append("spatial_region_segmentation")
            return regions_map, metadata
    except Exception as e:
        print(f"Region segmentation note: {e}")

    regions_map = {
        "header": image_bytes,
        "declarations": image_bytes,
        "manufacturer": image_bytes,
        "barcode": image_bytes
    }
    return regions_map, metadata


def crop_label_region(image_bytes: bytes) -> Tuple[bytes, Dict[str, Any]]:
    """
    Main product label region crop.
    """
    regions, meta = detect_and_crop_regions(image_bytes)
    return regions.get("declarations", image_bytes), meta

