"""
TypeTrace API Gateway — app/main.py
=========================================
This file acts as the central monolith entry point. 
It loads the highly-configured FastAPI instance from ml_service.py (which handles 
all the real ML /analyze and /history routes) and stitches the Authentication router 
back onto it.
"""

import sys
import os
import logging
from dotenv import load_dotenv

# ── 1. PATH FIX FOR ML IMPORTS ──────────────────────────────────────────────
# We must ensure the ml/ folder is in the system path before anything else
# so that ml_service.py can correctly import train_model.py
_ML_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ml")
if _ML_DIR not in sys.path:
    sys.path.insert(0, _ML_DIR)

load_dotenv()
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("TypeTrace-Gateway")

# ── 2. LOAD THE ML MICROSERVICE AS THE BASE APP ─────────────────────────────
# This imports your real V4 ML endpoints, rate limiters, and CORS.
try:
    from app.ml.ml_service import app
    log.info("✅ ML Service loaded as the base application.")
except Exception as e:
    log.error(f"❌ Failed to load ML Service. Error: {e}")
    raise e

# ── 3. RE-ATTACH THE AUTH ROUTER ────────────────────────────────────────────
# We dynamically attach your login/register routes here. 
# Based on your snippets, this is located in app/api/routes/auth.py
try:
    # Adjust this import if your auth file is named differently
    from app.api.routes.auth import router as auth_router
    app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
    log.info("✅ Auth router successfully re-attached from app.api.routes.auth")
except ImportError as e:
    log.warning(f"⚠️ Could not load Auth router from app.api.routes.auth. Trying fallback... Details: {e}")
    try:
        from app.routers.auth import router as auth_router
        app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
        log.info("✅ Auth router successfully re-attached from fallback path.")
    except ImportError as e2:
        log.error(f"❌ Could not find auth router. Make sure the import path matches your folder structure. {e2}")

# ⚠️ NOTICE: We explicitly DO NOT import app.api.routes.sessions here. 
# ml_service.py is exclusively handling all session logic now.

# ── 4. RUN SERVER ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    # Run the gateway on port 8000
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)