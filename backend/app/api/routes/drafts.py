# backend/app/api/routes/drafts.py

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_student
from app.core.crypto import decrypt_json, decrypt_text, encrypt_json, encrypt_text
from app.db.database import get_db
from app.models.course import Course, CourseStudent
from app.models.draft import DraftSession
from app.models.session import TypingSession
from app.models.user import User
from app.services.audit_log import create_audit_log
from app.services.canonical_evidence import compute_canonical_evidence, normalize_title
from app.schemas.evidence import (
    MAX_ACTIVE_DURATION_MS,
    MAX_ANALYSIS_EVENT_COUNT,
    MAX_ANALYSIS_TEXT_CHARACTERS,
    MAX_EVENT_TIMESTAMP_MS,
    KeystrokeEvent,
)
from app.services.text_units import utf16_length
from app.schemas.responses import DraftListResponse, DraftResponse, MessageResponse


router = APIRouter(prefix="/drafts")



class DraftUpsertRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    draft_id: Optional[str] = Field(default=None, max_length=120)
    title: str = Field(default="Untitled Document", max_length=255)
    text_content: str = Field(default="", max_length=MAX_ANALYSIS_TEXT_CHARACTERS)
    course_id: Optional[int] = None
    keystroke_array: List[KeystrokeEvent] = Field(
        default_factory=list,
        max_length=MAX_ANALYSIS_EVENT_COUNT,
    )
    active_duration_ms: int = Field(default=0, ge=0, le=MAX_ACTIVE_DURATION_MS)
    started_at: Optional[int] = Field(default=None, ge=0, le=MAX_EVENT_TIMESTAMP_MS)
    last_activity_at: Optional[int] = Field(default=None, ge=0, le=MAX_EVENT_TIMESTAMP_MS)
    paused_at: Optional[int] = Field(default=None, ge=0, le=MAX_EVENT_TIMESTAMP_MS)
    expected_version: Optional[int] = Field(default=None, ge=1)
    save_reason: Literal["autosave", "manual", "recovery", "resume"] = "autosave"
    lifecycle_status: Literal["ACTIVE", "PAUSED"] = "PAUSED"
    sync_status: Literal["LOCAL_ONLY", "SYNCED", "PENDING_SYNC", "CONFLICT"] = "SYNCED"

    def event_dicts(self) -> List[Dict[str, Any]]:
        return [event.model_dump(exclude_none=True) for event in self.keystroke_array]

    def validated_text_content(self) -> str:
        if utf16_length(self.text_content) > MAX_ANALYSIS_TEXT_CHARACTERS:
            raise ValueError(
                f"Draft text may not exceed {MAX_ANALYSIS_TEXT_CHARACTERS} UTF-16 code units."
            )
        return self.text_content


class DraftSubmitLinkRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: int = Field(ge=1)


def _normalize_title(title: str) -> str:
    clean = (title or "").strip()
    return clean[:255] if clean else "Untitled Document"


def _ms_to_datetime(value: Optional[int]) -> Optional[datetime]:
    if value is None:
        return None
    try:
        return datetime.fromtimestamp(int(value) / 1000, tz=timezone.utc)
    except (OSError, OverflowError, ValueError):
        return None


def _datetime_to_ms(value: Optional[datetime]) -> Optional[int]:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return int(value.timestamp() * 1000)


def _safe_sync_status(value: str) -> str:
    normalized = str(value or "SYNCED").upper()
    if normalized in {"LOCAL_ONLY", "SYNCED", "PENDING_SYNC", "CONFLICT"}:
        return normalized
    return "SYNCED"


def _safe_save_reason(value: str) -> str:
    normalized = str(value or "autosave").lower()
    if normalized in {"autosave", "manual", "recovery", "resume"}:
        return normalized
    return "autosave"


def _draft_payload(draft: DraftSession) -> Dict[str, Any]:
    local_id = draft.local_draft_id or draft.id
    return {
        "id": draft.id,
        "backend_draft_id": draft.id,
        "draft_id": local_id,
        "local_draft_id": local_id,
        "title": draft.title or "Untitled Document",
        "text_content": draft.text_content or "",
        "course_id": draft.course_id,
        "keystroke_array": draft.keystroke_array or [],
        "active_duration_ms": int(draft.active_duration_ms or 0),
        "started_at": _datetime_to_ms(draft.started_at),
        "last_activity_at": _datetime_to_ms(draft.last_activity_at),
        "paused_at": _datetime_to_ms(draft.paused_at),
        "version": int(draft.version or 1),
        "lifecycle_status": draft.lifecycle_status,
        "sync_status": draft.sync_status,
        "save_reason": draft.save_reason,
        "created_at": _datetime_to_ms(draft.created_at),
        "updated_at": _datetime_to_ms(draft.updated_at),
    }


async def _ensure_student_can_link_course(
    *,
    db: AsyncSession,
    student_id: str,
    course_id: Optional[int],
) -> None:
    if course_id is None:
        return

    result = await db.execute(
        select(CourseStudent.id)
        .join(Course, Course.id == CourseStudent.course_id)
        .where(
            CourseStudent.course_id == course_id,
            CourseStudent.student_id == student_id,
            Course.is_archived.is_(False),
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not enrolled in this course.",
        )


async def _find_draft(
    *,
    db: AsyncSession,
    user_id: str,
    draft_id: str,
    include_deleted: bool = False,
) -> Optional[DraftSession]:
    conditions = [
        DraftSession.user_id == user_id,
        (DraftSession.id == draft_id) | (DraftSession.local_draft_id == draft_id),
    ]
    if not include_deleted:
        conditions.append(DraftSession.lifecycle_status != "DELETED")

    result = await db.execute(select(DraftSession).where(*conditions))
    return result.scalars().first()


@router.get("", response_model=DraftListResponse)
async def list_drafts(
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DraftSession)
        .where(
            DraftSession.user_id == str(current_user.id),
            DraftSession.lifecycle_status.in_(["ACTIVE", "PAUSED"]),
        )
        .order_by(DraftSession.updated_at.desc())
    )
    drafts = list(result.scalars().all())

    decrypted_drafts = []
    for draft in drafts:
        payload = _draft_payload(draft)
        payload["text_content"] = decrypt_text(draft.text_content) or ""
        payload["keystroke_array"] = decrypt_json(draft.keystroke_array) or []
        decrypted_drafts.append(payload)

    return {
        "status": "success",
        "drafts": decrypted_drafts,
    }


@router.get("/{draft_id}", response_model=DraftResponse)
async def get_draft(
    draft_id: str,
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    draft = await _find_draft(
        db=db,
        user_id=str(current_user.id),
        draft_id=draft_id,
    )
    if draft is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found.",
        )

    payload = _draft_payload(draft)
    payload["text_content"] = decrypt_text(draft.text_content) or ""
    payload["keystroke_array"] = decrypt_json(draft.keystroke_array) or []

    return {
        "status": "success",
        "draft": payload,
    }


@router.post("", status_code=status.HTTP_200_OK, response_model=DraftResponse)
async def upsert_draft(
    payload: DraftUpsertRequest,
    request: Request,
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    if len(payload.keystroke_array) > MAX_ANALYSIS_EVENT_COUNT:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Draft evidence stream is too large to sync in one request.",
        )

    try:
        text_content = payload.validated_text_content()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    events = payload.event_dicts()

    await _ensure_student_can_link_course(
        db=db,
        student_id=str(current_user.id),
        course_id=payload.course_id,
    )

    local_draft_id = (payload.draft_id or "").strip() or None
    draft: Optional[DraftSession] = None

    if local_draft_id:
        draft = await _find_draft(
            db=db,
            user_id=str(current_user.id),
            draft_id=local_draft_id,
            include_deleted=True,
        )

    if draft is not None and draft.lifecycle_status == "SUBMITTED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This draft has already been submitted.",
        )

    if (
        draft is not None
        and payload.expected_version is not None
        and int(draft.version or 1) != int(payload.expected_version)
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Draft version conflict.",
                "server_draft": _draft_payload(draft),
            },
        )

    created = draft is None
    if draft is None:
        draft = DraftSession(
            user_id=str(current_user.id),
            local_draft_id=local_draft_id,
            version=1,
        )

    draft.course_id = payload.course_id
    draft.title = _normalize_title(payload.title)
    
    draft.text_content = encrypt_text(text_content) or ""
    draft.keystroke_array = encrypt_json(events) or []
    
    draft.active_duration_ms = int(payload.active_duration_ms or 0)
    draft.started_at = _ms_to_datetime(payload.started_at)
    draft.last_activity_at = _ms_to_datetime(payload.last_activity_at)
    draft.paused_at = _ms_to_datetime(payload.paused_at)
    draft.lifecycle_status = payload.lifecycle_status
    draft.sync_status = _safe_sync_status(payload.sync_status)
    draft.save_reason = _safe_save_reason(payload.save_reason)
    draft.conflict_payload = None

    if not created:
        draft.version = int(draft.version or 1) + 1

    db.add(draft)
    await db.flush()

    db.add(
        create_audit_log(
            event_type="DRAFT_CREATED" if created else "DRAFT_SYNCED",
            entity_type="draft_session",
            entity_id=str(draft.id),
            actor_user_id=str(current_user.id),
            target_user_id=str(current_user.id),
            request=request,
            metadata={
                "local_draft_id": draft.local_draft_id,
                "save_reason": draft.save_reason,
                "lifecycle_status": draft.lifecycle_status,
                "event_count": len(events),
                "active_duration_ms": int(draft.active_duration_ms or 0),
            },
        )
    )

    await db.commit()
    await db.refresh(draft)

    payload_response = _draft_payload(draft)
    payload_response["text_content"] = text_content
    payload_response["keystroke_array"] = events

    return {
        "status": "success",
        "draft": payload_response,
    }


@router.patch("/{draft_id}", response_model=DraftResponse)
async def update_draft(
    draft_id: str,
    payload: DraftUpsertRequest,
    request: Request,
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    payload.draft_id = payload.draft_id or draft_id
    return await upsert_draft(payload, request, current_user, db)


@router.delete("/{draft_id}", response_model=MessageResponse)
async def delete_draft(
    draft_id: str,
    request: Request,
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    draft = await _find_draft(
        db=db,
        user_id=str(current_user.id),
        draft_id=draft_id,
    )
    if draft is None:
        return {
            "status": "success",
            "message": "Draft already removed.",
        }

    draft.lifecycle_status = "DELETED"
    draft.sync_status = "SYNCED"
    db.add(draft)
    db.add(
        create_audit_log(
            event_type="DRAFT_DELETED",
            entity_type="draft_session",
            entity_id=str(draft.id),
            actor_user_id=str(current_user.id),
            target_user_id=str(current_user.id),
            request=request,
            metadata={"local_draft_id": draft.local_draft_id},
        )
    )
    await db.commit()

    return {
        "status": "success",
        "message": "Draft deleted.",
    }


@router.post("/{draft_id}/submit", response_model=MessageResponse)
async def mark_draft_submitted(
    draft_id: str,
    payload: DraftSubmitLinkRequest,
    request: Request,
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    user_id = str(current_user.id)
    draft = await _find_draft(
        db=db,
        user_id=user_id,
        draft_id=draft_id,
    )
    if draft is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found.",
        )

    session = (
        await db.execute(
            select(TypingSession).where(
                TypingSession.id == payload.session_id,
                TypingSession.user_id == user_id,
            )
        )
    ).scalars().first()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submitted session was not found for this student.",
        )

    if draft.submitted_session_id is not None:
        if int(draft.submitted_session_id) == int(session.id):
            return {
                "status": "success",
                "message": "Draft was already linked to this submitted session.",
            }
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Draft is already linked to a different submitted session.",
        )

    draft_text = decrypt_text(draft.text_content) or ""
    draft_events = decrypt_json(draft.keystroke_array) or []
    if not isinstance(draft_events, list):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Draft evidence is malformed and cannot be linked.",
        )

    canonical = compute_canonical_evidence(
        title=normalize_title(draft.title),
        text_content=draft_text,
        keystroke_array=draft_events,
        user_id=user_id,
        client_active_duration_ms=int(draft.active_duration_ms or 0),
    )
    if not session.evidence_hash or canonical.evidence_hash != session.evidence_hash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Draft evidence does not match the submitted session. "
                "The draft cannot be linked to an unrelated evidence record."
            ),
        )

    draft.lifecycle_status = "SUBMITTED"
    draft.sync_status = "SYNCED"
    draft.submitted_session_id = int(session.id)
    draft.conflict_payload = None
    db.add(draft)
    db.add(
        create_audit_log(
            event_type="DRAFT_SUBMITTED",
            entity_type="draft_session",
            entity_id=str(draft.id),
            actor_user_id=user_id,
            target_user_id=user_id,
            request=request,
            metadata={
                "local_draft_id": draft.local_draft_id,
                "session_id": int(session.id),
                "evidence_hash": session.evidence_hash,
            },
        )
    )
    await db.commit()

    return {
        "status": "success",
        "message": "Draft marked as submitted.",
    }
