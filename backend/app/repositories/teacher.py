from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class TeacherSubmissionFilters:
    course_id: int | None = None
    review_status: str | None = None
    risk_level: str | None = None
    search: str | None = None


async def list_teacher_submission_rows(
    db: AsyncSession,
    *,
    teacher_id: str,
    filters: TeacherSubmissionFilters,
    limit: int,
    offset: int,
) -> tuple[int, list[dict[str, Any]]]:
    """Run the parameterized teacher queue query behind one repository boundary."""

    where_parts = ["c.teacher_id = :teacher_id"]
    params: dict[str, Any] = {
        "teacher_id": teacher_id,
        "limit": limit,
        "offset": offset,
    }

    if filters.course_id is not None:
        where_parts.append("c.id = :course_id")
        params["course_id"] = filters.course_id

    normalized_review = str(filters.review_status or "").strip().upper()
    if normalized_review and normalized_review != "ALL":
        where_parts.append("COALESCE(ts.review_status, 'PENDING') = :review_status")
        params["review_status"] = normalized_review

    normalized_risk = str(filters.risk_level or "").strip().upper()
    if normalized_risk and normalized_risk != "ALL":
        where_parts.append("COALESCE(ts.risk_level, 'LOW') = :risk_level")
        params["risk_level"] = normalized_risk

    normalized_search = str(filters.search or "").strip().lower()
    if normalized_search:
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
        params["search"] = f"%{normalized_search}%"

    # Only allow-listed constant fragments above are interpolated. All user
    # values remain bound parameters.
    where_clause = " AND ".join(where_parts)

    total = (
        await db.execute(
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
        )
    ).scalar_one()

    rows = (
        await db.execute(
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
                    ts.decision_source,
                    ts.model_available,
                    ts.degraded_analysis,
                    ts.created_at,
                    ts.updated_at AS review_saved_at,
                    c.course_name,
                    c.course_code,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.student_id,
                    ts.word_count AS word_count
                FROM typing_sessions ts
                JOIN courses c ON c.id = ts.course_id
                JOIN users u ON u.id = ts.user_id
                WHERE {where_clause}
                ORDER BY ts.created_at DESC
                LIMIT :limit OFFSET :offset
                """
            ),
            params,
        )
    ).mappings().all()

    return int(total or 0), [dict(row) for row in rows]
