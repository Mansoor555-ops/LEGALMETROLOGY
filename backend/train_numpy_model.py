import os
import cv2
import json
import numpy as np
from typing import Tuple, List, Dict, Any

DATASET_DIR = os.path.abspath("dataset")
TRAIN_IMG_DIR = os.path.join(DATASET_DIR, "images", "train")
TRAIN_LBL_DIR = os.path.join(DATASET_DIR, "labels", "train")
VAL_IMG_DIR = os.path.join(DATASET_DIR, "images", "val")
VAL_LBL_DIR = os.path.join(DATASET_DIR, "labels", "val")

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

def extract_features(img: np.ndarray, cx: float, cy: float, w: float, h: float) -> np.ndarray:
    """
    Extracts normalized 12-D spatial, geometry, color, and texture features.
    """
    img_h, img_w, _ = img.shape
    x1 = int(max(0, (cx - w / 2.0) * img_w))
    y1 = int(max(0, (cy - h / 2.0) * img_h))
    x2 = int(min(img_w, (cx + w / 2.0) * img_w))
    y2 = int(min(img_h, (cy + h / 2.0) * img_h))

    crop = img[y1:y2, x1:x2]
    if crop.size == 0:
        crop = img

    aspect_ratio = float(w) / (h + 1e-5)
    area = float(w * h)

    # Color stats
    mean_val, std_val = cv2.meanStdDev(crop)
    r_mean, g_mean, b_mean = float(mean_val[2][0]), float(mean_val[1][0]), float(mean_val[0][0])
    r_std, g_std, b_std = float(std_val[2][0]), float(std_val[1][0]), float(std_val[0][0])

    # Edge density
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    edge_density = float(np.mean(np.abs(sobelx) + np.abs(sobely)))

    features = [
        float(cx), float(cy), float(w), float(h),
        aspect_ratio, area,
        r_mean, g_mean, b_mean,
        r_std, g_std,
        edge_density
    ]
    return np.array(features, dtype=np.float64)

def load_dataset(img_dir: str, lbl_dir: str) -> Tuple[np.ndarray, np.ndarray]:
    X, Y = [], []
    for fname in os.listdir(lbl_dir):
        if fname.endswith(".txt"):
            base_name = fname[:-4]
            img_path = os.path.join(img_dir, base_name + ".jpg")
            lbl_path = os.path.join(lbl_dir, fname)

            if os.path.exists(img_path):
                img = cv2.imread(img_path)
                if img is not None:
                    with open(lbl_path, "r") as f:
                        for line in f:
                            parts = line.strip().split()
                            if len(parts) == 5:
                                cls_id = int(parts[0])
                                cx, cy, w, h = map(float, parts[1:])
                                feat = extract_features(img, cx, cy, w, h)
                                X.append(feat)
                                Y.append(cls_id)

    return np.array(X, dtype=np.float64), np.array(Y, dtype=np.int32)

class PureNumPyKNNModel:
    def __init__(self, k: int = 3):
        self.k = k
        self.X_train = None
        self.Y_train = None
        self.mean = None
        self.std = None

    def fit(self, X: np.ndarray, Y: np.ndarray):
        self.mean = np.mean(X, axis=0)
        self.std = np.std(X, axis=0) + 1e-8
        self.X_train = (X - self.mean) / self.std
        self.Y_train = Y

    def predict(self, X: np.ndarray) -> np.ndarray:
        X_norm = (X - self.mean) / self.std
        predictions = []
        for sample in X_norm:
            distances = np.linalg.norm(self.X_train - sample, axis=1)
            k_indices = np.argsort(distances)[:self.k]
            k_labels = self.Y_train[k_indices]
            counts = np.bincount(k_labels)
            predictions.append(np.argmax(counts))
        return np.array(predictions, dtype=np.int32)

    def save(self, file_path: str):
        data = {
            "k": self.k,
            "mean": self.mean.tolist(),
            "std": self.std.tolist(),
            "X_train": self.X_train.tolist(),
            "Y_train": self.Y_train.tolist(),
            "classes": CLASSES
        }
        with open(file_path, "w") as f:
            json.dump(data, f, indent=2)

def train_and_save():
    print("[MODEL TRAINING] Loading 320 dataset features from generated Legal Metrology labels...")
    X_train, Y_train = load_dataset(TRAIN_IMG_DIR, TRAIN_LBL_DIR)
    X_val, Y_val = load_dataset(VAL_IMG_DIR, VAL_LBL_DIR)

    print(f"[DATASET INFO] Loaded {len(X_train)} training instances, {len(X_val)} validation instances.")

    model = PureNumPyKNNModel(k=3)
    model.fit(X_train, Y_train)

    train_preds = model.predict(X_train)
    train_acc = np.mean(train_preds == Y_train) * 100.0
    print(f"[TRAINING ACCURACY] {train_acc:.2f}%")

    val_preds = model.predict(X_val)
    val_acc = np.mean(val_preds == Y_val) * 100.0
    print(f"[VALIDATION ACCURACY] Pure NumPy Model Validation Accuracy: {val_acc:.2f}%")

    models_dir = os.path.abspath(os.path.join("app", "models"))
    os.makedirs(models_dir, exist_ok=True)
    save_path = os.path.join(models_dir, "legal_metrology_knn.json")
    model.save(save_path)
    print(f"[MODEL SAVED] Custom trained model JSON saved successfully to: {save_path}")

if __name__ == "__main__":
    train_and_save()
