
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_student
from app.db.database import get_db
from app.models.course import CourseStudent
from app.models.draft import DraftSession
from app.models.user import User
from app.services.audit_log import create_audit_log


router = APIRouter(prefix="/drafts")


MAX_TEXT_LENGTH = 100_000
MAX_EVENT_COUNT = 250_000


class DraftUpsertRequest(BaseModel):
    draft_id: Optional[str] = Field(default=None, max_length=120)
    title: str = Field(default="Untitled Document", max_length=255)
    text_content: str = Field(default="", max_length=MAX_TEXT_LENGTH)
    course_id: Optional[int] = None
    keystroke_array: List[Dict[str, Any]] = Field(default_factory=list)
    active_duration_ms: int = Field(default=0, ge=0)
    started_at: Optional[int] = Field(default=None, ge=0)
    last_activity_at: Optional[int] = Field(default=None, ge=0)
    paused_at: Optional[int] = Field(default=None, ge=0)
    expected_version: Optional[int] = Field(default=None, ge=1)
    save_reason: str = Field(default="autosave", max_length=30)
    lifecycle_status: str = Field(default="PAUSED", max_length=30)
    sync_status: str = Field(default="SYNCED", max_length=30)


class DraftSubmitLinkRequest(BaseModel):
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


def _safe_lifecycle_status(value: str) -> str:
    normalized = str(value or "PAUSED").upper()
    if normalized in {"ACTIVE", "PAUSED", "SUBMITTED", "DELETED"}:
        return normalized
    return "PAUSED"


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


@router.get("")
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

    return {
        "status": "success",
        "drafts": [_draft_payload(draft) for draft in drafts],
    }


@router.get("/{draft_id}")
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

    return {
        "status": "success",
        "draft": _draft_payload(draft),
    }


@router.post("", status_code=status.HTTP_200_OK)
async def upsert_draft(
    payload: DraftUpsertRequest,
    request: Request,
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    if len(payload.keystroke_array) > MAX_EVENT_COUNT:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Draft evidence stream is too large to sync in one request.",
        )

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
    draft.text_content = payload.text_content or ""
    draft.keystroke_array = payload.keystroke_array or []
    draft.active_duration_ms = int(payload.active_duration_ms or 0)
    draft.started_at = _ms_to_datetime(payload.started_at)
    draft.last_activity_at = _ms_to_datetime(payload.last_activity_at)
    draft.paused_at = _ms_to_datetime(payload.paused_at)
    draft.lifecycle_status = _safe_lifecycle_status(payload.lifecycle_status)
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
                "event_count": len(draft.keystroke_array or []),
                "active_duration_ms": int(draft.active_duration_ms or 0),
            },
        )
    )

    await db.commit()
    await db.refresh(draft)

    return {
        "status": "success",
        "draft": _draft_payload(draft),
    }


@router.patch("/{draft_id}")
async def update_draft(
    draft_id: str,
    payload: DraftUpsertRequest,
    request: Request,
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    payload.draft_id = payload.draft_id or draft_id
    return await upsert_draft(payload, request, current_user, db)


@router.delete("/{draft_id}")
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


@router.post("/{draft_id}/submit")
async def mark_draft_submitted(
    draft_id: str,
    payload: DraftSubmitLinkRequest,
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found.",
        )

    draft.lifecycle_status = "SUBMITTED"
    draft.sync_status = "SYNCED"
    draft.conflict_payload = {
        "submitted_session_id": payload.session_id,
        "submitted_from": "drafts.submit",
    }
    db.add(draft)
    db.add(
        create_audit_log(
            event_type="DRAFT_SUBMITTED",
            entity_type="draft_session",
            entity_id=str(draft.id),
            actor_user_id=str(current_user.id),
            target_user_id=str(current_user.id),
            request=request,
            metadata={
                "local_draft_id": draft.local_draft_id,
                "session_id": payload.session_id,
            },
        )
    )
    await db.commit()

    return {
        "status": "success",
        "message": "Draft marked as submitted.",
    }
