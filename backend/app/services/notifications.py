import logging
from typing import Any, Dict, Optional

from app.db.database import AsyncSessionLocal
from app.models.notification import Notification
from app.services.redis_cache import redis_client

logger = logging.getLogger("typetrace.notifications")

UNREAD_TTL_SECONDS = 60 * 60 * 24 * 7  # Cache never drifts more than a week


async def bump_unread_cache(recipient_id: str) -> None:
    try:
        await redis_client.incr(f"unread_notif:{recipient_id}")
        await redis_client.expire(f"unread_notif:{recipient_id}", UNREAD_TTL_SECONDS)
    except Exception as exc:
        logger.error("Failed to bump Redis unread count for %s: %s", recipient_id, exc)


async def dispatch_notification(
    *,
    recipient_id: str,
    event_type: str,
    entity_type: str,
    title: str,
    entity_id: Optional[str] = None,
    actor_id: Optional[str] = None,
    body: Optional[str] = None,
    action_url: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Runs inside a FastAPI BackgroundTask — opens its own session since the
    request-scoped one may already be closed by the time this executes.
    """
    async with AsyncSessionLocal() as db:
        try:
            notification = Notification(
                recipient_id=recipient_id,
                actor_id=actor_id,
                event_type=event_type,
                entity_type=entity_type,
                entity_id=entity_id,
                title=title,
                body=body,
                action_url=action_url,
                metadata_json=metadata or {},
            )
            db.add(notification)
            await db.commit()
        except Exception as exc:
            await db.rollback()
            logger.error("Failed to dispatch notification to %s: %s", recipient_id, exc)
            return

    await bump_unread_cache(recipient_id)


async def get_unread_count(recipient_id: str, db) -> int:
    try:
        cached = await redis_client.get(f"unread_notif:{recipient_id}")
        if cached is not None:
            return int(cached)
    except Exception as exc:
        logger.warning("Redis cache miss or failure for unread count %s: %s", recipient_id, exc)

    # Cache miss — recompute and reseed from Postgres
    from sqlalchemy import select, func
    from app.models.notification import Notification

    result = await db.execute(
        select(func.count()).select_from(Notification).where(
            Notification.recipient_id == recipient_id,
            Notification.is_read.is_(False),
        )
    )
    count = result.scalar_one()
    
    try:
        await redis_client.set(f"unread_notif:{recipient_id}", count, ex=UNREAD_TTL_SECONDS)
    except Exception as exc:
        logger.warning("Failed to set Redis unread count for %s: %s", recipient_id, exc)
        
    return count