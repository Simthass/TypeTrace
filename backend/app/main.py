
import sys
import os
import logging
from dotenv import load_dotenv

# ── 1. PATH FIX FOR ML IMPORTS ──────────────────────────────────────────────
_ML_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ml")
if _ML_DIR not in sys.path:
    sys.path.insert(0, _ML_DIR)

load_dotenv()
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("TypeTrace-Gateway")

# ── 2. LOAD THE ML MICROSERVICE AS THE BASE APP ─────────────────────────────
try:
    from app.ml.ml_service import app
    log.info("✅ ML Service loaded as the base application.")
except Exception as e:
    log.error(f"❌ Failed to load ML Service. Error: {e}")
    raise e

# ── 3. ATTACH THE AUTH ROUTER ────────────────────────────────────────────────
try:
    from app.api.routes.auth import router as auth_router
    app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
    log.info("✅ Auth router attached from app.api.routes.auth")
except ImportError as e:
    log.error(f"❌ Could not load Auth router: {e}")

# ── 4. ATTACH THE SESSIONS ROUTER (now safe — broken import fixed in Part 1) ─
# This router provides the ORM-based replay endpoint.
# The primary replay path is in ml_service.py (raw SQL).
# Both paths now compute real metrics — no hardcoded values.
try:
    from app.api.routes.sessions import router as sessions_router
    app.include_router(sessions_router, prefix="/api/v1/sessions-orm", tags=["Sessions ORM"])
    log.info("✅ Sessions ORM router attached from app.api.routes.sessions")
except ImportError as e:
    log.warning(f"⚠️  Sessions ORM router not loaded: {e}")

# ── 5. RUN SERVER ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)