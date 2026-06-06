# backend/app/api/routes/teacher.py

import secrets
import string
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

from app.api.deps import require_teacher
from app.core.config import settings
from app.models.user import User


router = APIRouter()

sync_engine = create_engine(settings.sync_database_url, pool_pre_ping=True)


class TeacherCourseCreate(BaseModel):
    course_name: str = Field(min_length=2, max_length=120)
    course_code: str = Field(min_length=2, max_length=40)


class TeacherReviewUpdate(BaseModel):
    status: str
    notes: Optional[str] = None


def _format_datetime(value: Any) -> str:
    if value is None:
        return "Unknown"

    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    return str(value)


def _classification_bucket(value: Optional[str]) -> str:
    normalized = str(value or "UNKNOWN").upper()

    if normalized == "HUMAN":
        return "HUMAN"

    if normalized == "SUSPICIOUS":
        return "SUSPICIOUS"

    if normalized in {"SYNTHETIC", "AI-GENERATED", "AI"}:
        return "SYNTHETIC"

    return "UNKNOWN"


def _risk_level(classification: Optional[str], risk_level: Optional[str]) -> str:
    if risk_level:
        return str(risk_level).upper()

    bucket = _classification_bucket(classification)

    if bucket == "SYNTHETIC":
        return "HIGH"

    if bucket == "SUSPICIOUS":
        return "MEDIUM"

    return "LOW"


def _generate_invite_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "TT-" + "".join(secrets.choice(alphabet) for _ in range(8))


def _submission_payload(row: Dict[str, Any]) -> Dict[str, Any]:
    classification = row.get("classification") or "UNKNOWN"

    return {
        "id": row.get("id"),
        "title": row.get("title") or "Untitled Document",
        "student_name": f"{row.get('first_name') or ''} {row.get('last_name') or ''}".strip(),
        "student_email": row.get("email") or "",
        "student_id": row.get("student_id") or "",
        "course_id": row.get("course_id"),
        "course_name": row.get("course_name"),
        "course_code": row.get("course_code"),
        "classification": classification,
        "classification_bucket": _classification_bucket(classification),
        "confidence": round(float(row.get("confidence") or 0), 2),
        "risk_level": _risk_level(classification, row.get("risk_level")),
        "review_status": row.get("review_status") or "PENDING",
        "review_notes": row.get("review_notes") or "",
        "wpm": round(float(row.get("wpm") or 0), 1),
        "duration_seconds": round(float(row.get("duration_seconds") or 0), 1),
        "total_keystrokes": int(row.get("total_keystrokes") or 0),
        "deletions": int(row.get("deletions") or 0),
        "pauses": int(row.get("pauses") or 0),
        "avg_iki": round(float(row.get("avg_iki") or 0), 1),
        "word_count": int(row.get("word_count") or 0),
        "certificate_id": row.get("certificate_id"),
        "document_hash": row.get("document_hash"),
        "created_at": _format_datetime(row.get("created_at")),
    }


def _course_payload(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row.get("id"),
        "course_name": row.get("course_name"),
        "course_code": row.get("course_code"),
        "invite_code": row.get("invite_code"),
        "created_at": _format_datetime(row.get("created_at")),
        "student_count": int(row.get("student_count") or 0),
        "submission_count": int(row.get("submission_count") or 0),
        "pending_count": int(row.get("pending_count") or 0),
        "approved_count": int(row.get("approved_count") or 0),
        "flagged_count": int(row.get("flagged_count") or 0),
        "avg_confidence": round(float(row.get("avg_confidence") or 0), 1),
        "avg_wpm": round(float(row.get("avg_wpm") or 0), 1),
    }


@router.get("/teacher/dashboard")
async def get_teacher_dashboard(
    current_user: User = Depends(require_teacher),
):
    teacher_id = str(current_user.id)

    with sync_engine.connect() as conn:
        summary = conn.execute(
            text(
                """
                SELECT
                    COUNT(DISTINCT c.id) AS total_courses,
                    COUNT(DISTINCT cs.student_id) AS total_students,
                    COUNT(ts.id) AS total_submissions,
                    COUNT(CASE WHEN COALESCE(ts.review_status, 'PENDING') = 'PENDING' THEN 1 END) AS pending_reviews,
                    COUNT(CASE WHEN ts.review_status = 'APPROVED' THEN 1 END) AS approved_reviews,
                    COUNT(CASE WHEN ts.review_status = 'FLAGGED' THEN 1 END) AS flagged_reviews,
                    COUNT(CASE WHEN ts.classification_result = 'HUMAN' THEN 1 END) AS human_submissions,
                    COUNT(CASE WHEN ts.classification_result = 'SUSPICIOUS' THEN 1 END) AS suspicious_submissions,
                    COUNT(CASE WHEN ts.classification_result IN ('SYNTHETIC', 'AI-GENERATED', 'AI') THEN 1 END) AS synthetic_submissions,
                    COALESCE(ROUND(AVG(ts.ml_confidence_score)::numeric, 1), 0) AS avg_confidence,
                    COALESCE(ROUND(AVG(ts.wpm)::numeric, 1), 0) AS avg_wpm
                FROM courses c
                LEFT JOIN course_students cs ON cs.course_id = c.id
                LEFT JOIN typing_sessions ts ON ts.course_id = c.id
                WHERE c.teacher_id = :teacher_id
                """
            ),
            {"teacher_id": teacher_id},
        ).mappings().fetchone()

        recent_submissions = conn.execute(
            text(
                """
                SELECT
                    ts.id,
                    ts.title,
                    ts.course_id,
                    ts.classification_result AS classification,
                    ts.ml_confidence_score AS confidence,
                    ts.risk_level,
                    ts.review_status,
                    ts.review_notes,
                    ts.wpm,
                    ts.duration_seconds,
                    ts.total_keystrokes,
                    ts.deletions,
                    ts.pauses,
                    ts.avg_iki,
                    ts.certificate_id,
                    ts.document_hash,
                    ts.created_at,
                    c.course_name,
                    c.course_code,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.student_id,
                    CASE
                        WHEN ts.text_content IS NULL THEN 0
                        ELSE array_length(regexp_split_to_array(trim(ts.text_content), '\\s+'), 1)
                    END AS word_count
                FROM typing_sessions ts
                JOIN courses c ON c.id = ts.course_id
                JOIN users u ON u.id = ts.user_id
                WHERE c.teacher_id = :teacher_id
                ORDER BY ts.created_at DESC
                LIMIT 8
                """
            ),
            {"teacher_id": teacher_id},
        ).mappings().fetchall()

        course_rows = conn.execute(
            text(
                """
                SELECT
                    c.id,
                    c.course_name,
                    c.course_code,
                    c.invite_code,
                    c.created_at,
                    COUNT(DISTINCT cs.student_id) AS student_count,
                    COUNT(ts.id) AS submission_count,
                    COUNT(CASE WHEN COALESCE(ts.review_status, 'PENDING') = 'PENDING' THEN 1 END) AS pending_count,
                    COUNT(CASE WHEN ts.review_status = 'APPROVED' THEN 1 END) AS approved_count,
                    COUNT(CASE WHEN ts.review_status = 'FLAGGED' THEN 1 END) AS flagged_count,
                    COALESCE(ROUND(AVG(ts.ml_confidence_score)::numeric, 1), 0) AS avg_confidence,
                    COALESCE(ROUND(AVG(ts.wpm)::numeric, 1), 0) AS avg_wpm
                FROM courses c
                LEFT JOIN course_students cs ON cs.course_id = c.id
                LEFT JOIN typing_sessions ts ON ts.course_id = c.id
                WHERE c.teacher_id = :teacher_id
                GROUP BY c.id, c.course_name, c.course_code, c.invite_code, c.created_at
                ORDER BY c.created_at DESC
                LIMIT 6
                """
            ),
            {"teacher_id": teacher_id},
        ).mappings().fetchall()

    summary_dict = dict(summary or {})

    return {
        "status": "success",
        "teacher": {
            "id": str(current_user.id),
            "first_name": current_user.first_name,
            "last_name": current_user.last_name,
            "email": current_user.email,
            "university_name": current_user.university_name,
            "department": current_user.department,
        },
        "summary": {
            "total_courses": int(summary_dict.get("total_courses") or 0),
            "total_students": int(summary_dict.get("total_students") or 0),
            "total_submissions": int(summary_dict.get("total_submissions") or 0),
            "pending_reviews": int(summary_dict.get("pending_reviews") or 0),
            "approved_reviews": int(summary_dict.get("approved_reviews") or 0),
            "flagged_reviews": int(summary_dict.get("flagged_reviews") or 0),
            "human_submissions": int(summary_dict.get("human_submissions") or 0),
            "suspicious_submissions": int(summary_dict.get("suspicious_submissions") or 0),
            "synthetic_submissions": int(summary_dict.get("synthetic_submissions") or 0),
            "avg_confidence": float(summary_dict.get("avg_confidence") or 0),
            "avg_wpm": float(summary_dict.get("avg_wpm") or 0),
        },
        "recent_submissions": [_submission_payload(dict(row)) for row in recent_submissions],
        "courses": [_course_payload(dict(row)) for row in course_rows],
    }


@router.post("/teacher/courses", status_code=status.HTTP_201_CREATED)
async def create_teacher_course(
    payload: TeacherCourseCreate,
    current_user: User = Depends(require_teacher),
):
    teacher_id = str(current_user.id)
    course_name = payload.course_name.strip()
    course_code = payload.course_code.strip().upper()

    if not course_name or not course_code:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Course name and course code are required.",
        )

    invite_code = _generate_invite_code()

    try:
        with sync_engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    INSERT INTO courses (
                        teacher_id,
                        course_name,
                        course_code,
                        invite_code
                    ) VALUES (
                        :teacher_id,
                        :course_name,
                        :course_code,
                        :invite_code
                    )
                    RETURNING id, course_name, course_code, invite_code, created_at
                    """
                ),
                {
                    "teacher_id": teacher_id,
                    "course_name": course_name,
                    "course_code": course_code,
                    "invite_code": invite_code,
                },
            ).mappings().fetchone()

    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A course with this code already exists under your account.",
        )

    return {
        "status": "success",
        "message": "Course created successfully.",
        "course": {
            "id": row["id"],
            "course_name": row["course_name"],
            "course_code": row["course_code"],
            "invite_code": row["invite_code"],
            "created_at": _format_datetime(row["created_at"]),
            "student_count": 0,
            "submission_count": 0,
            "pending_count": 0,
            "approved_count": 0,
            "flagged_count": 0,
            "avg_confidence": 0,
            "avg_wpm": 0,
        },
    }


@router.get("/teacher/courses")
async def list_teacher_courses(
    current_user: User = Depends(require_teacher),
):
    teacher_id = str(current_user.id)

    with sync_engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT
                    c.id,
                    c.course_name,
                    c.course_code,
                    c.invite_code,
                    c.created_at,
                    COUNT(DISTINCT cs.student_id) AS student_count,
                    COUNT(ts.id) AS submission_count,
                    COUNT(CASE WHEN COALESCE(ts.review_status, 'PENDING') = 'PENDING' THEN 1 END) AS pending_count,
                    COUNT(CASE WHEN ts.review_status = 'APPROVED' THEN 1 END) AS approved_count,
                    COUNT(CASE WHEN ts.review_status = 'FLAGGED' THEN 1 END) AS flagged_count,
                    COALESCE(ROUND(AVG(ts.ml_confidence_score)::numeric, 1), 0) AS avg_confidence,
                    COALESCE(ROUND(AVG(ts.wpm)::numeric, 1), 0) AS avg_wpm
                FROM courses c
                LEFT JOIN course_students cs ON cs.course_id = c.id
                LEFT JOIN typing_sessions ts ON ts.course_id = c.id
                WHERE c.teacher_id = :teacher_id
                GROUP BY c.id, c.course_name, c.course_code, c.invite_code, c.created_at
                ORDER BY c.created_at DESC
                """
            ),
            {"teacher_id": teacher_id},
        ).mappings().fetchall()

    return {
        "status": "success",
        "courses": [_course_payload(dict(row)) for row in rows],
    }


@router.get("/teacher/courses/{course_id}")
async def get_teacher_course_detail(
    course_id: int,
    current_user: User = Depends(require_teacher),
):
    teacher_id = str(current_user.id)

    with sync_engine.connect() as conn:
        course_row = conn.execute(
            text(
                """
                SELECT
                    c.id,
                    c.course_name,
                    c.course_code,
                    c.invite_code,
                    c.created_at,
                    COUNT(DISTINCT cs.student_id) AS student_count,
                    COUNT(ts.id) AS submission_count,
                    COUNT(CASE WHEN COALESCE(ts.review_status, 'PENDING') = 'PENDING' THEN 1 END) AS pending_count,
                    COUNT(CASE WHEN ts.review_status = 'APPROVED' THEN 1 END) AS approved_count,
                    COUNT(CASE WHEN ts.review_status = 'FLAGGED' THEN 1 END) AS flagged_count,
                    COALESCE(ROUND(AVG(ts.ml_confidence_score)::numeric, 1), 0) AS avg_confidence,
                    COALESCE(ROUND(AVG(ts.wpm)::numeric, 1), 0) AS avg_wpm
                FROM courses c
                LEFT JOIN course_students cs ON cs.course_id = c.id
                LEFT JOIN typing_sessions ts ON ts.course_id = c.id
                WHERE c.id = :course_id
                  AND c.teacher_id = :teacher_id
                GROUP BY c.id, c.course_name, c.course_code, c.invite_code, c.created_at
                LIMIT 1
                """
            ),
            {
                "course_id": course_id,
                "teacher_id": teacher_id,
            },
        ).mappings().fetchone()

        if course_row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found.",
            )

        student_rows = conn.execute(
            text(
                """
                SELECT
                    u.id,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.student_id,
                    cs.joined_at,
                    COUNT(ts.id) AS submission_count,
                    COALESCE(ROUND(AVG(ts.ml_confidence_score)::numeric, 1), 0) AS avg_confidence,
                    COALESCE(ROUND(AVG(ts.wpm)::numeric, 1), 0) AS avg_wpm,
                    MAX(ts.created_at) AS last_submission_at
                FROM course_students cs
                JOIN users u ON u.id = cs.student_id
                LEFT JOIN typing_sessions ts ON ts.user_id = u.id AND ts.course_id = cs.course_id
                WHERE cs.course_id = :course_id
                GROUP BY u.id, u.first_name, u.last_name, u.email, u.student_id, cs.joined_at
                ORDER BY cs.joined_at DESC
                """
            ),
            {"course_id": course_id},
        ).mappings().fetchall()

        submission_rows = conn.execute(
            text(
                """
                SELECT
                    ts.id,
                    ts.title,
                    ts.course_id,
                    ts.classification_result AS classification,
                    ts.ml_confidence_score AS confidence,
                    ts.risk_level,
                    ts.review_status,
                    ts.review_notes,
                    ts.wpm,
                    ts.duration_seconds,
                    ts.total_keystrokes,
                    ts.deletions,
                    ts.pauses,
                    ts.avg_iki,
                    ts.certificate_id,
                    ts.document_hash,
                    ts.created_at,
                    c.course_name,
                    c.course_code,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.student_id,
                    CASE
                        WHEN ts.text_content IS NULL THEN 0
                        ELSE array_length(regexp_split_to_array(trim(ts.text_content), '\\s+'), 1)
                    END AS word_count
                FROM typing_sessions ts
                JOIN users u ON u.id = ts.user_id
                JOIN courses c ON c.id = ts.course_id
                WHERE ts.course_id = :course_id
                  AND c.teacher_id = :teacher_id
                ORDER BY ts.created_at DESC
                LIMIT 20
                """
            ),
            {
                "course_id": course_id,
                "teacher_id": teacher_id,
            },
        ).mappings().fetchall()

    return {
        "status": "success",
        "course": _course_payload(dict(course_row)),
        "students": [
            {
                "id": row["id"],
                "student_name": f"{row['first_name']} {row['last_name'] or ''}".strip(),
                "email": row["email"],
                "student_id": row["student_id"],
                "joined_at": _format_datetime(row["joined_at"]),
                "submission_count": int(row["submission_count"] or 0),
                "avg_confidence": float(row["avg_confidence"] or 0),
                "avg_wpm": float(row["avg_wpm"] or 0),
                "last_submission_at": _format_datetime(row["last_submission_at"]),
            }
            for row in student_rows
        ],
        "submissions": [_submission_payload(dict(row)) for row in submission_rows],
    }


@router.get("/teacher/students")
async def list_teacher_students(
    current_user: User = Depends(require_teacher),
):
    teacher_id = str(current_user.id)

    with sync_engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT
                    u.id,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.student_id,
                    u.university_name,
                    c.id AS course_id,
                    c.course_name,
                    c.course_code,
                    cs.joined_at,
                    COUNT(ts.id) AS submission_count,
                    COALESCE(ROUND(AVG(ts.ml_confidence_score)::numeric, 1), 0) AS avg_confidence,
                    COALESCE(ROUND(AVG(ts.wpm)::numeric, 1), 0) AS avg_wpm,
                    COUNT(CASE WHEN COALESCE(ts.review_status, 'PENDING') = 'PENDING' THEN 1 END) AS pending_count,
                    COUNT(CASE WHEN ts.review_status = 'FLAGGED' THEN 1 END) AS flagged_count,
                    MAX(ts.created_at) AS last_submission_at
                FROM course_students cs
                JOIN users u ON u.id = cs.student_id
                JOIN courses c ON c.id = cs.course_id
                LEFT JOIN typing_sessions ts ON ts.user_id = u.id AND ts.course_id = c.id
                WHERE c.teacher_id = :teacher_id
                GROUP BY
                    u.id, u.first_name, u.last_name, u.email, u.student_id,
                    u.university_name, c.id, c.course_name, c.course_code, cs.joined_at
                ORDER BY cs.joined_at DESC
                """
            ),
            {"teacher_id": teacher_id},
        ).mappings().fetchall()

    return {
        "status": "success",
        "students": [
            {
                "id": row["id"],
                "student_name": f"{row['first_name']} {row['last_name'] or ''}".strip(),
                "email": row["email"],
                "student_id": row["student_id"],
                "university_name": row["university_name"],
                "course_id": row["course_id"],
                "course_name": row["course_name"],
                "course_code": row["course_code"],
                "joined_at": _format_datetime(row["joined_at"]),
                "submission_count": int(row["submission_count"] or 0),
                "avg_confidence": float(row["avg_confidence"] or 0),
                "avg_wpm": float(row["avg_wpm"] or 0),
                "pending_count": int(row["pending_count"] or 0),
                "flagged_count": int(row["flagged_count"] or 0),
                "last_submission_at": _format_datetime(row["last_submission_at"]),
            }
            for row in rows
        ],
    }


@router.get("/teacher/sessions")
async def list_teacher_submissions(
    course_id: Optional[int] = Query(default=None),
    review_status: Optional[str] = Query(default=None),
    risk_level: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_teacher),
):
    teacher_id = str(current_user.id)

    where_parts = ["c.teacher_id = :teacher_id"]
    params: Dict[str, Any] = {
        "teacher_id": teacher_id,
        "limit": limit,
        "offset": offset,
    }

    if course_id is not None:
        where_parts.append("c.id = :course_id")
        params["course_id"] = course_id

    if review_status and review_status.upper() != "ALL":
        where_parts.append("COALESCE(ts.review_status, 'PENDING') = :review_status")
        params["review_status"] = review_status.upper()

    if risk_level and risk_level.upper() != "ALL":
        where_parts.append("COALESCE(ts.risk_level, 'LOW') = :risk_level")
        params["risk_level"] = risk_level.upper()

    if search:
        where_parts.append(
            """
            (
                LOWER(ts.title) LIKE :search
                OR LOWER(u.first_name) LIKE :search
                OR LOWER(u.last_name) LIKE :search
                OR LOWER(u.email) LIKE :search
                OR LOWER(c.course_name) LIKE :search
                OR LOWER(c.course_code) LIKE :search
            )
            """
        )
        params["search"] = f"%{search.lower()}%"

    where_clause = " AND ".join(where_parts)

    with sync_engine.connect() as conn:
        total_row = conn.execute(
            text(
                f"""
                SELECT COUNT(*) AS total
                FROM typing_sessions ts
                JOIN courses c ON c.id = ts.course_id
                JOIN users u ON u.id = ts.user_id
                WHERE {where_clause}
                """
            ),
            params,
        ).mappings().fetchone()

        rows = conn.execute(
            text(
                f"""
                SELECT
                    ts.id,
                    ts.title,
                    ts.course_id,
                    ts.classification_result AS classification,
                    ts.ml_confidence_score AS confidence,
                    ts.risk_level,
                    ts.review_status,
                    ts.review_notes,
                    ts.wpm,
                    ts.duration_seconds,
                    ts.total_keystrokes,
                    ts.deletions,
                    ts.pauses,
                    ts.avg_iki,
                    ts.certificate_id,
                    ts.document_hash,
                    ts.created_at,
                    c.course_name,
                    c.course_code,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.student_id,
                    CASE
                        WHEN ts.text_content IS NULL THEN 0
                        ELSE array_length(regexp_split_to_array(trim(ts.text_content), '\\s+'), 1)
                    END AS word_count
                FROM typing_sessions ts
                JOIN courses c ON c.id = ts.course_id
                JOIN users u ON u.id = ts.user_id
                WHERE {where_clause}
                ORDER BY ts.created_at DESC
                LIMIT :limit OFFSET :offset
                """
            ),
            params,
        ).mappings().fetchall()

    return {
        "status": "success",
        "total": int(total_row["total"] if total_row else 0),
        "limit": limit,
        "offset": offset,
        "sessions": [_submission_payload(dict(row)) for row in rows],
    }


@router.get("/teacher/sessions/{session_id}")
async def get_teacher_submission_detail(
    session_id: int,
    current_user: User = Depends(require_teacher),
):
    teacher_id = str(current_user.id)

    with sync_engine.connect() as conn:
        row = conn.execute(
            text(
                """
                SELECT
                    ts.id,
                    ts.title,
                    ts.text_content,
                    ts.raw_keystroke_data,
                    ts.course_id,
                    ts.classification_result AS classification,
                    ts.ml_confidence_score AS confidence,
                    ts.risk_level,
                    ts.review_status,
                    ts.review_notes,
                    ts.wpm,
                    ts.duration_seconds,
                    ts.total_keystrokes,
                    ts.deletions,
                    ts.pauses,
                    ts.avg_iki,
                    ts.certificate_id,
                    ts.document_hash,
                    ts.created_at,
                    c.course_name,
                    c.course_code,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.student_id,
                    CASE
                        WHEN ts.text_content IS NULL THEN 0
                        ELSE array_length(regexp_split_to_array(trim(ts.text_content), '\\s+'), 1)
                    END AS word_count
                FROM typing_sessions ts
                JOIN courses c ON c.id = ts.course_id
                JOIN users u ON u.id = ts.user_id
                WHERE ts.id = :session_id
                  AND c.teacher_id = :teacher_id
                LIMIT 1
                """
            ),
            {
                "session_id": session_id,
                "teacher_id": teacher_id,
            },
        ).mappings().fetchone()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found.",
        )

    payload = _submission_payload(dict(row))
    payload["text_content"] = row["text_content"] or ""
    payload["raw_keystroke_data"] = row["raw_keystroke_data"] or []

    return {
        "status": "success",
        "session": payload,
    }


@router.patch("/teacher/sessions/{session_id}/review")
async def review_teacher_submission(
    session_id: int,
    payload: TeacherReviewUpdate,
    current_user: User = Depends(require_teacher),
):
    teacher_id = str(current_user.id)
    review_status = payload.status.strip().upper()

    if review_status not in {"PENDING", "APPROVED", "FLAGGED"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Review status must be PENDING, APPROVED, or FLAGGED.",
        )

    notes = (payload.notes or "").strip()

    with sync_engine.begin() as conn:
        existing = conn.execute(
            text(
                """
                SELECT ts.id
                FROM typing_sessions ts
                JOIN courses c ON c.id = ts.course_id
                WHERE ts.id = :session_id
                  AND c.teacher_id = :teacher_id
                LIMIT 1
                """
            ),
            {
                "session_id": session_id,
                "teacher_id": teacher_id,
            },
        ).fetchone()

        if existing is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Submission not found.",
            )

        conn.execute(
            text(
                """
                UPDATE typing_sessions
                SET
                    review_status = :review_status,
                    review_notes = :review_notes,
                    reviewed_by = :teacher_id,
                    updated_at = NOW()
                WHERE id = :session_id
                """
            ),
            {
                "review_status": review_status,
                "review_notes": notes,
                "teacher_id": teacher_id,
                "session_id": session_id,
            },
        )

    return {
        "status": "success",
        "message": "Submission review updated successfully.",
        "review_status": review_status,
        "review_notes": notes,
    }