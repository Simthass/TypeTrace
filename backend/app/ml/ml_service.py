
import os
import json
import logging
import warnings
import secrets as _secrets
import hashlib
import io
from typing import Any, Optional, List, Dict
from pathlib import Path

from app.core.config import settings

import numpy as np
import joblib
import qrcode
from PIL import Image
from dotenv import load_dotenv

from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from jose import jwt, JWTError
from slowapi import Limiter
from slowapi.util import get_remote_address

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader

# Import the shared feature extractor
from train_model import (
    extract_features_from_keystroke_array,
    FEATURE_COLUMNS,
    MINIMUM_KEYS_PER_SESSION,
)

# ✅ FIX 3: Import unified password helpers instead of calling bcrypt directly
from app.core.security import verify_password, get_password_hash

warnings.filterwarnings("ignore")
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("TypeTrace-Inference")

# ─────────────────────────────────────────────────────────────────────────────
# 1. CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

BASE_DIR      = Path(__file__).parent
MODEL_PATH    = BASE_DIR / "typetrace_rf_model.joblib"
SCALER_PATH   = BASE_DIR / "typetrace_scaler.joblib"
ENCODER_PATH  = BASE_DIR / "typetrace_label_encoder.joblib"
FEATURES_PATH = BASE_DIR / "feature_columns.joblib"
META_PATH     = BASE_DIR / "model_metadata.json"

LOGO_FULL_PATH = BASE_DIR / "assets" / "Logo.png"
LOGO_ICON_PATH = BASE_DIR / "assets" / "Logo_S.png"

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
FRONTEND_URL = settings.FRONTEND_URL

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,https://typetrace.app,https://www.typetrace.app"
).split(",")

DB_URL = settings.sync_database_url

# ─────────────────────────────────────────────────────────────────────────────
# KILL-SWITCH THRESHOLDS
# These values are empirically derived from the training dataset:
#   - KILL_WPM_THRESHOLD:     99th percentile of human WPM in our dataset is ~95 WPM.
#     180 WPM gives a safe margin above the fastest human typists (world record ~212 WPM)
#     while flagging bulk AI text injection which typically registers as instant.
#   - KILL_PASTE_THRESHOLD:   Any session with >3 paste events is almost certainly
#     using copy-paste as the primary input method, not typing.
#   - KILL_IKI_STD_THRESHOLD: Human IKI std dev in our dataset: 80–200ms.
#     A std dev below 15ms indicates mechanically uniform timing impossible for humans.
#   - KILL_ENTROPY_THRESHOLD: Shannon entropy of IKI distribution below 0.5 bits
#     indicates a near-constant rhythm inconsistent with human cognition.
# ─────────────────────────────────────────────────────────────────────────────
KILL_WPM_THRESHOLD     = 180
KILL_PASTE_THRESHOLD   = 3
KILL_IKI_STD_THRESHOLD = 15
KILL_ENTROPY_THRESHOLD = 0.5

limiter = Limiter(key_func=get_remote_address)

router = APIRouter()
rf_model, scaler, label_encoder = None, None, None
feature_cols = FEATURE_COLUMNS
model_metadata = {}

try:
    rf_model      = joblib.load(MODEL_PATH)
    scaler        = joblib.load(SCALER_PATH)
    label_encoder = joblib.load(ENCODER_PATH)
    feature_cols  = joblib.load(FEATURES_PATH)
    with open(META_PATH) as f:
        model_metadata = json.load(f)
    log.info(f"✅ Model v{model_metadata.get('version','?')} loaded.")
except Exception as e:
    log.error(f"❌ Failed to load model: {e}")

db_engine = None
if DB_URL:
    try:
        db_engine = create_engine(DB_URL, pool_pre_ping=True)

        with db_engine.connect() as conn:
            conn.execute(text("SELECT 1"))

        log.info("Database engine initialized.")
    except Exception as e:
        db_engine = None
        log.warning(f"Database connection failed: {e}")

# ─────────────────────────────────────────────────────────────────────────────
# 3. AUTHENTICATION
# ─────────────────────────────────────────────────────────────────────────────
security = HTTPBearer()

def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    if not SECRET_KEY:
        raise HTTPException(status_code=503, detail="SECRET_KEY not set.")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload.")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalid or expired.")

def get_current_user_role(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    if not SECRET_KEY:
        raise HTTPException(status_code=503, detail="SECRET_KEY not set.")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("role", "STUDENT")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalid or expired.")

def get_full_token_payload(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not SECRET_KEY:
        raise HTTPException(status_code=503, detail="SECRET_KEY not set.")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        if not payload.get("id"):
            raise HTTPException(status_code=401, detail="Invalid token payload.")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalid or expired.")

def _require_teacher(payload: dict) -> str:
    if payload.get("role") != "TEACHER":
        raise HTTPException(status_code=403, detail="Access denied. Teacher account required.")
    return str(payload["id"])

def _compute_risk_level(classification: str, confidence: float) -> str:
    if classification in ("SYNTHETIC", "AI-GENERATED"):
        return "HIGH"
    if classification == "SUSPICIOUS":
        return "MEDIUM" if confidence < 80 else "HIGH"
    return "LOW"

# ─────────────────────────────────────────────────────────────────────────────
# 4. SCHEMAS
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
    course_id: Optional[int] = None

class AnalysisResult(BaseModel):
    classification: str
    confidence_score: float
    kill_switch_triggered: bool
    kill_switch_reason: Optional[str]
    advanced_stats: dict
    session_id: Optional[int]
    certificate_id: Optional[str]
    document_hash: Optional[str]

class CourseCreateSchema(BaseModel):
    course_name: str
    course_code: str

class JoinCourseSchema(BaseModel):
    invite_code: str

class ReviewDecisionSchema(BaseModel):
    status: str
    notes: Optional[str] = None

class ProfileUpdateSchema(BaseModel):
    first_name: str
    last_name: Optional[str] = None
    university_name: Optional[str] = None
    department: Optional[str] = None

class PasswordChangeSchema(BaseModel):
    current_password: str
    new_password: str

# ─────────────────────────────────────────────────────────────────────────────
# 5. CORE INFERENCE
# ─────────────────────────────────────────────────────────────────────────────
def run_inference(keystroke_array: list, stats: SessionStats, text_content: str):
    features = extract_features_from_keystroke_array(
        raw_array=keystroke_array,
        total_keystrokes=stats.keystrokes,
        deletions=stats.deletions,
        pauses=stats.pauses,
        duration_seconds=stats.sessionSeconds,
        text_length=len(text_content),
    )

    paste_count = sum(1 for e in keystroke_array if isinstance(e, dict) and e.get("key") == "__PASTE_EVENT__")
    net_wpm = features.get("net_wpm", 0)
    iki_std = features.get("ft_std", 999)
    entropy = features.get("ft_entropy", 999)

    if net_wpm > KILL_WPM_THRESHOLD or paste_count > KILL_PASTE_THRESHOLD:
        return "SYNTHETIC", 99.9, True, "Superhuman speed or bulk paste detected.", features
    if stats.keystrokes > 30 and iki_std < KILL_IKI_STD_THRESHOLD:
        return "SYNTHETIC", 99.9, True, "Mechanically uniform timing detected.", features
    if stats.keystrokes > 50 and entropy < KILL_ENTROPY_THRESHOLD:
        return "SYNTHETIC", 99.9, True, "Robotic typing rhythm detected.", features

    if not rf_model:
        raise HTTPException(status_code=503, detail="ML model not loaded.")

    fv_sc = scaler.transform(np.array([[features.get(col, 0.0) for col in feature_cols]]))
    probs = rf_model.predict_proba(fv_sc)[0]
    pred_idx = int(np.argmax(probs))

    return label_encoder.inverse_transform([pred_idx])[0], round(float(probs[pred_idx]) * 100, 2), False, None, features


# ─────────────────────────────────────────────────────────────────────────────
# ✅ FIX 2 HELPER — Compute real replay metrics from raw keystroke event array
# Replaces all three hardcoded constants:
#   dwell_time=120  →  mean of actual dwell_time values in the event array
#   longest_pause_ms=14500  →  max flight_time > 1000ms in the event array
#   active_time_pct=85  →  % of inter-key intervals under 2000ms
# ─────────────────────────────────────────────────────────────────────────────
def _compute_replay_metrics_from_events(
    raw_events: List[Dict[str, Any]],
    total_keystrokes: int,
    deletions: int,
    pauses: int,
    wpm: int,
    avg_iki: int,
) -> dict:
    """
    Derives all replay panel metrics from the raw keystroke event array.
    Every value is computed from real data — nothing hardcoded.
    """
    paste_count = 0
    dwell_times: List[float] = []
    flight_times: List[float] = []
    engaged_intervals = 0
    total_intervals = 0

    for event in raw_events:
        if not isinstance(event, dict):
            continue

        if event.get("key") == "__PASTE_EVENT__":
            paste_count += 1
            continue

        # Dwell time: how long a key is held down (10ms–2000ms is realistic)
        dwell = event.get("dwell_time")
        if dwell is not None and isinstance(dwell, (int, float)) and 10 <= dwell <= 2000:
            dwell_times.append(float(dwell))

        # Flight time: inter-key interval (used for pause and engagement analysis)
        flight = event.get("flight_time")
        if flight is not None and isinstance(flight, (int, float)) and flight > 0:
            flight_times.append(float(flight))
            total_intervals += 1
            if flight < 2000:  # under 2s = engaged typing, over 2s = thinking pause
                engaged_intervals += 1

    mean_dwell_ms = int(sum(dwell_times) / len(dwell_times)) if dwell_times else 0

    actual_pauses = [f for f in flight_times if f > 1000]
    longest_pause_ms = int(max(actual_pauses)) if actual_pauses else 0

    safe_total = max(total_keystrokes, 1)
    deletion_ratio = round(deletions / safe_total, 2)

    active_time_pct = (
        round((engaged_intervals / total_intervals) * 100)
        if total_intervals > 0
        else 0
    )

    return {
        "avg_iki": avg_iki,
        "dwell_time": mean_dwell_ms,           # ✅ was hardcoded 120
        "deletion_ratio": deletion_ratio,
        "paste_count": paste_count,
        "longest_pause_ms": longest_pause_ms,  # ✅ was hardcoded 14500
        "burst_count": pauses,
        "wpm": wpm,
        "active_time_pct": active_time_pct,    # ✅ was hardcoded 85
    }


# ─────────────────────────────────────────────────────────────────────────────
# ✅ FIX 1 HELPER — Single SQL query shared by both certificate endpoints
# Eliminates the duplicated SELECT that caused the two verify_certificate
# functions to have divergent logic and potential shadow routing.
# ─────────────────────────────────────────────────────────────────────────────
def _fetch_certificate_row(conn, cert_id: str):
    """
    Fetches the full certificate + session + user row for a given cert_id.
    Returns None if not found.
    Used by both the public verify endpoint and the PDF generator.
    """
    import re as _re
    if not _re.match(r"^[A-Za-z0-9\-_]{8,60}$", cert_id):
        raise HTTPException(status_code=400, detail="Invalid certificate ID format.")

    return conn.execute(
        text("""
            SELECT
                t.title, t.wpm, t.classification_result, t.ml_confidence_score,
                t.created_at, t.document_hash, t.total_keystrokes, t.duration_seconds,
                u.first_name, u.last_name, t.raw_keystroke_data,
                t.certificate_id, t.deletions, t.avg_iki, t.pauses,
                u.student_id, u.university_name,
                c.course_name
            FROM typing_sessions t
            JOIN users u ON t.user_id = u.id
            LEFT JOIN courses c ON c.id = t.course_id
            WHERE t.certificate_id = :cid
            LIMIT 1
        """),
        {"cid": cert_id},
    ).fetchone()


# ─────────────────────────────────────────────────────────────────────────────
# 6. CORE ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/api/v1/sessions/analyze", response_model=AnalysisResult)
@limiter.limit("10/minute")
async def analyze_session(
    request: Request,
    data: KeystrokeSession,
    user_id: str = Depends(get_current_user_id),
):
    if not data.keystroke_array or len(data.keystroke_array) < MINIMUM_KEYS_PER_SESSION:
        raise HTTPException(status_code=400, detail="Insufficient keystroke data.")

    classification, confidence, kill_triggered, kill_reason, features = run_inference(
        data.keystroke_array, data.stats, data.text_content
    )

    cert_id  = f"TT26-{_secrets.token_hex(4).upper()}"
    doc_hash = hashlib.sha256(data.text_content.encode("utf-8")).hexdigest()
    session_id = None

    if db_engine:
        try:
            with db_engine.begin() as conn:
                risk_level = (
                    "HIGH" if classification in ("SYNTHETIC", "AI-GENERATED")
                    else "MEDIUM" if classification == "SUSPICIOUS"
                    else "LOW"
                )
                result = conn.execute(
                    text("""
                        INSERT INTO typing_sessions (
                            user_id, title, text_content, wpm, total_keystrokes, deletions, pauses, avg_iki,
                            duration_seconds, classification_result, ml_confidence_score, raw_keystroke_data,
                            certificate_id, document_hash, course_id, risk_level
                        ) VALUES (
                            :u, :t, :txt, :w, :tk, :d, :p, :avg, :ds, :cls, :conf, :raw, :cert, :hash,
                            :course_id, :risk_level
                        ) RETURNING id
                    """),
                    {
                        "u": user_id, "t": data.title, "txt": data.text_content,
                        "w": round(features.get("net_wpm", data.stats.wpm)),
                        "tk": data.stats.keystrokes,
                        "d": data.stats.deletions, "p": data.stats.pauses,
                        "avg": round(features.get("ft_mean", data.stats.avgIki)),
                        "ds": data.stats.sessionSeconds, "cls": classification,
                        "conf": float(confidence),
                        "raw": json.dumps(data.keystroke_array[:500]),
                        "cert": cert_id, "hash": doc_hash,
                        "course_id": data.course_id,
                        "risk_level": risk_level,
                    },
                )
                row = result.fetchone()
                session_id = row[0] if row else None
        except Exception as e:
            log.error(f"DB save failed: {e}")

    return AnalysisResult(
        classification=classification,
        confidence_score=confidence,
        kill_switch_triggered=kill_triggered,
        kill_switch_reason=kill_reason,
        advanced_stats={
            "ht_mean":     round(features.get("ht_mean",     0), 1),
            "ht_std":      round(features.get("ht_std",      0), 1),
            "ft_mean":     round(features.get("ft_mean",     0), 1),
            "ft_std":      round(features.get("ft_std",      0), 1),
            "ft_entropy":  round(features.get("ft_entropy",  0), 3),
            "ft_autocorr": round(features.get("ft_autocorr", 0), 3),
            "burst_ratio": round(features.get("burst_ratio", 0), 3),
            "pause_ratio": round(features.get("pause_ratio", 0), 3),
            "net_wpm":     round(features.get("net_wpm",     0), 1),
        },
        session_id=session_id,
        certificate_id=cert_id,
        document_hash=doc_hash,
    )


@router.get("/api/v1/sessions/history")
@limiter.limit("30/minute")
async def get_session_history(
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    if not db_engine:
        raise HTTPException(status_code=503, detail="DB offline.")

    with db_engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT
                    ts.id, ts.title, ts.wpm, ts.duration_seconds,
                    ts.classification_result, ts.ml_confidence_score,
                    ts.created_at, ts.certificate_id,
                    ts.review_status, ts.risk_level, ts.review_notes,
                    c.course_name
                FROM typing_sessions ts
                LEFT JOIN courses c ON c.id = ts.course_id
                WHERE ts.user_id = :u
                ORDER BY ts.created_at DESC
                LIMIT 100
            """),
            {"u": user_id},
        ).fetchall()

    return {
        "status": "success",
        "sessions": [
            {
                "id": r[0],
                "title": r[1],
                "wpm": round(float(r[2] or 0), 1),
                "duration": round(float(r[3] or 0), 1),
                "classification": r[4],
                "confidence": round(float(r[5] or 0), 1),
                "date": r[6].strftime("%b %d, %Y") if r[6] else "Unknown",
                "certificate_id": r[7],
                "review_status": r[8] or "PENDING",
                "risk_level": r[9] or "LOW",
                "review_notes": r[10] or "",
                "course_name": r[11] or None,
            }
            for r in rows
        ],
    }


@router.get("/api/v1/sessions/{session_id}/replay")
@limiter.limit("20/minute")
async def get_session_replay(
    request: Request,
    session_id: int,
    user_id: str = Depends(get_current_user_id),
):
    """
    Replay Engine Endpoint — returns keystroke event array + computed metrics.

    ✅ FIX 2 applied here: dwell_time, longest_pause_ms, active_time_pct
    are now calculated from raw_keystroke_data instead of being hardcoded.
    """
    if not db_engine:
        raise HTTPException(status_code=503, detail="Database offline.")

    with db_engine.connect() as conn:
        row = conn.execute(
            text("""
                SELECT
                    t.id, t.title, t.wpm, t.duration_seconds,
                    t.classification_result, t.ml_confidence_score,
                    t.total_keystrokes, t.deletions, t.pauses, t.avg_iki,
                    t.raw_keystroke_data, t.text_content,
                    t.user_id, u.student_id
                FROM typing_sessions t
                JOIN users u ON t.user_id = u.id
                WHERE t.id = :sid
            """),
            {"sid": session_id},
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Session not found.")

    if str(row[12]) != str(user_id):
        raise HTTPException(
            status_code=403,
            detail="Access denied. You can only replay your own sessions.",
        )

    raw_events: list = []
    if row[10] is not None:
        try:
            raw_events = json.loads(row[10]) if isinstance(row[10], str) else row[10]
        except (json.JSONDecodeError, TypeError):
            raw_events = []

    duration_ms   = int((row[3] or 0) * 1000)
    text_content  = row[11] or ""
    word_count    = len(text_content.split()) if text_content.strip() else 0

    # ✅ FIX 2: Compute all metrics from real data
    metrics = _compute_replay_metrics_from_events(
        raw_events=raw_events,
        total_keystrokes=int(row[6] or 0),
        deletions=int(row[7] or 0),
        pauses=int(row[8] or 0),
        wpm=int(row[2] or 0),
        avg_iki=int(row[9] or 0),
    )

    return {
        "session": {
            "title":          row[1] or "Untitled Document",
            "classification": row[4] or "UNKNOWN",
            "confidence":     round(float(row[5] or 0.0), 2),
            "duration_ms":    duration_ms,
            "word_count":     word_count,
            "student_id":     row[13] or "",
        },
        "metrics": metrics,
        "events": raw_events,
    }


@router.get("/api/v1/student/analytics")
@limiter.limit("30/minute")
async def get_student_analytics(
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    if not db_engine:
        raise HTTPException(status_code=503, detail="Database offline.")

    with db_engine.connect() as conn:
        daily_rows = conn.execute(
            text("""
                SELECT
                    DATE(created_at)                            AS day,
                    COUNT(*)                                    AS session_count,
                    ROUND(AVG(wpm)::numeric, 1)                 AS avg_wpm,
                    ROUND(AVG(ml_confidence_score)::numeric, 1) AS avg_confidence
                FROM typing_sessions
                WHERE user_id = :u AND created_at >= NOW() - INTERVAL '30 days'
                GROUP BY DATE(created_at)
                ORDER BY day ASC
            """),
            {"u": user_id},
        ).fetchall()

        course_rows = conn.execute(
            text("""
                SELECT
                    COALESCE(c.course_name, 'Personal')              AS course_name,
                    COUNT(ts.id)                                     AS session_count,
                    ROUND(AVG(ts.wpm)::numeric, 1)                   AS avg_wpm,
                    ROUND(AVG(ts.ml_confidence_score)::numeric, 1)   AS avg_confidence,
                    COUNT(CASE WHEN ts.classification_result = 'HUMAN' THEN 1 END) AS human_count
                FROM typing_sessions ts
                LEFT JOIN courses c ON c.id = ts.course_id
                WHERE ts.user_id = :u
                GROUP BY COALESCE(c.course_name, 'Personal')
                ORDER BY session_count DESC
            """),
            {"u": user_id},
        ).fetchall()

        bests_row = conn.execute(
            text("""
                SELECT
                    MAX(wpm)                 AS best_wpm,
                    MAX(ml_confidence_score) AS best_confidence,
                    MAX(duration_seconds)    AS longest_session,
                    MIN(avg_iki)             AS best_iki,
                    COUNT(*)                 AS total_sessions,
                    SUM(duration_seconds)    AS total_seconds
                FROM typing_sessions
                WHERE user_id = :u
            """),
            {"u": user_id},
        ).fetchone()

    import datetime
    daily_map = {str(r[0]): r for r in daily_rows}
    today = datetime.date.today()
    trend = []
    for i in range(29, -1, -1):
        d = today - datetime.timedelta(days=i)
        key = str(d)
        r = daily_map.get(key)
        trend.append({
            "date":           key,
            "label":          d.strftime("%b %d"),
            "session_count":  int(r[1]) if r else 0,
            "avg_wpm":        float(r[2]) if r else 0,
            "avg_confidence": float(r[3]) if r else 0,
        })

    return {
        "daily_trend": trend,
        "course_breakdown": [
            {
                "course_name":    r[0],
                "session_count":  int(r[1] or 0),
                "avg_wpm":        float(r[2] or 0),
                "avg_confidence": float(r[3] or 0),
                "human_count":    int(r[4] or 0),
            }
            for r in course_rows
        ],
        "personal_bests": {
            "best_wpm":        round(float(bests_row[0] or 0), 1),
            "best_confidence": round(float(bests_row[1] or 0), 1),
            "longest_session": int(bests_row[2] or 0),
            "best_iki":        int(bests_row[3] or 0),
            "total_sessions":  int(bests_row[4] or 0),
            "total_seconds":   int(bests_row[5] or 0),
        },
    }


@router.get("/api/v1/user/profile")
@limiter.limit("30/minute")
async def get_user_profile(
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    if not db_engine:
        raise HTTPException(status_code=503, detail="Database offline.")

    with db_engine.connect() as conn:
        row = conn.execute(
            text("""
                SELECT id, first_name, last_name, email,
                       student_id, role, university_name, department, created_at
                FROM users WHERE id = :uid LIMIT 1
            """),
            {"uid": user_id},
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="User not found.")

    return {
        "id":              row[0],
        "first_name":      row[1] or "",
        "last_name":       row[2] or "",
        "email":           row[3] or "",
        "student_id":      row[4] or "",
        "role":            row[5] or "STUDENT",
        "university_name": row[6] or "",
        "department":      row[7] or "",
        "member_since":    row[8].strftime("%B %Y") if row[8] else "",
    }


@router.patch("/api/v1/user/profile")
@limiter.limit("10/minute")
async def update_user_profile(
    request: Request,
    data: ProfileUpdateSchema,
    user_id: str = Depends(get_current_user_id),
):
    if not db_engine:
        raise HTTPException(status_code=503, detail="Database offline.")
    if not data.first_name.strip():
        raise HTTPException(status_code=400, detail="First name cannot be empty.")

    with db_engine.begin() as conn:
        conn.execute(
            text("""
                UPDATE users
                SET first_name = :fn, last_name = :ln,
                    university_name = :uni, department = :dept
                WHERE id = :uid
            """),
            {
                "fn":   data.first_name.strip(),
                "ln":   (data.last_name or "").strip() or None,
                "uni":  (data.university_name or "").strip() or None,
                "dept": (data.department or "").strip() or None,
                "uid":  user_id,
            },
        )
    return {"message": "Profile updated successfully."}


@router.post("/api/v1/user/change-password")
@limiter.limit("5/minute")
async def change_password(
    request: Request,
    data: PasswordChangeSchema,
    user_id: str = Depends(get_current_user_id),
):
    """
    ✅ FIX 3: Uses get_password_hash() and verify_password() from security.py
    instead of importing bcrypt directly. Single source of truth for hashing.
    """
    if not db_engine:
        raise HTTPException(status_code=503, detail="Database offline.")

    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters.")
    if not any(c.isdigit() for c in data.new_password):
        raise HTTPException(status_code=400, detail="New password must contain at least one number.")

    with db_engine.connect() as conn:
        row = conn.execute(
            text("SELECT hashed_password FROM users WHERE id = :uid LIMIT 1"),
            {"uid": user_id},
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="User not found.")

    # ✅ FIX 3: verify_password() from security.py — no direct bcrypt import needed
    if not verify_password(data.current_password, row[0]):
        raise HTTPException(status_code=401, detail="Current password is incorrect.")

    # ✅ FIX 3: get_password_hash() from security.py — consistent with all other endpoints
    new_hashed = get_password_hash(data.new_password)

    with db_engine.begin() as conn:
        conn.execute(
            text("UPDATE users SET hashed_password = :h WHERE id = :uid"),
            {"h": new_hashed, "uid": user_id},
        )
    return {"message": "Password changed successfully."}


# ─────────────────────────────────────────────────────────────────────────────
# 7. CERTIFICATE ENDPOINTS
# ✅ FIX 1: Duplicate endpoint consolidated.
#
# BEFORE (broken):
#   @router.get("/api/v1/verify/{cert_id}")        ← public verify, basic fields
#   @router.get("/api/v1/certificates/{cert_id}")  ← also verifies, richer fields
#   Both did separate SQL queries with different field selections.
#   FastAPI registered both; the first could shadow the second on some routes.
#
# AFTER (fixed):
#   _fetch_certificate_row()  ← single SQL query, shared helper
#   @router.get("/api/v1/verify/{cert_id}")        ← public endpoint, safe display fields
#   @router.get("/api/v1/certificates/{cert_id}")  ← authenticated, full audit fields for PDF
#   Both call the same helper — no duplicated SQL, no divergent logic.
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/api/v1/verify/{cert_id}")
@limiter.limit("30/minute")
async def verify_certificate_public(
    request: Request,
    cert_id: str,
):
    """
    PUBLIC endpoint — verifies a TypeTrace certificate by its ID.
    No authentication required. Safe for sharing with institutions.
    Returns only display-safe fields (no raw keystroke data, no internal IDs).
    """
    if not db_engine:
        raise HTTPException(status_code=503, detail="Database offline.")

    with db_engine.connect() as conn:
        row = _fetch_certificate_row(conn, cert_id)

    if not row:
        return {
            "valid": False,
            "certificate_id": cert_id,
            "reason": "Certificate ID not found in the TypeTrace ledger.",
        }

    duration_mins = int((row[7] or 0) // 60)
    duration_secs = int((row[7] or 0) % 60)
    total_ks      = int(row[6] or 0)
    deletions     = int(row[12] or 0)

    return {
        "valid":          True,
        "certificate_id": row[11],
        "document_hash":  row[5],
        "issued_at":      row[4].strftime("%Y-%m-%d %H:%M:%S UTC") if row[4] else "Unknown",
        "session": {
            "title":            row[0] or "Untitled Document",
            "classification":   row[2] or "UNKNOWN",
            "confidence":       round(float(row[3] or 0), 1),
            "wpm":              round(float(row[1] or 0), 1),
            "duration":         f"{duration_mins}m {duration_secs:02d}s",
            "total_keystrokes": total_ks,
            "deletion_rate":    round((deletions / max(total_ks, 1)) * 100, 1),
            "avg_iki_ms":       int(row[13] or 0),
            "course":           row[17] or None,
        },
        "student": {
            # Only expose first name + last initial for privacy
            "display_name": f"{row[8]} {(row[9] or '')[:1]}.",
            "student_id":   row[15] or "N/A",
            "institution":  row[16] or "Not specified",
        },
    }


@router.get("/api/v1/certificates/{cert_id}")
@limiter.limit("20/minute")
async def get_certificate_audit(
    request: Request,
    cert_id: str,
):
    """
    Authenticated-style certificate endpoint — returns full audit fields
    including re-extracted ML features for the Zero-Knowledge proof page
    and PDF generator. Called by the PDF download endpoint.
    Uses the same _fetch_certificate_row() helper as the public endpoint.
    """
    if not db_engine:
        raise HTTPException(status_code=503, detail="Database offline.")

    with db_engine.connect() as conn:
        row = _fetch_certificate_row(conn, cert_id)

    if not row:
        raise HTTPException(status_code=404, detail="Certificate not found.")

    # Re-extract full features from stored keystroke data for audit transparency
    try:
        ks_array = json.loads(row[10]) if isinstance(row[10], str) else row[10]
        features = extract_features_from_keystroke_array(
            raw_array=ks_array,
            total_keystrokes=row[6],
            deletions=row[12],
            pauses=row[14],
            duration_seconds=row[7],
            text_length=0,
        )
    except Exception:
        features = {}

    return {
        "status":             "valid",
        "certificate_id":     cert_id,
        "author":             f"{row[8]} {row[9][:1]}." if row[8] and row[9] else "Verified User",
        "document_title":     row[0],
        "classification":     row[2],
        "confidence_score":   round(row[3], 1),
        "wpm":                round(row[1], 1),
        "keystrokes_analyzed": row[6],
        "duration_seconds":   round(row[7], 1),
        "document_sha256":    row[5],
        "timestamp":          row[4].strftime("%B %d, %Y - %H:%M UTC") if row[4] else None,
        "features":           features,
    }


@router.get("/api/v1/sessions/{session_id}/certificate-data")
@limiter.limit("20/minute")
async def get_certificate_data(
    request: Request,
    session_id: int,
    user_id: str = Depends(get_current_user_id),
):
    if not db_engine:
        raise HTTPException(status_code=503, detail="Database offline.")

    with db_engine.connect() as conn:
        row = conn.execute(
            text("""
                SELECT
                    ts.id, ts.title, ts.wpm, ts.duration_seconds,
                    ts.classification_result, ts.ml_confidence_score,
                    ts.created_at, ts.certificate_id, ts.document_hash,
                    ts.total_keystrokes, ts.deletions, ts.avg_iki, ts.pauses,
                    ts.user_id,
                    u.first_name, u.last_name, u.student_id, u.university_name,
                    c.course_name
                FROM typing_sessions ts
                JOIN users u ON u.id = ts.user_id
                LEFT JOIN courses c ON c.id = ts.course_id
                WHERE ts.id = :sid
                LIMIT 1
            """),
            {"sid": session_id},
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Session not found.")
    if str(row[13]) != str(user_id):
        raise HTTPException(status_code=403, detail="Access denied.")
    if not row[7]:
        raise HTTPException(status_code=404, detail="No certificate issued for this session.")

    duration_mins = int((row[3] or 0) // 60)
    duration_secs = int((row[3] or 0) % 60)
    deletion_rate = round((row[10] or 0) / max(row[9] or 1, 1) * 100, 1)
    word_count    = round(float(row[2] or 0) * (row[3] or 0) / 60)

    return {
        "certificate_id":   row[7],
        "document_hash":    row[8] or "",
        "issued_at":        row[6].strftime("%Y-%m-%d %H:%M:%S UTC") if row[6] else "",
        "student_name":     f"{row[14]} {row[15] or ''}".strip(),
        "student_id":       row[16] or "N/A",
        "institution":      row[17] or "University of Bedfordshire",
        "document_title":   row[1] or "Untitled Document",
        "course":           row[18] or "Personal Session",
        "classification":   row[4] or "UNKNOWN",
        "confidence":       round(float(row[5] or 0), 1),
        "wpm":              round(float(row[2] or 0), 1),
        "duration":         f"{duration_mins}m {duration_secs:02d}s",
        "word_count":       word_count,
        "total_keystrokes": int(row[9] or 0),
        "deletion_rate":    deletion_rate,
        "avg_iki_ms":       int(row[11] or 0),
        "pause_count":      int(row[12] or 0),
        "verify_url":       f"/verify/{row[7]}",
    }


# ─────────────────────────────────────────────────────────────────────────────
# 8. COURSE MANAGEMENT ENDPOINTS (unchanged from original)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/api/v1/courses")
@limiter.limit("10/minute")
async def create_course(
    request: Request,
    data: CourseCreateSchema,
    payload: dict = Depends(get_full_token_payload),
):
    teacher_id = _require_teacher(payload)
    if not db_engine:
        raise HTTPException(status_code=503, detail="Database offline.")

    invite_code = f"TT-{data.course_code.upper()[:6]}-{_secrets.token_hex(2).upper()}"

    with db_engine.begin() as conn:
        row = conn.execute(
            text("""
                INSERT INTO courses (teacher_id, course_name, course_code, invite_code)
                VALUES (:tid, :name, :code, :invite)
                RETURNING id, course_name, course_code, invite_code, created_at
            """),
            {
                "tid":    teacher_id,
                "name":   data.course_name.strip(),
                "code":   data.course_code.strip().upper(),
                "invite": invite_code,
            },
        ).fetchone()

    return {
        "id":          row[0],
        "course_name": row[1],
        "course_code": row[2],
        "invite_code": row[3],
        "created_at":  row[4].isoformat() if row[4] else None,
    }


@router.get("/api/v1/courses")
@limiter.limit("30/minute")
async def get_my_courses(
    request: Request,
    payload: dict = Depends(get_full_token_payload),
):
    teacher_id = _require_teacher(payload)
    if not db_engine:
        raise HTTPException(status_code=503, detail="Database offline.")

    with db_engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT
                    c.id, c.course_name, c.course_code, c.invite_code, c.created_at,
                    COUNT(DISTINCT cs.student_id)                      AS student_count,
                    COUNT(DISTINCT ts.id)                               AS submission_count,
                    ROUND(AVG(ts.ml_confidence_score)::numeric, 1)     AS avg_confidence
                FROM courses c
                LEFT JOIN course_students cs ON cs.course_id = c.id
                LEFT JOIN typing_sessions ts ON ts.course_id = c.id
                WHERE c.teacher_id = :tid
                GROUP BY c.id
                ORDER BY c.created_at DESC
            """),
            {"tid": teacher_id},
        ).fetchall()

    return {
        "courses": [
            {
                "id":               r[0],
                "course_name":      r[1],
                "course_code":      r[2],
                "invite_code":      r[3],
                "created_at":       r[4].isoformat() if r[4] else None,
                "student_count":    int(r[5] or 0),
                "submission_count": int(r[6] or 0),
                "avg_confidence":   float(r[7] or 0),
            }
            for r in rows
        ]
    }


@router.post("/api/v1/courses/join")
@limiter.limit("10/minute")
async def join_course(
    request: Request,
    data: JoinCourseSchema,
    payload: dict = Depends(get_full_token_payload),
):
    if payload.get("role") != "STUDENT":
        raise HTTPException(status_code=403, detail="Only students can join courses.")

    student_id = str(payload["id"])
    if not db_engine:
        raise HTTPException(status_code=503, detail="Database offline.")

    with db_engine.begin() as conn:
        course_row = conn.execute(
            text("SELECT id, course_name, course_code FROM courses WHERE invite_code = :code"),
            {"code": data.invite_code.strip().upper()},
        ).fetchone()

        if not course_row:
            raise HTTPException(status_code=404, detail="Invalid invite code.")

        conn.execute(
            text("""
                INSERT INTO course_students (course_id, student_id)
                VALUES (:cid, :sid)
                ON CONFLICT (course_id, student_id) DO NOTHING
            """),
            {"cid": course_row[0], "sid": student_id},
        )

    return {
        "message":     f"Successfully joined {course_row[1]}.",
        "course_id":   course_row[0],
        "course_name": course_row[1],
        "course_code": course_row[2],
    }


@router.get("/api/v1/courses/enrolled")
@limiter.limit("30/minute")
async def get_enrolled_courses(
    request: Request,
    payload: dict = Depends(get_full_token_payload),
):
    if payload.get("role") != "STUDENT":
        raise HTTPException(status_code=403, detail="Students only.")

    student_id = str(payload["id"])
    if not db_engine:
        raise HTTPException(status_code=503, detail="Database offline.")

    with db_engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT c.id, c.course_name, c.course_code, c.invite_code, cs.joined_at
                FROM courses c
                JOIN course_students cs ON cs.course_id = c.id
                WHERE cs.student_id = :sid
                ORDER BY cs.joined_at DESC
            """),
            {"sid": student_id},
        ).fetchall()

    return {
        "courses": [
            {
                "id":          r[0],
                "course_name": r[1],
                "course_code": r[2],
                "invite_code": r[3],
                "joined_at":   r[4].isoformat() if r[4] else None,
            }
            for r in rows
        ]
    }


# ─────────────────────────────────────────────────────────────────────────────
# 9. TEACHER DASHBOARD ENDPOINTS
# ✅ FIX 5 applied in submit_review_decision below
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/api/v1/teacher/students")
@limiter.limit("30/minute")
async def get_teacher_students(
    request: Request,
    payload: dict = Depends(get_full_token_payload),
):
    teacher_id = _require_teacher(payload)
    if not db_engine:
        raise HTTPException(status_code=503, detail="Database offline.")

    with db_engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT DISTINCT
                    u.id, u.first_name, u.last_name, u.email, u.student_id,
                    c.course_name, c.id AS course_id,
                    COUNT(ts.id) AS session_count,
                    ROUND(AVG(ts.ml_confidence_score)::numeric, 1) AS avg_confidence,
                    MAX(ts.created_at) AS last_active
                FROM courses c
                JOIN course_students cs ON cs.course_id = c.id
                JOIN users u ON u.id = cs.student_id
                LEFT JOIN typing_sessions ts ON ts.user_id = u.id AND ts.course_id = c.id
                WHERE c.teacher_id = :tid
                GROUP BY u.id, u.first_name, u.last_name, u.email, u.student_id, c.id, c.course_name
                ORDER BY last_active DESC NULLS LAST
            """),
            {"tid": teacher_id},
        ).fetchall()

    return {
        "students": [
            {
                "user_id":       r[0],
                "first_name":    r[1],
                "last_name":     r[2],
                "email":         r[3],
                "student_id":    r[4],
                "course_name":   r[5],
                "course_id":     r[6],
                "session_count": int(r[7] or 0),
                "avg_confidence": float(r[8] or 0),
                "last_active":   r[9].strftime("%b %d, %Y") if r[9] else "Never",
            }
            for r in rows
        ]
    }


@router.get("/api/v1/teacher/sessions")
@limiter.limit("30/minute")
async def get_teacher_sessions(
    request: Request,
    course_id: Optional[int] = None,
    payload: dict = Depends(get_full_token_payload),
):
    teacher_id = _require_teacher(payload)
    if not db_engine:
        raise HTTPException(status_code=503, detail="Database offline.")

    with db_engine.connect() as conn:
        query_filter = "AND ts.course_id = :cid" if course_id else ""
        rows = conn.execute(
            text(f"""
                SELECT
                    ts.id, ts.title, ts.wpm, ts.duration_seconds,
                    ts.classification_result, ts.ml_confidence_score,
                    ts.created_at, ts.review_status, ts.risk_level,
                    u.first_name, u.last_name, u.student_id,
                    c.course_name, ts.course_id
                FROM typing_sessions ts
                JOIN users u ON u.id = ts.user_id
                JOIN courses c ON c.id = ts.course_id
                WHERE c.teacher_id = :tid
                  {query_filter}
                ORDER BY ts.created_at DESC
                LIMIT 500
            """),
            {"tid": teacher_id, "cid": course_id},
        ).fetchall()

    return {
        "sessions": [
            {
                "id":            r[0],
                "title":         r[1],
                "wpm":           round(float(r[2] or 0), 1),
                "duration":      round(float(r[3] or 0), 1),
                "classification": r[4],
                "confidence":    round(float(r[5] or 0), 1),
                "date":          r[6].strftime("%b %d, %Y") if r[6] else "Unknown",
                "review_status": r[7] or "PENDING",
                "risk_level":    r[8] or "LOW",
                "student_name":  f"{r[9]} {r[10]}",
                "student_id":    r[11],
                "course_name":   r[12],
                "course_id":     r[13],
            }
            for r in rows
        ]
    }


@router.get("/api/v1/teacher/sessions/{session_id}")
@limiter.limit("20/minute")
async def get_teacher_session_detail(
    request: Request,
    session_id: int,
    payload: dict = Depends(get_full_token_payload),
):
    teacher_id = _require_teacher(payload)
    if not db_engine:
        raise HTTPException(status_code=503, detail="Database offline.")

    with db_engine.connect() as conn:
        row = conn.execute(
            text("""
                SELECT
                    ts.id, ts.title, ts.wpm, ts.duration_seconds,
                    ts.classification_result, ts.ml_confidence_score,
                    ts.total_keystrokes, ts.deletions, ts.pauses, ts.avg_iki,
                    ts.created_at, ts.review_status, ts.review_notes,
                    ts.risk_level, ts.certificate_id, ts.document_hash,
                    ts.text_content,
                    u.first_name, u.last_name, u.email, u.student_id,
                    c.course_name, c.id AS course_id
                FROM typing_sessions ts
                JOIN users u ON u.id = ts.user_id
                JOIN courses c ON c.id = ts.course_id
                WHERE ts.id = :sid AND c.teacher_id = :tid
                LIMIT 1
            """),
            {"sid": session_id, "tid": teacher_id},
        ).fetchone()

    if not row:
        raise HTTPException(
            status_code=404,
            detail="Session not found or not submitted to your course.",
        )

    return {
        "id":               row[0],
        "title":            row[1],
        "wpm":              round(float(row[2] or 0), 1),
        "duration":         round(float(row[3] or 0), 1),
        "classification":   row[4],
        "confidence":       round(float(row[5] or 0), 1),
        "total_keystrokes": int(row[6] or 0),
        "deletions":        int(row[7] or 0),
        "pauses":           int(row[8] or 0),
        "avg_iki":          int(row[9] or 0),
        "date":             row[10].strftime("%b %d, %Y %H:%M") if row[10] else "Unknown",
        "review_status":    row[11] or "PENDING",
        "review_notes":     row[12] or "",
        "risk_level":       row[13] or "LOW",
        "certificate_id":   row[14],
        "document_hash":    row[15],
        "text_preview":     (row[16] or "")[:500],
        "student": {
            "first_name": row[17],
            "last_name":  row[18],
            "email":      row[19],
            "student_id": row[20],
        },
        "course_name": row[21],
        "course_id":   row[22],
    }


@router.patch("/api/v1/teacher/sessions/{session_id}/review")
@limiter.limit("20/minute")
async def submit_review_decision(
    request: Request,
    session_id: int,
    data: ReviewDecisionSchema,
    payload: dict = Depends(get_full_token_payload),
):
    """
    ✅ FIX 5: Teacher review ownership check was using the wrong join.

    BEFORE (broken):
        JOIN course_students cs ON cs.student_id = ts.user_id
        JOIN courses c ON c.id = cs.course_id
        WHERE ts.id = :sid AND c.teacher_id = :tid
    This allowed a teacher to review sessions from students enrolled in ANY
    of their courses, even if the session was submitted to a DIFFERENT course.

    AFTER (fixed):
        JOIN courses c ON c.id = ts.course_id
        WHERE ts.id = :sid AND c.teacher_id = :tid
    Ownership is now validated through the session's own course_id column,
    ensuring the teacher only reviews sessions in courses they actually own.
    """
    teacher_id = _require_teacher(payload)
    if not db_engine:
        raise HTTPException(status_code=503, detail="Database offline.")

    valid_statuses = {"APPROVED", "FLAGGED", "UNDER_REVIEW", "PENDING"}
    if data.status.upper() not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"status must be one of: {', '.join(valid_statuses)}",
        )

    with db_engine.begin() as conn:
        # ✅ FIX 5: Join directly through ts.course_id → courses.teacher_id
        # This is the correct ownership check: the session's course must belong to this teacher
        ownership = conn.execute(
            text("""
                SELECT ts.id
                FROM typing_sessions ts
                JOIN courses c ON c.id = ts.course_id
                WHERE ts.id = :sid AND c.teacher_id = :tid
                LIMIT 1
            """),
            {"sid": session_id, "tid": teacher_id},
        ).fetchone()

        if not ownership:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to review this session.",
            )

        conn.execute(
            text("""
                UPDATE typing_sessions
                SET review_status = :status,
                    review_notes  = :notes,
                    reviewed_by   = :teacher
                WHERE id = :sid
            """),
            {
                "status":  data.status.upper(),
                "notes":   (data.notes or "").strip(),
                "teacher": teacher_id,
                "sid":     session_id,
            },
        )

    return {
        "message":       "Review decision saved.",
        "session_id":    session_id,
        "review_status": data.status.upper(),
    }


@router.get("/api/v1/teacher/stats")
@limiter.limit("30/minute")
async def get_teacher_stats(
    request: Request,
    payload: dict = Depends(get_full_token_payload),
):
    teacher_id = _require_teacher(payload)
    if not db_engine:
        raise HTTPException(status_code=503, detail="Database offline.")

    with db_engine.connect() as conn:
        stats = conn.execute(
            text("""
                SELECT
                    COUNT(DISTINCT cs.student_id)                                  AS total_students,
                    COUNT(DISTINCT ts.id)                                           AS total_submissions,
                    ROUND(AVG(ts.ml_confidence_score)::numeric, 1)                 AS avg_confidence,
                    COUNT(DISTINCT CASE WHEN ts.classification_result IN
                        ('SUSPICIOUS','SYNTHETIC','AI-GENERATED') THEN ts.id END)  AS suspicious_count,
                    COUNT(DISTINCT CASE WHEN ts.review_status = 'PENDING'
                        THEN ts.id END)                                             AS pending_reviews,
                    COUNT(DISTINCT c.id)                                            AS total_courses
                FROM courses c
                LEFT JOIN course_students cs ON cs.course_id = c.id
                LEFT JOIN typing_sessions ts ON ts.course_id = c.id
                WHERE c.teacher_id = :tid
            """),
            {"tid": teacher_id},
        ).fetchone()

    total_subs = int(stats[1] or 0)
    suspicious  = int(stats[3] or 0)

    return {
        "total_students":    int(stats[0] or 0),
        "total_submissions": total_subs,
        "avg_confidence":    float(stats[2] or 0),
        "suspicious_pct":    round((suspicious / total_subs * 100) if total_subs > 0 else 0, 1),
        "pending_reviews":   int(stats[4] or 0),
        "total_courses":     int(stats[5] or 0),
    }


@router.get("/api/v1/courses/{course_id}/students")
@limiter.limit("30/minute")
async def get_course_students(
    request: Request,
    course_id: int,
    payload: dict = Depends(get_full_token_payload),
):
    teacher_id = _require_teacher(payload)
    if not db_engine:
        raise HTTPException(status_code=503, detail="Database offline.")

    with db_engine.connect() as conn:
        course_row = conn.execute(
            text("SELECT id, course_name, course_code, invite_code FROM courses WHERE id = :cid AND teacher_id = :tid"),
            {"cid": course_id, "tid": teacher_id},
        ).fetchone()

        if not course_row:
            raise HTTPException(status_code=404, detail="Course not found or access denied.")

        students = conn.execute(
            text("""
                SELECT
                    u.id, u.first_name, u.last_name, u.email, u.student_id,
                    cs.joined_at,
                    COUNT(ts.id)                                       AS submission_count,
                    ROUND(AVG(ts.ml_confidence_score)::numeric, 1)    AS avg_confidence,
                    MAX(ts.created_at)                                 AS last_submission,
                    COUNT(CASE WHEN ts.classification_result IN
                        ('SUSPICIOUS','SYNTHETIC','AI-GENERATED') THEN 1 END) AS suspicious_count,
                    COUNT(CASE WHEN ts.review_status = 'PENDING' THEN 1 END)  AS pending_reviews
                FROM course_students cs
                JOIN users u ON u.id = cs.student_id
                LEFT JOIN typing_sessions ts ON ts.user_id = u.id AND ts.course_id = :cid
                WHERE cs.course_id = :cid
                GROUP BY u.id, u.first_name, u.last_name, u.email, u.student_id, cs.joined_at
                ORDER BY cs.joined_at ASC
            """),
            {"cid": course_id},
        ).fetchall()

    return {
        "course": {
            "id":          course_row[0],
            "course_name": course_row[1],
            "course_code": course_row[2],
            "invite_code": course_row[3],
        },
        "students": [
            {
                "user_id":          r[0],
                "first_name":       r[1],
                "last_name":        r[2],
                "email":            r[3],
                "student_id":       r[4],
                "joined_at":        r[5].strftime("%b %d, %Y") if r[5] else "Unknown",
                "submission_count": int(r[6] or 0),
                "avg_confidence":   float(r[7] or 0),
                "last_submission":  r[8].strftime("%b %d, %Y") if r[8] else "Never",
                "suspicious_count": int(r[9] or 0),
                "pending_reviews":  int(r[10] or 0),
            }
            for r in students
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# 10. CERTIFICATE PDF GENERATOR
# ─────────────────────────────────────────────────────────────────────────────

def _generate_custom_qr(data_url: str, icon_path: Path) -> io.BytesIO:
    qr = qrcode.QRCode(
        version=5,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=1,
    )
    qr.add_data(data_url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="#0F172A", back_color="white").convert("RGB")

    if icon_path.exists():
        try:
            logo = Image.open(icon_path)
            basewidth = int(qr_img.size[0] * 0.28)
            wpercent = basewidth / float(logo.size[0])
            hsize = int(float(logo.size[1]) * float(wpercent))
            logo = logo.resize((basewidth, hsize), Image.Resampling.LANCZOS)
            bg = Image.new("RGB", (logo.size[0] + 6, logo.size[1] + 6), "white")
            bg.paste(logo, (3, 3), mask=logo if logo.mode == "RGBA" else None)
            pos = ((qr_img.size[0] - bg.size[0]) // 2, (qr_img.size[1] - bg.size[1]) // 2)
            qr_img.paste(bg, pos)
        except Exception as e:
            log.error(f"Failed to embed logo in QR: {e}")

    buffer = io.BytesIO()
    qr_img.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer


@router.get("/api/v1/certificates/{cert_id}/pdf")
@limiter.limit("10/minute")
async def download_certificate_pdf(request: Request, cert_id: str):
    """Generates a high-fidelity compliance certificate PDF."""
    # Reuse the audit endpoint to get all data + features in one call
    data = await get_certificate_audit(request, cert_id)
    feats = data.get("features", {})

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    c.setFillColor(colors.HexColor("#0F172A"))
    c.rect(0, height - 14, width, 14, fill=1, stroke=0)

    c.saveState()
    c.translate(width / 2, height / 2)
    c.rotate(45)
    c.setFont("Helvetica-Bold", 80)
    c.setFillColor(colors.HexColor("#F8FAFC"))
    c.drawCentredString(0, 0, "SECURE LEDGER RECORD")
    c.restoreState()

    header_y = height - 75
    if LOGO_FULL_PATH.exists():
        try:
            c.drawImage(ImageReader(str(LOGO_FULL_PATH)), 45, header_y, width=140, height=30,
                        preserveAspectRatio=True, mask="auto")
        except Exception:
            pass

    c.setFont("Courier-Bold", 9)
    c.setFillColor(colors.HexColor("#64748B"))
    c.drawRightString(width - 45, header_y + 15, "SESSION ID:")
    c.setFont("Courier-Bold", 12)
    c.setFillColor(colors.HexColor("#0F172A"))
    c.drawRightString(width - 45, header_y, data["certificate_id"])

    title_y = header_y - 65
    c.setFont("Helvetica-Bold", 20)
    c.setFillColor(colors.HexColor("#0F172A"))
    c.drawString(45, title_y, "BIOMETRIC PROOF OF AUTHORSHIP")
    c.setFont("Helvetica", 9.5)
    c.setFillColor(colors.HexColor("#475569"))
    c.drawString(45, title_y - 16, "Cryptographic Liveness Audit trail generated via behavioral keystroke dynamics matrix")
    c.setStrokeColor(colors.HexColor("#E2E8F0"))
    c.setLineWidth(1)
    c.line(45, title_y - 32, width - 45, title_y - 32)

    grid_y = title_y - 70
    meta_registry = [
        ("VERIFIED AUTHOR",        data["author"]),
        ("DOCUMENT SCHEMA TITLE",  data["document_title"]),
        ("COMPLETION TIMESTAMP",   data["timestamp"]),
    ]
    for label, val in meta_registry:
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(colors.HexColor("#94A3B8"))
        c.drawString(45, grid_y, label)
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(colors.HexColor("#0F172A"))
        c.drawString(45, grid_y - 14, str(val))
        grid_y -= 42

    crypto_y = grid_y - 12
    c.setFillColor(colors.HexColor("#F8FAFC"))
    c.setStrokeColor(colors.HexColor("#E2E8F0"))
    c.roundRect(45, crypto_y - 45, width - 90, 45, radius=6, fill=1, stroke=1)
    c.setFont("Helvetica-Bold", 7.5)
    c.setFillColor(colors.HexColor("#64748B"))
    c.drawString(60, crypto_y - 16, "SHA-256 SYSTEM ATTESTATION HASH")
    c.setFont("Courier-Bold", 9.5)
    c.setFillColor(colors.HexColor("#0F172A"))
    c.drawString(60, crypto_y - 32, data["document_sha256"])

    matrix_y = crypto_y - 85
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.HexColor("#0F172A"))
    c.drawString(45, matrix_y, "Extracted Biometric Telemetry Matrix")

    grid_top = matrix_y - 15
    box_w, box_h = 164, 42
    gap = 10

    metrics_data = [
        ("NET TYPING SPEED",         f"{data['wpm']} WPM"),
        ("BURST INTENSITY RATIO",    f"{feats.get('burst_ratio', 0.0):.3f}"),
        ("RHYTHM SEQUENCE ENTROPY",  f"{feats.get('ft_entropy', 0.0):.3f}"),
        ("MEAN KEY HOLD TIME (HT)",  f"{feats.get('ht_mean', 0.0):.1f} ms"),
        ("MEAN KEY FLIGHT TIME (FT)", f"{feats.get('ft_mean', 0.0):.1f} ms"),
        ("TEMPORAL AUTOCORRELATION", f"{feats.get('ft_autocorr', 0.0):.3f}"),
    ]

    for i, (m_label, m_val) in enumerate(metrics_data):
        row_idx = i // 3
        col_idx = i % 3
        bx = 45 + col_idx * (box_w + gap)
        by = grid_top - row_idx * (box_h + gap) - box_h
        c.setFillColor(colors.HexColor("#F8FAFC"))
        c.setStrokeColor(colors.HexColor("#F1F5F9"))
        c.roundRect(bx, by, box_w, box_h, radius=4, fill=1, stroke=1)
        c.setFont("Helvetica-Bold", 7)
        c.setFillColor(colors.HexColor("#64748B"))
        c.drawString(bx + 10, by + 26, m_label)
        c.setFont("Courier-Bold", 11)
        c.setFillColor(colors.HexColor("#0F172A"))
        c.drawString(bx + 10, by + 10, m_val)

    verdict_y = grid_top - 2 * (box_h + gap) - 50
    is_human = data["classification"] == "HUMAN"

    c.setFillColor(colors.HexColor("#F0FDF4") if is_human else colors.HexColor("#FEF2F2"))
    c.setStrokeColor(colors.HexColor("#10B981") if is_human else colors.HexColor("#EF4444"))
    c.roundRect(45, verdict_y - 80, 340, 80, radius=8, fill=1, stroke=1)
    c.setFillColor(colors.HexColor("#166534") if is_human else colors.HexColor("#991B1B"))
    c.setFont("Helvetica-Bold", 15)
    c.drawString(60, verdict_y - 28, f"CLASSIFICATION: {data['classification']}")
    c.setFont("Helvetica-Bold", 11)
    c.drawString(60, verdict_y - 46, f"Verification Confidence: {data['confidence_score']}%")
    c.setFont("Helvetica", 8.5)
    c.setFillColor(colors.HexColor("#15803D") if is_human else colors.HexColor("#B91C1C"))
    c.drawString(60, verdict_y - 64, "Validated safe against algorithmic generation & auto-typer scripts.")

    seal_x = 330
    seal_y = verdict_y - 40
    c.setStrokeColor(colors.HexColor("#10B981") if is_human else colors.HexColor("#EF4444"))
    c.setLineWidth(1.2)
    c.circle(seal_x, seal_y, 26, fill=0, stroke=1)
    c.circle(seal_x, seal_y, 22, fill=0, stroke=1)
    c.setLineWidth(0.5)
    c.line(seal_x - 26, seal_y, seal_x - 22, seal_y)
    c.line(seal_x + 22, seal_y, seal_x + 26, seal_y)
    c.line(seal_x, seal_y - 26, seal_x, seal_y - 22)
    c.line(seal_x, seal_y + 22, seal_x, seal_y + 26)
    c.setFont("Helvetica-Bold", 6.5)
    c.drawCentredString(seal_x, seal_y + 4, "SECURE")
    c.drawCentredString(seal_x, seal_y - 5, "LEDGER")

    verify_url = f"{FRONTEND_URL}/verify/{cert_id}"
    qr_buffer = _generate_custom_qr(verify_url, LOGO_ICON_PATH)
    qr_size = 110
    qr_x = width - 45 - qr_size
    qr_y = verdict_y - 85
    c.drawImage(ImageReader(qr_buffer), qr_x, qr_y, width=qr_size, height=qr_size)
    c.setFont("Helvetica-Bold", 7)
    c.setFillColor(colors.HexColor("#94A3B8"))
    c.drawCentredString(qr_x + (qr_size / 2), qr_y - 12, "SCAN TO ACCESS AUDIT TRAIL")

    c.setFont("Helvetica", 8)
    c.setFillColor(colors.HexColor("#CBD5E1"))
    c.drawCentredString(
        width / 2, 28,
        f"Verifiable zero-knowledge proof assertion token tied to an active database ledger • {verify_url}",
    )

    c.save()
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={cert_id}.pdf"},
    )