import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.crypto import decrypt_json, decrypt_text
from app.core.privacy import privacy_safe_export_session
from app.core.rate_limit import limiter, per_minute, reauth_rate_limit_key
from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.db.database import get_db
from app.models.user import User
from app.schemas.responses import SensitiveExportRequest, UserDataExportResponse, UserProfileResponse
from app.services.audit_log import create_audit_log


router = APIRouter()


class ProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: str = Field(min_length=1, max_length=50)
    last_name: Optional[str] = Field(default="", max_length=50)
    university_name: Optional[str] = Field(default=None, max_length=200)
    department: Optional[str] = Field(default=None, max_length=200)


class PasswordChangeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        if not any(char.isalpha() for char in value):
            raise ValueError("Password must contain at least one letter.")
        if not any(char.isdigit() for char in value):
            raise ValueError("Password must contain at least one number.")
        return value


class DeleteAccountRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    password: str = Field(min_length=1, max_length=128)
    confirmation: str = Field(min_length=1, max_length=20)


def _format_datetime(value: Any) -> str:
    if value is None:
        return "Unknown"
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return str(value)


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


async def _fetch_account_summary(db: AsyncSession, user_id: str) -> Dict[str, Any]:
    session_row = (
        await db.execute(
            text(
                """
                SELECT COUNT(*) AS total_sessions,
                       COUNT(*) FILTER (WHERE certificate_id IS NOT NULL) AS certificate_count,
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
        )
    ).mappings().first()
    enrollment_count = (
        await db.execute(
            text("SELECT COUNT(*) FROM course_students WHERE student_id = :user_id"),
            {"user_id": user_id},
        )
    ).scalar_one()
    owned_course_count = (
        await db.execute(
            text("SELECT COUNT(*) FROM courses WHERE teacher_id = :user_id"),
            {"user_id": user_id},
        )
    ).scalar_one()
    row = dict(session_row or {})
    return {
        "total_sessions": int(row.get("total_sessions") or 0),
        "certificate_count": int(row.get("certificate_count") or 0),
        "total_seconds": float(row.get("total_seconds") or 0),
        "total_keystrokes": int(row.get("total_keystrokes") or 0),
        "avg_wpm": float(row.get("avg_wpm") or 0),
        "avg_confidence": float(row.get("avg_confidence") or 0),
        "last_session_at": _format_datetime(row.get("last_session_at")),
        "enrolled_courses": int(enrollment_count or 0),
        "owned_courses": int(owned_course_count or 0),
    }


@router.get("/user/profile", response_model=UserProfileResponse)
async def get_user_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return {
        "status": "success",
        "profile": _serialize_user(current_user),
        "summary": await _fetch_account_summary(db, str(current_user.id)),
    }


@router.patch("/user/profile", response_model=UserProfileResponse)
async def update_user_profile(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (
        await db.execute(
            text(
                """
                UPDATE users
                SET first_name = :first_name,
                    last_name = :last_name,
                    university_name = :university_name,
                    department = :department,
                    updated_at = NOW()
                WHERE id = :user_id
                RETURNING id, first_name, last_name, email, role, student_id,
                          university_name, department, is_verified, created_at, updated_at
                """
            ),
            {
                "user_id": str(current_user.id),
                "first_name": payload.first_name.strip(),
                "last_name": (payload.last_name or "").strip(),
                "university_name": (payload.university_name or "").strip() or None,
                "department": (payload.department or "").strip() or None,
            },
        )
    ).mappings().first()
    if row is None:
        await db.rollback()
        raise HTTPException(status_code=404, detail="Account not found.")
    await db.commit()
    return {
        "status": "success",
        "message": "Profile updated successfully.",
        "profile": {
            **dict(row),
            "id": str(row["id"]),
            "last_name": row["last_name"] or "",
            "is_verified": bool(row["is_verified"]),
            "created_at": _format_datetime(row["created_at"]),
            "updated_at": _format_datetime(row["updated_at"]),
        },
    }


@router.post("/user/change-password", response_model=UserProfileResponse)
@limiter.limit(
    per_minute(settings.MAX_REAUTH_ATTEMPTS_PER_MINUTE),
    key_func=reauth_rate_limit_key,
)
async def change_password(
    payload: PasswordChangeRequest,
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    del response
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if verify_password(payload.new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=400,
            detail="New password must be different from the current password.",
        )

    await db.execute(
        text(
            """
            UPDATE users
            SET hashed_password = :hashed_password,
                token_version = token_version + 1,
                updated_at = NOW()
            WHERE id = :user_id
            """
        ),
        {
            "hashed_password": get_password_hash(payload.new_password),
            "user_id": str(current_user.id),
        },
    )
    db.add(
        create_audit_log(
            event_type="PASSWORD_CHANGED",
            entity_type="USER",
            entity_id=str(current_user.id),
            actor_user_id=str(current_user.id),
            target_user_id=str(current_user.id),
            request=request,
        )
    )
    await db.commit()
    return {
        "status": "success",
        "message": "Password changed successfully. Sign in again on all devices.",
    }


@router.get("/user/privacy", response_model=UserProfileResponse)
async def get_privacy_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = str(current_user.id)
    sessions = (
        await db.execute(
            text(
                """
                SELECT COUNT(*) AS total_sessions,
                       COUNT(*) FILTER (WHERE raw_keystroke_data IS NOT NULL) AS sessions_with_keystrokes,
                       COUNT(*) FILTER (WHERE text_content IS NOT NULL AND text_content != '') AS sessions_with_text,
                       COUNT(*) FILTER (WHERE certificate_id IS NOT NULL) AS certificates,
                       COALESCE(SUM(total_keystrokes), 0) AS total_keystrokes
                FROM typing_sessions WHERE user_id = :user_id
                """
            ),
            {"user_id": user_id},
        )
    ).mappings().first()
    enrollments = (
        await db.execute(
            text("SELECT COUNT(*) FROM course_students WHERE student_id = :user_id"),
            {"user_id": user_id},
        )
    ).scalar_one()
    owned_courses = (
        await db.execute(
            text("SELECT COUNT(*) FROM courses WHERE teacher_id = :user_id"),
            {"user_id": user_id},
        )
    ).scalar_one()
    row = dict(sessions or {})
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
            "total_sessions": int(row.get("total_sessions") or 0),
            "sessions_with_keystrokes": int(row.get("sessions_with_keystrokes") or 0),
            "sessions_with_text": int(row.get("sessions_with_text") or 0),
            "certificates": int(row.get("certificates") or 0),
            "total_keystrokes": int(row.get("total_keystrokes") or 0),
            "course_enrollments": int(enrollments or 0),
            "owned_courses": int(owned_courses or 0),
            "export_available": True,
            "sensitive_export_requires_password": True,
            "delete_mode": "anonymize_account_preserve_academic_records",
        },
    }


async def _build_export(
    *,
    db: AsyncSession,
    current_user: User,
    include_sensitive: bool,
) -> Dict[str, Any]:
    user_id = str(current_user.id)
    session_rows = (
        await db.execute(
            text(
                """
                SELECT ts.id, ts.title, ts.text_content, ts.word_count, ts.wpm,
                       ts.total_keystrokes, ts.deletions, ts.pauses, ts.avg_iki,
                       ts.duration_seconds, ts.classification_result,
                       ts.ml_confidence_score, ts.raw_keystroke_data,
                       ts.certificate_id, ts.document_hash, ts.review_status,
                       ts.review_notes, ts.risk_level, ts.decision_source,
                       ts.model_available, ts.degraded_analysis,
                       ts.created_at, ts.updated_at,
                       c.course_name, c.course_code
                FROM typing_sessions ts
                LEFT JOIN courses c ON c.id = ts.course_id
                WHERE ts.user_id = :user_id
                ORDER BY ts.created_at DESC
                """
            ),
            {"user_id": user_id},
        )
    ).mappings().all()
    certificate_rows = (
        await db.execute(
            text(
                """
                SELECT cert.id, cert.certificate_id, cert.document_hash,
                       cert.verification_status, cert.revoked_at, cert.generated_at,
                       ts.title AS session_title
                FROM certificates cert
                JOIN typing_sessions ts ON ts.id = cert.session_id
                WHERE ts.user_id = :user_id
                ORDER BY cert.generated_at DESC
                """
            ),
            {"user_id": user_id},
        )
    ).mappings().all()
    enrolled_rows = (
        await db.execute(
            text(
                """
                SELECT c.id, c.course_name, c.course_code, c.is_archived, cs.joined_at
                FROM course_students cs
                JOIN courses c ON c.id = cs.course_id
                WHERE cs.student_id = :user_id
                ORDER BY cs.joined_at DESC
                """
            ),
            {"user_id": user_id},
        )
    ).mappings().all()
    owned_rows = (
        await db.execute(
            text(
                """
                SELECT c.id, c.course_name, c.course_code, c.is_archived, c.created_at,
                       COUNT(DISTINCT cs.student_id) AS student_count,
                       COUNT(DISTINCT ts.id) AS submission_count
                FROM courses c
                LEFT JOIN course_students cs ON cs.course_id = c.id
                LEFT JOIN typing_sessions ts ON ts.course_id = c.id
                WHERE c.teacher_id = :user_id
                GROUP BY c.id, c.course_name, c.course_code, c.is_archived, c.created_at
                ORDER BY c.created_at DESC
                """
            ),
            {"user_id": user_id},
        )
    ).mappings().all()

    sessions: list[dict[str, Any]] = []
    for source in session_rows:
        row = dict(source)
        # Decrypt inside the protected server process so redacted exports still
        # contain accurate hashes and event summaries. Raw values are included
        # in the response only when password re-authentication succeeded.
        row["text_content"] = decrypt_text(row.get("text_content"))
        row["raw_keystroke_data"] = decrypt_json(row.get("raw_keystroke_data"))
        sessions.append(
            privacy_safe_export_session(row, include_sensitive=include_sensitive)
        )

    return {
        "status": "success",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "privacy": {
            "include_sensitive": include_sensitive,
            "sensitive_fields": ["text_content", "raw_keystroke_data"],
            "third_party_email_addresses_included": False,
            "course_invite_codes_included": False,
        },
        "profile": _serialize_user(current_user),
        "summary": await _fetch_account_summary(db, user_id),
        "sessions": sessions,
        "certificates": [
            {
                "id": row["id"],
                "certificate_id": row["certificate_id"],
                "document_hash": row["document_hash"],
                "verification_status": row["verification_status"],
                "revoked_at": _format_datetime(row["revoked_at"]),
                "generated_at": _format_datetime(row["generated_at"]),
                "session_title": row["session_title"],
            }
            for row in certificate_rows
        ],
        "enrolled_courses": [
            {
                "id": row["id"],
                "course_name": row["course_name"],
                "course_code": row["course_code"],
                "is_archived": bool(row["is_archived"]),
                "joined_at": _format_datetime(row["joined_at"]),
            }
            for row in enrolled_rows
        ],
        "owned_courses": [
            {
                "id": row["id"],
                "course_name": row["course_name"],
                "course_code": row["course_code"],
                "is_archived": bool(row["is_archived"]),
                "created_at": _format_datetime(row["created_at"]),
                "student_count": int(row["student_count"] or 0),
                "submission_count": int(row["submission_count"] or 0),
            }
            for row in owned_rows
        ],
    }


@router.get("/user/data-export", response_model=UserDataExportResponse)
async def export_user_data(
    response: Response,
    include_sensitive: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    response.headers.update({"Cache-Control": "no-store", "Pragma": "no-cache"})
    if include_sensitive:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Sensitive export requires password re-authentication through "
                "POST /api/v1/user/data-export/sensitive."
            ),
        )
    return await _build_export(
        db=db,
        current_user=current_user,
        include_sensitive=False,
    )


@router.post("/user/data-export/sensitive", response_model=UserDataExportResponse)
@limiter.limit(
    per_minute(settings.MAX_REAUTH_ATTEMPTS_PER_MINUTE),
    key_func=reauth_rate_limit_key,
)
async def export_sensitive_user_data(
    payload: SensitiveExportRequest,
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    response.headers.update({"Cache-Control": "no-store", "Pragma": "no-cache"})
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Password re-authentication failed.",
            headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
        )

    export_payload = await _build_export(
        db=db,
        current_user=current_user,
        include_sensitive=True,
    )
    db.add(
        create_audit_log(
            event_type="SENSITIVE_DATA_EXPORTED",
            entity_type="USER",
            entity_id=str(current_user.id),
            actor_user_id=str(current_user.id),
            target_user_id=str(current_user.id),
            request=request,
            metadata={"includes_text": True, "includes_keystrokes": True},
        )
    )
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return export_payload


@router.delete("/user/account", response_model=UserProfileResponse)
@limiter.limit(
    per_minute(settings.MAX_REAUTH_ATTEMPTS_PER_MINUTE),
    key_func=reauth_rate_limit_key,
)
async def delete_user_account(
    payload: DeleteAccountRequest,
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    del response
    if payload.confirmation.strip().upper() != "DELETE":
        raise HTTPException(status_code=400, detail="Type DELETE to confirm account removal.")
    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Password is incorrect.")

    user_id = str(current_user.id)
    now = datetime.now(timezone.utc)
    anonymized_email = f"deleted-{user_id}@typetrace.local"
    anonymized_student_id = f"deleted-{user_id[:12]}" if current_user.student_id else None
    disabled_password = get_password_hash(f"disabled-{user_id}-{now.timestamp()}")

    if str(current_user.role).upper() == "TEACHER":
        await db.execute(
            text(
                """
                UPDATE courses
                SET is_archived = TRUE,
                    invite_enabled = FALSE,
                    archived_at = COALESCE(archived_at, NOW()),
                    invite_code = 'AR-' || LPAD(id::text, 27, '0'),
                    updated_at = NOW()
                WHERE teacher_id = :user_id
                """
            ),
            {"user_id": user_id},
        )
    else:
        # Enrollment membership is not evidence. Submitted sessions keep their
        # course_id and anonymized user relation for the academic audit trail.
        await db.execute(
            text("DELETE FROM course_students WHERE student_id = :user_id"),
            {"user_id": user_id},
        )

    await db.execute(
        text(
            """
            UPDATE users
            SET first_name = 'Deleted', last_name = 'User', email = :email,
                student_id = :student_id, university_name = NULL, department = NULL,
                hashed_password = :hashed_password, is_verified = FALSE,
                token_version = token_version + 1, deleted_at = NOW(), updated_at = NOW()
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
    db.add(
        create_audit_log(
            event_type="ACCOUNT_ANONYMIZED",
            entity_type="USER",
            entity_id=user_id,
            actor_user_id=user_id,
            target_user_id=user_id,
            request=request,
            metadata={
                "role": current_user.role,
                "courses_archived": str(current_user.role).upper() == "TEACHER",
            },
        )
    )
    await db.commit()
    return {
        "status": "success",
        "message": (
            "Account identity was anonymized. Owned courses were archived and "
            "their invite codes were disabled. Academic records remain preserved."
        ),
    }
