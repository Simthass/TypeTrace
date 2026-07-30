import io
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from fastapi.responses import StreamingResponse
from reportlab.lib import colors as pdf_colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from PIL import Image, ImageDraw
import qrcode
from qrcode.constants import ERROR_CORRECT_H
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_teacher
from app.core.config import PROJECT_ROOT, settings
from app.db.database import get_db
from app.core.rate_limit import limiter, per_minute
from app.models.user import User
from app.repositories.certificates import (
    fetch_certificate_record_row,
    fetch_owned_session_certificate_id,
    list_user_certificate_ids,
    lock_certificate_for_revocation,
)
from app.core.privacy import safe_public_certificate_identity
from app.services.certificate_signing import verify_certificate_record
from app.services.certificate_status import resolve_public_certificate_state
from app.services.notifications import bump_unread_cache
from app.schemas.responses import (
    CertificateListResponse,
    CertificateRevocationResponse,
    PublicCertificateResponse,
)


router = APIRouter()
logger = logging.getLogger("typetrace.certificates")



class CertificateRevocationRequest(BaseModel):
    reason: str = Field(min_length=8, max_length=500)

    model_config = {"extra": "forbid"}


CERT_ID_PATTERN = re.compile(r"^[A-Za-z0-9\-_]{8,80}$")

# Professional certificate asset locations. These keep the feature production-safe:
# if the assets are missing in a deployed backend container, the PDF still renders
# with a clean text fallback instead of crashing.
FRONTEND_PUBLIC_DIR = PROJECT_ROOT / "frontend" / "public"
BRAND_LOGO_CANDIDATES = (
    FRONTEND_PUBLIC_DIR / "Logo.png",
    FRONTEND_PUBLIC_DIR / "logo.png",
    FRONTEND_PUBLIC_DIR / "QR-Logo.png",
)
QR_LOGO_CANDIDATES = (
    FRONTEND_PUBLIC_DIR / "QR-Logo.png",
    FRONTEND_PUBLIC_DIR / "Logo.png",
    FRONTEND_PUBLIC_DIR / "logo.png",
)

# Premium PDF palette. Kept local to the backend PDF renderer so it does not
# affect the frontend design system.
PDF_BLUE = "#0B4F9C"
PDF_BLUE_DARK = "#083B74"
PDF_INK = "#111827"
PDF_MUTED = "#6B7280"
PDF_LINE = "#D7DEE8"
PDF_PANEL = "#F7FAFC"
PDF_SOFT_BLUE = "#EEF6FF"
PDF_SUCCESS = "#047857"
PDF_WARNING = "#B45309"
PDF_DANGER = "#B91C1C"


def _validate_certificate_id(cert_id: str) -> str:
    cleaned = cert_id.strip()

    if not CERT_ID_PATTERN.match(cleaned):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid certificate ID format.",
        )

    return cleaned


def _format_datetime(value: Any) -> str:
    if value is None:
        return "Unknown"

    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    return str(value)


def _classification_label(value: Optional[str]) -> str:
    normalized = str(value or "UNKNOWN").upper()
    if normalized == "HUMAN":
        return "Human"
    if normalized == "SUSPICIOUS":
        return "Review Required"
    if normalized in {"SYNTHETIC", "AI-GENERATED", "AI"}:
        return "High Risk"
    return "Unknown"


def _certificate_status(classification: Optional[str], risk_level: Optional[str] = None) -> str:
    normalized = str(classification or "UNKNOWN").upper()
    risk = str(risk_level or "LOW").upper()

    if normalized == "HUMAN" and risk == "LOW":
        return "VALID"

    if normalized == "SUSPICIOUS" or risk == "MEDIUM":
        return "REVIEW_REQUIRED"

    return "HIGH_RISK"



def _review_outcome(status: Optional[str]) -> str:
    normalized = str(status or "PENDING").upper()
    if normalized == "NOT_APPLICABLE":
        return "Personal session — no review required"
    if normalized == "APPROVED":
        return "Accepted by teacher"
    if normalized == "FLAGGED":
        return "Flagged for academic review"
    if normalized == "NEEDS_DISCUSSION":
        return "Discussion requested"
    return "Awaiting teacher review"


def _ledger_display_status(
    *,
    ledger_status: Optional[str],
    classification: Optional[str],
    risk_level: Optional[str],
    revoked_at: Any,
) -> str:
    if revoked_at is not None:
        return "REVOKED"

    normalized = str(ledger_status or "").upper()
    if normalized in {"VALID_LEGACY", "LEGACY_UNSIGNED"}:
        return "LEGACY_UNSIGNED"
    if normalized == "REVOKED":
        return "REVOKED"
    if normalized == "INVALID_SIGNATURE":
        return "INVALID_SIGNATURE"
    if normalized == "VALID":
        return "VALID"
    if normalized in {"REVIEW_REQUIRED", "HIGH_RISK"}:
        return "REVIEW_REQUIRED"

    inferred = _certificate_status(classification, risk_level)
    return "VALID" if inferred == "VALID" else "REVIEW_REQUIRED"


async def _fetch_certificate_record(
    db: AsyncSession,
    cert_id: str,
) -> Optional[Dict[str, Any]]:
    cert_id = _validate_certificate_id(cert_id)

    row = await fetch_certificate_record_row(
        db,
        certificate_id=cert_id,
    )

    if row is None:
        return None

    ledger_status = _ledger_display_status(
        ledger_status=row["verification_status"],
        classification=row["classification_result"],
        risk_level=row["risk_level"],
        revoked_at=row["revoked_at"],
    )

    return {
        "session_id": row["session_id"],
        "user_id": row["user_id"],
        "teacher_id": row["teacher_id"],
        "course_id": row["course_id"],
        "title": row["title"] or "Untitled Document",
        "student_name": f"{row['first_name']} {row['last_name'] or ''}".strip(),
        "student_id": row["student_id"] or "",
        "university_name": row["university_name"] or "",
        "department": row["department"] or "",
        "course_name": row["course_name"],
        "course_code": row["course_code"],
        "word_count": int(row["word_count"] or 0),
        "wpm": round(float(row["wpm"] or 0), 1),
        "total_keystrokes": int(row["total_keystrokes"] or 0),
        "deletions": int(row["deletions"] or 0),
        "pauses": int(row["pauses"] or 0),
        "avg_iki": round(float(row["avg_iki"] or 0), 1),
        "duration_seconds": round(float(row["duration_seconds"] or 0), 1),
        "classification": row["classification_result"] or "UNKNOWN",
        "classification_label": _classification_label(row["classification_result"]),
        "confidence": round(float(row["ml_confidence_score"] or 0), 2),
        "risk_level": row["risk_level"] or "LOW",
        "review_status": row["review_status"] or "PENDING",
        "certificate_id": row["certificate_id"],
        "document_hash": row["document_hash"],
        "evidence_hash": row["certificate_evidence_hash"] or row["session_evidence_hash"],
        "model_version": row["model_version"],
        "model_score": round(float(row["model_score"] or 0), 4),
        "decision_source": row["decision_source"],
        "model_available": bool(row["model_available"]),
        "degraded_analysis": bool(row["degraded_analysis"]),
        "wpm_raw": row["wpm"],
        "avg_iki_raw": row["avg_iki"],
        "duration_seconds_raw": row["duration_seconds"],
        "confidence_raw": row["ml_confidence_score"],
        "model_score_raw": row["model_score"],
        "created_at": _format_datetime(row["created_at"]),
        "generated_at": _format_datetime(row["ledger_generated_at"] or row["created_at"]),
        "ledger_generated_at_raw": row["ledger_generated_at"],
        "ledger_id": row["ledger_id"],
        "ledger_status": ledger_status,
        "verification_notes": row["verification_notes"] or "",
        "signed_payload_hash": row["signed_payload_hash"],
        "signature": row["signature"],
        "signature_algorithm": row["signature_algorithm"] or "UNSIGNED_LEGACY",
        "signing_key_id": row["signing_key_id"],
        "signed_at": _format_datetime(row["signed_at"]),
        "signed_at_raw": row["signed_at"],
        "verification_status": row["verification_status"],
        "revoked_at": _format_datetime(row["revoked_at"]) if row["revoked_at"] else None,
        "revoked_at_raw": row["revoked_at"],
        "revocation_reason": row["revocation_reason"],
        "status": ledger_status,
    }


def _authorize_certificate_audit(record: Dict[str, Any], user: User) -> None:
    role = str(user.role).upper()
    user_id = str(user.id)

    if role == "STUDENT":
        if str(record.get("user_id")) == user_id:
            return

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied for this certificate.",
        )

    if role == "TEACHER":
        if record.get("teacher_id") and str(record.get("teacher_id")) == user_id:
            return

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied for this certificate.",
        )

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied for this certificate.",
    )


def _frontend_verify_url(cert_id: str) -> str:
    """
    URL encoded inside the certificate QR code.

    This intentionally points to the React verification page, not the raw API
    endpoint, so scanning the QR opens the public TypeTrace verification UI with
    the certificate ID already loaded.
    """
    base_url = str(settings.FRONTEND_URL or "http://localhost:5173").rstrip("/")
    return f"{base_url}/verify/{quote(str(cert_id).strip(), safe='')}"



def _certificate_audit_timeline(record: Dict[str, Any], signature_result: Any) -> list[Dict[str, Any]]:
    """
    Public-safe audit timeline for certificate verification.

    This deliberately exposes only high-level ledger events. It does not expose
    essay text, raw keystroke events, IP addresses, user agents, or private
    teacher notes.
    """
    timeline: list[Dict[str, Any]] = []

    timeline.append(
        {
            "label": "Writing session recorded",
            "status": "complete",
            "timestamp": record.get("created_at"),
            "description": "A TypeTrace writing session was submitted and converted into a canonical evidence record.",
        }
    )

    if record.get("document_hash"):
        timeline.append(
            {
                "label": "Document hash sealed",
                "status": "complete",
                "timestamp": record.get("created_at"),
                "description": "A SHA-256 document integrity hash was attached to the certificate record.",
            }
        )

    if record.get("signed_payload_hash"):
        timeline.append(
            {
                "label": "Certificate ledger signed",
                "status": "complete" if signature_result.valid else "warning",
                "timestamp": record.get("signed_at"),
                "description": f"Signed with {record.get('signature_algorithm') or 'the configured signing algorithm'} using key {record.get('signing_key_id') or 'unknown'}.",
            }
        )
    else:
        timeline.append(
            {
                "label": "Legacy unsigned certificate",
                "status": "legacy",
                "timestamp": record.get("generated_at"),
                "description": "This certificate was generated before signed ledger enforcement was enabled.",
            }
        )

    verification_tone = (
        "complete"
        if signature_result.status == "VALID"
        else "legacy"
        if signature_result.status == "VALID_LEGACY"
        else "warning"
    )
    timeline.append(
        {
            "label": "Public verification checked",
            "status": verification_tone,
            "timestamp": _format_datetime(datetime.now(timezone.utc)),
            "description": signature_result.reason,
        }
    )

    review_status_normalized = str(record.get("review_status") or "PENDING").upper()
    if review_status_normalized not in {"PENDING", "NOT_APPLICABLE"}:
        timeline.append(
            {
                "label": "Teacher review outcome recorded",
                "status": "complete",
                "timestamp": record.get("generated_at"),
                "description": f"Review outcome: {review_status_normalized.replace('_', ' ')}.",
            }
        )

    if record.get("revoked_at"):
        timeline.append(
            {
                "label": "Certificate revoked",
                "status": "warning",
                "timestamp": record.get("revoked_at"),
                "description": record.get("revocation_reason") or "This certificate was revoked without exposing private evidence.",
            }
        )

    return timeline

def _public_certificate_payload(record: Dict[str, Any], request: Optional[Request]) -> Dict[str, Any]:
    del request
    verify_url = _frontend_verify_url(record["certificate_id"])
    signature_result = verify_certificate_record(record)

    identity = safe_public_certificate_identity(
        student_name=record["student_name"],
        student_id=record["student_id"],
        show_name=settings.PUBLIC_CERTIFICATE_SHOW_STUDENT_NAME,
        show_student_id=settings.PUBLIC_CERTIFICATE_SHOW_STUDENT_ID,
    )

    public_state = resolve_public_certificate_state(
        record_found=True,
        ledger_status=record.get("ledger_status"),
        revoked=record.get("revoked_at") is not None,
        signature_valid=bool(signature_result.valid),
        signature_status=signature_result.status,
        signature_algorithm=record.get("signature_algorithm"),
    )

    return {
        "record_found": public_state.record_found,
        "ledger_verified": public_state.ledger_verified,
        "certificate_active": public_state.certificate_active,
        # Compatibility only. New clients must use status and certificate_active.
        "valid": public_state.compatibility_valid,
        "status": public_state.status,
        "certificate_id": record["certificate_id"],
        "reason": None,
        "verify_url": verify_url,
        "title": record["title"],
        "student_name": identity["student_name"],
        "student_id": identity["student_id"],
        "university_name": record["university_name"],
        "course_name": record["course_name"],
        "course_code": record["course_code"],
        "word_count": record["word_count"],
        "wpm": record["wpm"],
        "duration_seconds": record["duration_seconds"],
        "classification": record["classification"],
        "classification_label": record["classification_label"],
        "confidence": record["confidence"],
        "human_evidence_score": record["confidence"],
        "risk_level": record["risk_level"],
        "review_status": record["review_status"],
        "review_outcome": _review_outcome(record.get("review_status")),
        "document_hash": record["document_hash"],
        "evidence_hash": record.get("evidence_hash"),
        "created_at": record["created_at"],
        "generated_at": record["generated_at"],
        "ledger_status": record["ledger_status"],
        "signature_algorithm": record.get("signature_algorithm"),
        "signing_key_id": record.get("signing_key_id"),
        "signed_at": record.get("signed_at"),
        "signed_payload_hash": record.get("signed_payload_hash"),
        "signature_status": signature_result.status,
        "signature_valid": signature_result.signature_valid,
        "payload_hash_matches": signature_result.payload_hash_matches,
        "ledger_reason": signature_result.reason,
        "revoked_at": record.get("revoked_at"),
        "revocation_reason": record.get("revocation_reason"),
        "decision_source": record.get("decision_source"),
        "model_available": bool(record.get("model_available")),
        "degraded_analysis": bool(record.get("degraded_analysis")),
        "audit_timeline": _certificate_audit_timeline(record, signature_result),
        "public_exposure": {
            "essay_text_exposed": False,
            "raw_keystrokes_exposed": False,
            "student_private_notes_exposed": False,
        },
        "privacy_notice": (
            "Public verification does not expose essay text or raw keystroke evidence."
        ),
    }

    
def _pdf_public_record(record: Dict[str, Any]) -> Dict[str, Any]:
    identity = safe_public_certificate_identity(
        student_name=record["student_name"],
        student_id=record["student_id"],
        show_name=settings.PUBLIC_CERTIFICATE_SHOW_STUDENT_NAME,
        show_student_id=settings.PUBLIC_CERTIFICATE_PDF_SHOW_STUDENT_ID,
    )

    safe_record = dict(record)
    safe_record["student_name"] = identity["student_name"]
    safe_record["student_id"] = identity["student_id"]

    return safe_record


async def _safe_bump_unread_cache(recipient_id: str) -> None:
    try:
        await bump_unread_cache(recipient_id=recipient_id)
    except Exception:
        logger.exception(
            "Notification cache update failed after committed certificate operation",
            extra={"recipient_id": recipient_id},
        )


@router.get(
    "/verify/{cert_id}",
    name="verify_certificate_public",
    response_model=PublicCertificateResponse,
)
@limiter.limit(per_minute(settings.MAX_PUBLIC_VERIFY_PER_MINUTE))
async def verify_certificate_public(
    request: Request,
    response: Response,
    cert_id: str,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    response.headers.update({"Cache-Control": "no-store", "Pragma": "no-cache"})
    record = await _fetch_certificate_record(db, cert_id)

    if record is None:
        return {
            "record_found": False,
            "ledger_verified": False,
            "certificate_active": False,
            "valid": False,
            "status": "NOT_FOUND",
            "certificate_id": cert_id.strip(),
            "reason": "Certificate ID was not found in the TypeTrace ledger.",
        }

    return _public_certificate_payload(record, request)


@router.get("/certificates", response_model=CertificateListResponse)
async def list_my_certificates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    certificate_ids = await list_user_certificate_ids(
        db,
        user_id=str(current_user.id),
    )

    certificates: list[Dict[str, Any]] = []
    for certificate_id in certificate_ids:
        record = await _fetch_certificate_record(db, certificate_id)
        if record is None:
            logger.error(
                "Session references missing certificate ledger record",
                extra={"certificate_id": certificate_id},
            )
            continue
        public = _public_certificate_payload(record, request=None)
        certificates.append(
            {
                "session_id": int(record["session_id"]),
                "title": record["title"],
                "wpm": record["wpm"],
                "duration_seconds": record["duration_seconds"],
                "classification": record["classification"],
                "confidence": record["confidence"],
                "created_at": record["created_at"],
                "certificate_id": record["certificate_id"],
                "document_hash": record["document_hash"],
                "risk_level": record["risk_level"],
                "review_status": record["review_status"],
                "review_outcome": _review_outcome(record["review_status"]),
                "course_name": record["course_name"],
                "course_code": record["course_code"],
                "verify_url": f"/verify/{record['certificate_id']}",
                "status": public["status"],
                "certificate_active": public["certificate_active"],
                "degraded_analysis": bool(record.get("degraded_analysis")),
                "decision_source": record.get("decision_source"),
            }
        )

    return {"status": "success", "certificates": certificates}


@router.get("/certificates/{cert_id}", response_model=PublicCertificateResponse)
async def get_certificate_audit(
    request: Request,
    cert_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    record = await _fetch_certificate_record(db, cert_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certificate not found.",
        )

    _authorize_certificate_audit(record, current_user)
    payload = _public_certificate_payload(record, request)
    payload.update(
        {
            "session_id": record["session_id"],
            "total_keystrokes": record["total_keystrokes"],
            "deletions": record["deletions"],
            "pauses": record["pauses"],
            "avg_iki": record["avg_iki"],
            "department": record["department"],
            "verification_notes": record["verification_notes"],
        }
    )
    return payload


@router.post(
    "/certificates/{cert_id}/revoke",
    response_model=CertificateRevocationResponse,
)
async def revoke_certificate(
    cert_id: str,
    payload: CertificateRevocationRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    cert_id = _validate_certificate_id(cert_id)
    reason = " ".join(payload.reason.split())

    locked = await lock_certificate_for_revocation(
        db,
        certificate_id=cert_id,
    )

    if locked is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certificate not found.",
        )
    if not locked["teacher_id"] or str(locked["teacher_id"]) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owning course teacher may revoke this certificate.",
        )

    already_revoked = (
        locked["revoked_at"] is not None
        or str(locked.get("verification_status") or "").upper() == "REVOKED"
    )
    if not already_revoked:
        await db.execute(
            text(
                """
                UPDATE certificates
                SET verification_status = 'REVOKED',
                    revoked_at = NOW(),
                    revocation_reason = :reason
                WHERE certificate_id = :cert_id
                """
            ),
            {"cert_id": cert_id, "reason": reason},
        )
        await db.execute(
            text(
                """
                INSERT INTO audit_logs (
                    actor_user_id, target_user_id, event_type, entity_type, entity_id,
                    request_id, ip_address, user_agent, metadata
                ) VALUES (
                    :actor_user_id, :target_user_id, 'CERTIFICATE_REVOKED',
                    'certificate', :entity_id, :request_id, :ip_address, :user_agent,
                    CAST(:metadata AS JSONB)
                )
                """
            ),
            {
                "actor_user_id": str(current_user.id),
                "target_user_id": str(locked["user_id"]),
                "entity_id": cert_id,
                "request_id": request.headers.get("x-request-id"),
                "ip_address": request.client.host if request.client else None,
                "user_agent": request.headers.get("user-agent"),
                "metadata": json.dumps(
                    {
                        "reason": reason,
                        "session_id": int(locked["session_id"]),
                    }
                ),
            },
        )
        await db.execute(
            text(
                """
                INSERT INTO notifications (
                    id, recipient_id, actor_id, event_type, entity_type, entity_id,
                    title, body, action_url, is_read, created_at
                ) VALUES (
                    :id, :recipient_id, :actor_id, 'CERTIFICATE_REVOKED',
                    'certificate', :entity_id, 'Certificate Revoked', :body,
                    :action_url, false, NOW()
                )
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "recipient_id": str(locked["user_id"]),
                "actor_id": str(current_user.id),
                "entity_id": cert_id,
                "body": f"Your certificate for '{locked['title']}' has been revoked by your instructor.",
                "action_url": f"/verify/{cert_id}",
            },
        )

    # Reload inside the same transaction. A failed reload prevents commit, so a
    # committed revocation is never followed by a misleading server error.
    record = await _fetch_certificate_record(db, cert_id)
    if record is None:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Certificate could not be reloaded; no revocation was committed.",
        )

    if already_revoked:
        await db.rollback()
    else:
        await db.commit()
        background_tasks.add_task(
            _safe_bump_unread_cache,
            str(locked["user_id"]),
        )
    return {
        "status": "success",
        "message": (
            "Certificate was already revoked."
            if already_revoked
            else "Certificate revoked."
        ),
        "already_revoked": already_revoked,
        "certificate": _public_certificate_payload(record, request),
    }


@router.get(
    "/sessions/{session_id}/certificate-data",
    response_model=PublicCertificateResponse,
)
async def get_certificate_data_by_session(
    request: Request,
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    certificate_id = await fetch_owned_session_certificate_id(
        db,
        session_id=session_id,
        user_id=str(current_user.id),
    )

    if not certificate_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No certificate exists for this session.",
        )

    record = await _fetch_certificate_record(db, certificate_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certificate record not found.",
        )

    result = _public_certificate_payload(record, request)
    result.update(
        {
            "session_id": record["session_id"],
            "total_keystrokes": record["total_keystrokes"],
            "deletions": record["deletions"],
            "pauses": record["pauses"],
            "avg_iki": record["avg_iki"],
        }
    )
    return result


def _find_existing_asset(candidates: tuple[Path, ...]) -> Optional[Path]:
    for path in candidates:
        try:
            if path.exists() and path.is_file():
                return path
        except OSError:
            continue
    return None


def _draw_wrapped_text(
    pdf: canvas.Canvas,
    text_value: str,
    x: float,
    y: float,
    max_width: float,
    *,
    font_name: str = "Helvetica",
    font_size: float = 9,
    line_height: float = 12,
    color: str = PDF_INK,
) -> float:
    """Draw text wrapped by actual PDF string width rather than raw character count."""
    value = " ".join(str(text_value or "").split())
    if not value:
        return y

    pdf.setFont(font_name, font_size)
    pdf.setFillColor(pdf_colors.HexColor(color))

    words = value.split(" ")
    lines: list[str] = []
    current = ""

    for word in words:
        candidate = f"{current} {word}".strip()
        if pdf.stringWidth(candidate, font_name, font_size) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word

    if current:
        lines.append(current)

    for line in lines:
        pdf.drawString(x, y, line)
        y -= line_height

    return y


def _draw_pill(
    pdf: canvas.Canvas,
    x: float,
    y: float,
    width: float,
    height: float,
    label: str,
    *,
    fill: str,
    text_color: str = "#FFFFFF",
) -> None:
    pdf.setFillColor(pdf_colors.HexColor(fill))
    pdf.setStrokeColor(pdf_colors.HexColor(fill))
    pdf.roundRect(x, y, width, height, height / 2, fill=True, stroke=False)
    pdf.setFillColor(pdf_colors.HexColor(text_color))
    pdf.setFont("Helvetica-Bold", 8.5)
    pdf.drawCentredString(x + width / 2, y + height / 2 - 3, label.upper())


def _draw_key_value(
    pdf: canvas.Canvas,
    x: float,
    y: float,
    label: str,
    value: Any,
    *,
    label_width: float = 92,
    value_width: float = 275,
    line_height: float = 13,
) -> float:
    pdf.setFont("Helvetica-Bold", 8.2)
    pdf.setFillColor(pdf_colors.HexColor(PDF_MUTED))
    pdf.drawString(x, y, label.upper())

    pdf.setFont("Helvetica", 9.4)
    pdf.setFillColor(pdf_colors.HexColor(PDF_INK))

    text = str(value if value not in [None, ""] else "Not provided")
    before_y = y
    after_y = _draw_wrapped_text(
        pdf,
        text,
        x + label_width,
        y,
        value_width,
        font_name="Helvetica",
        font_size=9.4,
        line_height=line_height,
        color=PDF_INK,
    )
    return min(before_y - 17, after_y - 4)


def _draw_metric_card(
    pdf: canvas.Canvas,
    x: float,
    y: float,
    width: float,
    height: float,
    label: str,
    value: str,
) -> None:
    pdf.setFillColor(pdf_colors.white)
    pdf.setStrokeColor(pdf_colors.HexColor(PDF_LINE))
    pdf.roundRect(x, y, width, height, 8, fill=True, stroke=True)

    pdf.setFont("Helvetica-Bold", 7.5)
    pdf.setFillColor(pdf_colors.HexColor(PDF_MUTED))
    pdf.drawString(x + 10, y + height - 16, label.upper())

    pdf.setFont("Helvetica-Bold", 15)
    pdf.setFillColor(pdf_colors.HexColor(PDF_INK))
    pdf.drawString(x + 10, y + 13, value)


def _make_logo_card(logo_path: Path, size: int) -> Image.Image:
    """Create the rounded white centre card used inside the QR image."""
    card_size = int(size * 0.28)
    card = Image.new("RGBA", (card_size, card_size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(card)
    radius = int(card_size * 0.22)
    draw.rounded_rectangle(
        (0, 0, card_size - 1, card_size - 1),
        radius=radius,
        fill=(255, 255, 255, 255),
        outline=(11, 79, 156, 255),
        width=max(2, int(card_size * 0.025)),
    )

    with Image.open(logo_path) as logo:
        logo = logo.convert("RGBA")
        logo.thumbnail((int(card_size * 0.72), int(card_size * 0.72)), Image.LANCZOS)
        lx = (card_size - logo.width) // 2
        ly = (card_size - logo.height) // 2
        card.alpha_composite(logo, (lx, ly))

    return card


def _build_branded_qr_image(verify_url: str) -> io.BytesIO:
    """
    Build a blue QR code with the TypeTrace QR logo in the centre.

    The QR uses high error correction because the centre logo intentionally
    covers part of the QR matrix. Keep the centre card below ~30% of the QR size.
    """
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=12,
        border=2,
    )
    qr.add_data(verify_url)
    qr.make(fit=True)

    qr_img = qr.make_image(fill_color=PDF_BLUE, back_color="white").convert("RGBA")
    logo_path = _find_existing_asset(QR_LOGO_CANDIDATES)

    if logo_path:
        card = _make_logo_card(logo_path, qr_img.size[0])
        position = ((qr_img.width - card.width) // 2, (qr_img.height - card.height) // 2)
        qr_img.alpha_composite(card, position)

    output = io.BytesIO()
    qr_img.save(output, format="PNG")
    output.seek(0)
    return output


def _draw_brand_logo(pdf: canvas.Canvas, x: float, y: float, max_width: float = 128, max_height: float = 38) -> None:
    logo_path = _find_existing_asset(BRAND_LOGO_CANDIDATES)

    if logo_path:
        try:
            pdf.drawImage(
                ImageReader(str(logo_path)),
                x,
                y,
                width=max_width,
                height=max_height,
                preserveAspectRatio=True,
                mask="auto",
                anchor="w",
            )
            return
        except Exception as exc:
            logger.warning(
                "Certificate logo could not be rendered; using text fallback: %s",
                exc,
            )

    # Fallback wordmark if the backend container does not include frontend assets.
    pdf.setFont("Helvetica-Bold", 18)
    pdf.setFillColor(pdf_colors.HexColor(PDF_BLUE))
    pdf.drawString(x, y + 9, "TypeTrace")


def _status_color(status: str) -> str:
    normalized = str(status or "").upper()
    if normalized in {"VALID", "VALID_LEGACY"}:
        return PDF_SUCCESS
    if normalized == "REVIEW_REQUIRED":
        return PDF_WARNING
    return PDF_DANGER


def _format_duration_pdf(seconds: Any) -> str:
    try:
        total = int(float(seconds or 0))
    except (TypeError, ValueError):
        return "Unknown"

    hours, remainder = divmod(total, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours}h {minutes}m {secs}s"
    if minutes:
        return f"{minutes}m {secs}s"
    return f"{secs}s"


def _build_certificate_pdf(record: Dict[str, Any], verify_url: str) -> bytes:
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)

    width, height = A4
    margin = 0.72 * inch
    content_width = width - (margin * 2)

    pdf.setTitle(f"TypeTrace Certificate {record['certificate_id']}")
    pdf.setAuthor("TypeTrace")
    pdf.setSubject("Behavioral authorship evidence certificate")

    # White page with premium border and subtle blue accent.
    pdf.setFillColor(pdf_colors.white)
    pdf.rect(0, 0, width, height, fill=True, stroke=False)

    pdf.setStrokeColor(pdf_colors.HexColor(PDF_BLUE))
    pdf.setLineWidth(1.25)
    pdf.roundRect(margin * 0.62, margin * 0.62, width - margin * 1.24, height - margin * 1.24, 12, fill=False, stroke=True)

    pdf.setStrokeColor(pdf_colors.HexColor(PDF_LINE))
    pdf.setLineWidth(0.6)
    pdf.roundRect(margin * 0.78, margin * 0.78, width - margin * 1.56, height - margin * 1.56, 9, fill=False, stroke=True)

    # Header.
    top_y = height - margin - 8
    _draw_brand_logo(pdf, margin, top_y - 32, max_width=124, max_height=34)

    pdf.setFont("Helvetica-Bold", 7.8)
    pdf.setFillColor(pdf_colors.HexColor(PDF_MUTED))
    pdf.drawRightString(width - margin, top_y - 2, "CERTIFICATE ID")
    pdf.setFont("Courier-Bold", 9.4)
    pdf.setFillColor(pdf_colors.HexColor(PDF_INK))
    pdf.drawRightString(width - margin, top_y - 17, record["certificate_id"])

    pdf.setStrokeColor(pdf_colors.HexColor(PDF_LINE))
    pdf.line(margin, top_y - 47, width - margin, top_y - 47)

    # Hero title.
    y = top_y - 90
    pdf.setFont("Helvetica-Bold", 24)
    pdf.setFillColor(pdf_colors.HexColor(PDF_INK))
    pdf.drawCentredString(width / 2, y, "Writing Evidence Certificate")

    y -= 20
    pdf.setFont("Helvetica", 9.8)
    pdf.setFillColor(pdf_colors.HexColor(PDF_MUTED))
    pdf.drawCentredString(width / 2, y, "Behavioral keystroke evidence for academic authorship review")

    y -= 32
    status = str(record.get("public_status") or record.get("status") or "UNKNOWN")
    status_fill = _status_color(status)
    _draw_pill(pdf, width / 2 - 63, y, 126, 24, status.replace("_", " "), fill=status_fill)

    # Main details panel.
    y -= 42
    panel_x = margin
    panel_h = 184
    panel_y = y - panel_h
    pdf.setFillColor(pdf_colors.HexColor(PDF_PANEL))
    pdf.setStrokeColor(pdf_colors.HexColor(PDF_LINE))
    pdf.roundRect(panel_x, panel_y, content_width, panel_h, 11, fill=True, stroke=True)

    pdf.setFont("Helvetica-Bold", 11)
    pdf.setFillColor(pdf_colors.HexColor(PDF_BLUE_DARK))
    pdf.drawString(panel_x + 18, y - 18, "Recorded session details")

    left_x = panel_x + 18
    right_x = panel_x + content_width / 2 + 12
    row_y_left = y - 44
    row_y_right = y - 44
    label_w = 86
    value_w = content_width / 2 - 118

    left_details = [
        ("Student", record.get("student_name") or "Not provided"),
        ("Student ID", record.get("student_id") or "Not provided"),
        ("Institution", record.get("university_name") or "Not provided"),
        ("Department", record.get("department") or "Not provided"),
        ("Course", record.get("course_name") or "Personal session"),
        ("Course code", record.get("course_code") or "Not provided"),
    ]

    right_details = [
        ("Document", record.get("title") or "Untitled Document"),
        ("Generated", record.get("generated_at") or "Unknown"),
        ("Classification", record.get("classification_label") or "Unknown"),
        ("Risk level", record.get("risk_level") or "Unknown"),
        ("Review", record.get("review_status") or "PENDING"),
        ("Ledger", record.get("ledger_status") or "SESSION_RECORDED"),
        ("Signature", record.get("signature_algorithm") or "UNSIGNED_LEGACY"),
    ]

    for label, value in left_details:
        row_y_left = _draw_key_value(
            pdf, left_x, row_y_left, label, value,
            label_width=label_w,
            value_width=value_w,
        )

    for label, value in right_details:
        row_y_right = _draw_key_value(
            pdf, right_x, row_y_right, label, value,
            label_width=label_w,
            value_width=value_w,
        )

    # Evidence metrics.
    metrics_y = panel_y - 66
    card_gap = 10
    card_w = (content_width - card_gap * 3) / 4
    metric_values = [
        ("Human Evidence Score", f"{record.get('confidence', 0)}%"),
        ("Words", str(record.get("word_count") or 0)),
        ("WPM", str(record.get("wpm") or 0)),
        ("Duration", _format_duration_pdf(record.get("duration_seconds"))),
    ]
    for i, (label, value) in enumerate(metric_values):
        _draw_metric_card(
            pdf,
            margin + i * (card_w + card_gap),
            metrics_y,
            card_w,
            50,
            label,
            value,
        )

    # Behavioral evidence row.
    evidence_y = metrics_y - 44
    pdf.setFont("Helvetica-Bold", 10.5)
    pdf.setFillColor(pdf_colors.HexColor(PDF_BLUE_DARK))
    pdf.drawString(margin, evidence_y, "Behavioral evidence summary")

    evidence_y -= 18
    pdf.setFont("Helvetica", 8.8)
    pdf.setFillColor(pdf_colors.HexColor(PDF_INK))
    evidence_items = [
        f"Keystrokes: {record.get('total_keystrokes') or 0}",
        f"Deletions: {record.get('deletions') or 0}",
        f"Pauses: {record.get('pauses') or 0}",
        f"Average IKI: {record.get('avg_iki') or 0} ms",
    ]
    pdf.drawString(margin, evidence_y, "   •   ".join(evidence_items))

    # Integrity hash block.
    hash_y = evidence_y - 32
    pdf.setFillColor(pdf_colors.HexColor(PDF_SOFT_BLUE))
    pdf.setStrokeColor(pdf_colors.HexColor("#C9E2FF"))
    pdf.roundRect(margin, hash_y - 52, content_width, 66, 8, fill=True, stroke=True)

    pdf.setFont("Helvetica-Bold", 8.5)
    pdf.setFillColor(pdf_colors.HexColor(PDF_BLUE_DARK))
    pdf.drawString(margin + 14, hash_y - 6, "DOCUMENT INTEGRITY HASH (SHA-256)")
    _draw_wrapped_text(
        pdf,
        str(record.get("document_hash") or "Not available"),
        margin + 14,
        hash_y - 24,
        content_width - 28,
        font_name="Courier",
        font_size=7.8,
        line_height=9.5,
        color=PDF_INK,
    )

    # QR verification block.
    qr_size = 102
    qr_x = width - margin - qr_size
    qr_y = margin + 30
    qr_stream = _build_branded_qr_image(verify_url)
    pdf.drawImage(ImageReader(qr_stream), qr_x, qr_y, width=qr_size, height=qr_size, mask="auto")
    pdf.linkURL(verify_url, (qr_x, qr_y, qr_x + qr_size, qr_y + qr_size), relative=0)

    pdf.setFont("Helvetica-Bold", 8.8)
    pdf.setFillColor(pdf_colors.HexColor(PDF_BLUE_DARK))
    pdf.drawCentredString(qr_x + qr_size / 2, qr_y - 12, "SCAN TO VERIFY")

    verify_text_x = margin
    verify_text_y = qr_y + qr_size - 4
    pdf.setFont("Helvetica-Bold", 10.5)
    pdf.setFillColor(pdf_colors.HexColor(PDF_INK))
    pdf.drawString(verify_text_x, verify_text_y, "Public verification")

    verify_text_y -= 17
    _draw_wrapped_text(
        pdf,
        "Scan the QR code or open the verification link to view the live TypeTrace certificate record. The public page does not expose essay text or raw keystroke data.",
        verify_text_x,
        verify_text_y,
        qr_x - margin - 22,
        font_name="Helvetica",
        font_size=8.8,
        line_height=11,
        color=PDF_MUTED,
    )

    verify_text_y -= 42
    pdf.setFont("Helvetica-Bold", 8.2)
    pdf.setFillColor(pdf_colors.HexColor(PDF_MUTED))
    pdf.drawString(verify_text_x, verify_text_y, "VERIFICATION URL")
    _draw_wrapped_text(
        pdf,
        verify_url,
        verify_text_x,
        verify_text_y - 14,
        qr_x - margin - 22,
        font_name="Helvetica",
        font_size=7.8,
        line_height=9,
        color=PDF_BLUE_DARK,
    )
    pdf.linkURL(verify_url, (verify_text_x, verify_text_y - 34, qr_x - 22, verify_text_y + 3), relative=0)

    # Footer/legal note.
    footer_y = margin * 0.84
    pdf.setStrokeColor(pdf_colors.HexColor(PDF_LINE))
    pdf.line(margin, footer_y + 20, width - margin, footer_y + 20)

    pdf.setFont("Helvetica", 7.4)
    pdf.setFillColor(pdf_colors.HexColor(PDF_MUTED))
    pdf.drawString(margin, footer_y, "TypeTrace - Behavioral Authorship Verification")
    pdf.drawRightString(width - margin, footer_y, datetime.now(timezone.utc).strftime("Generated %Y-%m-%d %H:%M UTC"))

    disclaimer = (
        "This certificate provides probabilistic behavioural evidence for academic review. "
        "It should support, not replace, institutional judgement and academic integrity procedures."
    )
    pdf.setFont("Helvetica", 6.8)
    pdf.drawCentredString(width / 2, margin * 0.66, disclaimer)

    pdf.showPage()
    pdf.save()

    buffer.seek(0)
    return buffer.read()


@router.get(
    "/certificates/{cert_id}/pdf",
    response_class=StreamingResponse,
)
async def download_certificate_pdf(
    request: Request,
    cert_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public PDF download endpoint.

    Public by design: anyone with a certificate ID can verify or download the signed record.
    """
    record = await _fetch_certificate_record(db, cert_id)

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certificate not found.",
        )

    public = _public_certificate_payload(record, request)
    pdf_record = _pdf_public_record(record)
    pdf_record["public_status"] = public["status"]
    pdf_record["certificate_active"] = public["certificate_active"]
    verify_url = _frontend_verify_url(record["certificate_id"])
    pdf_bytes = _build_certificate_pdf(pdf_record, verify_url)

    filename = f"TypeTrace_Certificate_{record['certificate_id']}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )
