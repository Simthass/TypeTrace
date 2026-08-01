from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Optional

from app.services.text_units import from_utf16_units, to_utf16_units, utf16_length


@dataclass(frozen=True)
class EvidenceReplayResult:
    text: str
    complete: bool
    issues: tuple[str, ...]


class EvidenceReplayMismatch(ValueError):
    """Raised when submitted final text cannot be proven by the event stream."""


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return max(0, int(round(float(value))))
    except (TypeError, ValueError, OverflowError):
        return default


def _optional_int(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        return int(round(float(value)))
    except (TypeError, ValueError, OverflowError):
        return None


def _event_type(event: Mapping[str, Any]) -> str:
    return str(event.get("type") or "").strip().lower()


def _event_key(event: Mapping[str, Any]) -> str:
    return str(event.get("key") or "")


def _is_shortcut(event: Mapping[str, Any]) -> bool:
    ctrl_or_meta = bool(event.get("ctrlKey") or event.get("metaKey"))
    # AltGr commonly reports Ctrl+Alt while producing real text.
    return ctrl_or_meta and not bool(event.get("altKey"))


def _fallback_insert_text(event: Mapping[str, Any]) -> str:
    if _event_type(event) != "keydown" or _is_shortcut(event):
        return ""

    key = _event_key(event)
    if key == "Enter":
        return "\n"
    if key == "Tab":
        return "    "
    if utf16_length(key) == 1:
        return key
    return ""


def _deleted_characters(event: Mapping[str, Any]) -> int:
    has_explicit = "deletedCharacters" in event or "chars_deleted" in event
    if has_explicit:
        explicit = event.get("deletedCharacters")
        if explicit is None:
            explicit = event.get("chars_deleted")
        return _safe_int(explicit)

    if _event_type(event) == "keydown" and _event_key(event) in {
        "Backspace",
        "Delete",
    }:
        return 1
    return 0


def _insert_text(event: Mapping[str, Any]) -> str:
    explicit = event.get("insertedText")
    if explicit is None:
        explicit = event.get("inserted_text")
    if isinstance(explicit, str):
        return explicit

    inserted_characters = _optional_int(event.get("insertedCharacters"))
    if inserted_characters == 0:
        return ""
    return _fallback_insert_text(event)


def reconstruct_evidence_text(
    events: Iterable[Mapping[str, Any]],
) -> EvidenceReplayResult:
    """Replay TypeTrace events using browser UTF-16 cursor semantics.

    The browser records selection and document positions in UTF-16 code units.
    Python string indexes are Unicode code points, so reconstruction must operate
    on explicit UTF-16 units or emoji/non-BMP text will drift.
    """

    units: list[bytes] = []
    issues: list[str] = []

    for index, event in enumerate(events):
        event_type = _event_type(event)
        key = _event_key(event)

        if event_type in {"keyup", "cursor"}:
            continue
        if key == "__IDLE_BREAK__" or str(event.get("inputType") or "") == "historyIdleBreak":
            continue

        before_length = len(units)
        declared_before = _optional_int(event.get("documentLengthBefore"))
        if declared_before is None:
            declared_before = _optional_int(event.get("documentLength"))

        if declared_before is not None and declared_before != before_length:
            issues.append(
                f"event {index}: declared pre-edit length {declared_before} "
                f"does not match reconstructed length {before_length}"
            )

        raw_position = _optional_int(event.get("cursorPosition"))
        position = before_length if raw_position is None else raw_position
        if position < 0 or position > before_length:
            issues.append(
                f"event {index}: cursor position {position} is outside "
                f"the reconstructed document length {before_length}"
            )
            position = max(0, min(before_length, position))

        deleted = _deleted_characters(event)
        selection_length = _safe_int(event.get("selection_length_before"))
        forward_delete = (
            event_type != "keydown"
            or key == "Delete"
            or selection_length > 0
            or event_type == "paste"
        )
        delete_start = position if forward_delete else max(0, position - deleted)
        actual_deleted = min(deleted, max(0, len(units) - delete_start))

        if deleted > actual_deleted:
            issues.append(
                f"event {index}: requested deletion of {deleted} UTF-16 units "
                f"but only {actual_deleted} were available"
            )

        if actual_deleted:
            del units[delete_start : delete_start + actual_deleted]

        inserted_text = _insert_text(event)
        inserted_units = to_utf16_units(inserted_text)
        declared_inserted = _optional_int(event.get("insertedCharacters"))
        if declared_inserted is not None and declared_inserted != len(inserted_units):
            issues.append(
                f"event {index}: insertedCharacters {declared_inserted} does not "
                f"match inserted text length {len(inserted_units)}"
            )

        if event_type == "paste" and not inserted_text and _safe_int(event.get("pastedLength")) > 0:
            issues.append(
                f"event {index}: paste content is missing and cannot be reconstructed"
            )

        if inserted_units:
            units[delete_start:delete_start] = inserted_units

        after_length = len(units)
        declared_after = _optional_int(event.get("documentLengthAfter"))
        if declared_after is not None and declared_after != after_length:
            issues.append(
                f"event {index}: declared post-edit length {declared_after} "
                f"does not match reconstructed length {after_length}"
            )

        declared_delta = _optional_int(event.get("deltaLength"))
        if declared_delta is not None:
            actual_delta = after_length - before_length
            if declared_delta != actual_delta:
                issues.append(
                    f"event {index}: deltaLength {declared_delta} does not match "
                    f"the reconstructed delta {actual_delta}"
                )

    return EvidenceReplayResult(
        text=from_utf16_units(units),
        complete=not issues,
        issues=tuple(issues),
    )


def validate_evidence_text(
    *,
    events: Iterable[Mapping[str, Any]],
    expected_text: str,
) -> EvidenceReplayResult:
    result = reconstruct_evidence_text(events)

    if result.issues:
        raise EvidenceReplayMismatch(
            "The writing evidence stream is internally inconsistent: "
            + "; ".join(result.issues[:3])
        )

    if result.text != expected_text:
        raise EvidenceReplayMismatch(
            "The submitted document does not match the text reconstructed from "
            "the captured writing evidence. Save the latest draft and retry."
        )

    return result
