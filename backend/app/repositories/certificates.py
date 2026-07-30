from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def fetch_certificate_record_row(
    db: AsyncSession,
    *,
    certificate_id: str,
) -> dict[str, Any] | None:
    row = (
        await db.execute(
            text(
                """
                SELECT
                    ts.id AS session_id,
                    ts.title AS title,
                    ts.word_count AS word_count,
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
                    ts.evidence_hash AS session_evidence_hash,
                    ts.model_version AS model_version,
                    ts.model_score AS model_score,
                    ts.decision_source AS decision_source,
                    ts.model_available AS model_available,
                    ts.degraded_analysis AS degraded_analysis,
                    ts.course_id AS course_id,

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
                    cert.verification_notes AS verification_notes,
                    cert.evidence_hash AS certificate_evidence_hash,
                    cert.signed_payload_hash AS signed_payload_hash,
                    cert.signature AS signature,
                    cert.signature_algorithm AS signature_algorithm,
                    cert.signing_key_id AS signing_key_id,
                    cert.signed_at AS signed_at,
                    cert.verification_status AS verification_status,
                    cert.revoked_at AS revoked_at,
                    cert.revocation_reason AS revocation_reason
                FROM typing_sessions ts
                JOIN users u ON u.id = ts.user_id
                LEFT JOIN courses c ON c.id = ts.course_id
                LEFT JOIN certificates cert ON cert.certificate_id = ts.certificate_id
                WHERE ts.certificate_id = :certificate_id
                LIMIT 1
                """
            ),
            {"certificate_id": certificate_id},
        )
    ).mappings().first()
    return dict(row) if row is not None else None


async def list_user_certificate_ids(
    db: AsyncSession,
    *,
    user_id: str,
) -> list[str]:
    rows = (
        await db.execute(
            text(
                """
                SELECT certificate_id
                FROM typing_sessions
                WHERE user_id = :user_id
                  AND certificate_id IS NOT NULL
                ORDER BY created_at DESC
                """
            ),
            {"user_id": user_id},
        )
    ).mappings().all()
    return [str(row["certificate_id"]) for row in rows]


async def fetch_owned_session_certificate_id(
    db: AsyncSession,
    *,
    session_id: int,
    user_id: str,
) -> str | None:
    value = (
        await db.execute(
            text(
                """
                SELECT certificate_id
                FROM typing_sessions
                WHERE id = :session_id AND user_id = :user_id
                LIMIT 1
                """
            ),
            {"session_id": session_id, "user_id": user_id},
        )
    ).scalar_one_or_none()
    return str(value) if value else None


async def lock_certificate_for_revocation(
    db: AsyncSession,
    *,
    certificate_id: str,
) -> dict[str, Any] | None:
    row = (
        await db.execute(
            text(
                """
                SELECT cert.certificate_id, cert.verification_status, cert.revoked_at, ts.id AS session_id,
                       ts.user_id, ts.title, c.teacher_id
                FROM certificates cert
                JOIN typing_sessions ts ON ts.id = cert.session_id
                LEFT JOIN courses c ON c.id = ts.course_id
                WHERE cert.certificate_id = :certificate_id
                FOR UPDATE OF cert
                """
            ),
            {"certificate_id": certificate_id},
        )
    ).mappings().first()
    return dict(row) if row is not None else None
