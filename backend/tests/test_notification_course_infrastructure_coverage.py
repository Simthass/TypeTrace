from __future__ import annotations

import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import BackgroundTasks, HTTPException
from sqlalchemy.exc import IntegrityError

from app.api import deps
from app.api.routes import courses, model, notifications


class _ScalarCollection:
    def __init__(self, rows):
        self._rows = list(rows)

    def scalars(self):
        return self

    def all(self):
        return self._rows

    def first(self):
        return self._rows[0] if self._rows else None


class _ScalarOne:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _RowCount:
    def __init__(self, rowcount):
        self.rowcount = rowcount


class NotificationRouteCoverageTests(unittest.IsolatedAsyncioTestCase):
    def test_notification_serializer_handles_timestamp_and_optional_fields(self):
        now = datetime(2026, 8, 16, 6, tzinfo=timezone.utc)
        payload = notifications._serialize_notification(
            SimpleNamespace(
                id="n-1",
                event_type="REVIEW_UPDATED",
                entity_type="session",
                entity_id=None,
                title="Review updated",
                body=None,
                action_url=None,
                is_read=False,
                created_at=now,
            )
        )
        self.assertEqual(payload["entity_id"], "")
        self.assertEqual(payload["body"], "")
        self.assertEqual(payload["created_at"], now.isoformat())

    async def test_list_notifications_supports_all_and_unread_queries(self):
        row = SimpleNamespace(
            id="n-1", event_type="TEST", entity_type="session", entity_id="1",
            title="Notice", body="Body", action_url="/sessions/1", is_read=False,
            created_at=None,
        )
        for unread_only in (False, True):
            db = SimpleNamespace(execute=AsyncMock(return_value=_ScalarCollection([row])))
            result = await notifications.list_notifications(
                limit=7,
                unread_only=unread_only,
                current_user=SimpleNamespace(id="student-1"),
                db=db,
            )
            self.assertEqual(result["status"], "success")
            self.assertEqual(result["notifications"][0]["id"], "n-1")
            db.execute.assert_awaited_once()

    async def test_unread_count_route_delegates_to_cache_aware_service(self):
        db = SimpleNamespace()
        with patch.object(notifications, "get_unread_count", AsyncMock(return_value=6)) as getter:
            result = await notifications.get_unread_count_route(
                current_user=SimpleNamespace(id="student-1"), db=db
            )
        self.assertEqual(result, {"status": "success", "unread_count": 6})
        getter.assert_awaited_once_with("student-1", db)

    async def test_mark_read_commits_and_decrements_positive_cache(self):
        db = SimpleNamespace(execute=AsyncMock(return_value=_RowCount(1)), commit=AsyncMock())
        redis = SimpleNamespace(get=AsyncMock(return_value=b"2"), decr=AsyncMock())
        with patch.object(notifications, "redis_client", redis):
            result = await notifications.mark_read(
                "n-1", current_user=SimpleNamespace(id="student-1"), db=db
            )
        self.assertEqual(result, {"status": "success"})
        db.commit.assert_awaited_once()
        redis.decr.assert_awaited_once_with("unread_notif:student-1")

    async def test_mark_read_skips_commit_when_no_owned_unread_row_and_tolerates_cache_failure(self):
        empty_db = SimpleNamespace(execute=AsyncMock(return_value=_RowCount(0)), commit=AsyncMock())
        redis = SimpleNamespace(get=AsyncMock(), decr=AsyncMock())
        with patch.object(notifications, "redis_client", redis):
            await notifications.mark_read("missing", current_user=SimpleNamespace(id="student-1"), db=empty_db)
        empty_db.commit.assert_not_awaited()
        redis.get.assert_not_awaited()

        db = SimpleNamespace(execute=AsyncMock(return_value=_RowCount(1)), commit=AsyncMock())
        failing = SimpleNamespace(get=AsyncMock(side_effect=RuntimeError("redis")), decr=AsyncMock())
        with patch.object(notifications, "redis_client", failing):
            self.assertEqual(
                await notifications.mark_read("n-2", current_user=SimpleNamespace(id="student-1"), db=db),
                {"status": "success"},
            )
        db.commit.assert_awaited_once()

    async def test_mark_all_read_commits_and_cache_reset_is_best_effort(self):
        for side_effect in (None, RuntimeError("redis")):
            db = SimpleNamespace(execute=AsyncMock(), commit=AsyncMock())
            redis = SimpleNamespace(set=AsyncMock(side_effect=side_effect))
            with patch.object(notifications, "redis_client", redis):
                result = await notifications.mark_all_read(
                    current_user=SimpleNamespace(id="student-1"), db=db
                )
            self.assertEqual(result, {"status": "success"})
            db.commit.assert_awaited_once()
            redis.set.assert_awaited_once_with("unread_notif:student-1", 0)


class CourseRouteCoverageTests(unittest.IsolatedAsyncioTestCase):
    def test_join_request_normalizes_invite_code(self):
        self.assertEqual(courses.JoinCourseRequest(invite_code="  ab-123  ").invite_code, "AB-123")

    async def test_join_course_rejects_invalid_invite_and_returns_existing_enrollment_idempotently(self):
        user = SimpleNamespace(id="student-1", first_name="Grace", last_name="Hopper")
        background = BackgroundTasks()

        missing_db = SimpleNamespace(execute=AsyncMock(return_value=_ScalarCollection([])))
        with self.assertRaises(HTTPException) as caught:
            await courses.join_course(courses.JoinCourseRequest(invite_code="BAD"), background, user, missing_db)
        self.assertEqual(caught.exception.status_code, 404)

        course = SimpleNamespace(id=5, course_name="Secure Systems", course_code="SEC401", teacher_id="teacher-1")
        existing_db = SimpleNamespace(
            execute=AsyncMock(side_effect=[_ScalarCollection([course]), _ScalarOne(99)])
        )
        result = await courses.join_course(courses.JoinCourseRequest(invite_code="SEC401"), background, user, existing_db)
        self.assertIn("already enrolled", result["message"])
        self.assertEqual(result["course"]["id"], 5)

    async def test_join_course_rolls_back_duplicate_commit_and_schedules_notification_on_success(self):
        user = SimpleNamespace(id="student-1", first_name="Grace", last_name="Hopper")
        course = SimpleNamespace(id=5, course_name="Secure Systems", course_code="SEC401", teacher_id="teacher-1")

        duplicate_db = SimpleNamespace(
            execute=AsyncMock(side_effect=[_ScalarCollection([course]), _ScalarOne(None)]),
            add=MagicMock(),
            commit=AsyncMock(side_effect=IntegrityError("insert", {}, RuntimeError("duplicate"))),
            rollback=AsyncMock(),
        )
        with self.assertRaises(HTTPException) as caught:
            await courses.join_course(
                courses.JoinCourseRequest(invite_code="SEC401"), BackgroundTasks(), user, duplicate_db
            )
        self.assertEqual(caught.exception.status_code, 400)
        duplicate_db.rollback.assert_awaited_once()

        success_db = SimpleNamespace(
            execute=AsyncMock(side_effect=[_ScalarCollection([course]), _ScalarOne(None)]),
            add=MagicMock(), commit=AsyncMock(), rollback=AsyncMock(),
        )
        background = BackgroundTasks()
        result = await courses.join_course(
            courses.JoinCourseRequest(invite_code="SEC401"), background, user, success_db
        )
        self.assertEqual(result["message"], "Course joined successfully.")
        success_db.add.assert_called_once()
        success_db.commit.assert_awaited_once()
        self.assertEqual(len(background.tasks), 1)

    async def test_get_enrolled_courses_projects_public_course_fields(self):
        rows = [
            SimpleNamespace(id=5, course_name="Secure Systems", course_code="SEC401"),
            SimpleNamespace(id=7, course_name="Applied AI", course_code="AI402"),
        ]
        db = SimpleNamespace(execute=AsyncMock(return_value=_ScalarCollection(rows)))
        result = await courses.get_enrolled_courses(
            current_user=SimpleNamespace(id="student-1"), db=db
        )
        self.assertEqual([row["course_code"] for row in result["courses"]], ["SEC401", "AI402"])


class ModelAndDependencyCoverageTests(unittest.IsolatedAsyncioTestCase):
    async def test_model_metrics_features_and_enabled_reload_expose_only_public_contracts(self):
        status = {
            "status": "ready", "model_available": True, "model_name": "TypeTrace",
            "model_version": "v2", "feature_family": "public-timing-v2", "feature_count": 43,
            "feature_columns": ["dwell_mean"], "trained_at": "2026-08-01", "metrics": {"f1": 0.91},
        }
        engine = SimpleNamespace(get_status=MagicMock(return_value=status), reload=MagicMock(return_value={
            "status": "ready", "model_available": True, "model_name": "TypeTrace",
            "model_version": "v2", "feature_family": "public-timing-v2", "feature_count": 43,
            "decision_note": "reloaded",
        }))
        with patch.object(model, "inference_engine", engine):
            metrics = await model.get_model_metrics()
            features = await model.get_model_features()
        self.assertEqual(metrics["metrics"]["f1"], 0.91)
        self.assertEqual(features["feature_columns"], ["dwell_mean"])

        with (
            patch.object(model, "settings", SimpleNamespace(is_production=False, ALLOW_MODEL_RELOAD=True)),
            patch.object(model, "inference_engine", engine),
        ):
            reloaded = await model.reload_model(SimpleNamespace(role="TEACHER"))
        self.assertEqual(reloaded["status"], "ready")
        engine.reload.assert_called_once()

    def test_dependency_helpers_return_bearer_challenge_and_enforce_generic_role(self):
        exc = deps.credentials_exception()
        self.assertEqual(exc.status_code, 401)
        self.assertEqual(exc.headers, {"WWW-Authenticate": "Bearer"})

        deps.require_role(SimpleNamespace(role="STUDENT"), "STUDENT")
        with self.assertRaises(HTTPException) as caught:
            deps.require_role(SimpleNamespace(role="TEACHER"), "STUDENT")
        self.assertEqual(caught.exception.status_code, 403)
        self.assertEqual(caught.exception.detail, "Student account required.")


if __name__ == "__main__":
    unittest.main(verbosity=2)
