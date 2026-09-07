# Vercel Python Serverless Entrypoint — v2
import os
import sys
import traceback

current_dir = os.path.dirname(os.path.abspath(__file__))
frontend_dir = os.path.dirname(current_dir)
if frontend_dir not in sys.path:
    sys.path.insert(0, frontend_dir)

try:
    from backend_src.main import app
except Exception as _import_err:
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    app = FastAPI()
    _err_detail = traceback.format_exc()

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    async def fallback_error(path: str = ""):
        return JSONResponse(status_code=500, content={
            "status": "import_error",
            "error": str(_import_err),
            "traceback": _err_detail
        })

