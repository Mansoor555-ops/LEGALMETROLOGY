import os
import io
import json
import time
import shutil
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

DATASET_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data", "training_dataset")
IMAGES_DIR = os.path.join(DATASET_DIR, "images")
ANNOTATIONS_FILE = os.path.join(DATASET_DIR, "annotations.jsonl")

def _ensure_dirs():
    os.makedirs(IMAGES_DIR, exist_ok=True)
    if not os.path.exists(ANNOTATIONS_FILE):
        with open(ANNOTATIONS_FILE, "w", encoding="utf-8") as f:
            pass

def save_scan_training_sample(
    image_bytes: bytes,
    inspection_id: str,
    extracted_fields: List[Dict[str, Any]],
    category: str = "Packaged Food",
    source_panel: str = "panel"
) -> Optional[str]:
    """
    Saves a scanned label image and its extractions into the self-learning local dataset.
    """
    if not image_bytes:
        return None

    try:
        _ensure_dirs()
        sample_id = f"SAMPLE-{inspection_id}-{source_panel}-{int(time.time())}"
        img_filename = f"{sample_id}.jpg"
        img_path = os.path.join(IMAGES_DIR, img_filename)

        # Save image file
        with open(img_path, "wb") as f:
            f.write(image_bytes)

        # Standardize ground truth fields
        ground_truth = {}
        for f in extracted_fields:
            key = f.get("field_key")
            if not key: continue
            txt = (f.get("extracted_text") or "").strip()
            if txt and txt.lower() != "not found":
                ground_truth[key] = {
                    "text": txt,
                    "status": f.get("status", "PASS"),
                    "confidence": f.get("confidence", 0.90)
                }

        annotation_record = {
            "sample_id": sample_id,
            "inspection_id": inspection_id,
            "image_filename": img_filename,
            "image_path": f"/data/training_dataset/images/{img_filename}",
            "category": category,
            "source_panel": source_panel,
            "ground_truth": ground_truth,
            "is_officer_verified": False,
            "created_at": datetime.now().isoformat()
        }

        with open(ANNOTATIONS_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(annotation_record, ensure_ascii=False) + "\n")

        logger.info(f"Self-learning dataset: Saved training sample {sample_id} ({len(ground_truth)} fields).")
        return sample_id

    except Exception as e:
        logger.warning(f"Error saving training sample: {e}")
        return None

def update_ground_truth_from_officer_override(
    inspection_id: str,
    field_key: str,
    corrected_text: str,
    new_status: str
) -> bool:
    """
    Updates dataset ground truth when an officer submits a manual correction/override.
    Marks the sample as high-priority verified ground truth.
    """
    if not os.path.exists(ANNOTATIONS_FILE):
        return False

    try:
        updated = False
        records = []
        with open(ANNOTATIONS_FILE, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip(): continue
                rec = json.loads(line)
                if rec.get("inspection_id") == inspection_id:
                    gt = rec.get("ground_truth", {})
                    gt[field_key] = {
                        "text": corrected_text,
                        "status": new_status,
                        "confidence": 1.0
                    }
                    rec["ground_truth"] = gt
                    rec["is_officer_verified"] = True
                    rec["verified_at"] = datetime.now().isoformat()
                    updated = True
                records.append(rec)

        if updated:
            with open(ANNOTATIONS_FILE, "w", encoding="utf-8") as f:
                for rec in records:
                    f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            logger.info(f"Self-learning dataset: Updated officer ground truth for inspection {inspection_id}, field {field_key}.")
            return True

    except Exception as e:
        logger.warning(f"Error updating officer ground truth: {e}")

    return False

def get_dataset_stats() -> Dict[str, Any]:
    """
    Returns current self-learning dataset statistics.
    """
    _ensure_dirs()
    total_samples = 0
    verified_samples = 0
    field_counts: Dict[str, int] = {}

    if os.path.exists(ANNOTATIONS_FILE):
        with open(ANNOTATIONS_FILE, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip(): continue
                try:
                    rec = json.loads(line)
                    total_samples += 1
                    if rec.get("is_officer_verified"):
                        verified_samples += 1
                    gt = rec.get("ground_truth", {})
                    for fk in gt.keys():
                        field_counts[fk] = field_counts.get(fk, 0) + 1
                except Exception:
                    pass

    return {
        "total_training_samples": total_samples,
        "officer_verified_samples": verified_samples,
        "silver_auto_samples": total_samples - verified_samples,
        "field_sample_counts": field_counts,
        "dataset_ready_for_training": total_samples >= 5
    }
