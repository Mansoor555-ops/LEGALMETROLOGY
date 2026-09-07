import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .db.mongo import connect_to_mongo, close_mongo_connection
from .api.routes import inspections, products, webhooks, reports

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Connect to MongoDB
    await connect_to_mongo()
    yield
    # Shutdown: Close MongoDB connection
    await close_mongo_connection()

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API for Legal Metrology (Packaged Commodities) Rules 2011 compliance checking via Gemini 1.5 Vision, n8n, and RAG",
    version="2.0.0",
    lifespan=lifespan
)

# Enable CORS for Next.js frontend & n8n
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static Uploads
app.mount("/uploads", StaticFiles(directory=settings.UPLOADS_DIR), name="uploads")

# Register Modular Resource Routers
app.include_router(inspections.router)
app.include_router(products.router)
app.include_router(webhooks.router)
app.include_router(reports.router)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "environment": settings.ENV,
        "gemini_configured": bool(settings.GEMINI_API_KEY)
    }
