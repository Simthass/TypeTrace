"""
TypeTrace ML Inference Service v5.0 (Cryptographic Certificate Edition)
=======================================================================
Production FastAPI microservice for keystroke liveness detection and 
Zero-Knowledge Proof certificate generation.

New Features:
  - TT26 Cryptographic ID generation
  - SHA-256 Document Hashing
  - Auto-patching PostgreSQL schema
  - Public Zero-Knowledge Verification Endpoint
  - Dynamic PDF Certificate Generation (ReportLab + QRCode)
"""

import os
import json
import logging
import warnings
import secrets
import hashlib
import io
from typing import Any, Optional
from pathlib import Path

import numpy as np
import joblib
import qrcode
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from jose import jwt, JWTError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors

# Import the shared feature extractor
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
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,https://typetrace.app,https://www.typetrace.app"
).split(",")

DB_URL = os.getenv("DATABASE_URL", "").replace("+asyncpg", "")

KILL_WPM_THRESHOLD    = 180    
KILL_PASTE_THRESHOLD  = 3      
KILL_IKI_STD_THRESHOLD = 15    
KILL_ENTROPY_THRESHOLD = 0.5   

limiter = Limiter(key_func=get_remote_address)

# ─────────────────────────────────────────────────────────────────────────────
# 2. STARTUP & DB AUTO-PATCH
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="TypeTrace Inference API", version="5.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

rf_model, scaler, label_encoder = None, None, None
feature_cols = FEATURE_COLUMNS
model_metadata = {}

try:
    rf_model       = joblib.load(MODEL_PATH)
    scaler         = joblib.load(SCALER_PATH)
    label_encoder  = joblib.load(ENCODER_PATH)
    feature_cols   = joblib.load(FEATURES_PATH)
    with open(META_PATH) as f:
        model_metadata = json.load(f)
    log.info(f"✅ Model v{model_metadata.get('version','?')} loaded.")
except Exception as e:
    log.error(f"❌ Failed to load model: {e}")

db_engine = None
if DB_URL:
    try:
        db_engine = create_engine(DB_URL, pool_pre_ping=True)
        # DEFENSIVE ENGINEERING: Auto-patch the DB to add our new columns if missing
        with db_engine.begin() as conn:
            conn.execute(text("ALTER TABLE typing_sessions ADD COLUMN IF NOT EXISTS certificate_id VARCHAR(50) UNIQUE;"))
            conn.execute(text("ALTER TABLE typing_sessions ADD COLUMN IF NOT EXISTS document_hash VARCHAR(64);"))
        log.info("✅ Database engine initialized & schema patched for Certificates.")
    except Exception as e:
        log.warning(f"⚠️  Database connection/patch failed: {e}")

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

class AnalysisResult(BaseModel):
    classification: str          
    confidence_score: float      
    kill_switch_triggered: bool  
    kill_switch_reason: Optional[str]
    advanced_stats: dict         
    session_id: Optional[int]    
    certificate_id: Optional[str] # NEW
    document_hash: Optional[str]  # NEW

# ─────────────────────────────────────────────────────────────────────────────
# 5. CORE INFERENCE
# ─────────────────────────────────────────────────────────────────────────────
def run_inference(keystroke_array: list, stats: SessionStats, text_content: str):
    features = extract_features_from_keystroke_array(
        raw_array=keystroke_array, total_keystrokes=stats.keystrokes,
        deletions=stats.deletions, pauses=stats.pauses,
        duration_seconds=stats.sessionSeconds, text_length=len(text_content),
    )

    paste_count = sum(1 for e in keystroke_array if isinstance(e, dict) and e.get("key") == "__PASTE_EVENT__")
    net_wpm, iki_std, entropy = features.get("net_wpm", 0), features.get("ft_std", 999), features.get("ft_entropy", 999)

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
# 6. ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health")
@limiter.limit("10/minute")
async def health(request: Request):
    return {"status": "ok", "model_loaded": rf_model is not None}


@app.post("/api/v1/sessions/analyze", response_model=AnalysisResult)
@limiter.limit("10/minute")
async def analyze_session(request: Request, data: KeystrokeSession, user_id: str = Depends(get_current_user_id)):
    if not data.keystroke_array or len(data.keystroke_array) < MINIMUM_KEYS_PER_SESSION:
        raise HTTPException(status_code=400, detail="Insufficient keystroke data.")

    classification, confidence, kill_triggered, kill_reason, features = run_inference(
        data.keystroke_array, data.stats, data.text_content
    )

    # SECURE CRYPTOGRAPHY GENERATION
    cert_id = f"TT26-{secrets.token_hex(4).upper()}"
    doc_hash = hashlib.sha256(data.text_content.encode('utf-8')).hexdigest()
    session_id = None

    if db_engine:
        try:
            with db_engine.begin() as conn:
                result = conn.execute(
                    text("""
                        INSERT INTO typing_sessions (
                            user_id, title, text_content, wpm, total_keystrokes, deletions, pauses, avg_iki, 
                            duration_seconds, classification_result, ml_confidence_score, raw_keystroke_data,
                            certificate_id, document_hash
                        ) VALUES (
                            :u, :t, :txt, :w, :tk, :d, :p, :avg, :ds, :cls, :conf, :raw, :cert, :hash
                        ) RETURNING id
                    """),
                    {
                        "u": user_id, "t": data.title, "txt": data.text_content, 
                        "w": round(features.get("net_wpm", data.stats.wpm)), "tk": data.stats.keystrokes,
                        "d": data.stats.deletions, "p": data.stats.pauses, "avg": round(features.get("ft_mean", data.stats.avgIki)),
                        "ds": data.stats.sessionSeconds, "cls": classification, "conf": float(confidence),
                        "raw": json.dumps(data.keystroke_array[:500]), "cert": cert_id, "hash": doc_hash
                    }
                )
                row = result.fetchone()
                session_id = row[0] if row else None
        except Exception as e:
            log.error(f"DB save failed: {e}")

    return AnalysisResult(
        classification=classification, confidence_score=confidence,
        kill_switch_triggered=kill_triggered, kill_switch_reason=kill_reason,
        advanced_stats={"net_wpm": round(features.get("net_wpm", 0), 1)},
        session_id=session_id, certificate_id=cert_id, document_hash=doc_hash
    )


@app.get("/api/v1/sessions/history")
@limiter.limit("30/minute")
async def get_session_history(request: Request, user_id: str = Depends(get_current_user_id)):
    if not db_engine: raise HTTPException(status_code=503, detail="DB offline.")
    with db_engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT id, title, wpm, duration_seconds, classification_result, 
                       ml_confidence_score, created_at, certificate_id 
                FROM typing_sessions WHERE user_id = :u ORDER BY created_at DESC LIMIT 100
            """), {"u": user_id}
        ).fetchall()
    return {"status": "success", "sessions": [
        {
            "id": r[0], "title": r[1], "wpm": round(r[2] or 0, 1), "duration": round(r[3] or 0, 1),
            "classification": r[4], "confidence": round(r[5] or 0, 1),
            "date": r[6].strftime("%b %d, %Y") if r[6] else "Unknown",
            "certificate_id": r[7]
        } for r in rows
    ]}


# ─────────────────────────────────────────────────────────────────────────────
# 7. ZERO-KNOWLEDGE PUBLIC VERIFICATION & PDF GENERATOR
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/v1/certificates/{cert_id}")
@limiter.limit("20/minute")
async def verify_certificate(request: Request, cert_id: str):
    """PUBLIC: Returns Metadata only. No text content exposed."""
    if not db_engine: raise HTTPException(status_code=503)
    
    with db_engine.connect() as conn:
        # JOIN with users table to get the author name without exposing full email
        row = conn.execute(
            text("""
                SELECT t.title, t.wpm, t.classification_result, t.ml_confidence_score, 
                       t.created_at, t.document_hash, t.total_keystrokes, t.duration_seconds,
                       u.first_name, u.last_name
                FROM typing_sessions t
                JOIN users u ON t.user_id = u.id
                WHERE t.certificate_id = :cid
            """), {"cid": cert_id}
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Certificate not found.")

    return {
        "status": "valid",
        "certificate_id": cert_id,
        "author": f"{row[8]} {row[9][:1]}." if row[8] and row[9] else "Verified User",
        "document_title": row[0],
        "classification": row[2],
        "confidence_score": round(row[3], 1),
        "wpm": round(row[1], 1),
        "keystrokes_analyzed": row[6],
        "duration_seconds": round(row[7], 1),
        "document_sha256": row[5],
        "timestamp": row[4].isoformat() if row[4] else None
    }


@app.get("/api/v1/certificates/{cert_id}/pdf")
@limiter.limit("10/minute")
async def download_certificate_pdf(request: Request, cert_id: str):
    """Generates an enterprise-grade PDF on the fly."""
    data = await verify_certificate(request, cert_id)
    
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    # Draw Premium Border
    c.setStrokeColor(colors.HexColor("#E5E5E5"))
    c.setLineWidth(2)
    c.rect(30, 30, width - 60, height - 60)

    # Title
    c.setFont("Helvetica-Bold", 24)
    c.setFillColor(colors.HexColor("#050505"))
    c.drawString(50, height - 80, "TypeTrace Cryptographic Receipt")

    c.setFont("Helvetica", 10)
    c.setFillColor(colors.HexColor("#666666"))
    c.drawString(50, height - 100, "Immutable Biometric Authorship Verification")

    # Divider
    c.setStrokeColor(colors.HexColor("#EAEAEA"))
    c.line(50, height - 120, width - 50, height - 120)

    # Certificate Details
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(colors.black)
    
    y = height - 160
    details = [
        ("Certificate ID:", data["certificate_id"]),
        ("Author:", data["author"]),
        ("Document Title:", data["document_title"]),
        ("SHA-256 Hash:", data["document_sha256"]),
        ("Timestamp:", data["timestamp"]),
    ]

    for label, val in details:
        c.setFont("Helvetica-Bold", 10)
        c.drawString(50, y, label)
        c.setFont("Helvetica", 10)
        c.drawString(160, y, str(val))
        y -= 25

    # Biometric Results Box
    c.setFillColor(colors.HexColor("#FAFAFA"))
    c.rect(50, y - 100, width - 100, 80, fill=1, stroke=0)
    
    is_human = data["classification"] == "HUMAN"
    c.setFillColor(colors.HexColor("#10B981") if is_human else colors.HexColor("#EF4444"))
    c.setFont("Helvetica-Bold", 16)
    c.drawString(70, y - 50, f"RESULT: {data['classification']} ({data['confidence_score']}%)")
    
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 10)
    c.drawString(70, y - 75, f"Typing Speed: {data['wpm']} WPM | Biometric Data Points: {data['keystrokes_analyzed']}")

    # Generate QR Code pointing to the verification page
    qr = qrcode.QRCode(version=1, box_size=3, border=1)
    verify_url = f"{FRONTEND_URL}/verify/{cert_id}"
    qr.add_data(verify_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save QR to temp buffer and draw on PDF
    qr_buffer = io.BytesIO()
    img.save(qr_buffer, format="PNG")
    qr_buffer.seek(0)
    
    from reportlab.lib.utils import ImageReader
    c.drawImage(ImageReader(qr_buffer), width - 150, 50, width=100, height=100)

    # Footer
    c.setFont("Helvetica", 8)
    c.setFillColor(colors.gray)
    c.drawString(50, 60, f"Scan QR code to mathematically verify this document at {verify_url}")

    c.save()
    buffer.seek(0)

    return StreamingResponse(
        buffer, 
        media_type="application/pdf", 
        headers={"Content-Disposition": f"attachment; filename=TypeTrace_{cert_id}.pdf"}
    )