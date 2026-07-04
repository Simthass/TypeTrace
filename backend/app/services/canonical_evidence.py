
import hashlib
import json
import math
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional


IDLE_BREAK_THRESHOLD_MS = 30_000
MAX_REASONABLE_ACTIVE_DURATION_MS = 1000 * 60 * 60 * 24
MAX_REASONABLE_FLIGHT_TIME_MS = 30_000
LONG_PAUSE_MS = 1_000


@dataclass(frozen=True)
class CanonicalEvidenceResult:
    """Server-side source of truth for submitted writing evidence."""

    stats: Dict[str, Any]
    event_counts: Dict[str, int]
    revision_metrics: Dict[str, int]
    idle_breaks: List[Dict[str, Any]]
    evidence_metadata: Dict[str, Any]
    active_duration_ms: int
    document_hash: str
    evidence_hash: str
    canonical_stats_json: Dict[str, Any]


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )


def sha256_hex(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def safe_number(value: Any) -> Optional[float]:
    try:
        number = float(value)
        if math.isnan(number) or math.isinf(number):
            return None
        return number
    except (TypeError, ValueError):
        return None


def safe_int(value: Any, default: int = 0) -> int:
    number = safe_number(value)
    if number is None:
        return default
    return max(0, int(round(number)))


def count_words(value: str) -> int:
    clean = (value or "").strip()
    return len(clean.split()) if clean else 0


def normalize_title(title: str) -> str:
    clean = (title or "").strip()
    return clean[:255] if clean else "Untitled Document"


def event_type(event: Dict[str, Any]) -> str:
    return str(event.get("type") or "").strip().lower()


def event_key(event: Dict[str, Any]) -> str:
    return str(event.get("key") or "")


def event_timestamp(event: Dict[str, Any]) -> Optional[float]:
    return safe_number(event.get("timestamp"))


def is_keyup_event(event: Dict[str, Any]) -> bool:
    return event_type(event) == "keyup"


def is_keydown_event(event: Dict[str, Any]) -> bool:
    return event_type(event) == "keydown"


def is_paste_event(event: Dict[str, Any]) -> bool:
    return event_type(event) == "paste" or event_key(event) == "__PASTE_EVENT__"


def is_cut_event(event: Dict[str, Any]) -> bool:
    return event_type(event) == "cut" or event_key(event) == "__CUT_EVENT__"


def is_idle_break_event(event: Dict[str, Any]) -> bool:
    return event_key(event) == "__IDLE_BREAK__" or str(event.get("inputType") or "") == "historyIdleBreak"


def is_delete_keydown_event(event: Dict[str, Any]) -> bool:
    return is_keydown_event(event) and event_key(event) in {"Backspace", "Delete"}


def sanitize_flight_time(value: Any) -> Optional[float]:
    number = safe_number(value)
    if number is None or number <= 0:
        return None
    if number > MAX_REASONABLE_FLIGHT_TIME_MS:
        return None
    return number


def sanitize_dwell_time(value: Any) -> Optional[float]:
    number = safe_number(value)
    if number is None or number <= 0:
        return None
    if number > 2_000:
        return None
    return number


def event_deleted_characters(event: Dict[str, Any]) -> int:
    if is_keyup_event(event):
        return 0

    explicit = safe_number(event.get("chars_deleted", event.get("deletedCharacters")))
    if explicit is not None and explicit > 0:
        return max(0, int(round(explicit)))

    if is_delete_keydown_event(event):
        return 1

    return 0


def is_deletion_evidence(event: Dict[str, Any]) -> bool:
    if is_keyup_event(event):
        return False

    method = str(event.get("deletion_method") or "unknown").lower()
    return (
        event_deleted_characters(event) > 0
        or is_delete_keydown_event(event)
        or event_key(event) in {"__CUT_EVENT__", "__TEXT_REVISION__"}
        or method != "unknown"
    )


def compute_revision_metrics(events: List[Dict[str, Any]]) -> Dict[str, int]:
    revisions: Dict[str, Dict[str, Any]] = {}

    for index, event in enumerate(events):
        if not isinstance(event, dict) or not is_deletion_evidence(event):
            continue

        deleted_chars = event_deleted_characters(event)
        revision_id = str(
            event.get("revision_id")
            or f"{event.get('timestamp', 0)}-{event.get('type', '')}-{event.get('key', '')}-{index}"
        )
        method = str(event.get("deletion_method") or "unknown").lower()
        selection_len = safe_int(event.get("selection_length_before"))
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
        existing["cut"] = bool(existing["cut"]) or method == "cut" or is_cut_event(event)
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


def clean_events(raw_events: Iterable[Any]) -> List[Dict[str, Any]]:
    cleaned: List[Dict[str, Any]] = []

    for raw in raw_events or []:
        if not isinstance(raw, dict):
            continue

        event = dict(raw)
        timestamp = event_timestamp(event)
        if timestamp is not None:
            event["timestamp"] = timestamp

        flight = sanitize_flight_time(event.get("flight_time"))
        event["flight_time"] = flight

        dwell = sanitize_dwell_time(event.get("dwell_time"))
        event["dwell_time"] = dwell

        cleaned.append(event)

    return cleaned


def event_counts(events: List[Dict[str, Any]]) -> Dict[str, int]:
    keydown_count = 0
    paste_count = 0
    cut_count = 0
    pasted_length = 0
    idle_break_count = 0

    for event in events:
        if is_keydown_event(event):
            keydown_count += 1
        if is_paste_event(event):
            paste_count += 1
            pasted_length += safe_int(event.get("pastedLength"))
        if is_cut_event(event):
            cut_count += 1
        if is_idle_break_event(event):
            idle_break_count += 1

    return {
        "keydown_count": keydown_count,
        "paste_count": paste_count,
        "cut_count": cut_count,
        "pasted_length": pasted_length,
        "idle_break_count": idle_break_count,
        "event_count": len(events),
    }


def activity_timestamps(events: List[Dict[str, Any]]) -> List[float]:
    values: List[float] = []

    for event in events:
        if is_keyup_event(event):
            continue
        timestamp = event_timestamp(event)
        if timestamp is not None:
            values.append(timestamp)

    return values


def compute_idle_breaks(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    timestamps = activity_timestamps(events)
    idle_breaks: List[Dict[str, Any]] = []

    previous: Optional[float] = None
    for timestamp in timestamps:
        if previous is not None:
            gap = max(0.0, timestamp - previous)
            if gap > IDLE_BREAK_THRESHOLD_MS:
                idle_breaks.append(
                    {
                        "started_after_ms": int(round(previous)),
                        "resumed_at_ms": int(round(timestamp)),
                        "duration_ms": int(round(gap)),
                        "source": "event_gap",
                    }
                )
        previous = timestamp

    # Preserve explicit frontend idle markers as metadata too. They are not used
    # to add active duration, but they make replay/audit explanations clearer.
    for event in events:
        if not is_idle_break_event(event):
            continue
        timestamp = event_timestamp(event)
        explicit_duration = safe_number(event.get("idleBreakMs") or event.get("idle_break_ms"))
        if timestamp is None or explicit_duration is None:
            continue
        idle_breaks.append(
            {
                "started_after_ms": int(round(timestamp - explicit_duration)),
                "resumed_at_ms": int(round(timestamp)),
                "duration_ms": int(round(max(0.0, explicit_duration))),
                "source": "idle_marker",
            }
        )

    # Deduplicate close duplicates.
    unique: Dict[str, Dict[str, Any]] = {}
    for item in idle_breaks:
        key = f"{item['resumed_at_ms']}:{item['duration_ms']}"
        unique[key] = item

    return sorted(unique.values(), key=lambda item: item["resumed_at_ms"])


def reconstruct_active_duration_ms(events: List[Dict[str, Any]]) -> int:
    timestamps = activity_timestamps(events)
    if len(timestamps) < 2:
        return 1000 if events else 0

    active_ms = 0.0
    previous = timestamps[0]

    for timestamp in timestamps[1:]:
        gap = max(0.0, timestamp - previous)
        if gap <= IDLE_BREAK_THRESHOLD_MS:
            active_ms += gap
        previous = timestamp

    return int(max(1000, min(round(active_ms), MAX_REASONABLE_ACTIVE_DURATION_MS)))


def select_active_duration_ms(
    *,
    events: List[Dict[str, Any]],
    client_active_duration_ms: Any = None,
    client_session_seconds: Any = None,
) -> Dict[str, Any]:
    reconstructed = reconstruct_active_duration_ms(events)
    explicit = safe_number(client_active_duration_ms)

    if explicit is not None and 0 <= explicit <= MAX_REASONABLE_ACTIVE_DURATION_MS:
        explicit = float(round(explicit))
    else:
        explicit = None

    if reconstructed > 0 and explicit is not None:
        # Accept the frontend active clock only if it is close to what the raw
        # event stream proves. Otherwise use the raw-event reconstruction.
        tolerance = max(3000.0, reconstructed * 0.2)
        if explicit <= reconstructed + tolerance:
            return {
                "active_duration_ms": int(max(1000, explicit)),
                "duration_source": "client_active_duration_verified",
                "reconstructed_active_duration_ms": reconstructed,
            }

        return {
            "active_duration_ms": reconstructed,
            "duration_source": "server_reconstructed_active_duration",
            "reconstructed_active_duration_ms": reconstructed,
            "rejected_client_active_duration_ms": int(explicit),
        }

    if reconstructed > 0:
        return {
            "active_duration_ms": reconstructed,
            "duration_source": "server_reconstructed_active_duration",
            "reconstructed_active_duration_ms": reconstructed,
        }

    session_seconds = safe_number(client_session_seconds)
    if session_seconds is not None and session_seconds > 0:
        return {
            "active_duration_ms": int(min(session_seconds * 1000, MAX_REASONABLE_ACTIVE_DURATION_MS)),
            "duration_source": "client_session_seconds_fallback",
            "reconstructed_active_duration_ms": reconstructed,
        }

    return {
        "active_duration_ms": 0,
        "duration_source": "empty_or_unavailable",
        "reconstructed_active_duration_ms": reconstructed,
    }


def timing_values(events: List[Dict[str, Any]]) -> Dict[str, List[float]]:
    dwell_values: List[float] = []
    flight_values: List[float] = []

    for event in events:
        if not is_keydown_event(event):
            continue

        dwell = sanitize_dwell_time(event.get("dwell_time"))
        if dwell is not None:
            dwell_values.append(dwell)

        flight = sanitize_flight_time(event.get("flight_time"))
        if flight is not None:
            flight_values.append(flight)

    return {
        "dwell_values": dwell_values,
        "flight_values": flight_values,
    }


def compute_canonical_evidence(
    *,
    title: str,
    text_content: str,
    keystroke_array: List[Dict[str, Any]],
    user_id: str,
    client_stats: Any = None,
    client_active_duration_ms: Any = None,
) -> CanonicalEvidenceResult:
    events = clean_events(keystroke_array)
    counts = event_counts(events)
    revision = compute_revision_metrics(events)
    timings = timing_values(events)
    idle_breaks = compute_idle_breaks(events)

    client_session_seconds = None
    if client_stats is not None:
        if isinstance(client_stats, dict):
            client_session_seconds = client_stats.get("sessionSeconds")
        else:
            client_session_seconds = getattr(client_stats, "sessionSeconds", None)

    duration_info = select_active_duration_ms(
        events=events,
        client_active_duration_ms=client_active_duration_ms,
        client_session_seconds=client_session_seconds,
    )
    active_duration_ms = int(duration_info["active_duration_ms"])
    session_seconds = max(1.0, round(active_duration_ms / 1000, 2)) if events else 0.0

    word_count = count_words(text_content)
    char_count = len(text_content or "")
    wpm = round((word_count / session_seconds) * 60, 2) if session_seconds > 0 else 0.0

    flight_values = timings["flight_values"]
    pauses = sum(1 for value in flight_values if LONG_PAUSE_MS < value <= MAX_REASONABLE_FLIGHT_TIME_MS)
    avg_iki = round(sum(flight_values) / len(flight_values), 2) if flight_values else 0.0

    paste_ratio = round(counts["pasted_length"] / char_count, 4) if char_count > 0 else 0.0
    deletion_ratio = round(revision["delete_actions"] / max(1, counts["keydown_count"]), 4)
    deleted_character_ratio = round(revision["deleted_characters"] / max(1, char_count), 4)

    stats = {
        "wpm": wpm,
        "keystrokes": counts["keydown_count"],
        "deletions": revision["delete_actions"],
        "deletedCharacters": revision["deleted_characters"],
        "bulkDeletionEvents": revision["bulk_deletion_events"],
        "largestDeletionChars": revision["largest_deletion_chars"],
        "selectionDeletionEvents": revision["selection_deletion_events"],
        "wordDeletionEvents": revision["word_deletion_events"],
        "cutEvents": revision["cut_events"],
        "pauses": pauses,
        "avgIki": avg_iki,
        "sessionSeconds": session_seconds,
    }

    evidence_metadata = {
        "word_count": word_count,
        "character_count": char_count,
        "event_count": counts["event_count"],
        "paste_count": counts["paste_count"],
        "cut_count": counts["cut_count"],
        "pasted_length": counts["pasted_length"],
        "paste_ratio": paste_ratio,
        "deletion_ratio": deletion_ratio,
        "deleted_character_ratio": deleted_character_ratio,
        "idle_break_count": len(idle_breaks),
        "idle_break_duration_ms": sum(int(item["duration_ms"]) for item in idle_breaks),
        "duration_source": duration_info["duration_source"],
        "reconstructed_active_duration_ms": duration_info["reconstructed_active_duration_ms"],
    }
    if "rejected_client_active_duration_ms" in duration_info:
        evidence_metadata["rejected_client_active_duration_ms"] = duration_info[
            "rejected_client_active_duration_ms"
        ]

    normalized_title = normalize_title(title)
    document_hash = sha256_hex(
        {
            "title": normalized_title,
            "text_content": text_content or "",
        }
    )

    canonical_stats_json = {
        "stats": stats,
        "event_counts": counts,
        "revision_metrics": revision,
        "evidence_metadata": evidence_metadata,
        "idle_breaks": idle_breaks,
    }

    evidence_hash = sha256_hex(
        {
            "user_id": str(user_id),
            "document_hash": document_hash,
            "keystroke_array": events,
            "canonical_stats": canonical_stats_json,
        }
    )

    return CanonicalEvidenceResult(
        stats=stats,
        event_counts=counts,
        revision_metrics=revision,
        idle_breaks=idle_breaks,
        evidence_metadata=evidence_metadata,
        active_duration_ms=active_duration_ms,
        document_hash=document_hash,
        evidence_hash=evidence_hash,
        canonical_stats_json=canonical_stats_json,
    )
