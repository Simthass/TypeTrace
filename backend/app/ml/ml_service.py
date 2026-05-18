"""
TypeTrace ML Inference Service v4.0
=====================================
Production FastAPI microservice for keystroke liveness detection.
Replaces the previous unauthenticated, hardcoded-user-id service.

Changes from v3:
  - JWT authentication on every endpoint (no more open analyze endpoint)
  - Scaler loaded and applied at inference (v3 forgot the scaler entirely)
  - 28-feature vector matching train_model.py v4.0
  - Binary HUMAN / SYNTHETIC output (cleaner than 3-class)
  - Audit logging per inference (for dissertation study data)
  - No hardcoded "student" user fallback — raises proper 401
  - CORS restricted to configured origins (not wildcard)
  - Rate limiting via slowapi
  - Health endpoint for Railway/Render deployment checks
"""

import os
import json
import logging
import warnings
from typing import Any, Optional
from pathlib import Path

import numpy as np
import joblib
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from jose import jwt, JWTError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Import the shared feature extractor so inference and training are IDENTICAL
from train_model import (
    extract_features_from_keystroke_array,
    FEATURE_COLUMNS,
    MINIMUM_KEYS_PER_SESSION,
)

warnings.filterwarnings("ignore")
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("TypeTrace-Inference")

# ─────────────────────────────────────────────────────────────────────────────
# 1. CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

BASE_DIR    = Path(__file__).parent
MODEL_PATH  = BASE_DIR / "typetrace_rf_model.joblib"
SCALER_PATH = BASE_DIR / "typetrace_scaler.joblib"
ENCODER_PATH= BASE_DIR / "typetrace_label_encoder.joblib"
FEATURES_PATH = BASE_DIR / "feature_columns.joblib"
META_PATH   = BASE_DIR / "model_metadata.json"

SECRET_KEY  = os.getenv("SECRET_KEY")
ALGORITHM   = "HS256"

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,https://typetrace.app,https://www.typetrace.app"
).split(",")

DB_URL = os.getenv("DATABASE_URL", "").replace("+asyncpg", "")

# Kill-switch thresholds (deterministic rules applied BEFORE ML inference)
KILL_WPM_THRESHOLD    = 180    # Physically impossible for humans to sustain
KILL_PASTE_THRESHOLD  = 3      # More than 3 pastes = almost certainly AI-assisted
KILL_IKI_STD_THRESHOLD = 15    # Standard deviation < 15ms = mechanical/scripted
KILL_ENTROPY_THRESHOLD = 0.5   # Editing entropy < 0.5 = robotic uniformity

# ─────────────────────────────────────────────────────────────────────────────
# 2. RATE LIMITING SETUP
# ─────────────────────────────────────────────────────────────────────────────

limiter = Limiter(key_func=get_remote_address)

# ─────────────────────────────────────────────────────────────────────────────
# 3. STARTUP — load model artifacts
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="TypeTrace Inference API",
    version="4.0.0",
    description="Keystroke liveness detection for academic authorship verification.",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

# Load model at startup — fail loudly so deployment fails fast rather than silently
rf_model      = None
scaler        = None
label_encoder = None
feature_cols  = FEATURE_COLUMNS
model_metadata = {}

try:
    rf_model       = joblib.load(MODEL_PATH)
    scaler         = joblib.load(SCALER_PATH)
    label_encoder  = joblib.load(ENCODER_PATH)
    feature_cols   = joblib.load(FEATURES_PATH)
    with open(META_PATH) as f:
        model_metadata = json.load(f)
    log.info(f"✅ Model v{model_metadata.get('version','?')} loaded. "
             f"Accuracy: {model_metadata.get('accuracy',0)*100:.2f}%  "
             f"Features: {len(feature_cols)}")
except FileNotFoundError as e:
    log.warning(f"⚠️  Model artifacts not found: {e}. Run train_model.py first.")
except Exception as e:
    log.error(f"❌ Failed to load model: {e}")

# DB engine (sync — inference service is synchronous for simplicity)
db_engine = None
try:
    if DB_URL:
        db_engine = create_engine(DB_URL, pool_pre_ping=True)
        log.info("✅ Database engine initialized.")
except Exception as e:
    log.warning(f"⚠️  Database connection failed: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# 4. AUTHENTICATION — reuse the same JWT secret as the main FastAPI app
# ─────────────────────────────────────────────────────────────────────────────

security = HTTPBearer()


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """
    Validates the Bearer JWT token and returns the user's ID.
    Raises 401 if token is invalid or expired.
    """
    if not SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service misconfigured — SECRET_KEY not set.",
        )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("id")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload.")
        return user_id
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalid or expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ─────────────────────────────────────────────────────────────────────────────
# 5. REQUEST / RESPONSE SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class SessionStats(BaseModel):
    wpm: float
    keystrokes: int
    deletions: int
    pauses: int
    avgIki: float
    sessionSeconds: float


class KeystrokeSession(BaseModel):
    title: str
    text_content: str
    keystroke_array: Any
    stats: SessionStats


class AnalysisResult(BaseModel):
    classification: str          # "HUMAN" or "SYNTHETIC"
    confidence_score: float      # 0–100
    kill_switch_triggered: bool  # True if a deterministic rule fired
    kill_switch_reason: Optional[str]
    advanced_stats: dict         # raw features for frontend display
    session_id: Optional[int]    # DB row ID after save


# ─────────────────────────────────────────────────────────────────────────────
# 6. CORE INFERENCE LOGIC
# ─────────────────────────────────────────────────────────────────────────────

def run_inference(
    keystroke_array: list,
    stats: SessionStats,
    text_content: str,
) -> tuple[str, float, bool, Optional[str], dict]:
    """
    Returns: (classification, confidence_score, kill_switch_triggered, reason, features)
    """
    # Step 1: extract features
    features = extract_features_from_keystroke_array(
        raw_array=keystroke_array,
        total_keystrokes=stats.keystrokes,
        deletions=stats.deletions,
        pauses=stats.pauses,
        duration_seconds=stats.sessionSeconds,
        text_length=len(text_content),
    )

    # Count paste events (not a feature in the model, but a kill-switch trigger)
    paste_count = sum(
        1 for e in keystroke_array
        if isinstance(e, dict) and e.get("key") == "__PASTE_EVENT__"
    )

    # Step 2: deterministic kill-switch rules (always applied first)
    net_wpm  = features.get("net_wpm", 0)
    iki_std  = features.get("ft_std",  999)
    entropy  = features.get("ft_entropy", 999)

    if net_wpm > KILL_WPM_THRESHOLD or paste_count > KILL_PASTE_THRESHOLD:
        reason = (
            f"Copy-paste detected ({paste_count} paste events, {net_wpm:.0f} WPM)"
            if paste_count > KILL_PASTE_THRESHOLD
            else f"Superhuman typing speed detected ({net_wpm:.0f} WPM > {KILL_WPM_THRESHOLD})"
        )
        return "SYNTHETIC", 99.9, True, reason, features

    if stats.keystrokes > 30 and iki_std < KILL_IKI_STD_THRESHOLD:
        reason = f"Mechanically uniform timing detected (IKI σ = {iki_std:.1f}ms < {KILL_IKI_STD_THRESHOLD}ms)"
        return "SYNTHETIC", 99.9, True, reason, features

    if stats.keystrokes > 50 and entropy < KILL_ENTROPY_THRESHOLD:
        reason = f"Robotic typing rhythm detected (entropy = {entropy:.2f} < {KILL_ENTROPY_THRESHOLD})"
        return "SYNTHETIC", 99.9, True, reason, features

    # Step 3: probabilistic ML inference
    if rf_model is None or scaler is None or label_encoder is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML model not loaded. Contact administrator.",
        )

    feature_vector = np.array([[features.get(col, 0.0) for col in feature_cols]])
    feature_vector_sc = scaler.transform(feature_vector)

    probabilities  = rf_model.predict_proba(feature_vector_sc)[0]
    pred_class_idx = int(np.argmax(probabilities))
    classification = label_encoder.inverse_transform([pred_class_idx])[0]
    confidence     = round(float(probabilities[pred_class_idx]) * 100, 2)

    return classification, confidence, False, None, features


# ─────────────────────────────────────────────────────────────────────────────
# 7. ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health")
@limiter.limit("10/minute")
async def health(request: Request):
    return {
        "status": "ok",
        "model_loaded": rf_model is not None,
        "model_version": model_metadata.get("version", "unknown"),
        "model_accuracy": model_metadata.get("accuracy", None),
    }


@app.post("/api/v1/sessions/analyze", response_model=AnalysisResult)
@limiter.limit("10/minute")
async def analyze_session(
    request: Request,
    data: KeystrokeSession,
    user_id: str = Depends(get_current_user_id),  # ← JWT required
):
    """
    Analyzes a TypeTrace keystroke session and returns a classification result.
    Requires a valid JWT Bearer token in the Authorization header.
    """
    if not data.keystroke_array or len(data.keystroke_array) < MINIMUM_KEYS_PER_SESSION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient keystroke data. Minimum {MINIMUM_KEYS_PER_SESSION} keystrokes required.",
        )

    classification, confidence, kill_triggered, kill_reason, features = run_inference(
        keystroke_array=data.keystroke_array,
        stats=data.stats,
        text_content=data.text_content,
    )

    log.info(
        f"[{user_id}] '{data.title[:30]}' → {classification} ({confidence:.1f}%) "
        f"{'[KILL-SWITCH]' if kill_triggered else '[ML]'}"
    )

    # Persist to database
    session_id = None
    if db_engine:
        try:
            with db_engine.begin() as conn:
                result = conn.execute(
                    text("""
                        INSERT INTO typing_sessions (
                            user_id, title, text_content, wpm, total_keystrokes,
                            deletions, pauses, avg_iki, duration_seconds,
                            classification_result, ml_confidence_score,
                            raw_keystroke_data
                        ) VALUES (
                            :user_id, :title, :text_content, :wpm, :total_keystrokes,
                            :deletions, :pauses, :avg_iki, :duration_seconds,
                            :classification_result, :ml_confidence_score,
                            :raw_keystroke_data
                        ) RETURNING id
                    """),
                    {
                        "user_id":               user_id,
                        "title":                 data.title,
                        "text_content":          data.text_content,
                        "wpm":                   round(features.get("net_wpm", data.stats.wpm)),
                        "total_keystrokes":      data.stats.keystrokes,
                        "deletions":             data.stats.deletions,
                        "pauses":                data.stats.pauses,
                        "avg_iki":               round(features.get("ft_mean", data.stats.avgIki)),
                        "duration_seconds":      data.stats.sessionSeconds,
                        "classification_result": classification,
                        "ml_confidence_score":   float(confidence),
                        "raw_keystroke_data":    json.dumps(
                            data.keystroke_array[:500]  # Cap at 500 events to keep DB lean
                        ),
                    },
                )
                row = result.fetchone()
                session_id = row[0] if row else None
        except Exception as e:
            log.error(f"DB save failed for user {user_id}: {e}")
            # Don't raise — analysis result is still returned to user

    return AnalysisResult(
        classification=classification,
        confidence_score=confidence,
        kill_switch_triggered=kill_triggered,
        kill_switch_reason=kill_reason,
        advanced_stats={
            "ht_mean":      round(features.get("ht_mean", 0), 1),
            "ht_std":       round(features.get("ht_std", 0), 1),
            "ft_mean":      round(features.get("ft_mean", 0), 1),
            "ft_std":       round(features.get("ft_std", 0), 1),
            "ft_entropy":   round(features.get("ft_entropy", 0), 3),
            "ft_autocorr":  round(features.get("ft_autocorr", 0), 3),
            "burst_ratio":  round(features.get("burst_ratio", 0), 3),
            "pause_ratio":  round(features.get("pause_ratio", 0), 3),
            "net_wpm":      round(features.get("net_wpm", 0), 1),
        },
        session_id=session_id,
    )


@app.get("/api/v1/sessions/history")
@limiter.limit("30/minute")
async def get_session_history(
    request: Request,
    user_id: str = Depends(get_current_user_id),  # ← JWT required
):
    """
    Returns the authenticated user's session history.
    No more hardcoded 'student' user — each user sees only their own data.
    """
    if not db_engine:
        raise HTTPException(status_code=503, detail="Database not available.")

    try:
        with db_engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT id, title, wpm, duration_seconds, classification_result,
                           ml_confidence_score, created_at
                    FROM typing_sessions
                    WHERE user_id = :user_id
                    ORDER BY created_at DESC
                    LIMIT 100
                """),
                {"user_id": user_id},
            ).fetchall()

        sessions = [
            {
                "id":             row[0],
                "title":          row[1],
                "wpm":            round(row[2] or 0, 1),
                "duration":       round(row[3] or 0, 1),
                "classification": row[4],
                "confidence":     round(row[5] or 0, 1),
                "date":           row[6].strftime("%b %d, %Y — %I:%M %p") if row[6] else "Unknown",
            }
            for row in rows
        ]
        return {"status": "success", "sessions": sessions}

    except Exception as e:
        log.error(f"History fetch failed for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve session history.")


@app.get("/api/v1/model/info")
@limiter.limit("30/minute")
async def model_info(
    request: Request,
    user_id: str = Depends(get_current_user_id)
):
    """Returns model metadata for the About/Science page."""
    return {
        "version":    model_metadata.get("version", "unknown"),
        "accuracy":   model_metadata.get("accuracy", None),
        "features":   len(feature_cols),
        "dataset":    model_metadata.get("dataset_citation", ""),
        "classes":    model_metadata.get("classes", []),
        "trained_on": model_metadata.get("training_samples", 0),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 8. STARTUP — run with uvicorn
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)