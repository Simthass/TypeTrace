from __future__ import annotations

import secrets
import string
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_student
from app.core.crypto import decrypt_json, decrypt_text, encrypt_json, encrypt_text
from app.db.database import get_db
from app.ml.inference_engine import (
    SCORING_ENGINE_VERSION,
    InferenceInputError,
    InferenceInternalError,
    inference_engine,
)
from app.ml.paste_policy import (
    MINIMUM_KEYSTROKES,
    PASTE_POLICY_VERSION,
    apply_paste_policy,
)
from app.models.certificate import Certificate
from app.models.course import Course, CourseStudent
from app.models.draft import DraftSession
from app.models.session import TypingSession
from app.models.user import User
from app.schemas.evidence import (
    AnalysisResponse,
    KeystrokeSessionAnalyzeRequest,
    SessionStats,
)
from app.services.audit_log import create_audit_log
from app.services.canonical_evidence import compute_canonical_evidence, normalize_title
from app.services.certificate_signing import sign_certificate_for_session
from app.services.evidence_replay import EvidenceReplayMismatch, validate_evidence_text
from app.services.notifications import dispatch_notification


router = APIRouter()


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


def _validate_event_stream(*, event_counts: Dict[str, int], text_content: str) -> None:
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
) -> Optional[Course]:
    if course_id is None:
        return None

    result = await db.execute(
        select(Course)
        .join(CourseStudent, CourseStudent.course_id == Course.id)
        .where(
            Course.id == course_id,
            CourseStudent.student_id == student_id,
            Course.is_archived.is_(False),
        )
    )
    course = result.scalars().first()
    if course is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not enrolled in an active course.",
        )
    return course


def _clamp_score(value: Any) -> float:
    try:
        score = float(value)
        if score != score or score in {float("inf"), float("-inf")}:
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


async def _load_idempotent_response(
    *,
    db: AsyncSession,
    user_id: str,
    submission_id: str,
    expected_evidence_hash: Optional[str] = None,
) -> Optional[AnalysisResponse]:
    result = await db.execute(
        select(TypingSession).where(
            TypingSession.user_id == user_id,
            TypingSession.submission_id == submission_id,
        )
    )
    session = result.scalars().first()
    if session is None:
        return None

    if (
        expected_evidence_hash
        and session.evidence_hash
        and str(session.evidence_hash) != expected_evidence_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This submission_id was already used for different evidence. "
                "Generate a new submission identifier before submitting again."
            ),
        )

    certificate_result = await db.execute(
        select(Certificate).where(Certificate.session_id == session.id)
    )
    certificate = certificate_result.scalars().first()
    if certificate is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The prior submission exists but its certificate transaction is incomplete.",
        )

    metadata = dict(session.evidence_metadata or {})
    stored = metadata.get("analysis_response")
    if isinstance(stored, dict):
        replay = dict(stored)
        replay["idempotent_replay"] = True
        replay["submission_id"] = submission_id
        return AnalysisResponse.model_validate(replay)

    canonical_stats = dict(session.canonical_stats_json or {})
    stats = _stats_from_dict(canonical_stats)
    decision_source = str(session.decision_source or "LEGACY_UNKNOWN")
    model_available = bool(session.model_available)
    degraded_analysis = bool(session.degraded_analysis)
    confidence = _clamp_score(session.ml_confidence_score)
    risk_score = _clamp_score(100.0 - confidence)
    return AnalysisResponse(
        classification=str(session.classification_result or "UNKNOWN"),
        confidence_score=confidence,
        kill_switch_triggered=degraded_analysis,
        kill_switch_reason=(
            "The original record used degraded analysis."
            if degraded_analysis
            else None
        ),
        advanced_stats={
            "decision_source": decision_source,
            "model_available": model_available,
            "degraded_analysis": degraded_analysis,
        },
        stats=stats,
        session_id=int(session.id),
        certificate_id=certificate.certificate_id,
        document_hash=str(session.document_hash or certificate.document_hash),
        risk_level=str(session.risk_level or "LOW"),
        risk_score=risk_score,
        evidence_hash=session.evidence_hash,
        canonical_stats=canonical_stats,
        submission_id=submission_id,
        idempotent_replay=True,
        decision_source=decision_source,
        model_available=model_available,
        degraded_analysis=degraded_analysis,
    )


async def _load_owned_draft(
    *,
    db: AsyncSession,
    user_id: str,
    draft_id: Optional[str],
) -> Optional[DraftSession]:
    if not draft_id:
        return None

    result = await db.execute(
        select(DraftSession).where(
            DraftSession.user_id == user_id,
            DraftSession.lifecycle_status != "DELETED",
            (DraftSession.id == draft_id) | (DraftSession.local_draft_id == draft_id),
        )
    )
    draft = result.scalars().first()
    if draft is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found or is not owned by this student.",
        )
    return draft


def _verify_draft_matches_submission(
    *,
    draft: DraftSession,
    payload: KeystrokeSessionAnalyzeRequest,
    user_id: str,
    submission_evidence_hash: str,
) -> None:
    if draft.submitted_session_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This draft is already linked to a submitted session.",
        )

    draft_text = decrypt_text(draft.text_content) or ""
    draft_events = decrypt_json(draft.keystroke_array) or []
    if not isinstance(draft_events, list):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The saved draft evidence is malformed and cannot be submitted.",
        )

    draft_canonical = compute_canonical_evidence(
        title=normalize_title(draft.title),
        text_content=draft_text,
        keystroke_array=draft_events,
        user_id=user_id,
        client_stats=payload.stats,
        client_active_duration_ms=int(draft.active_duration_ms or 0),
    )
    if draft_canonical.evidence_hash != submission_evidence_hash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "The submitted evidence no longer matches the server-synced draft. "
                "Save the latest draft and retry."
            ),
        )


def _store_analysis_response(session: TypingSession, response: AnalysisResponse) -> None:
    metadata = dict(session.evidence_metadata or {})
    metadata["analysis_response"] = response.model_dump(mode="json")
    session.evidence_metadata = metadata


@router.post(
    "/analyze",
    response_model=AnalysisResponse,
    status_code=status.HTTP_201_CREATED,
)
async def analyze_session(
    payload: KeystrokeSessionAnalyzeRequest,
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
) -> AnalysisResponse:
    user_id = str(current_user.id)
    events = payload.event_dicts()
    title = normalize_title(payload.title)

    canonical = compute_canonical_evidence(
        title=title,
        text_content=payload.text_content,
        keystroke_array=events,
        user_id=user_id,
        client_stats=payload.stats,
        client_active_duration_ms=payload.active_duration_ms,
    )

    existing = await _load_idempotent_response(
        db=db,
        user_id=user_id,
        submission_id=payload.submission_id,
        expected_evidence_hash=canonical.evidence_hash,
    )
    if existing is not None:
        # Preserve the original idempotency contract across deployments. A
        # historical session may predate strict replay validation, but an exact
        # retry must still return the committed result rather than create a new
        # failure mode after an upgrade.
        response.status_code = status.HTTP_200_OK
        return existing

    try:
        validate_evidence_text(
            events=events,
            expected_text=payload.text_content,
        )
    except EvidenceReplayMismatch as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    _validate_event_stream(
        event_counts=canonical.event_counts,
        text_content=payload.text_content,
    )
    server_stats = _stats_from_dict(canonical.stats)

    course = await _ensure_student_can_submit_to_course(
        db=db,
        student_id=user_id,
        course_id=payload.course_id,
    )
    draft = await _load_owned_draft(
        db=db,
        user_id=user_id,
        draft_id=payload.draft_id,
    )
    if draft is not None:
        _verify_draft_matches_submission(
            draft=draft,
            payload=payload,
            user_id=user_id,
            submission_evidence_hash=canonical.evidence_hash,
        )

    try:
        result = inference_engine.analyze(
            events=events,
            stats=server_stats,
            text_content=payload.text_content,
        )
    except InferenceInputError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except InferenceInternalError as exc:
        # No session, certificate, audit or notification objects have been added.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Analysis is temporarily unavailable. No evidence record was created.",
        ) from exc

    classification = _normalize_result_label(result.classification)
    confidence_score = _clamp_score(result.confidence_score)
    risk_score = _clamp_score(result.risk_score)
    risk_level = _normalize_risk_level(result.risk_level, risk_score)

    paste_policy = apply_paste_policy(
        result=result,
        event_counts=canonical.event_counts,
        text_content=payload.text_content,
        classification=classification,
        confidence_score=confidence_score,
        risk_score=risk_score,
        risk_level=risk_level,
    )
    classification = str(paste_policy["classification"])
    confidence_score = _clamp_score(paste_policy["confidence_score"])
    risk_score = _clamp_score(paste_policy["risk_score"])
    risk_level = _normalize_risk_level(paste_policy["risk_level"], risk_score)

    advanced_stats = dict(paste_policy["advanced_stats"] or {})
    decision_source = str(
        advanced_stats.get("decision_source")
        or result.decision_source
        or "UNKNOWN"
    )
    model_available = bool(advanced_stats.get("model_available", False))
    degraded_analysis = bool(
        advanced_stats.get("degraded_analysis", not model_available)
    )
    advanced_stats.update(
        {
            "canonical_evidence": canonical.evidence_metadata,
            "evidence_hash": canonical.evidence_hash,
            "duration_source": canonical.evidence_metadata.get("duration_source"),
            "idle_break_count": canonical.evidence_metadata.get("idle_break_count", 0),
            "decision_source": decision_source,
            "model_available": model_available,
            "degraded_analysis": degraded_analysis,
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

    session = TypingSession(
        user_id=user_id,
        submission_id=payload.submission_id,
        course_id=payload.course_id,
        title=title,
        text_content=encrypt_text(payload.text_content),
        raw_keystroke_data=encrypt_json(events),
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
        decision_source=decision_source,
        model_available=model_available,
        degraded_analysis=degraded_analysis,
        canonical_stats_json=canonical.canonical_stats_json,
        evidence_metadata={
            **canonical.evidence_metadata,
            "client_metadata": dict(payload.client_metadata),
            "analysis_versions": {
                "scoring_engine_version": str(
                    advanced_stats.get("scoring_engine_version")
                    or SCORING_ENGINE_VERSION
                ),
                "paste_policy_version": str(
                    advanced_stats.get("paste_policy_version")
                    or PASTE_POLICY_VERSION
                ),
                "model_version": str(model_version),
                "model_feature_family": advanced_stats.get("model_feature_family"),
                "decision_source": decision_source,
                "model_available": model_available,
                "degraded_analysis": degraded_analysis,
            },
        },
        active_duration_ms=canonical.active_duration_ms,
        idle_breaks_json=canonical.idle_breaks,
        risk_level=risk_level,
        review_status=(
            "PENDING" if payload.course_id is not None else "NOT_APPLICABLE"
        ),
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

    if draft is not None:
        draft.lifecycle_status = "SUBMITTED"
        draft.sync_status = "SYNCED"
        draft.submitted_session_id = int(session.id)
        draft.conflict_payload = {
            "submitted_session_id": int(session.id),
            "submitted_from": "sessions.analyze",
            "submission_id": payload.submission_id,
            "evidence_hash": canonical.evidence_hash,
        }
        db.add(draft)

    analysis_response = AnalysisResponse(
        classification=classification,
        confidence_score=confidence_score,
        kill_switch_triggered=bool(paste_policy["kill_switch_triggered"]),
        kill_switch_reason=paste_policy["kill_switch_reason"],
        advanced_stats=advanced_stats,
        stats=server_stats,
        session_id=int(session.id),
        certificate_id=certificate_id,
        document_hash=canonical.document_hash,
        risk_level=risk_level,
        risk_score=risk_score,
        evidence_hash=canonical.evidence_hash,
        canonical_stats=canonical.canonical_stats_json,
        submission_id=payload.submission_id,
        idempotent_replay=False,
        decision_source=decision_source,
        model_available=model_available,
        degraded_analysis=degraded_analysis,
    )
    _store_analysis_response(session, analysis_response)

    db.add(
        create_audit_log(
            event_type="SESSION_ANALYZED",
            entity_type="typing_session",
            entity_id=str(session.id),
            actor_user_id=user_id,
            target_user_id=user_id,
            request=request,
            metadata={
                "submission_id": payload.submission_id,
                "certificate_id": certificate_id,
                "classification": classification,
                "risk_level": risk_level,
                "evidence_hash": canonical.evidence_hash,
                "draft_id": payload.draft_id,
                "model_version": str(model_version),
                "model_score": model_score,
                "decision_source": decision_source,
                "model_available": model_available,
                "degraded_analysis": degraded_analysis,
                "scoring_engine_version": str(
                    advanced_stats.get("scoring_engine_version")
                    or SCORING_ENGINE_VERSION
                ),
                "paste_policy_version": str(
                    advanced_stats.get("paste_policy_version")
                    or PASTE_POLICY_VERSION
                ),
            },
        )
    )
    db.add(
        create_audit_log(
            event_type="CERTIFICATE_CREATED",
            entity_type="certificate",
            entity_id=certificate_id,
            actor_user_id=user_id,
            target_user_id=user_id,
            request=request,
            metadata={
                "session_id": int(session.id),
                "submission_id": payload.submission_id,
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
    except IntegrityError as exc:
        await db.rollback()
        replay = await _load_idempotent_response(
            db=db,
            user_id=user_id,
            submission_id=payload.submission_id,
            expected_evidence_hash=canonical.evidence_hash,
        )
        if replay is not None:
            response.status_code = status.HTTP_200_OK
            return replay
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The evidence submission conflicts with an existing record.",
        ) from exc
    except Exception:
        await db.rollback()
        raise

    if course is not None:
        background_tasks.add_task(
            dispatch_notification,
            recipient_id=course.teacher_id,
            actor_id=user_id,
            event_type="SESSION_SUBMITTED",
            entity_type="typing_session",
            entity_id=str(session.id),
            title=f'{current_user.first_name} submitted "{title}"',
            body=(
                f"Classification: {classification} · Risk: {risk_level}"
                + (" · Degraded analysis" if degraded_analysis else "")
            ),
            action_url=f"/teacher/submissions?search={session.id}",
        )

    return analysis_response
