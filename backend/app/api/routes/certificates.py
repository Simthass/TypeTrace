# backend/app/api/routes/certificates.py

import io
import re
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from reportlab.lib import colors as pdf_colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from sqlalchemy import create_engine, text

from app.api.deps import get_current_user
from app.core.config import settings
from app.models.user import User


router = APIRouter()

sync_engine = create_engine(settings.sync_database_url, pool_pre_ping=True)


CERT_ID_PATTERN = re.compile(r"^[A-Za-z0-9\-_]{8,80}$")


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
        return "Human Writing Pattern"

    if normalized == "SUSPICIOUS":
        return "Suspicious Writing Pattern"

    if normalized in {"SYNTHETIC", "AI-GENERATED", "AI"}:
        return "Synthetic Writing Pattern"

    return "Unknown"


def _certificate_status(classification: Optional[str]) -> str:
    normalized = str(classification or "UNKNOWN").upper()

    if normalized == "HUMAN":
        return "VALID"

    if normalized == "SUSPICIOUS":
        return "REVIEW_REQUIRED"

    return "HIGH_RISK"


def _fetch_certificate_record(cert_id: str) -> Optional[Dict[str, Any]]:
    cert_id = _validate_certificate_id(cert_id)

    with sync_engine.connect() as conn:
        row = conn.execute(
            text(
                """
                SELECT
                    ts.id AS session_id,
                    ts.title AS title,
                    ts.text_content AS text_content,
                    ts.wpm AS wpm,
                    ts.total_keystrokes AS total_keystrokes,
                    ts.deletions AS deletions,
                    ts.pauses AS pauses,
                    ts.avg_iki AS avg_iki,
                    ts.duration_seconds AS duration_seconds,
                    ts.classification_result AS classification_result,
                    ts.ml_confidence_score AS ml_confidence_score,
                    ts.certificate_id AS certificate_id,
                    ts.document_hash AS document_hash,
                    ts.risk_level AS risk_level,
                    ts.review_status AS review_status,
                    ts.created_at AS created_at,

                    u.id AS user_id,
                    u.first_name AS first_name,
                    u.last_name AS last_name,
                    u.student_id AS student_id,
                    u.university_name AS university_name,
                    u.department AS department,

                    c.course_name AS course_name,
                    c.course_code AS course_code,
                    c.teacher_id AS teacher_id,

                    cert.id AS ledger_id,
                    cert.generated_at AS ledger_generated_at,
                    cert.verification_notes AS verification_notes
                FROM typing_sessions ts
                JOIN users u ON u.id = ts.user_id
                LEFT JOIN courses c ON c.id = ts.course_id
                LEFT JOIN certificates cert ON cert.certificate_id = ts.certificate_id
                WHERE ts.certificate_id = :cert_id
                LIMIT 1
                """
            ),
            {"cert_id": cert_id},
        ).mappings().fetchone()

    if row is None:
        return None

    word_count = len((row["text_content"] or "").split())

    return {
        "session_id": row["session_id"],
        "user_id": row["user_id"],
        "teacher_id": row["teacher_id"],
        "title": row["title"] or "Untitled Document",
        "student_name": f"{row['first_name']} {row['last_name'] or ''}".strip(),
        "student_id": row["student_id"] or "",
        "university_name": row["university_name"] or "",
        "department": row["department"] or "",
        "course_name": row["course_name"],
        "course_code": row["course_code"],
        "word_count": word_count,
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
        "created_at": _format_datetime(row["created_at"]),
        "generated_at": _format_datetime(row["ledger_generated_at"] or row["created_at"]),
        "ledger_id": row["ledger_id"],
        "ledger_status": "LEDGER_RECORDED" if row["ledger_id"] else "SESSION_RECORDED",
        "verification_notes": row["verification_notes"] or "",
        "status": _certificate_status(row["classification_result"]),
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


def _public_certificate_payload(record: Dict[str, Any], request: Request) -> Dict[str, Any]:
    verify_url = str(request.url_for("verify_certificate_public", cert_id=record["certificate_id"]))

    return {
        "valid": True,
        "status": record["status"],
        "certificate_id": record["certificate_id"],
        "verify_url": verify_url,
        "title": record["title"],
        "student_name": record["student_name"],
        "student_id": record["student_id"],
        "university_name": record["university_name"],
        "course_name": record["course_name"],
        "course_code": record["course_code"],
        "word_count": record["word_count"],
        "wpm": record["wpm"],
        "duration_seconds": record["duration_seconds"],
        "classification": record["classification"],
        "classification_label": record["classification_label"],
        "confidence": record["confidence"],
        "risk_level": record["risk_level"],
        "review_status": record["review_status"],
        "document_hash": record["document_hash"],
        "created_at": record["created_at"],
        "generated_at": record["generated_at"],
        "ledger_status": record["ledger_status"],
    }


@router.get("/verify/{cert_id}", name="verify_certificate_public")
async def verify_certificate_public(
    request: Request,
    cert_id: str,
):
    """
    Public endpoint used by instructors/universities to verify a certificate.

    No authentication required.
    """
    record = _fetch_certificate_record(cert_id)

    if record is None:
        return {
            "valid": False,
            "status": "INVALID",
            "certificate_id": cert_id,
            "reason": "Certificate ID was not found in the TypeTrace ledger.",
        }

    return _public_certificate_payload(record, request)


@router.get("/certificates")
async def list_my_certificates(
    current_user: User = Depends(get_current_user),
):
    """
    Authenticated student certificate list.
    """
    with sync_engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT
                    ts.id AS session_id,
                    ts.title AS title,
                    ts.wpm AS wpm,
                    ts.duration_seconds AS duration_seconds,
                    ts.classification_result AS classification,
                    ts.ml_confidence_score AS confidence,
                    ts.created_at AS created_at,
                    ts.certificate_id AS certificate_id,
                    ts.document_hash AS document_hash,
                    ts.risk_level AS risk_level,
                    ts.review_status AS review_status,
                    c.course_name AS course_name,
                    c.course_code AS course_code
                FROM typing_sessions ts
                LEFT JOIN courses c ON c.id = ts.course_id
                WHERE ts.user_id = :user_id
                  AND ts.certificate_id IS NOT NULL
                ORDER BY ts.created_at DESC
                """
            ),
            {"user_id": str(current_user.id)},
        ).mappings().fetchall()

    certificates = []

    for row in rows:
        certificates.append(
            {
                "session_id": row["session_id"],
                "title": row["title"] or "Untitled Document",
                "wpm": round(float(row["wpm"] or 0), 1),
                "duration_seconds": round(float(row["duration_seconds"] or 0), 1),
                "classification": row["classification"] or "UNKNOWN",
                "confidence": round(float(row["confidence"] or 0), 2),
                "created_at": _format_datetime(row["created_at"]),
                "certificate_id": row["certificate_id"],
                "document_hash": row["document_hash"],
                "risk_level": row["risk_level"] or "LOW",
                "review_status": row["review_status"] or "PENDING",
                "course_name": row["course_name"],
                "course_code": row["course_code"],
                "verify_url": f"/verify/{row['certificate_id']}",
            }
        )

    return {
        "status": "success",
        "certificates": certificates,
    }


@router.get("/certificates/{cert_id}")
async def get_certificate_audit(
    request: Request,
    cert_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Authenticated certificate audit endpoint.

    Students can access their own certificates.
    Teachers can access certificates only for sessions in their own courses.
    """
    record = _fetch_certificate_record(cert_id)

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


@router.get("/sessions/{session_id}/certificate-data")
async def get_certificate_data_by_session(
    request: Request,
    session_id: int,
    current_user: User = Depends(get_current_user),
):
    """
    Authenticated endpoint for frontend certificate export by session ID.
    """
    with sync_engine.connect() as conn:
        row = conn.execute(
            text(
                """
                SELECT certificate_id
                FROM typing_sessions
                WHERE id = :session_id
                  AND user_id = :user_id
                LIMIT 1
                """
            ),
            {
                "session_id": session_id,
                "user_id": str(current_user.id),
            },
        ).mappings().fetchone()

    if row is None or not row["certificate_id"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No certificate exists for this session.",
        )

    record = _fetch_certificate_record(row["certificate_id"])

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certificate record not found.",
        )

    payload = _public_certificate_payload(record, request)
    payload.update(
        {
            "session_id": record["session_id"],
            "total_keystrokes": record["total_keystrokes"],
            "deletions": record["deletions"],
            "pauses": record["pauses"],
            "avg_iki": record["avg_iki"],
        }
    )

    return payload


def _draw_wrapped_text(
    pdf: canvas.Canvas,
    text_value: str,
    x: float,
    y: float,
    max_chars: int = 90,
    line_height: float = 11,
) -> float:
    value = text_value or ""
    lines = []

    while len(value) > max_chars:
        split_at = value.rfind(" ", 0, max_chars)
        if split_at <= 0:
            split_at = max_chars
        lines.append(value[:split_at])
        value = value[split_at:].strip()

    if value:
        lines.append(value)

    for line in lines:
        pdf.drawString(x, y, line)
        y -= line_height

    return y


def _build_certificate_pdf(record: Dict[str, Any], verify_url: str) -> bytes:
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)

    width, height = letter
    margin = 54
    y = height - 60

    pdf.setTitle(f"TypeTrace Certificate {record['certificate_id']}")

    pdf.setFillColor(pdf_colors.HexColor("#111827"))
    pdf.rect(0, height - 90, width, 90, fill=True, stroke=False)

    pdf.setFillColor(pdf_colors.white)
    pdf.setFont("Helvetica-Bold", 22)
    pdf.drawString(margin, height - 48, "TypeTrace Certificate of Authenticity")

    pdf.setFont("Helvetica", 10)
    pdf.drawString(margin, height - 68, "Behavioral authorship verification for academic writing")

    y -= 70

    status = record["status"]
    status_color = "#047857" if status == "VALID" else "#B45309" if status == "REVIEW_REQUIRED" else "#B91C1C"

    pdf.setFillColor(pdf_colors.HexColor(status_color))
    pdf.roundRect(margin, y - 24, 170, 30, 6, fill=True, stroke=False)
    pdf.setFillColor(pdf_colors.white)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(margin + 14, y - 12, f"STATUS: {status}")

    pdf.setFillColor(pdf_colors.HexColor("#111827"))
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawRightString(width - margin, y - 4, record["certificate_id"])

    y -= 60

    pdf.setStrokeColor(pdf_colors.HexColor("#E5E7EB"))
    pdf.line(margin, y, width - margin, y)
    y -= 28

    pdf.setFillColor(pdf_colors.HexColor("#111827"))
    pdf.setFont("Helvetica-Bold", 15)
    pdf.drawString(margin, y, "Verified Writing Session")
    y -= 24

    details = [
        ("Student", record["student_name"]),
        ("Student ID", record["student_id"] or "Not provided"),
        ("Institution", record["university_name"] or "Not provided"),
        ("Course", record["course_name"] or "Personal session"),
        ("Document Title", record["title"]),
        ("Generated", record["generated_at"]),
        ("Classification", record["classification_label"]),
        ("Confidence", f"{record['confidence']}%"),
        ("Risk Level", record["risk_level"]),
        ("Word Count", str(record["word_count"])),
        ("WPM", str(record["wpm"])),
        ("Duration", f"{record['duration_seconds']} seconds"),
        ("Keystrokes", str(record["total_keystrokes"])),
        ("Deletions", str(record["deletions"])),
        ("Pauses", str(record["pauses"])),
    ]

    pdf.setFont("Helvetica", 10)

    for label, value in details:
        pdf.setFillColor(pdf_colors.HexColor("#6B7280"))
        pdf.drawString(margin, y, f"{label}:")
        pdf.setFillColor(pdf_colors.HexColor("#111827"))
        pdf.drawString(margin + 110, y, str(value))
        y -= 18

    y -= 8

    pdf.setFillColor(pdf_colors.HexColor("#111827"))
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(margin, y, "Document Integrity Hash")
    y -= 18

    pdf.setFont("Courier", 8)
    pdf.setFillColor(pdf_colors.HexColor("#111827"))
    y = _draw_wrapped_text(
        pdf=pdf,
        text_value=record["document_hash"],
        x=margin,
        y=y,
        max_chars=88,
        line_height=10,
    )

    y -= 14

    pdf.setFont("Helvetica-Bold", 12)
    pdf.setFillColor(pdf_colors.HexColor("#111827"))
    pdf.drawString(margin, y, "Public Verification URL")
    y -= 18

    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(pdf_colors.HexColor("#374151"))
    y = _draw_wrapped_text(
        pdf=pdf,
        text_value=verify_url,
        x=margin,
        y=y,
        max_chars=88,
        line_height=10,
    )

    y -= 28

    pdf.setFillColor(pdf_colors.HexColor("#6B7280"))
    pdf.setFont("Helvetica", 8)
    footer_text = (
        "This certificate verifies the writing process using TypeTrace keystroke dynamics, "
        "behavioral biometrics, cryptographic hashing, and ML-assisted authorship analysis. "
        "It should be used alongside institutional academic integrity procedures."
    )
    _draw_wrapped_text(pdf, footer_text, margin, y, max_chars=105, line_height=10)

    pdf.setFillColor(pdf_colors.HexColor("#F4F4F5"))
    pdf.rect(0, 0, width, 38, fill=True, stroke=False)

    pdf.setFillColor(pdf_colors.HexColor("#6B7280"))
    pdf.setFont("Helvetica", 8)
    pdf.drawString(margin, 18, "TypeTrace — Behavioral Authorship Verification")
    pdf.drawRightString(width - margin, 18, datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"))

    pdf.showPage()
    pdf.save()

    buffer.seek(0)
    return buffer.read()


@router.get("/certificates/{cert_id}/pdf")
async def download_certificate_pdf(
    request: Request,
    cert_id: str,
):
    """
    Public PDF download endpoint.

    Public by design: anyone with a certificate ID can verify/download the proof.
    """
    record = _fetch_certificate_record(cert_id)

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certificate not found.",
        )

    verify_url = str(request.url_for("verify_certificate_public", cert_id=record["certificate_id"]))
    pdf_bytes = _build_certificate_pdf(record, verify_url)

    filename = f"TypeTrace_Certificate_{record['certificate_id']}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )