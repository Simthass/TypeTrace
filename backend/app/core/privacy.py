
import hashlib
import json
from typing import Any, Dict, List, Optional


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def redact_email(email: Optional[str]) -> str:
    if not email:
        return ""

    clean = email.strip().lower()

    if "@" not in clean:
        return "***"

    local, domain = clean.split("@", 1)

    if len(local) <= 2:
        masked_local = f"{local[:1]}***"
    else:
        masked_local = f"{local[:2]}***"

    return f"{masked_local}@{domain}"


def redact_student_id(student_id: Optional[str]) -> str:
    if not student_id:
        return ""

    clean = str(student_id).strip()

    if len(clean) <= 3:
        return "***"

    return f"{clean[:2]}***{clean[-2:]}"


def redact_name(name: Optional[str]) -> str:
    if not name:
        return ""

    clean = " ".join(str(name).split())

    if not clean:
        return ""

    parts = clean.split(" ")

    if len(parts) == 1:
        return f"{parts[0][:1]}***"

    first = parts[0]
    last = parts[-1]

    return f"{first} {last[:1]}."


def parse_json_list(value: Any) -> List[Dict[str, Any]]:
    if value is None:
        return []

    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]

    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return [item for item in parsed if isinstance(item, dict)]
        except json.JSONDecodeError:
            return []

    return []


def summarize_keystroke_events(value: Any) -> Dict[str, Any]:
    events = parse_json_list(value)

    paste_events = 0
    deletion_events = 0
    keydown_events = 0

    for event in events:
        event_type = str(event.get("type") or "")
        key = str(event.get("key") or "")

        if event_type == "keydown":
            keydown_events += 1

        if event_type == "paste" or key == "__PASTE_EVENT__":
            paste_events += 1

        if key in {"Backspace", "Delete"}:
            deletion_events += 1

    return {
        "total_events": len(events),
        "keydown_events": keydown_events,
        "paste_events": paste_events,
        "deletion_events": deletion_events,
        "raw_events_included": False,
    }


def safe_public_certificate_identity(
    *,
    student_name: str,
    student_id: str,
    show_name: bool,
    show_student_id: bool,
) -> Dict[str, str]:
    return {
        "student_name": student_name if show_name else redact_name(student_name),
        "student_id": student_id if show_student_id else redact_student_id(student_id),
    }


def strip_sensitive_session_fields(session: Dict[str, Any]) -> Dict[str, Any]:
    cleaned = dict(session)

    cleaned.pop("text_content", None)
    cleaned.pop("raw_keystroke_data", None)

    cleaned["has_text_content"] = bool(session.get("text_content"))
    cleaned["has_raw_keystroke_data"] = bool(session.get("raw_keystroke_data"))

    if "raw_keystroke_data" in session:
        cleaned["keystroke_summary"] = summarize_keystroke_events(
            session.get("raw_keystroke_data")
        )

    return cleaned


def privacy_safe_export_session(
    row: Dict[str, Any],
    *,
    include_sensitive: bool,
) -> Dict[str, Any]:
    base = {
        "id": row["id"],
        "title": row["title"],
        "wpm": float(row["wpm"] or 0),
        "total_keystrokes": int(row["total_keystrokes"] or 0),
        "deletions": int(row["deletions"] or 0),
        "pauses": int(row["pauses"] or 0),
        "avg_iki": float(row["avg_iki"] or 0),
        "duration_seconds": float(row["duration_seconds"] or 0),
        "classification_result": row["classification_result"],
        "ml_confidence_score": float(row["ml_confidence_score"] or 0),
        "certificate_id": row["certificate_id"],
        "document_hash": row["document_hash"],
        "review_status": row["review_status"],
        "review_notes": row["review_notes"],
        "risk_level": row["risk_level"],
        "course_name": row["course_name"],
        "course_code": row["course_code"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "has_text_content": bool(row.get("text_content")),
        "has_raw_keystroke_data": bool(row.get("raw_keystroke_data")),
        "keystroke_summary": summarize_keystroke_events(
            row.get("raw_keystroke_data")
        ),
    }

    if include_sensitive:
        base["text_content"] = row.get("text_content")
        base["raw_keystroke_data"] = parse_json_list(row.get("raw_keystroke_data"))
        base["sensitive_export"] = True
    else:
        base["text_content_hash"] = (
            sha256_text(row.get("text_content") or "")
            if row.get("text_content")
            else None
        )
        base["sensitive_export"] = False

    return base