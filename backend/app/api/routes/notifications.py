import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.services.notifications import get_unread_count
from app.services.redis_cache import redis_client
from app.schemas.responses import NotificationListResponse, StatusOnlyResponse, UnreadCountResponse

router = APIRouter()
logger = logging.getLogger("typetrace.notifications")

def _serialize_notification(notif: Notification) -> Dict[str, Any]:
    return {
        "id": notif.id,
        "event_type": notif.event_type,
        "entity_type": notif.entity_type,
        "entity_id": notif.entity_id or "",
        "title": notif.title,
        "body": notif.body or "",
        "action_url": notif.action_url or "",
        "is_read": notif.is_read,
        "created_at": notif.created_at.isoformat() if notif.created_at else None,
    }

@router.get("", status_code=status.HTTP_200_OK, response_model=NotificationListResponse)
async def list_notifications(
    limit: int = Query(20, le=50),
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Notification).where(Notification.recipient_id == str(current_user.id))
    if unread_only:
        query = query.where(Notification.is_read == False)
    
    query = query.order_by(Notification.created_at.desc()).limit(limit)
    result = await db.execute(query)
    notifications = result.scalars().all()

    return {
        "status": "success",
        "notifications": [_serialize_notification(n) for n in notifications],
    }

@router.get("/unread-count", status_code=status.HTTP_200_OK, response_model=UnreadCountResponse)
async def get_unread_count_route(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await get_unread_count(str(current_user.id), db)
    return {"status": "success", "unread_count": count}

@router.patch("/{notification_id}/read", status_code=status.HTTP_200_OK, response_model=StatusOnlyResponse)
async def mark_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        update(Notification)
        .where(
            Notification.id == notification_id,
            Notification.recipient_id == str(current_user.id),
            Notification.is_read == False
        )
        .values(is_read=True, read_at=func.now())
    )
    if result.rowcount > 0:
        await db.commit()
        # Safely decrement cache without dropping below 0
        cache_key = f"unread_notif:{current_user.id}"
        try:
            current_cache = await redis_client.get(cache_key)
            if current_cache is not None and int(current_cache) > 0:
                await redis_client.decr(cache_key)
        except Exception:
            logger.exception(
                "Unread notification cache decrement failed after database commit",
                extra={"user_id": str(current_user.id)},
            )
    
    return {"status": "success"}

@router.post("/mark-all-read", status_code=status.HTTP_200_OK, response_model=StatusOnlyResponse)
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(Notification)
        .where(
            Notification.recipient_id == str(current_user.id),
            Notification.is_read == False
        )
        .values(is_read=True, read_at=func.now())
    )
    await db.commit()
    try:
        await redis_client.set(f"unread_notif:{current_user.id}", 0)
    except Exception:
        logger.exception(
            "Unread notification cache reset failed after database commit",
            extra={"user_id": str(current_user.id)},
        )
    
    return {"status": "success"}
