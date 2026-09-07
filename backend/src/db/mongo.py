import logging
from typing import Dict, Any, List, Optional
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import PyMongoError
from ..config import settings

logger = logging.getLogger(__name__)

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None

db_instance = MongoDB()

# In-memory storage fallbacks for offline / unconfigured mode
_memory_inspections: Dict[str, Dict[str, Any]] = {}
_memory_violations: Dict[str, Dict[str, Any]] = {}
_memory_products: Dict[str, Dict[str, Any]] = {}
_memory_corrections: Dict[str, Dict[str, Any]] = {}
_memory_rag_docs: Dict[str, Dict[str, Any]] = {}

async def connect_to_mongo():
    try:
        logger.info(f"Connecting to MongoDB at {settings.MONGODB_URI}...")
        db_instance.client = AsyncIOMotorClient(
            settings.MONGODB_URI,
            serverSelectionTimeoutMS=5000
        )
        db_instance.db = db_instance.client[settings.MONGODB_DB_NAME]
        
        # Ping server to confirm connection
        await db_instance.client.admin.command('ping')
        logger.info("Successfully connected to MongoDB.")
        
        # Create indexes across 5 collections
        await db_instance.db.inspections.create_index("id", unique=True)
        await db_instance.db.inspections.create_index("timestamp")
        await db_instance.db.violations.create_index("inspection_id")
        await db_instance.db.products.create_index("barcode", unique=True, sparse=True)
        await db_instance.db.corrections.create_index("inspection_id")
        await db_instance.db.rag_documents.create_index("chunk_id")
    except Exception as e:
        logger.warning(f"MongoDB connection note (operating with local fallback mode): {e}")

async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()
        logger.info("MongoDB connection closed.")

def get_database():
    return db_instance.db

async def save_inspection(inspection_doc: Dict[str, Any]) -> str:
    db = get_database()
    doc_copy = dict(inspection_doc)
    doc_copy.pop("_id", None)
    
    insp_id = doc_copy["id"]
    if db is not None:
        try:
            await db.inspections.replace_one({"id": insp_id}, doc_copy, upsert=True)
            if doc_copy.get("overall_status") in ["FAIL", "NON_COMPLIANT"]:
                await db.violations.replace_one({"inspection_id": insp_id}, doc_copy, upsert=True)
            return insp_id
        except Exception as e:
            logger.warning(f"Mongo save inspection error ({e}); using memory fallback.")

    _memory_inspections[insp_id] = doc_copy
    if doc_copy.get("overall_status") in ["FAIL", "NON_COMPLIANT"]:
        _memory_violations[insp_id] = doc_copy
    return insp_id

async def get_inspections(limit: int = 50) -> List[Dict[str, Any]]:
    db = get_database()
    if db is not None:
        try:
            cursor = db.inspections.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit)
            return await cursor.to_list(length=limit)
        except Exception as e:
            logger.warning(f"Mongo get inspections error ({e}); returning memory storage.")

    return list(_memory_inspections.values())[:limit]

async def get_inspection_by_id(insp_id: str) -> Optional[Dict[str, Any]]:
    db = get_database()
    if db is not None:
        try:
            doc = await db.inspections.find_one({"id": insp_id}, {"_id": 0})
            if doc:
                return doc
        except Exception as e:
            logger.warning(f"Mongo get_inspection_by_id error ({e}); checking memory.")

    return _memory_inspections.get(insp_id)

async def get_violations(limit: int = 50) -> List[Dict[str, Any]]:
    db = get_database()
    if db is not None:
        try:
            cursor = db.violations.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit)
            return await cursor.to_list(length=limit)
        except Exception as e:
            logger.warning(f"Mongo get violations error ({e}); returning memory.")

    return list(_memory_violations.values())[:limit]

async def save_correction(correction_doc: Dict[str, Any]) -> str:
    """
    Feedback Loop Storage:
    Persists officer field overrides along with raw Gemini output, deterministic verdict, and officer note.
    These corrections are used for prompt few-shot context re-injection and RAG document creation (NOT model fine-tuning).
    """
    db = get_database()
    doc_copy = dict(correction_doc)
    doc_copy.pop("_id", None)
    
    corr_id = doc_copy.get("correction_id", f"CORR-{doc_copy.get('inspection_id')}")
    if db is not None:
        try:
            await db.corrections.replace_one({"correction_id": corr_id}, doc_copy, upsert=True)
            return corr_id
        except Exception as e:
            logger.warning(f"Mongo save correction error ({e}); saving to memory.")

    _memory_corrections[corr_id] = doc_copy
    return corr_id

async def get_corrections(limit: int = 50) -> List[Dict[str, Any]]:
    db = get_database()
    if db is not None:
        try:
            cursor = db.corrections.find({}, {"_id": 0}).limit(limit)
            return await cursor.to_list(length=limit)
        except Exception as e:
            logger.warning(f"Mongo get corrections error ({e}); returning memory.")

    return list(_memory_corrections.values())[:limit]
