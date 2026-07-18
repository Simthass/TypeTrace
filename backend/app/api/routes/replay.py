# backend/app/api/routes/replay.py

import json
from datetime import datetime, timezone
from statistics import mean
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import create_engine, text

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.crypto import decrypt_json, decrypt_text
from app.models.user import User


router = APIRouter()

sync_engine = create_engine(settings.sync_database_url, pool_pre_ping=True)


LONG_PAUSE_THRESHOLD_MS = 2000
COGNITIVE_PAUSE_THRESHOLD_MS = 5000
MAX_REPLAY_EVENTS = 25000


def _format_datetime(value: Any) -> str:
    if value is None:
        return "Unknown"

    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    return str(value)


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        result = float(value)
        if result != result:
            return default
        return result
    except (TypeError, ValueError):
        return default


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _is_keyup_event(event: Dict[str, Any]) -> bool:
    return str(event.get("type") or "").lower() == "keyup"


def _is_delete_keydown_event(event: Dict[str, Any]) -> bool:
    return (
        str(event.get("type") or "").lower() == "keydown"
        and event.get("key") in {"Backspace", "Delete"}
    )


def _event_deleted_characters(event: Dict[str, Any]) -> int:
    if _is_keyup_event(event):
        return 0

    explicit = event.get("chars_deleted", event.get("deletedCharacters"))
    value = _safe_float(explicit)
    if value > 0:
        return max(0, int(round(value)))
    if _is_delete_keydown_event(event):
        return 1
    return 0


def _classification_bucket(value: Optional[str]) -> str:
    normalized = str(value or "UNKNOWN").upper()

    if normalized == "HUMAN":
        return "HUMAN"

    if normalized == "SUSPICIOUS":
        return "SUSPICIOUS"

    if normalized in {"SYNTHETIC", "AI", "AI-GENERATED"}:
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


def _parse_raw_events(value: Any) -> List[Dict[str, Any]]:
    if value is None:
        return []

    if isinstance(value, list):
        return [event for event in value if isinstance(event, dict)]

    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return [event for event in parsed if isinstance(event, dict)]
        except json.JSONDecodeError:
            return []

    return []


def _normalize_key(event: Dict[str, Any]) -> str:
    key = str(event.get("key") or "")

    if key == " ":
        return "Space"

    if key == "__PASTE_EVENT__":
        return "Paste"

    return key or "Unknown"


def _normalize_events(raw_events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not raw_events:
        return []

    timestamps = [
        _safe_float(event.get("timestamp"))
        for event in raw_events
        if event.get("timestamp") is not None
    ]

    start_timestamp = min(timestamps) if timestamps else 0

    normalized: List[Dict[str, Any]] = []

    for index, event in enumerate(raw_events):
        timestamp = _safe_float(event.get("timestamp"))
        relative_time_ms = max(0, timestamp - start_timestamp)

        event_type = str(event.get("type") or "keydown")
        key = str(event.get("key") or "")
        is_paste = key == "__PASTE_EVENT__" or event_type == "paste"
        deleted_characters = _event_deleted_characters(event)
        deletion_method = str(event.get("deletion_method") or "")
        is_deletion = (
            not _is_keyup_event(event)
            and (
                _is_delete_keydown_event(event)
                or key in {"__CUT_EVENT__", "__TEXT_REVISION__"}
                or deleted_characters > 0
                or bool(deletion_method)
            )
        )
        flight_time = event.get("flight_time")
        dwell_time = event.get("dwell_time")

        normalized_event = {
            "event_index": index,
            "key": "__PASTE_EVENT__" if is_paste else key,
            "display_key": _normalize_key(event),
            "keyCode": _safe_int(event.get("keyCode")),
            "code": event.get("code"),
            "type": "paste" if is_paste else event_type,
            "timestamp": timestamp,
            "relative_time_ms": round(relative_time_ms, 2),
            "down_time": event.get("down_time"),
            "up_time": event.get("up_time"),
            "dwell_time": dwell_time,
            "flight_time": flight_time,
            "documentLength": _safe_int(event.get("documentLength")),
            "cursorPosition": _safe_int(event.get("cursorPosition")),
            "pastedLength": _safe_int(event.get("pastedLength")),
            "inputType": event.get("inputType"),
            "revision_id": event.get("revision_id"),
            "deletedCharacters": deleted_characters,
            "chars_deleted": deleted_characters,
            "selection_length_before": _safe_int(event.get("selection_length_before")),
            "deletion_method": deletion_method or None,
            "is_bulk_deletion": bool(event.get("isBulkDeletion") or event.get("bulk_deletion") or deleted_characters >= 2),
            "documentLengthBefore": _safe_int(event.get("documentLengthBefore")),
            "documentLengthAfter": _safe_int(event.get("documentLengthAfter")),
            "deltaLength": _safe_int(event.get("deltaLength")),
            "insertedCharacters": _safe_int(event.get("insertedCharacters")),
            "inserted_text": event.get("insertedText") or event.get("inserted_text"),
            "is_paste": is_paste,
            "is_deletion": is_deletion,
            "is_enter": key == "Enter",
            "is_space": key == " ",
            "is_pause": flight_time is not None and _safe_float(flight_time) >= LONG_PAUSE_THRESHOLD_MS,
            "is_cognitive_pause": flight_time is not None and _safe_float(flight_time) >= COGNITIVE_PAUSE_THRESHOLD_MS,
        }

        normalized.append(normalized_event)

    return normalized


def _compute_replay_metrics(
    events: List[Dict[str, Any]],
    row: Dict[str, Any],
) -> Dict[str, Any]:
    keydown_events = [
        event
        for event in events
        if event.get("type") == "keydown" and not event.get("is_paste")
    ]

    dwell_times = [
        _safe_float(event.get("dwell_time"))
        for event in keydown_events
        if event.get("dwell_time") is not None and 10 <= _safe_float(event.get("dwell_time")) <= 2000
    ]

    flight_times = [
        _safe_float(event.get("flight_time"))
        for event in keydown_events
        if event.get("flight_time") is not None and _safe_float(event.get("flight_time")) > 0
    ]

    pause_events = [
        event for event in events if event.get("is_pause")
    ]

    cognitive_pauses = [
        event for event in events if event.get("is_cognitive_pause")
    ]

    paste_events = [
        event for event in events if event.get("is_paste")
    ]

    deletion_events = [
        event for event in events if event.get("is_deletion")
    ]

    total_keys = max(len(keydown_events), 1)
    active_intervals = [
        value for value in flight_times if value < LONG_PAUSE_THRESHOLD_MS
    ]

    mean_dwell = mean(dwell_times) if dwell_times else 0
    mean_flight = mean(flight_times) if flight_times else 0
    longest_pause = max(flight_times) if flight_times else 0

    deleted_characters = sum(_safe_int(event.get("deletedCharacters")) for event in deletion_events)
    bulk_deletions = [event for event in deletion_events if event.get("is_bulk_deletion")]
    largest_deletion = max([_safe_int(event.get("deletedCharacters")) for event in deletion_events] or [0])

    deletion_ratio = len(deletion_events) / total_keys
    deleted_character_ratio = deleted_characters / max(len(row.get("text_content") or ""), 1)
    paste_ratio = len(paste_events) / total_keys
    active_time_pct = (
        round((len(active_intervals) / len(flight_times)) * 100)
        if flight_times
        else 0
    )

    pause_density = len(pause_events) / total_keys

    return {
        "avg_iki": round(_safe_float(row.get("avg_iki")) or mean_flight, 1),
        "dwell_time": round(mean_dwell, 1),
        "deletion_ratio": round(deletion_ratio, 4),
        "deleted_characters": deleted_characters,
        "deleted_character_ratio": round(deleted_character_ratio, 4),
        "bulk_deletion_events": len(bulk_deletions),
        "largest_deletion_chars": largest_deletion,
        "paste_count": len(paste_events),
        "paste_ratio": round(paste_ratio, 4),
        "longest_pause_ms": round(longest_pause, 1),
        "burst_count": _safe_int(row.get("pauses")),
        "wpm": round(_safe_float(row.get("wpm")), 1),
        "active_time_pct": active_time_pct,
        "pause_count": len(pause_events),
        "cognitive_pause_count": len(cognitive_pauses),
        "pause_density": round(pause_density, 4),
        "total_events": len(events),
        "keydown_events": len(keydown_events),
        "deletion_count": len(deletion_events),
        "deleted_characters": deleted_characters,
        "bulk_deletion_events": len(bulk_deletions),
        "largest_deletion_chars": largest_deletion,
        "mean_flight_ms": round(mean_flight, 1),
        "mean_dwell_ms": round(mean_dwell, 1),
    }


def _build_timeline_markers(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    markers: List[Dict[str, Any]] = []

    for event in events:
        marker_type = None
        label = None

        if event.get("is_paste"):
            marker_type = "paste"
            label = f"Paste event ({event.get('pastedLength', 0)} chars)"
        elif event.get("is_deletion"):
            marker_type = "deletion"
            label = "Deletion"
        elif event.get("is_cognitive_pause"):
            marker_type = "cognitive_pause"
            label = f"Cognitive pause ({round(_safe_float(event.get('flight_time')) / 1000, 1)}s)"
        elif event.get("is_pause"):
            marker_type = "pause"
            label = f"Pause ({round(_safe_float(event.get('flight_time')) / 1000, 1)}s)"

        if marker_type:
            markers.append(
                {
                    "type": marker_type,
                    "label": label,
                    "event_index": event.get("event_index"),
                    "relative_time_ms": event.get("relative_time_ms"),
                    "key": event.get("display_key"),
                }
            )

    return markers


def _fetch_replay_row(session_id: int) -> Optional[Dict[str, Any]]:
    with sync_engine.connect() as conn:
        row = conn.execute(
            text(
                """
                SELECT
                    ts.id,
                    ts.user_id,
                    ts.course_id,
                    ts.title,
                    ts.text_content,
                    ts.word_count,
                    ts.wpm,
                    ts.total_keystrokes,
                    ts.deletions,
                    ts.pauses,
                    ts.avg_iki,
                    ts.duration_seconds,
                    ts.classification_result,
                    ts.ml_confidence_score,
                    ts.raw_keystroke_data,
                    ts.certificate_id,
                    ts.document_hash,
                    ts.review_status,
                    ts.review_notes,
                    ts.risk_level,
                    ts.created_at,

                    u.first_name,
                    u.last_name,
                    u.email,
                    u.student_id,

                    c.course_name,
                    c.course_code,
                    c.teacher_id
                FROM typing_sessions ts
                JOIN users u ON u.id = ts.user_id
                LEFT JOIN courses c ON c.id = ts.course_id
                WHERE ts.id = :session_id
                LIMIT 1
                """
            ),
            {"session_id": session_id},
        ).mappings().fetchone()

    return dict(row) if row else None


def _authorize_replay_access(row: Dict[str, Any], user: User) -> None:
    user_id = str(user.id)
    role = str(user.role).upper()

    if role == "STUDENT" and str(row.get("user_id")) == user_id:
        return

    if role == "TEACHER" and row.get("teacher_id") and str(row.get("teacher_id")) == user_id:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied for this replay.",
    )


@router.get("/replay/{session_id}")
async def get_replay_audit(
    session_id: int,
    response: Response,
    current_user: User = Depends(get_current_user),
):
    """
    Clean replay/audit endpoint for both students and teachers.

    Students can replay their own sessions.
    Teachers can replay submissions linked to their courses.
    """
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"

    if session_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session ID.",
        )

    row = _fetch_replay_row(session_id)

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    _authorize_replay_access(row, current_user)

    decrypted_raw = decrypt_json(row.get("raw_keystroke_data"))
    raw_events = _parse_raw_events(decrypted_raw)
    events = _normalize_events(raw_events)
    is_truncated = len(events) > MAX_REPLAY_EVENTS

    if is_truncated:
        events = events[:MAX_REPLAY_EVENTS]

    metrics = _compute_replay_metrics(events, row)
    timeline_markers = _build_timeline_markers(events)

    classification = row.get("classification_result") or "UNKNOWN"
    duration_seconds = _safe_float(row.get("duration_seconds"))
    duration_ms = round(duration_seconds * 1000)

    word_count = int(row.get("word_count") or 0)

    return {
        "status": "success",
        "session": {
            "id": row["id"],
            "title": row.get("title") or "Untitled Document",
            "classification": classification,
            "classification_bucket": _classification_bucket(classification),
            "confidence": round(_safe_float(row.get("ml_confidence_score")), 2),
            "risk_level": _risk_level(classification, row.get("risk_level")),
            "duration_ms": duration_ms,
            "duration_seconds": round(duration_seconds, 1),
            "word_count": word_count,
            "student_name": f"{row.get('first_name') or ''} {row.get('last_name') or ''}".strip(),
            "student_id": row.get("student_id") or "",
            "student_email": row.get("email") or "",
            "course_id": row.get("course_id"),
            "course_name": row.get("course_name"),
            "course_code": row.get("course_code"),
            "certificate_id": row.get("certificate_id"),
            "document_hash": row.get("document_hash"),
            "review_status": row.get("review_status") or "PENDING",
            "review_notes": row.get("review_notes") or "",
            "created_at": _format_datetime(row.get("created_at")),
        },
        "metrics": metrics,
        "events": events,
        "timeline_markers": timeline_markers,
        "audit": {
            "total_raw_events": len(raw_events),
            "total_normalized_events": len(events),
            "has_paste_events": metrics["paste_count"] > 0,
            "has_cognitive_pauses": metrics["cognitive_pause_count"] > 0,
            "has_deletions": metrics["deletion_count"] > 0,
            "integrity_hash": row.get("document_hash"),
            "is_truncated": is_truncated,
            "max_events_returned": MAX_REPLAY_EVENTS,
        },
    }


@router.get("/sessions/{session_id}/replay")
async def get_session_replay_compatible(
    session_id: int,
    response: Response,
    current_user: User = Depends(get_current_user),
):
    """
    Compatibility route for frontend replay links.

    Returns the same payload as /api/v1/replay/{session_id}.
    """
    return await get_replay_audit(
        session_id=session_id,
        response=response,
        current_user=current_user,
    )