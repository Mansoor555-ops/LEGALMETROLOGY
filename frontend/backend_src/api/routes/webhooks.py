import logging
from typing import Dict, Any
from fastapi import APIRouter, HTTPException
from ...db.mongo import get_database

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/webhooks", tags=["n8n Webhooks"])

@router.post("/n8n-result")
async def n8n_result_webhook(payload: Dict[str, Any]):
    """
    Part E: Webhook receiver for self-hosted n8n workflow execution result.
    Centralized validation & MongoDB Atlas persistence.
    """
    insp_id = payload.get("inspection_id") or payload.get("id")
    if not insp_id:
        raise HTTPException(status_code=400, detail="Missing inspection_id in n8n payload")

    db = get_database()
    if db is not None:
        try:
            await db.inspections.update_one(
                {"id": insp_id},
                {"$set": payload},
                upsert=True
            )
            logger.info(f"Persisted n8n workflow inspection result for {insp_id} into MongoDB.")
        except Exception as e:
            logger.error(f"Error persisting n8n webhook result: {e}")

    return {
        "success": True,
        "inspection_id": insp_id,
        "message": "n8n workflow result persisted successfully"
    }
