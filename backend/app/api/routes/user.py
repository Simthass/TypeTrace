# backend/app/api/routes/user.py

import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, text

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.models.user import User


router = APIRouter()

sync_engine = create_engine(settings.sync_database_url, pool_pre_ping=True)


class ProfileUpdateRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=50)
    last_name: Optional[str] = Field(default="", max_length=50)
    university_name: Optional[str] = Field(default=None, max_length=200)
    department: Optional[str] = Field(default=None, max_length=200)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


class DeleteAccountRequest(BaseModel):
    password: str = Field(min_length=1)
    confirmation: str = Field(min_length=1)


def _format_datetime(value: Any) -> str:
    if value is None:
        return "Unknown"

    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    return str(value)


def _parse_json(value: Any) -> Any:
    if value is None:
        return None

    if isinstance(value, (dict, list)):
        return value

    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value

    return value


def _serialize_user(user: User) -> Dict[str, Any]:
    return {
        "id": str(user.id),
        "first_name": user.first_name,
        "last_name": user.last_name or "",
        "email": user.email,
        "role": user.role,
        "student_id": user.student_id,
        "university_name": user.university_name,
        "department": user.department,
        "is_verified": bool(user.is_verified),
        "created_at": _format_datetime(user.created_at),
        "updated_at": _format_datetime(user.updated_at),
    }


def _fetch_account_summary(user_id: str) -> Dict[str, Any]:
    with sync_engine.connect() as conn:
        session_row = conn.execute(
            text(
                """
                SELECT
                    COUNT(*) AS total_sessions,
                    COUNT(CASE WHEN certificate_id IS NOT NULL THEN 1 END) AS certificate_count,
                    COALESCE(SUM(duration_seconds), 0) AS total_seconds,
                    COALESCE(SUM(total_keystrokes), 0) AS total_keystrokes,
                    COALESCE(ROUND(AVG(wpm)::numeric, 1), 0) AS avg_wpm,
                    COALESCE(ROUND(AVG(ml_confidence_score)::numeric, 1), 0) AS avg_confidence,
                    MAX(created_at) AS last_session_at
                FROM typing_sessions
                WHERE user_id = :user_id
                """
            ),
            {"user_id": user_id},
        ).mappings().fetchone()

        student_course_row = conn.execute(
            text(
                """
                SELECT COUNT(*) AS enrolled_courses
                FROM course_students
                WHERE student_id = :user_id
                """
            ),
            {"user_id": user_id},
        ).mappings().fetchone()

        teacher_course_row = conn.execute(
            text(
                """
                SELECT COUNT(*) AS owned_courses
                FROM courses
                WHERE teacher_id = :user_id
                """
            ),
            {"user_id": user_id},
        ).mappings().fetchone()

    session_dict = dict(session_row or {})

    return {
        "total_sessions": int(session_dict.get("total_sessions") or 0),
        "certificate_count": int(session_dict.get("certificate_count") or 0),
        "total_seconds": float(session_dict.get("total_seconds") or 0),
        "total_keystrokes": int(session_dict.get("total_keystrokes") or 0),
        "avg_wpm": float(session_dict.get("avg_wpm") or 0),
        "avg_confidence": float(session_dict.get("avg_confidence") or 0),
        "last_session_at": _format_datetime(session_dict.get("last_session_at")),
        "enrolled_courses": int(student_course_row["enrolled_courses"] or 0) if student_course_row else 0,
        "owned_courses": int(teacher_course_row["owned_courses"] or 0) if teacher_course_row else 0,
    }


@router.get("/user/profile")
async def get_user_profile(
    current_user: User = Depends(get_current_user),
):
    """
    Returns the authenticated account profile and account summary.
    """
    return {
        "status": "success",
        "profile": _serialize_user(current_user),
        "summary": _fetch_account_summary(str(current_user.id)),
    }


@router.patch("/user/profile")
async def update_user_profile(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Updates editable profile fields.

    Email, role, Student ID, and verification status are intentionally not editable here.
    """
    first_name = payload.first_name.strip()
    last_name = (payload.last_name or "").strip()
    university_name = (payload.university_name or "").strip() or None
    department = (payload.department or "").strip() or None

    with sync_engine.begin() as conn:
        row = conn.execute(
            text(
                """
                UPDATE users
                SET
                    first_name = :first_name,
                    last_name = :last_name,
                    university_name = :university_name,
                    department = :department,
                    updated_at = NOW()
                WHERE id = :user_id
                RETURNING
                    id,
                    first_name,
                    last_name,
                    email,
                    role,
                    student_id,
                    university_name,
                    department,
                    is_verified,
                    created_at,
                    updated_at
                """
            ),
            {
                "user_id": str(current_user.id),
                "first_name": first_name,
                "last_name": last_name,
                "university_name": university_name,
                "department": department,
            },
        ).mappings().fetchone()

    return {
        "status": "success",
        "message": "Profile updated successfully.",
        "profile": {
            "id": str(row["id"]),
            "first_name": row["first_name"],
            "last_name": row["last_name"] or "",
            "email": row["email"],
            "role": row["role"],
            "student_id": row["student_id"],
            "university_name": row["university_name"],
            "department": row["department"],
            "is_verified": bool(row["is_verified"]),
            "created_at": _format_datetime(row["created_at"]),
            "updated_at": _format_datetime(row["updated_at"]),
        },
    }


@router.post("/user/change-password")
async def change_password(
    payload: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Changes the authenticated user's password after verifying current password.
    """
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    if verify_password(payload.new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password.",
        )

    hashed_password = get_password_hash(payload.new_password)

    with sync_engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE users
                SET hashed_password = :hashed_password,
                    updated_at = NOW()
                WHERE id = :user_id
                """
            ),
            {
                "hashed_password": hashed_password,
                "user_id": str(current_user.id),
            },
        )

    return {
        "status": "success",
        "message": "Password changed successfully.",
    }


@router.get("/user/privacy")
async def get_privacy_summary(
    current_user: User = Depends(get_current_user),
):
    """
    Returns privacy/data ownership summary for the authenticated user.
    """
    user_id = str(current_user.id)

    with sync_engine.connect() as conn:
        sessions = conn.execute(
            text(
                """
                SELECT
                    COUNT(*) AS total_sessions,
                    COUNT(CASE WHEN raw_keystroke_data IS NOT NULL THEN 1 END) AS sessions_with_keystrokes,
                    COUNT(CASE WHEN text_content IS NOT NULL AND text_content != '' THEN 1 END) AS sessions_with_text,
                    COUNT(CASE WHEN certificate_id IS NOT NULL THEN 1 END) AS certificates,
                    COALESCE(SUM(total_keystrokes), 0) AS total_keystrokes
                FROM typing_sessions
                WHERE user_id = :user_id
                """
            ),
            {"user_id": user_id},
        ).mappings().fetchone()

        enrollments = conn.execute(
            text(
                """
                SELECT COUNT(*) AS total_enrollments
                FROM course_students
                WHERE student_id = :user_id
                """
            ),
            {"user_id": user_id},
        ).mappings().fetchone()

        owned_courses = conn.execute(
            text(
                """
                SELECT COUNT(*) AS total_owned_courses
                FROM courses
                WHERE teacher_id = :user_id
                """
            ),
            {"user_id": user_id},
        ).mappings().fetchone()

    session_dict = dict(sessions or {})

    return {
        "status": "success",
        "privacy": {
            "data_categories": [
                "Account profile",
                "Authentication metadata",
                "Course enrollments",
                "Writing session text",
                "Keystroke timing evidence",
                "ML classification results",
                "Certificates and document hashes",
                "Teacher review notes",
            ],
            "total_sessions": int(session_dict.get("total_sessions") or 0),
            "sessions_with_keystrokes": int(session_dict.get("sessions_with_keystrokes") or 0),
            "sessions_with_text": int(session_dict.get("sessions_with_text") or 0),
            "certificates": int(session_dict.get("certificates") or 0),
            "total_keystrokes": int(session_dict.get("total_keystrokes") or 0),
            "course_enrollments": int(enrollments["total_enrollments"] or 0) if enrollments else 0,
            "owned_courses": int(owned_courses["total_owned_courses"] or 0) if owned_courses else 0,
            "export_available": True,
            "delete_mode": "anonymize_account_preserve_academic_records",
        },
    }


@router.get("/user/data-export")
async def export_user_data(
    current_user: User = Depends(get_current_user),
):
    """
    Exports all personal TypeTrace data for the authenticated user.

    This returns JSON so the frontend can download it as a file.
    """
    user_id = str(current_user.id)

    with sync_engine.connect() as conn:
        session_rows = conn.execute(
            text(
                """
                SELECT
                    ts.id,
                    ts.title,
                    ts.text_content,
                    ts.wpm,
                    ts.total_keystrokes,
                    ts.deletions,
                    ts.pauses,
                    ts.avg_iki,
                    ts.duration_seconds,
                    ts.classification_result,
                    ts.ml_confidence_score,
                    ts.raw_keystroke_data,
                    ts.certificate_id,
                    ts.document_hash,
                    ts.review_status,
                    ts.review_notes,
                    ts.risk_level,
                    ts.created_at,
                    ts.updated_at,
                    c.course_name,
                    c.course_code
                FROM typing_sessions ts
                LEFT JOIN courses c ON c.id = ts.course_id
                WHERE ts.user_id = :user_id
                ORDER BY ts.created_at DESC
                """
            ),
            {"user_id": user_id},
        ).mappings().fetchall()

        certificate_rows = conn.execute(
            text(
                """
                SELECT
                    cert.id,
                    cert.certificate_id,
                    cert.document_hash,
                    cert.generated_at,
                    cert.verification_notes,
                    ts.title AS session_title
                FROM certificates cert
                JOIN typing_sessions ts ON ts.id = cert.session_id
                WHERE ts.user_id = :user_id
                ORDER BY cert.generated_at DESC
                """
            ),
            {"user_id": user_id},
        ).mappings().fetchall()

        enrolled_course_rows = conn.execute(
            text(
                """
                SELECT
                    c.id,
                    c.course_name,
                    c.course_code,
                    c.invite_code,
                    cs.joined_at,
                    u.first_name AS teacher_first_name,
                    u.last_name AS teacher_last_name,
                    u.email AS teacher_email
                FROM course_students cs
                JOIN courses c ON c.id = cs.course_id
                JOIN users u ON u.id = c.teacher_id
                WHERE cs.student_id = :user_id
                ORDER BY cs.joined_at DESC
                """
            ),
            {"user_id": user_id},
        ).mappings().fetchall()

        owned_course_rows = conn.execute(
            text(
                """
                SELECT
                    c.id,
                    c.course_name,
                    c.course_code,
                    c.invite_code,
                    c.created_at,
                    COUNT(DISTINCT cs.student_id) AS student_count,
                    COUNT(ts.id) AS submission_count
                FROM courses c
                LEFT JOIN course_students cs ON cs.course_id = c.id
                LEFT JOIN typing_sessions ts ON ts.course_id = c.id
                WHERE c.teacher_id = :user_id
                GROUP BY c.id, c.course_name, c.course_code, c.invite_code, c.created_at
                ORDER BY c.created_at DESC
                """
            ),
            {"user_id": user_id},
        ).mappings().fetchall()

    exported_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    return {
        "status": "success",
        "exported_at": exported_at,
        "profile": _serialize_user(current_user),
        "summary": _fetch_account_summary(user_id),
        "sessions": [
            {
                "id": row["id"],
                "title": row["title"],
                "text_content": row["text_content"],
                "wpm": float(row["wpm"] or 0),
                "total_keystrokes": int(row["total_keystrokes"] or 0),
                "deletions": int(row["deletions"] or 0),
                "pauses": int(row["pauses"] or 0),
                "avg_iki": float(row["avg_iki"] or 0),
                "duration_seconds": float(row["duration_seconds"] or 0),
                "classification_result": row["classification_result"],
                "ml_confidence_score": float(row["ml_confidence_score"] or 0),
                "raw_keystroke_data": _parse_json(row["raw_keystroke_data"]),
                "certificate_id": row["certificate_id"],
                "document_hash": row["document_hash"],
                "review_status": row["review_status"],
                "review_notes": row["review_notes"],
                "risk_level": row["risk_level"],
                "course_name": row["course_name"],
                "course_code": row["course_code"],
                "created_at": _format_datetime(row["created_at"]),
                "updated_at": _format_datetime(row["updated_at"]),
            }
            for row in session_rows
        ],
        "certificates": [
            {
                "id": row["id"],
                "certificate_id": row["certificate_id"],
                "document_hash": row["document_hash"],
                "generated_at": _format_datetime(row["generated_at"]),
                "verification_notes": row["verification_notes"],
                "session_title": row["session_title"],
            }
            for row in certificate_rows
        ],
        "enrolled_courses": [
            {
                "id": row["id"],
                "course_name": row["course_name"],
                "course_code": row["course_code"],
                "invite_code": row["invite_code"],
                "joined_at": _format_datetime(row["joined_at"]),
                "teacher_name": f"{row['teacher_first_name']} {row['teacher_last_name'] or ''}".strip(),
                "teacher_email": row["teacher_email"],
            }
            for row in enrolled_course_rows
        ],
        "owned_courses": [
            {
                "id": row["id"],
                "course_name": row["course_name"],
                "course_code": row["course_code"],
                "invite_code": row["invite_code"],
                "created_at": _format_datetime(row["created_at"]),
                "student_count": int(row["student_count"] or 0),
                "submission_count": int(row["submission_count"] or 0),
            }
            for row in owned_course_rows
        ],
    }


@router.delete("/user/account")
async def delete_user_account(
    payload: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Privacy-safe account removal.

    Academic evidence/certificates are preserved for integrity, but the account identity is anonymized.
    """
    if payload.confirmation.strip().upper() != "DELETE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Type DELETE to confirm account removal.",
        )

    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is incorrect.",
        )

    user_id = str(current_user.id)
    anonymized_email = f"deleted-{user_id}@typetrace.local"
    anonymized_student_id = f"deleted-{user_id[:12]}" if current_user.student_id else None
    disabled_password = get_password_hash(f"disabled-{user_id}-{datetime.now(timezone.utc).timestamp()}")

    with sync_engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE users
                SET
                    first_name = 'Deleted',
                    last_name = 'User',
                    email = :email,
                    student_id = :student_id,
                    university_name = NULL,
                    department = NULL,
                    hashed_password = :hashed_password,
                    is_verified = FALSE,
                    updated_at = NOW()
                WHERE id = :user_id
                """
            ),
            {
                "email": anonymized_email,
                "student_id": anonymized_student_id,
                "hashed_password": disabled_password,
                "user_id": user_id,
            },
        )

    return {
        "status": "success",
        "message": "Account identity has been anonymized. Academic records remain available for institutional integrity.",
    }