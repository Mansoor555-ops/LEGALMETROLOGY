import os
from dotenv import load_dotenv
load_dotenv()

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Legal Metrology Compliance Assistant API"
    ENV: str = os.getenv("ENV", "development")
    
    # Gemini API Key
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    
    # MongoDB Atlas / Local Connection
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "legal_metrology_db")
    
    # n8n Webhook Integration
    N8N_WEBHOOK_URL: str = os.getenv("N8N_WEBHOOK_URL", "http://localhost:5678/webhook/inspection-pipeline")
    
    # Storage Paths
    BASE_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    UPLOADS_DIR: str = os.path.abspath(os.path.join(BASE_DIR, "uploads"))
    REPORTS_DIR: str = os.path.abspath(os.path.join(BASE_DIR, "reports"))
    DATA_DIR: str = os.path.abspath(os.path.join(BASE_DIR, "data"))
    FAISS_INDEX_PATH: str = os.path.abspath(os.path.join(DATA_DIR, "faiss_index"))

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

os.makedirs(settings.UPLOADS_DIR, exist_ok=True)
os.makedirs(settings.REPORTS_DIR, exist_ok=True)
os.makedirs(settings.DATA_DIR, exist_ok=True)
