# backend/app/api/routes/sessions.py

import hashlib
import json
import secrets
import string
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_student
from app.db.database import get_db
from app.ml.inference_engine import inference_engine
from app.models.certificate import Certificate
from app.models.course import CourseStudent
from app.models.session import TypingSession
from app.models.user import User


router = APIRouter()


MINIMUM_KEYSTROKES = 30


class SessionStats(BaseModel):
    wpm: float = Field(ge=0)
    keystrokes: int = Field(ge=0)
    deletions: int = Field(ge=0)
    pauses: int = Field(ge=0)
    avgIki: float = Field(ge=0)
    sessionSeconds: float = Field(ge=0)


class KeystrokeSessionAnalyzeRequest(BaseModel):
    title: str = Field(default="Untitled Document", max_length=255)
    text_content: str = Field(min_length=1)
    keystroke_array: List[Dict[str, Any]] = Field(default_factory=list)
    stats: SessionStats
    course_id: Optional[int] = None


class AnalysisResponse(BaseModel):
    classification: str
    confidence_score: float
    kill_switch_triggered: bool
    kill_switch_reason: Optional[str]
    advanced_stats: Dict[str, Any]
    session_id: int
    certificate_id: str
    document_hash: str
    risk_level: str
    risk_score: float


def _normalize_title(title: str) -> str:
    clean = (title or "").strip()
    return clean[:255] if clean else "Untitled Document"


def _canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )


def _generate_document_hash(
    *,
    title: str,
    text_content: str,
    keystroke_array: List[Dict[str, Any]],
    stats: SessionStats,
    user_id: str,
) -> str:
    payload = {
        "title": title,
        "text_content": text_content,
        "keystroke_array": keystroke_array,
        "stats": stats.model_dump(),
        "user_id": user_id,
    }

    return hashlib.sha256(_canonical_json(payload).encode("utf-8")).hexdigest()


def _generate_certificate_id() -> str:
    alphabet = string.ascii_uppercase + string.digits
    suffix = "".join(secrets.choice(alphabet) for _ in range(12))
    return f"TT-{suffix}"


async def _create_unique_certificate_id(db: AsyncSession) -> str:
    for _ in range(10):
        certificate_id = _generate_certificate_id()
        existing = await db.execute(
            select(Certificate.id).where(Certificate.certificate_id == certificate_id)
        )

        if existing.scalar_one_or_none() is None:
            return certificate_id

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to generate a unique certificate ID.",
    )


async def _ensure_student_can_submit_to_course(
    *,
    db: AsyncSession,
    student_id: str,
    course_id: Optional[int],
) -> None:
    if course_id is None:
        return

    result = await db.execute(
        select(CourseStudent.id).where(
            CourseStudent.course_id == course_id,
            CourseStudent.student_id == student_id,
        )
    )

    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not enrolled in this course.",
        )


@router.post(
    "/analyze",
    response_model=AnalysisResponse,
    status_code=status.HTTP_201_CREATED,
)
async def analyze_session(
    payload: KeystrokeSessionAnalyzeRequest,
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    """
    Analyzes a student writing session, stores the session,
    and creates a certificate ledger record.

    """

    if payload.stats.keystrokes < MINIMUM_KEYSTROKES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"At least {MINIMUM_KEYSTROKES} keystrokes are required for analysis.",
        )

    if not payload.keystroke_array:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Keystroke evidence is required.",
        )

    await _ensure_student_can_submit_to_course(
        db=db,
        student_id=str(current_user.id),
        course_id=payload.course_id,
    )

    try:
        result = inference_engine.analyze(
            events=payload.keystroke_array,
            stats=payload.stats,
            text_content=payload.text_content,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )

    title = _normalize_title(payload.title)

    document_hash = _generate_document_hash(
        title=title,
        text_content=payload.text_content,
        keystroke_array=payload.keystroke_array,
        stats=payload.stats,
        user_id=str(current_user.id),
    )

    certificate_id = await _create_unique_certificate_id(db)

    session = TypingSession(
        user_id=str(current_user.id),
        course_id=payload.course_id,
        title=title,
        text_content=payload.text_content,
        wpm=float(payload.stats.wpm),
        total_keystrokes=int(payload.stats.keystrokes),
        deletions=int(payload.stats.deletions),
        pauses=int(payload.stats.pauses),
        avg_iki=int(payload.stats.avgIki),
        duration_seconds=float(payload.stats.sessionSeconds),
        ml_confidence_score=float(result.confidence_score),
        classification_result=result.classification,
        raw_keystroke_data=payload.keystroke_array,
        certificate_id=certificate_id,
        document_hash=document_hash,
        risk_level=result.risk_level,
        review_status="PENDING",
    )

    db.add(session)
    await db.flush()

    certificate = Certificate(
        session_id=session.id,
        certificate_id=certificate_id,
        document_hash=document_hash,
        verification_notes="Generated from TypeTrace writing-session analysis.",
    )

    db.add(certificate)

    try:
        await db.commit()
        await db.refresh(session)
    except Exception:
        await db.rollback()
        raise

    return AnalysisResponse(
        classification=result.classification,
        confidence_score=float(result.confidence_score),
        kill_switch_triggered=bool(result.kill_switch_triggered),
        kill_switch_reason=result.kill_switch_reason,
        advanced_stats=result.advanced_stats,
        session_id=int(session.id),
        certificate_id=certificate_id,
        document_hash=document_hash,
        risk_level=result.risk_level,
        risk_score=float(result.risk_score),
    )