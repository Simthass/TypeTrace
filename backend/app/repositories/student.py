from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class StudentSessionFilters:
    classification: str | None = None
    review_status: str | None = None
    search: str | None = None


async def list_student_session_rows(
    db: AsyncSession,
    *,
    user_id: str,
    filters: StudentSessionFilters,
    limit: int,
    offset: int,
) -> tuple[int, list[dict[str, Any]]]:
    """Run the parameterized student session query behind one repository boundary."""

    where_parts = ["ts.user_id = :user_id"]
    params: dict[str, Any] = {
        "user_id": user_id,
        "limit": limit,
        "offset": offset,
    }

    normalized_classification = str(filters.classification or "").strip().upper()
    if normalized_classification and normalized_classification != "ALL":
        if normalized_classification == "SYNTHETIC":
            where_parts.append(
                "ts.classification_result IN ('SYNTHETIC', 'AI-GENERATED', 'AI')"
            )
        else:
            where_parts.append("ts.classification_result = :classification")
            params["classification"] = normalized_classification

    normalized_review = str(filters.review_status or "").strip().upper()
    if normalized_review and normalized_review != "ALL":
        where_parts.append(
            "COALESCE(ts.review_status, 'PENDING') = :review_status"
        )
        params["review_status"] = normalized_review

    normalized_search = str(filters.search or "").strip().lower()
    if normalized_search:
        where_parts.append("LOWER(ts.title) LIKE :search")
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
                    c.course_name,
                    c.course_code,
                    ts.word_count AS word_count
                FROM typing_sessions ts
                LEFT JOIN courses c ON c.id = ts.course_id
                WHERE {where_clause}
                ORDER BY ts.created_at DESC
                LIMIT :limit OFFSET :offset
                """
            ),
            params,
        )
    ).mappings().all()

    return int(total or 0), [dict(row) for row in rows]
