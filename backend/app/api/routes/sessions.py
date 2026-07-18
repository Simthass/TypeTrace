# backend/app/api/routes/sessions.py

import secrets
import string
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_student
from app.core.crypto import encrypt_json, encrypt_text
from app.db.database import get_db
from app.ml.inference_engine import inference_engine
from app.models.certificate import Certificate
from app.models.course import Course, CourseStudent
from app.models.draft import DraftSession
from app.models.session import TypingSession
from app.models.user import User
from app.services.audit_log import create_audit_log
from app.services.canonical_evidence import compute_canonical_evidence, normalize_title
from app.services.certificate_signing import sign_certificate_for_session
from app.services.notifications import dispatch_notification


router = APIRouter()


MINIMUM_KEYSTROKES = 30


class SessionStats(BaseModel):
    wpm: float = Field(ge=0)
    keystrokes: int = Field(ge=0)
    deletions: int = Field(default=0, ge=0)
    deletedCharacters: int = Field(default=0, ge=0)
    bulkDeletionEvents: int = Field(default=0, ge=0)
    largestDeletionChars: int = Field(default=0, ge=0)
    selectionDeletionEvents: int = Field(default=0, ge=0)
    wordDeletionEvents: int = Field(default=0, ge=0)
    cutEvents: int = Field(default=0, ge=0)
    pauses: int = Field(ge=0)
    avgIki: float = Field(ge=0)
    sessionSeconds: float = Field(ge=0)


class KeystrokeSessionAnalyzeRequest(BaseModel):
    title: str = Field(default="Untitled Document", max_length=255)
    text_content: str = Field(min_length=1)
    keystroke_array: List[Dict[str, Any]] = Field(default_factory=list)
    stats: SessionStats
    course_id: Optional[int] = None

    active_duration_ms: Optional[int] = Field(default=None, ge=0)
    draft_id: Optional[str] = Field(default=None, max_length=120)
    client_metadata: Dict[str, Any] = Field(default_factory=dict)


class AnalysisResponse(BaseModel):
    classification: str
    confidence_score: float
    kill_switch_triggered: bool
    kill_switch_reason: Optional[str]
    advanced_stats: Dict[str, Any]
    stats: SessionStats
    session_id: int
    certificate_id: str
    document_hash: str
    risk_level: str
    risk_score: float
    evidence_hash: Optional[str] = None
    canonical_stats: Dict[str, Any] = Field(default_factory=dict)


def _stats_from_dict(value: Dict[str, Any]) -> SessionStats:
    return SessionStats(
        wpm=float(value.get("wpm") or 0),
        keystrokes=int(value.get("keystrokes") or 0),
        deletions=int(value.get("deletions") or 0),
        deletedCharacters=int(value.get("deletedCharacters") or 0),
        bulkDeletionEvents=int(value.get("bulkDeletionEvents") or 0),
        largestDeletionChars=int(value.get("largestDeletionChars") or 0),
        selectionDeletionEvents=int(value.get("selectionDeletionEvents") or 0),
        wordDeletionEvents=int(value.get("wordDeletionEvents") or 0),
        cutEvents=int(value.get("cutEvents") or 0),
        pauses=int(value.get("pauses") or 0),
        avgIki=float(value.get("avgIki") or 0),
        sessionSeconds=float(value.get("sessionSeconds") or 0),
    )


def _validate_event_stream(
    *,
    event_counts: Dict[str, int],
    text_content: str,
) -> None:
    has_typing_evidence = event_counts.get("keydown_count", 0) >= MINIMUM_KEYSTROKES
    has_paste_evidence = event_counts.get("paste_count", 0) > 0 and bool(
        (text_content or "").strip()
    )

    if not event_counts.get("event_count", 0):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Keystroke evidence is required.",
        )

    if not has_typing_evidence and not has_paste_evidence:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"At least {MINIMUM_KEYSTROKES} keydown events or one captured paste "
                "event are required for analysis."
            ),
        )


def _apply_paste_dominant_override(
    *,
    result: Any,
    event_counts: Dict[str, int],
    text_content: str,
    classification: str,
    confidence_score: float,
    risk_score: float,
    risk_level: str,
) -> Dict[str, Any]:

    text_length = len(text_content or "")
    paste_count = event_counts.get("paste_count", 0)
    pasted_length = event_counts.get("pasted_length", 0)
    keydown_count = event_counts.get("keydown_count", 0)

    paste_dominant = (
        paste_count > 0
        and (
            keydown_count < MINIMUM_KEYSTROKES
            or (text_length > 0 and pasted_length >= text_length * 0.6)
        )
    )

    if not paste_dominant:
        return {
            "classification": classification,
            "confidence_score": confidence_score,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "advanced_stats": result.advanced_stats,
            "kill_switch_triggered": bool(result.kill_switch_triggered),
            "kill_switch_reason": result.kill_switch_reason,
        }

    advanced_stats = dict(result.advanced_stats or {})
    risk_signals = list(advanced_stats.get("risk_signals") or [])
    risk_signals.append(
        "Most of the document was inserted through paste rather than typed directly."
    )
    advanced_stats.update(
        {
            "paste_count": paste_count,
            "pasted_length": pasted_length,
            "paste_dominant": True,
            "risk_signals": risk_signals,
            "decision_source": "paste_dominant_override",
            "academic_interpretation": (
                "This result indicates high paste/automation risk. It should be "
                "reviewed as supporting evidence, not as an automatic misconduct decision."
            ),
        }
    )

    return {
        "classification": "SYNTHETIC",
        "confidence_score": min(confidence_score, 2.0),
        "risk_score": max(risk_score, 92.0),
        "risk_level": "HIGH",
        "advanced_stats": advanced_stats,
        "kill_switch_triggered": True,
        "kill_switch_reason": "Paste-dominant writing session detected.",
    }


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


def _clamp_score(value: Any) -> float:
    try:
        score = float(value)
        if score != score:
            return 0.0
        return round(max(0.0, min(100.0, score)), 2)
    except (TypeError, ValueError):
        return 0.0


def _normalize_result_label(value: Any) -> str:
    label = str(value or "UNKNOWN").strip().upper()
    if label in {"HUMAN", "SUSPICIOUS", "SYNTHETIC"}:
        return label
    if label in {"AI", "AI-GENERATED", "AI_GENERATED"}:
        return "SYNTHETIC"
    if label in {"REAL", "NORMAL"}:
        return "HUMAN"
    if label in {"UNCERTAIN", "AMBIGUOUS"}:
        return "SUSPICIOUS"
    return "UNKNOWN"


def _normalize_risk_level(value: Any, risk_score: float) -> str:
    level = str(value or "").strip().upper()
    if level in {"LOW", "MEDIUM", "HIGH"}:
        return level
    if risk_score >= 50:
        return "HIGH"
    if risk_score >= 20:
        return "MEDIUM"
    return "LOW"


def _certificate_status_for(classification: str, risk_level: str) -> str:
    normalized = str(classification or "UNKNOWN").upper()
    risk = str(risk_level or "LOW").upper()
    if normalized == "HUMAN" and risk == "LOW":
        return "VALID"
    if normalized == "SUSPICIOUS" or risk == "MEDIUM":
        return "REVIEW_REQUIRED"
    return "HIGH_RISK"


async def _mark_draft_submitted(
    *,
    db: AsyncSession,
    user_id: str,
    draft_id: Optional[str],
    session_id: int,
) -> None:
    if not draft_id:
        return

    result = await db.execute(
        select(DraftSession).where(
            DraftSession.user_id == user_id,
            DraftSession.lifecycle_status != "DELETED",
            (DraftSession.id == draft_id) | (DraftSession.local_draft_id == draft_id),
        )
    )
    draft = result.scalars().first()
    if draft is None:
        return

    draft.lifecycle_status = "SUBMITTED"
    draft.sync_status = "SYNCED"
    draft.conflict_payload = {
        "submitted_session_id": session_id,
        "submitted_from": "sessions.analyze",
    }
    db.add(draft)


@router.post(
    "/analyze",
    response_model=AnalysisResponse,
    status_code=status.HTTP_201_CREATED,
)
async def analyze_session(
    payload: KeystrokeSessionAnalyzeRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    title = normalize_title(payload.title)
    canonical = compute_canonical_evidence(
        title=title,
        text_content=payload.text_content,
        keystroke_array=payload.keystroke_array,
        user_id=str(current_user.id),
        client_stats=payload.stats,
        client_active_duration_ms=payload.active_duration_ms,
    )
    _validate_event_stream(
        event_counts=canonical.event_counts,
        text_content=payload.text_content,
    )
    server_stats = _stats_from_dict(canonical.stats)

    await _ensure_student_can_submit_to_course(
        db=db,
        student_id=str(current_user.id),
        course_id=payload.course_id,
    )

    try:
        result = inference_engine.analyze(
            events=payload.keystroke_array,
            stats=server_stats,
            text_content=payload.text_content,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Analysis engine failed to process this writing session.",
        ) from exc

    classification = _normalize_result_label(result.classification)
    confidence_score = _clamp_score(result.confidence_score)
    risk_score = _clamp_score(result.risk_score)
    risk_level = _normalize_risk_level(result.risk_level, risk_score)

    paste_override = _apply_paste_dominant_override(
        result=result,
        event_counts=canonical.event_counts,
        text_content=payload.text_content,
        classification=classification,
        confidence_score=confidence_score,
        risk_score=risk_score,
        risk_level=risk_level,
    )
    classification = paste_override["classification"]
    confidence_score = _clamp_score(paste_override["confidence_score"])
    risk_score = _clamp_score(paste_override["risk_score"])
    risk_level = _normalize_risk_level(paste_override["risk_level"], risk_score)

    advanced_stats = dict(paste_override["advanced_stats"] or {})
    advanced_stats.update(
        {
            "canonical_evidence": canonical.evidence_metadata,
            "evidence_hash": canonical.evidence_hash,
            "duration_source": canonical.evidence_metadata.get("duration_source"),
            "idle_break_count": canonical.evidence_metadata.get("idle_break_count", 0),
        }
    )

    model_version = (
        advanced_stats.get("model_version")
        or (
            getattr(inference_engine, "artifacts", None)
            and getattr(inference_engine.artifacts, "metadata", {}).get("model_version")
        )
        or "fallback-rules"
    )
    model_score = _clamp_score(advanced_stats.get("model_score", risk_score))

    total_words = len((payload.text_content or "").split())

    certificate_id = await _create_unique_certificate_id(db)

    encrypted_text = encrypt_text(payload.text_content)
    encrypted_events = encrypt_json(payload.keystroke_array)

    session = TypingSession(
        user_id=str(current_user.id),
        course_id=payload.course_id,
        title=title,
        text_content=encrypted_text,
        raw_keystroke_data=encrypted_events,
        word_count=total_words,
        wpm=float(server_stats.wpm),
        total_keystrokes=int(server_stats.keystrokes),
        deletions=int(server_stats.deletions),
        pauses=int(server_stats.pauses),
        avg_iki=int(round(server_stats.avgIki)),
        duration_seconds=float(server_stats.sessionSeconds),
        ml_confidence_score=confidence_score,
        classification_result=classification,
        certificate_id=certificate_id,
        document_hash=canonical.document_hash,
        evidence_hash=canonical.evidence_hash,
        model_version=str(model_version),
        model_score=model_score,
        canonical_stats_json=canonical.canonical_stats_json,
        evidence_metadata={
            **canonical.evidence_metadata,
            "client_metadata": payload.client_metadata,
        },
        active_duration_ms=canonical.active_duration_ms,
        idle_breaks_json=canonical.idle_breaks,
        risk_level=risk_level,
        review_status="PENDING" if payload.course_id is not None else "NOT_APPLICABLE",
    )

    db.add(session)
    await db.flush()

    certificate = Certificate(
        session_id=session.id,
        certificate_id=certificate_id,
        document_hash=canonical.document_hash,
        evidence_hash=canonical.evidence_hash,
        verification_notes=(
            "Generated from backend-canonical TypeTrace writing-session evidence "
            "and signed into the TypeTrace certificate ledger."
        ),
        verification_status=_certificate_status_for(classification, risk_level),
    )
    signature_bundle = sign_certificate_for_session(session, certificate)
    db.add(certificate)

    await _mark_draft_submitted(
        db=db,
        user_id=str(current_user.id),
        draft_id=payload.draft_id,
        session_id=int(session.id),
    )

    db.add(
        create_audit_log(
            event_type="SESSION_ANALYZED",
            entity_type="typing_session",
            entity_id=str(session.id),
            actor_user_id=str(current_user.id),
            target_user_id=str(current_user.id),
            request=request,
            metadata={
                "certificate_id": certificate_id,
                "classification": classification,
                "risk_level": risk_level,
                "evidence_hash": canonical.evidence_hash,
                "draft_id": payload.draft_id,
                "model_version": str(model_version),
                "model_score": model_score,
            },
        )
    )
    db.add(
        create_audit_log(
            event_type="CERTIFICATE_CREATED",
            entity_type="certificate",
            entity_id=certificate_id,
            actor_user_id=str(current_user.id),
            target_user_id=str(current_user.id),
            request=request,
            metadata={
                "session_id": int(session.id),
                "document_hash": canonical.document_hash,
                "evidence_hash": canonical.evidence_hash,
                "verification_status": certificate.verification_status,
                "signature_algorithm": signature_bundle.algorithm,
                "signing_key_id": signature_bundle.signing_key_id,
                "signed_payload_hash": signature_bundle.payload_hash,
            },
        )
    )

    try:
        await db.commit()
        await db.refresh(session)
    except Exception:
        await db.rollback()
        raise

    if payload.course_id:
        course_query = await db.execute(select(Course).where(Course.id == payload.course_id))
        course_obj = course_query.scalars().first()
        if course_obj:
            background_tasks.add_task(
                dispatch_notification,
                recipient_id=course_obj.teacher_id,
                actor_id=str(current_user.id),
                event_type="SESSION_SUBMITTED",
                entity_type="typing_session",
                entity_id=str(session.id),
                title=f"{current_user.first_name} submitted \"{title}\"",
                body=f"Classification: {classification} · Risk: {risk_level}",
                action_url=f"/teacher/submissions?search={session.id}",
            )

    return AnalysisResponse(
        classification=classification,
        confidence_score=confidence_score,
        kill_switch_triggered=bool(paste_override["kill_switch_triggered"]),
        kill_switch_reason=paste_override["kill_switch_reason"],
        advanced_stats=advanced_stats,
        stats=server_stats,
        session_id=int(session.id),
        certificate_id=certificate_id,
        document_hash=canonical.document_hash,
        risk_level=risk_level,
        risk_score=risk_score,
        evidence_hash=canonical.evidence_hash,
        canonical_stats=canonical.canonical_stats_json,
    )