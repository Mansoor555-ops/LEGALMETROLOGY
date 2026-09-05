import os
import cv2
import numpy as np
from typing import Tuple, List

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

def extract_features_from_region(img: np.ndarray, cx: float, cy: float, w: float, h: float) -> np.ndarray:
    """
    Extracts a 12-dimensional feature vector for spatial & visual region classification:
    [cx, cy, w, h, aspect_ratio, area, r_mean, g_mean, b_mean, r_std, g_std, edge_density]
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

    # Color statistics
    mean_val, std_val = cv2.meanStdDev(crop)
    r_mean, g_mean, b_mean = mean_val[2][0], mean_val[1][0], mean_val[0][0]
    r_std, g_std, b_std = std_val[2][0], std_val[1][0], std_val[0][0]

    # Edge density (Sobel gradient)
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    edge_density = float(np.mean(np.abs(sobelx) + np.abs(sobely)))

    features = [
        float(cx), float(cy), float(w), float(h),
        aspect_ratio, area,
        float(r_mean), float(g_mean), float(b_mean),
        float(r_std), float(g_std),
        edge_density
    ]
    return np.array(features, dtype=np.float32)

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
                                feat = extract_features_from_region(img, cx, cy, w, h)
                                X.append(feat)
                                Y.append(cls_id)

    return np.array(X, dtype=np.float32), np.array(Y, dtype=np.int32)

def train_and_evaluate():
    print("[MODEL TRAINING] Loading dataset features...")
    X_train, Y_train = load_dataset(TRAIN_IMG_DIR, TRAIN_LBL_DIR)
    X_val, Y_val = load_dataset(VAL_IMG_DIR, VAL_LBL_DIR)

    print(f"[DATASET INFO] Loaded {len(X_train)} training samples and {len(X_val)} validation samples.")

    # Create OpenCV Random Forest (RTrees) model
    rf = cv2.ml.RTrees_create()
    rf.setMaxDepth(10)
    rf.setMinSampleCount(2)
    rf.setRegressionAccuracy(0)
    rf.setUseSurrogates(False)
    rf.setMaxCategories(8)
    rf.setCVFolds(0)
    rf.setUse1SERule(True)
    rf.setTruncatePrunedTree(True)

    # Termination criteria: 50 trees or 0.01 precision
    term_crit = (cv2.TERM_CRITERIA_MAX_ITER + cv2.TERM_CRITERIA_EPS, 50, 0.01)
    rf.setTermCriteria(term_crit)

    # Train model
    train_data = cv2.ml.TrainData_create(
        samples=X_train,
        layout=cv2.ml.ROW_SAMPLE,
        responses=Y_train
    )

    print("[MODEL TRAINING] Training OpenCV Random Forest Classifier...")
    rf.train(train_data)
    print("[MODEL TRAINING] Model training completed successfully!")

    # Evaluate accuracy on validation set
    if len(X_val) > 0:
        _, results = rf.predict(X_val)
        pred_labels = results.ravel().astype(np.int32)
        accuracy = np.mean(pred_labels == Y_val) * 100.0
        print(f"[VALIDATION ACCURACY] OpenCV ML Model Validation Accuracy: {accuracy:.2f}%")

    # Save model XML file
    models_dir = os.path.abspath(os.path.join("app", "models"))
    os.makedirs(models_dir, exist_ok=True)
    model_save_path = os.path.join(models_dir, "legal_metrology_rf.xml")
    rf.save(model_save_path)
    print(f"[MODEL SAVED] Model XML successfully written to: {model_save_path}")

if __name__ == "__main__":
    train_and_evaluate()
