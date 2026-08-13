from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from app.services import notifications


class _DbContext:
    def __init__(self, db) -> None:
        self.db = db

    async def __aenter__(self):
        return self.db

    async def __aexit__(self, exc_type, exc, tb):
        return False


class NotificationServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_bump_unread_cache_updates_count_and_ttl(self) -> None:
        redis = SimpleNamespace(incr=AsyncMock(), expire=AsyncMock())

        with patch.object(notifications, "redis_client", redis):
            await notifications.bump_unread_cache("student-1")

        redis.incr.assert_awaited_once_with("unread_notif:student-1")
        redis.expire.assert_awaited_once_with(
            "unread_notif:student-1",
            notifications.UNREAD_TTL_SECONDS,
        )

    async def test_bump_unread_cache_is_best_effort_on_redis_failure(self) -> None:
        redis = SimpleNamespace(
            incr=AsyncMock(side_effect=RuntimeError("redis down")),
            expire=AsyncMock(),
        )

        with patch.object(notifications, "redis_client", redis):
            await notifications.bump_unread_cache("student-1")

        redis.expire.assert_not_awaited()

    async def test_get_unread_count_uses_cache_when_present(self) -> None:
        redis = SimpleNamespace(get=AsyncMock(return_value=b"7"), set=AsyncMock())
        db = SimpleNamespace(execute=AsyncMock())

        with patch.object(notifications, "redis_client", redis):
            count = await notifications.get_unread_count("student-1", db)

        self.assertEqual(count, 7)
        db.execute.assert_not_awaited()
        redis.set.assert_not_awaited()

    async def test_get_unread_count_recomputes_and_reseeds_cache(self) -> None:
        redis = SimpleNamespace(get=AsyncMock(return_value=None), set=AsyncMock())
        result = MagicMock()
        result.scalar_one.return_value = 3
        db = SimpleNamespace(execute=AsyncMock(return_value=result))

        with patch.object(notifications, "redis_client", redis):
            count = await notifications.get_unread_count("student-1", db)

        self.assertEqual(count, 3)
        db.execute.assert_awaited_once()
        redis.set.assert_awaited_once_with(
            "unread_notif:student-1",
            3,
            ex=notifications.UNREAD_TTL_SECONDS,
        )

    async def test_dispatch_notification_commits_then_bumps_cache(self) -> None:
        db = SimpleNamespace(
            add=MagicMock(),
            commit=AsyncMock(),
            rollback=AsyncMock(),
        )
        bump = AsyncMock()

        with (
            patch.object(notifications, "AsyncSessionLocal", return_value=_DbContext(db)),
            patch.object(notifications, "bump_unread_cache", bump),
        ):
            await notifications.dispatch_notification(
                recipient_id="student-1",
                actor_id="teacher-1",
                event_type="REVIEW_UPDATED",
                entity_type="session",
                entity_id="42",
                title="Review updated",
                body="Your instructor updated the review.",
                action_url="/sessions/42",
                metadata={"safe": True},
            )

        db.add.assert_called_once()
        db.commit.assert_awaited_once()
        db.rollback.assert_not_awaited()
        bump.assert_awaited_once_with("student-1")

    async def test_dispatch_notification_rolls_back_and_does_not_bump_on_failure(self) -> None:
        db = SimpleNamespace(
            add=MagicMock(),
            commit=AsyncMock(side_effect=RuntimeError("database down")),
            rollback=AsyncMock(),
        )
        bump = AsyncMock()

        with (
            patch.object(notifications, "AsyncSessionLocal", return_value=_DbContext(db)),
            patch.object(notifications, "bump_unread_cache", bump),
        ):
            await notifications.dispatch_notification(
                recipient_id="student-1",
                event_type="TEST",
                entity_type="session",
                title="Test",
            )

        db.rollback.assert_awaited_once()
        bump.assert_not_awaited()


if __name__ == "__main__":
    unittest.main(verbosity=2)
