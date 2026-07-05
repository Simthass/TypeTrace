
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import create_engine, text

from app.api.deps import require_student
from app.core.config import settings
from app.models.user import User


router = APIRouter()

sync_engine = create_engine(settings.sync_database_url, pool_pre_ping=True)


def _format_datetime(value: Any) -> str:
    if value is None:
        return "Unknown"

    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    return str(value)


def _format_day(value: Any) -> str:
    if value is None:
        return "Unknown"

    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d")

    return str(value)


def _classification_bucket(classification: Optional[str]) -> str:
    normalized = str(classification or "UNKNOWN").upper()

    if normalized == "HUMAN":
        return "HUMAN"

    if normalized == "SUSPICIOUS":
        return "SUSPICIOUS"

    if normalized in {"SYNTHETIC", "AI", "AI-GENERATED"}:
        return "SYNTHETIC"

    return "UNKNOWN"


def _review_outcome(status: Optional[str]) -> str:
    normalized = str(status or "PENDING").upper()

    if normalized == "APPROVED":
        return "Accepted by teacher"
    if normalized == "FLAGGED":
        return "Flagged for academic review"
    if normalized == "NEEDS_DISCUSSION":
        return "Discussion requested"
    return "Awaiting teacher review"


def _risk_level(classification: Optional[str], fallback: Optional[str]) -> str:
    if fallback:
        return str(fallback).upper()

    normalized = _classification_bucket(classification)

    if normalized == "SYNTHETIC":
        return "HIGH"

    if normalized == "SUSPICIOUS":
        return "MEDIUM"

    return "LOW"


def _session_to_dict(row: Dict[str, Any]) -> Dict[str, Any]:
    classification = row.get("classification") or "UNKNOWN"

    return {
        "id": row.get("id"),
        "title": row.get("title") or "Untitled Document",
        "classification": classification,
        "classification_bucket": _classification_bucket(classification),
        "confidence": round(float(row.get("confidence") or 0), 2),
        "risk_level": _risk_level(classification, row.get("risk_level")),
        "review_status": row.get("review_status") or "PENDING",
        "review_outcome": _review_outcome(row.get("review_status")),
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
        "course_name": row.get("course_name"),
        "course_code": row.get("course_code"),
        "created_at": _format_datetime(row.get("created_at")),
    }


@router.get("/student/dashboard")
async def get_student_dashboard(
    current_user: User = Depends(require_student),
):
    """
    Student dashboard summary.

    Provides:
    - KPI cards
    - recent writing sessions
    - recent trend chart data
    - certificate and review summary
    """
    user_id = str(current_user.id)

    with sync_engine.connect() as conn:
        summary = conn.execute(
            text(
                """
                SELECT
                    COUNT(*) AS total_sessions,
                    COALESCE(ROUND(AVG(wpm)::numeric, 1), 0) AS avg_wpm,
                    COALESCE(ROUND(AVG(ml_confidence_score)::numeric, 1), 0) AS avg_confidence,
                    COALESCE(SUM(duration_seconds), 0) AS total_seconds,
                    COALESCE(SUM(total_keystrokes), 0) AS total_keystrokes,
                    COALESCE(SUM(deletions), 0) AS total_deletions,
                    COALESCE(SUM(pauses), 0) AS total_pauses,
                    COUNT(CASE WHEN classification_result = 'HUMAN' THEN 1 END) AS human_sessions,
                    COUNT(CASE WHEN classification_result = 'SUSPICIOUS' THEN 1 END) AS suspicious_sessions,
                    COUNT(CASE WHEN classification_result IN ('SYNTHETIC', 'AI-GENERATED', 'AI') THEN 1 END) AS synthetic_sessions,
                    COUNT(CASE WHEN certificate_id IS NOT NULL THEN 1 END) AS certificate_count,
                    COUNT(CASE WHEN review_status = 'APPROVED' THEN 1 END) AS approved_count,
                    COUNT(CASE WHEN review_status = 'FLAGGED' THEN 1 END) AS flagged_count,
                    COUNT(CASE WHEN review_status IN ('PENDING', 'NEEDS_DISCUSSION') OR review_status IS NULL THEN 1 END) AS pending_count
                FROM typing_sessions
                WHERE user_id = :user_id
                """
            ),
            {"user_id": user_id},
        ).mappings().fetchone()

        recent_rows = conn.execute(
            text(
                """
                SELECT
                    ts.id,
                    ts.title,
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
                    CASE
                        WHEN ts.text_content IS NULL THEN 0
                        ELSE array_length(regexp_split_to_array(trim(ts.text_content), '\\s+'), 1)
                    END AS word_count
                FROM typing_sessions ts
                LEFT JOIN courses c ON c.id = ts.course_id
                WHERE ts.user_id = :user_id
                ORDER BY ts.created_at DESC
                LIMIT 5
                """
            ),
            {"user_id": user_id},
        ).mappings().fetchall()

        trend_rows = conn.execute(
            text(
                """
                SELECT
                    DATE(created_at) AS day,
                    COUNT(*) AS session_count,
                    COALESCE(ROUND(AVG(wpm)::numeric, 1), 0) AS avg_wpm,
                    COALESCE(ROUND(AVG(ml_confidence_score)::numeric, 1), 0) AS avg_confidence,
                    COUNT(CASE WHEN classification_result = 'HUMAN' THEN 1 END) AS human_count,
                    COUNT(CASE WHEN classification_result = 'SUSPICIOUS' THEN 1 END) AS suspicious_count,
                    COUNT(CASE WHEN classification_result IN ('SYNTHETIC', 'AI-GENERATED', 'AI') THEN 1 END) AS synthetic_count
                FROM typing_sessions
                WHERE user_id = :user_id
                  AND created_at >= NOW() - INTERVAL '14 days'
                GROUP BY DATE(created_at)
                ORDER BY day ASC
                """
            ),
            {"user_id": user_id},
        ).mappings().fetchall()

        course_rows = conn.execute(
            text(
                """
                SELECT
                    COALESCE(c.course_name, 'Personal') AS course_name,
                    COALESCE(c.course_code, '') AS course_code,
                    COUNT(ts.id) AS session_count,
                    COALESCE(ROUND(AVG(ts.wpm)::numeric, 1), 0) AS avg_wpm,
                    COALESCE(ROUND(AVG(ts.ml_confidence_score)::numeric, 1), 0) AS avg_confidence,
                    COUNT(CASE WHEN ts.classification_result = 'HUMAN' THEN 1 END) AS human_count
                FROM typing_sessions ts
                LEFT JOIN courses c ON c.id = ts.course_id
                WHERE ts.user_id = :user_id
                GROUP BY COALESCE(c.course_name, 'Personal'), COALESCE(c.course_code, '')
                ORDER BY session_count DESC
                LIMIT 6
                """
            ),
            {"user_id": user_id},
        ).mappings().fetchall()

    summary_dict = dict(summary or {})

    return {
        "status": "success",
        "student": {
            "id": str(current_user.id),
            "first_name": current_user.first_name,
            "last_name": current_user.last_name,
            "email": current_user.email,
            "student_id": current_user.student_id,
            "university_name": current_user.university_name,
        },
        "summary": {
            "total_sessions": int(summary_dict.get("total_sessions") or 0),
            "avg_wpm": float(summary_dict.get("avg_wpm") or 0),
            "avg_confidence": float(summary_dict.get("avg_confidence") or 0),
            "total_seconds": round(float(summary_dict.get("total_seconds") or 0), 1),
            "total_keystrokes": int(summary_dict.get("total_keystrokes") or 0),
            "total_deletions": int(summary_dict.get("total_deletions") or 0),
            "total_pauses": int(summary_dict.get("total_pauses") or 0),
            "human_sessions": int(summary_dict.get("human_sessions") or 0),
            "suspicious_sessions": int(summary_dict.get("suspicious_sessions") or 0),
            "synthetic_sessions": int(summary_dict.get("synthetic_sessions") or 0),
            "certificate_count": int(summary_dict.get("certificate_count") or 0),
            "approved_count": int(summary_dict.get("approved_count") or 0),
            "flagged_count": int(summary_dict.get("flagged_count") or 0),
            "pending_count": int(summary_dict.get("pending_count") or 0),
        },
        "recent_sessions": [_session_to_dict(dict(row)) for row in recent_rows],
        "trend": [
            {
                "day": _format_day(row["day"]),
                "session_count": int(row["session_count"] or 0),
                "avg_wpm": float(row["avg_wpm"] or 0),
                "avg_confidence": float(row["avg_confidence"] or 0),
                "human_count": int(row["human_count"] or 0),
                "suspicious_count": int(row["suspicious_count"] or 0),
                "synthetic_count": int(row["synthetic_count"] or 0),
            }
            for row in trend_rows
        ],
        "courses": [
            {
                "course_name": row["course_name"],
                "course_code": row["course_code"],
                "session_count": int(row["session_count"] or 0),
                "avg_wpm": float(row["avg_wpm"] or 0),
                "avg_confidence": float(row["avg_confidence"] or 0),
                "human_count": int(row["human_count"] or 0),
            }
            for row in course_rows
        ],
    }


@router.get("/student/sessions")
async def get_student_sessions(
    classification: Optional[str] = Query(default=None),
    review_status: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_student),
):
    """
    Full student writing session history with filtering.
    """
    user_id = str(current_user.id)

    where_parts = ["ts.user_id = :user_id"]
    params: Dict[str, Any] = {
        "user_id": user_id,
        "limit": limit,
        "offset": offset,
    }

    if classification and classification.upper() != "ALL":
        selected = classification.upper()

        if selected == "SYNTHETIC":
            where_parts.append("ts.classification_result IN ('SYNTHETIC', 'AI-GENERATED', 'AI')")
        else:
            where_parts.append("ts.classification_result = :classification")
            params["classification"] = selected

    if review_status and review_status.upper() != "ALL":
        where_parts.append("COALESCE(ts.review_status, 'PENDING') = :review_status")
        params["review_status"] = review_status.upper()

    if search:
        where_parts.append("(LOWER(ts.title) LIKE :search OR LOWER(ts.text_content) LIKE :search)")
        params["search"] = f"%{search.lower()}%"

    where_clause = " AND ".join(where_parts)

    with sync_engine.connect() as conn:
        total_row = conn.execute(
            text(
                f"""
                SELECT COUNT(*) AS total
                FROM typing_sessions ts
                LEFT JOIN courses c ON c.id = ts.course_id
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
                    CASE
                        WHEN ts.text_content IS NULL THEN 0
                        ELSE array_length(regexp_split_to_array(trim(ts.text_content), '\\s+'), 1)
                    END AS word_count
                FROM typing_sessions ts
                LEFT JOIN courses c ON c.id = ts.course_id
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
        "sessions": [_session_to_dict(dict(row)) for row in rows],
    }


@router.get("/student/sessions/{session_id}")
async def get_student_session_detail(
    session_id: int,
    current_user: User = Depends(require_student),
):
    """
    Single session detail for the student.
    """
    with sync_engine.connect() as conn:
        row = conn.execute(
            text(
                """
                SELECT
                    ts.id,
                    ts.title,
                    ts.text_content,
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
                    CASE
                        WHEN ts.text_content IS NULL THEN 0
                        ELSE array_length(regexp_split_to_array(trim(ts.text_content), '\\s+'), 1)
                    END AS word_count
                FROM typing_sessions ts
                LEFT JOIN courses c ON c.id = ts.course_id
                WHERE ts.id = :session_id
                  AND ts.user_id = :user_id
                LIMIT 1
                """
            ),
            {
                "session_id": session_id,
                "user_id": str(current_user.id),
            },
        ).mappings().fetchone()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    payload = _session_to_dict(dict(row))
    payload["text_content"] = row["text_content"] or ""

    return {
        "status": "success",
        "session": payload,
    }


@router.get("/student/analytics")
async def get_student_analytics_clean(
    current_user: User = Depends(require_student),
):
    """
    Clean student analytics endpoint used by the analytics page.
    """
    user_id = str(current_user.id)

    with sync_engine.connect() as conn:
        daily_rows = conn.execute(
            text(
                """
                SELECT
                    DATE(created_at) AS day,
                    COUNT(*) AS session_count,
                    COALESCE(ROUND(AVG(wpm)::numeric, 1), 0) AS avg_wpm,
                    COALESCE(ROUND(AVG(ml_confidence_score)::numeric, 1), 0) AS avg_confidence,
                    COALESCE(SUM(total_keystrokes), 0) AS total_keys,
                    COALESCE(SUM(deletions), 0) AS deletions,
                    COALESCE(SUM(pauses), 0) AS pauses
                FROM typing_sessions
                WHERE user_id = :user_id
                  AND created_at >= NOW() - INTERVAL '30 days'
                GROUP BY DATE(created_at)
                ORDER BY day ASC
                """
            ),
            {"user_id": user_id},
        ).mappings().fetchall()

        course_rows = conn.execute(
            text(
                """
                SELECT
                    COALESCE(c.course_name, 'Personal') AS course_name,
                    COALESCE(c.course_code, '') AS course_code,
                    COUNT(ts.id) AS session_count,
                    COALESCE(ROUND(AVG(ts.wpm)::numeric, 1), 0) AS avg_wpm,
                    COALESCE(ROUND(AVG(ts.ml_confidence_score)::numeric, 1), 0) AS avg_confidence,
                    COUNT(CASE WHEN ts.classification_result = 'HUMAN' THEN 1 END) AS human_count,
                    COUNT(CASE WHEN ts.classification_result = 'SUSPICIOUS' THEN 1 END) AS suspicious_count,
                    COUNT(CASE WHEN ts.classification_result IN ('SYNTHETIC', 'AI-GENERATED', 'AI') THEN 1 END) AS synthetic_count
                FROM typing_sessions ts
                LEFT JOIN courses c ON c.id = ts.course_id
                WHERE ts.user_id = :user_id
                GROUP BY COALESCE(c.course_name, 'Personal'), COALESCE(c.course_code, '')
                ORDER BY session_count DESC
                """
            ),
            {"user_id": user_id},
        ).mappings().fetchall()

        bests = conn.execute(
            text(
                """
                SELECT
                    COALESCE(MAX(wpm), 0) AS best_wpm,
                    COALESCE(MAX(ml_confidence_score), 0) AS best_confidence,
                    COALESCE(MAX(duration_seconds), 0) AS longest_session,
                    COALESCE(MIN(avg_iki), 0) AS best_iki,
                    COUNT(*) AS total_sessions,
                    COALESCE(SUM(duration_seconds), 0) AS total_seconds
                FROM typing_sessions
                WHERE user_id = :user_id
                """
            ),
            {"user_id": user_id},
        ).mappings().fetchone()

    return {
        "status": "success",
        "daily": [
            {
                "day": _format_day(row["day"]),
                "session_count": int(row["session_count"] or 0),
                "avg_wpm": float(row["avg_wpm"] or 0),
                "avg_confidence": float(row["avg_confidence"] or 0),
                "total_keys": int(row["total_keys"] or 0),
                "deletions": int(row["deletions"] or 0),
                "pauses": int(row["pauses"] or 0),
            }
            for row in daily_rows
        ],
        "courses": [
            {
                "course_name": row["course_name"],
                "course_code": row["course_code"],
                "session_count": int(row["session_count"] or 0),
                "avg_wpm": float(row["avg_wpm"] or 0),
                "avg_confidence": float(row["avg_confidence"] or 0),
                "human_count": int(row["human_count"] or 0),
                "suspicious_count": int(row["suspicious_count"] or 0),
                "synthetic_count": int(row["synthetic_count"] or 0),
            }
            for row in course_rows
        ],
        "bests": {
            "best_wpm": float(bests["best_wpm"] or 0) if bests else 0,
            "best_confidence": float(bests["best_confidence"] or 0) if bests else 0,
            "longest_session": float(bests["longest_session"] or 0) if bests else 0,
            "best_iki": float(bests["best_iki"] or 0) if bests else 0,
            "total_sessions": int(bests["total_sessions"] or 0) if bests else 0,
            "total_seconds": float(bests["total_seconds"] or 0) if bests else 0,
        },
    }
