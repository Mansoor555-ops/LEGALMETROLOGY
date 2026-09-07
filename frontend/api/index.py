# Vercel Python Serverless Entrypoint — v2
import os
import sys
import traceback
from fastapi import FastAPI
from fastapi.responses import JSONResponse

# Ensure backend_src is importable
current_dir = os.path.dirname(os.path.abspath(__file__))
frontend_dir = os.path.dirname(current_dir)
if frontend_dir not in sys.path:
    sys.path.insert(0, frontend_dir)

# Top-level app — required by Vercel Python runtime static analysis
app = FastAPI(title="Legal Metrology Compliance Assistant API")

# Import the real app and replace placeholder
try:
    from backend_src.main import app  # noqa: F811
except Exception as _import_err:
    _err_detail = traceback.format_exc()

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    async def fallback_error(path: str = ""):
        return JSONResponse(status_code=500, content={
            "status": "import_error",
            "error": str(_import_err),
            "traceback": _err_detail
        })

