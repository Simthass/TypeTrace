
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

    # Backward-compatible action count: one revision/delete action, not characters.
    deletions: int = Field(default=0, ge=0)

    # Industry-grade revision metrics. These are derived from raw event metadata,
    # not trusted blindly from the browser summary.
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


def _normalize_title(title: str) -> str:
    clean = (title or "").strip()
    return clean[:255] if clean else "Untitled Document"


def _count_words(value: str) -> int:
    return len((value or "").strip().split()) if (value or "").strip() else 0


def _safe_event_number(value: Any) -> Optional[float]:
    try:
        number = float(value)
        if number != number or number in {float("inf"), float("-inf")}:
            return None
        return number
    except (TypeError, ValueError):
        return None


def _safe_event_int(value: Any, default: int = 0) -> int:
    number = _safe_event_number(value)
    if number is None:
        return default
    return max(0, int(round(number)))


def _is_keyup_event(event: Dict[str, Any]) -> bool:
    return str(event.get("type") or "").lower() == "keyup"


def _is_delete_keydown_event(event: Dict[str, Any]) -> bool:
    return (
        str(event.get("type") or "").lower() == "keydown"
        and event.get("key") in {"Backspace", "Delete"}
    )


def _event_deleted_characters(event: Dict[str, Any]) -> int:
    # Keyup is only the key release signal. It must not count as a second
    # deletion action or another deleted character.
    if _is_keyup_event(event):
        return 0

    explicit = _safe_event_number(
        event.get("chars_deleted", event.get("deletedCharacters"))
    )
    if explicit is not None and explicit > 0:
        return max(0, int(round(explicit)))

    # Legacy fallback for older events without chars_deleted. Apply only to the
    # keydown half of the action, never to keyup.
    if _is_delete_keydown_event(event):
        return 1

    return 0


def _is_deletion_evidence(event: Dict[str, Any]) -> bool:
    if _is_keyup_event(event):
        return False

    return (
        _event_deleted_characters(event) > 0
        or _is_delete_keydown_event(event)
        or event.get("key") in {"__CUT_EVENT__", "__TEXT_REVISION__"}
        or bool(event.get("deletion_method"))
    )


def _compute_revision_metrics(events: List[Dict[str, Any]]) -> Dict[str, int]:
    """
    Compute privacy-safe revision metrics without trusting client summary stats.

    Events sharing the same revision_id are one user action represented by
    multiple browser signals (keydown + input confirmation), so they are merged.
    """
    revisions: Dict[str, Dict[str, Any]] = {}

    for index, event in enumerate(events):
        if not isinstance(event, dict) or not _is_deletion_evidence(event):
            continue

        deleted_chars = _event_deleted_characters(event)
        revision_id = str(
            event.get("revision_id")
            or f"{event.get('timestamp', 0)}-{event.get('type', '')}-{event.get('key', '')}-{index}"
        )
        method = str(event.get("deletion_method") or "unknown").lower()
        selection_len = _safe_event_int(event.get("selection_length_before"))
        bulk_flag = bool(event.get("isBulkDeletion") or event.get("bulk_deletion"))

        existing = revisions.setdefault(
            revision_id,
            {
                "deleted": 0,
                "method": method,
                "selection": 0,
                "bulk": False,
                "cut": False,
            },
        )

        existing["deleted"] = max(int(existing["deleted"]), deleted_chars)
        existing["selection"] = max(int(existing["selection"]), selection_len)
        existing["bulk"] = bool(existing["bulk"]) or bulk_flag or deleted_chars >= 2 or method in {
            "word",
            "line",
            "selection",
            "replacement",
            "cut",
            "all",
        }
        existing["cut"] = bool(existing["cut"]) or method == "cut" or event.get("type") == "cut"
        if existing["method"] == "unknown" and method != "unknown":
            existing["method"] = method

    values = list(revisions.values())

    return {
        "delete_actions": len(values),
        "deleted_characters": sum(max(0, int(item["deleted"])) for item in values),
        "bulk_deletion_events": sum(1 for item in values if item["bulk"]),
        "largest_deletion_chars": max([int(item["deleted"]) for item in values] or [0]),
        "selection_deletion_events": sum(
            1
            for item in values
            if int(item["selection"]) > 0
            or item["method"] in {"selection", "replacement", "all"}
        ),
        "word_deletion_events": sum(1 for item in values if item["method"] == "word"),
        "cut_events": sum(1 for item in values if item["cut"]),
    }


def _compute_server_stats(
    *,
    text_content: str,
    keystroke_array: List[Dict[str, Any]],
    client_stats: SessionStats,
) -> SessionStats:
    """
    Recompute core telemetry from raw events on the backend.

    The frontend still sends live stats for UI responsiveness, but persisted
    evidence must be derived server-side so crash recovery, browser reloads,
    or malicious clients cannot poison the final certificate metrics.
    """

    keydown_events = [
        event
        for event in keystroke_array
        if isinstance(event, dict) and event.get("type") == "keydown"
    ]

    flight_times: List[float] = []
    for event in keydown_events:
        value = _safe_event_number(event.get("flight_time"))
        if value is not None and value > 0:
            flight_times.append(value)

    revision_metrics = _compute_revision_metrics(keystroke_array)
    pauses = sum(1 for value in flight_times if value > 1000)
    avg_iki = (
        round(sum(flight_times) / len(flight_times)) if flight_times else 0
    )

    key_timestamps = [
        _safe_event_number(event.get("timestamp")) for event in keydown_events
    ]
    key_timestamps = [value for value in key_timestamps if value is not None]

    if len(key_timestamps) >= 2:
        duration_seconds = max(
            1.0,
            round((max(key_timestamps) - min(key_timestamps)) / 1000, 2),
        )
    else:
        duration_seconds = max(1.0, float(client_stats.sessionSeconds or 1))

    word_count = _count_words(text_content)
    wpm = round((word_count / duration_seconds) * 60, 2) if duration_seconds > 0 else 0

    return SessionStats(
        wpm=wpm,
        keystrokes=len(keydown_events),
        deletions=revision_metrics["delete_actions"],
        deletedCharacters=revision_metrics["deleted_characters"],
        bulkDeletionEvents=revision_metrics["bulk_deletion_events"],
        largestDeletionChars=revision_metrics["largest_deletion_chars"],
        selectionDeletionEvents=revision_metrics["selection_deletion_events"],
        wordDeletionEvents=revision_metrics["word_deletion_events"],
        cutEvents=revision_metrics["cut_events"],
        pauses=pauses,
        avgIki=avg_iki,
        sessionSeconds=duration_seconds,
    )


def _event_counts(keystroke_array: List[Dict[str, Any]]) -> Dict[str, int]:
    keydown_count = 0
    paste_count = 0
    pasted_length = 0

    for event in keystroke_array:
        if not isinstance(event, dict):
            continue

        if event.get("type") == "keydown":
            keydown_count += 1

        if event.get("type") == "paste" or event.get("key") == "__PASTE_EVENT__":
            paste_count += 1
            try:
                pasted_length += max(0, int(event.get("pastedLength") or 0))
            except (TypeError, ValueError):
                pass

    return {
        "keydown_count": keydown_count,
        "paste_count": paste_count,
        "pasted_length": pasted_length,
    }


def _validate_event_stream(
    *,
    keystroke_array: List[Dict[str, Any]],
    text_content: str,
) -> Dict[str, int]:
    if not isinstance(keystroke_array, list) or not keystroke_array:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Keystroke evidence is required.",
        )

    counts = _event_counts(keystroke_array)
    has_typing_evidence = counts["keydown_count"] >= MINIMUM_KEYSTROKES
    has_paste_evidence = counts["paste_count"] > 0 and bool((text_content or "").strip())

    if not has_typing_evidence and not has_paste_evidence:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"At least {MINIMUM_KEYSTROKES} keydown events or one captured paste "
                "event are required for analysis."
            ),
        )

    return counts


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
    """
    Pure pasted sessions have little or no keydown rhythm, so the ML model can
    produce weak/irrelevant timing predictions. This override makes paste-heavy
    sessions review-safe and deterministic without changing normal human typing.
    """

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
        "confidence_score": max(confidence_score, 98.0),
        "risk_score": max(risk_score, 92.0),
        "risk_level": "HIGH",
        "advanced_stats": advanced_stats,
        "kill_switch_triggered": True,
        "kill_switch_reason": "Paste-dominant writing session detected.",
    }

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


def _clamp_score(value: Any) -> float:
    """Clamp score values to 0-100 range, handling NaN/Infinity."""
    try:
        score = float(value)

        if score != score:  # NaN check
            return 0.0

        return round(max(0.0, min(100.0, score)), 2)
    except (TypeError, ValueError):
        return 0.0


def _normalize_result_label(value: Any) -> str:
    """Normalize classification labels to consistent values."""
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
    """Normalize risk level with fallback to score-based calculation."""
    level = str(value or "").strip().upper()

    if level in {"LOW", "MEDIUM", "HIGH"}:
        return level

    if risk_score >= 70:
        return "HIGH"

    if risk_score >= 40:
        return "MEDIUM"

    return "LOW"


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

    event_counts = _validate_event_stream(
        keystroke_array=payload.keystroke_array,
        text_content=payload.text_content,
    )

    server_stats = _compute_server_stats(
        text_content=payload.text_content,
        keystroke_array=payload.keystroke_array,
        client_stats=payload.stats,
    )

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

    # Normalize and bound all ML outputs before persisting
    classification = _normalize_result_label(result.classification)
    confidence_score = _clamp_score(result.confidence_score)
    risk_score = _clamp_score(result.risk_score)
    risk_level = _normalize_risk_level(result.risk_level, risk_score)

    paste_override = _apply_paste_dominant_override(
        result=result,
        event_counts=event_counts,
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

    title = _normalize_title(payload.title)

    document_hash = _generate_document_hash(
        title=title,
        text_content=payload.text_content,
        keystroke_array=payload.keystroke_array,
        stats=server_stats,
        user_id=str(current_user.id),
    )

    certificate_id = await _create_unique_certificate_id(db)

    session = TypingSession(
        user_id=str(current_user.id),
        course_id=payload.course_id,
        title=title,
        text_content=payload.text_content,
        wpm=float(server_stats.wpm),
        total_keystrokes=int(server_stats.keystrokes),
        deletions=int(server_stats.deletions),
        pauses=int(server_stats.pauses),
        avg_iki=int(server_stats.avgIki),
        duration_seconds=float(server_stats.sessionSeconds),
        ml_confidence_score=confidence_score,
        classification_result=classification,
        raw_keystroke_data=payload.keystroke_array,
        certificate_id=certificate_id,
        document_hash=document_hash,
        risk_level=risk_level,
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
        classification=classification,
        confidence_score=confidence_score,
        kill_switch_triggered=bool(paste_override["kill_switch_triggered"]),
        kill_switch_reason=paste_override["kill_switch_reason"],
        advanced_stats=paste_override["advanced_stats"],
        stats=server_stats,
        session_id=int(session.id),
        certificate_id=certificate_id,
        document_hash=document_hash,
        risk_level=risk_level,
        risk_score=risk_score,
    )

