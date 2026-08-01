from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.services.text_units import utf16_length


MAX_ANALYSIS_TEXT_CHARACTERS = 30_000
MAX_ANALYSIS_EVENT_COUNT = 120_000
MAX_EVENT_INSERTED_TEXT_CHARACTERS = 12_000
MAX_TOTAL_PASTED_CHARACTERS = 12_000
MAX_CLIENT_METADATA_KEYS = 24
MAX_CLIENT_METADATA_VALUE_CHARACTERS = 1_000
MAX_ACTIVE_DURATION_MS = 7 * 24 * 60 * 60 * 1000
MAX_EVENT_TIMESTAMP_MS = 4_102_444_800_000  # 2100-01-01 UTC wall-clock milliseconds
MAX_TIMESTAMP_SPAN_MS = 90 * 24 * 60 * 60 * 1000
MAX_POSITION_VALUE = MAX_ANALYSIS_TEXT_CHARACTERS + MAX_TOTAL_PASTED_CHARACTERS

KeystrokeEventType = Literal["keydown", "keyup", "paste", "cut", "input", "cursor"]
DeletionMethod = Literal[
    "single",
    "word",
    "line",
    "selection",
    "replacement",
    "cut",
    "all",
    "unknown",
]


class SessionStats(BaseModel):
    model_config = ConfigDict(extra="forbid")

    wpm: float = Field(ge=0, le=2_000)
    keystrokes: int = Field(ge=0, le=MAX_ANALYSIS_EVENT_COUNT)
    deletions: int = Field(default=0, ge=0, le=MAX_ANALYSIS_EVENT_COUNT)
    deletedCharacters: int = Field(
        default=0,
        ge=0,
        le=MAX_ANALYSIS_TEXT_CHARACTERS + MAX_TOTAL_PASTED_CHARACTERS,
    )
    bulkDeletionEvents: int = Field(default=0, ge=0, le=MAX_ANALYSIS_EVENT_COUNT)
    largestDeletionChars: int = Field(
        default=0,
        ge=0,
        le=MAX_ANALYSIS_TEXT_CHARACTERS + MAX_TOTAL_PASTED_CHARACTERS,
    )
    selectionDeletionEvents: int = Field(default=0, ge=0, le=MAX_ANALYSIS_EVENT_COUNT)
    wordDeletionEvents: int = Field(default=0, ge=0, le=MAX_ANALYSIS_EVENT_COUNT)
    cutEvents: int = Field(default=0, ge=0, le=MAX_ANALYSIS_EVENT_COUNT)
    pauses: int = Field(ge=0, le=MAX_ANALYSIS_EVENT_COUNT)
    avgIki: float = Field(ge=0, le=MAX_TIMESTAMP_SPAN_MS)
    sessionSeconds: float = Field(ge=0, le=MAX_ACTIVE_DURATION_MS / 1000)


class KeystrokeEvent(BaseModel):
    """Strict, privacy-bounded event accepted by the analysis API.

    The frontend can submit the current TypeTrace event shape, but arbitrary
    dictionary keys are rejected. Literal inserted text is accepted only for
    confirmed insertion/paste/replacement events and is size bounded.
    """

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    key: str = Field(default="", max_length=128)
    keyCode: int = Field(default=0, ge=0, le=65_535)
    code: Optional[str] = Field(default=None, max_length=128)
    type: KeystrokeEventType
    timestamp: float = Field(ge=0, le=MAX_EVENT_TIMESTAMP_MS)
    down_time: Optional[float] = Field(default=None, ge=0, le=MAX_EVENT_TIMESTAMP_MS)
    up_time: Optional[float] = Field(default=None, ge=0, le=MAX_EVENT_TIMESTAMP_MS)
    dwell_time: Optional[float] = Field(default=None, ge=0, le=60_000)
    flight_time: Optional[float] = Field(default=None, ge=0, le=MAX_TIMESTAMP_SPAN_MS)
    documentLength: int = Field(default=0, ge=0, le=MAX_POSITION_VALUE)
    cursorPosition: int = Field(default=0, ge=0, le=MAX_POSITION_VALUE)
    pastedLength: Optional[int] = Field(default=None, ge=0, le=MAX_TOTAL_PASTED_CHARACTERS)
    inputType: Optional[str] = Field(default=None, max_length=128)
    revision_id: Optional[str] = Field(default=None, max_length=160)
    documentLengthBefore: Optional[int] = Field(default=None, ge=0, le=MAX_POSITION_VALUE)
    documentLengthAfter: Optional[int] = Field(default=None, ge=0, le=MAX_POSITION_VALUE)
    selectionStartBefore: Optional[int] = Field(default=None, ge=0, le=MAX_POSITION_VALUE)
    selectionEndBefore: Optional[int] = Field(default=None, ge=0, le=MAX_POSITION_VALUE)
    selection_length_before: Optional[int] = Field(default=None, ge=0, le=MAX_POSITION_VALUE)
    deltaLength: Optional[int] = Field(
        default=None,
        ge=-MAX_POSITION_VALUE,
        le=MAX_POSITION_VALUE,
    )
    insertedCharacters: Optional[int] = Field(default=None, ge=0, le=MAX_TOTAL_PASTED_CHARACTERS)
    insertedText: Optional[str] = Field(default=None, max_length=MAX_EVENT_INSERTED_TEXT_CHARACTERS)
    deletedCharacters: Optional[int] = Field(default=None, ge=0, le=MAX_POSITION_VALUE)
    chars_deleted: Optional[int] = Field(default=None, ge=0, le=MAX_POSITION_VALUE)
    deletion_method: Optional[DeletionMethod] = None
    isBulkDeletion: Optional[bool] = None
    bulk_deletion: Optional[bool] = None
    ctrlKey: Optional[bool] = None
    altKey: Optional[bool] = None
    metaKey: Optional[bool] = None
    shiftKey: Optional[bool] = None
    repeat: Optional[bool] = None
    isComposing: Optional[bool] = None
    idleBreakMs: Optional[int] = Field(default=None, ge=0, le=MAX_TIMESTAMP_SPAN_MS)
    idle_break_ms: Optional[int] = Field(default=None, ge=0, le=MAX_TIMESTAMP_SPAN_MS)

    @model_validator(mode="after")
    def validate_positions_and_text(self) -> "KeystrokeEvent":
        if self.cursorPosition > self.documentLength:
            raise ValueError("cursorPosition cannot exceed documentLength.")

        if self.type != "paste" and self.pastedLength not in (None, 0):
            raise ValueError("pastedLength is only valid for paste events.")

        if self.insertedText is not None:
            allowed = self.type in {"paste", "input", "keydown"}
            if not allowed:
                raise ValueError("insertedText is not valid for this event type.")
            inserted_units = utf16_length(self.insertedText)
            if (
                self.insertedCharacters is not None
                and inserted_units != self.insertedCharacters
            ):
                raise ValueError(
                    "insertedCharacters must match insertedText UTF-16 length."
                )

        if self.type == "paste":
            if self.insertedText is None:
                raise ValueError("Paste events must include the captured pasted text.")
            inserted_units = utf16_length(self.insertedText)
            if self.pastedLength != inserted_units:
                raise ValueError(
                    "pastedLength must match the pasted text UTF-16 length."
                )
            if self.insertedCharacters != inserted_units:
                raise ValueError(
                    "insertedCharacters must match the pasted text UTF-16 length."
                )

        return self


class KeystrokeSessionAnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    submission_id: str = Field(min_length=16, max_length=120, pattern=r"^[A-Za-z0-9._:-]+$")
    title: str = Field(default="Untitled Document", max_length=255)
    text_content: str = Field(min_length=1, max_length=MAX_ANALYSIS_TEXT_CHARACTERS)
    keystroke_array: List[KeystrokeEvent] = Field(
        min_length=1,
        max_length=MAX_ANALYSIS_EVENT_COUNT,
    )
    stats: SessionStats
    course_id: Optional[int] = Field(default=None, gt=0)
    active_duration_ms: Optional[int] = Field(default=None, ge=0, le=MAX_ACTIVE_DURATION_MS)
    draft_id: Optional[str] = Field(default=None, max_length=120)
    client_metadata: Dict[str, str] = Field(default_factory=dict)

    @field_validator("submission_id", "draft_id")
    @classmethod
    def strip_identifiers(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("text_content")
    @classmethod
    def validate_text_utf16_length(cls, value: str) -> str:
        if utf16_length(value) > MAX_ANALYSIS_TEXT_CHARACTERS:
            raise ValueError(
                f"text_content may not exceed {MAX_ANALYSIS_TEXT_CHARACTERS} UTF-16 code units."
            )
        return value

    @field_validator("client_metadata")
    @classmethod
    def validate_client_metadata(cls, value: Dict[str, str]) -> Dict[str, str]:
        if len(value) > MAX_CLIENT_METADATA_KEYS:
            raise ValueError(
                f"client_metadata may contain at most {MAX_CLIENT_METADATA_KEYS} keys."
            )

        normalized: Dict[str, str] = {}
        for key, item in value.items():
            clean_key = str(key).strip()
            clean_value = str(item).strip()
            if not clean_key or len(clean_key) > 80:
                raise ValueError("client_metadata keys must be 1 to 80 characters.")
            if len(clean_value) > MAX_CLIENT_METADATA_VALUE_CHARACTERS:
                raise ValueError(
                    "client_metadata values exceed the permitted length."
                )
            normalized[clean_key] = clean_value
        return normalized

    @model_validator(mode="after")
    def validate_stream_limits(self) -> "KeystrokeSessionAnalyzeRequest":
        events = self.keystroke_array
        timestamps = [event.timestamp for event in events]
        if timestamps and max(timestamps) - min(timestamps) > MAX_TIMESTAMP_SPAN_MS:
            raise ValueError("Keystroke timestamp range exceeds the permitted session span.")

        previous_timestamp: float | None = None
        for timestamp in timestamps:
            if previous_timestamp is not None and timestamp < previous_timestamp - 1_000:
                raise ValueError(
                    "Keystroke timestamps must preserve capture order."
                )
            previous_timestamp = timestamp

        total_pasted = sum(
            max(
                event.pastedLength or 0,
                utf16_length(event.insertedText or "") if event.type == "paste" else 0,
            )
            for event in events
            if event.type == "paste"
        )
        if total_pasted > MAX_TOTAL_PASTED_CHARACTERS:
            raise ValueError(
                f"Total pasted content may not exceed {MAX_TOTAL_PASTED_CHARACTERS} characters."
            )

        if self.active_duration_ms is not None and self.stats.sessionSeconds > 0:
            server_tolerance_ms = max(60_000, int(self.stats.sessionSeconds * 1000 * 0.25))
            if self.active_duration_ms > int(self.stats.sessionSeconds * 1000) + server_tolerance_ms:
                raise ValueError("active_duration_ms is inconsistent with sessionSeconds.")

        return self

    def event_dicts(self) -> List[Dict[str, Any]]:
        return [event.model_dump(exclude_none=True) for event in self.keystroke_array]


class AnalysisResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", protected_namespaces=())

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
    submission_id: str
    idempotent_replay: bool = False
    decision_source: str
    model_available: bool
    degraded_analysis: bool
