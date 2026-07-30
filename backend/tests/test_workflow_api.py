"""Focused HTTP contract tests for courses, drafts, notifications, and verification."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.deps import get_current_user, require_student
from app.api.routes.certificates import router as certificates_router
from app.api.routes.courses import router as courses_router
from app.api.routes.drafts import router as drafts_router
from app.api.routes.notifications import router as notifications_router
from app.core.rate_limit import limiter
from app.db.database import get_db
from tests.helpers import FakeAsyncSession, make_user


def build_workflow_app() -> FastAPI:
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(
        RateLimitExceeded,
        _rate_limit_exceeded_handler,
    )
    app.include_router(courses_router, prefix="/api/v1")
    app.include_router(drafts_router, prefix="/api/v1")
    app.include_router(
        notifications_router,
        prefix="/api/v1/notifications",
    )
    app.include_router(certificates_router, prefix="/api/v1")
    return app


class WorkflowApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = build_workflow_app()
        self.client = TestClient(self.app)
        self.student = make_user()

        async def _student_override():
            return self.student

        self.app.dependency_overrides[require_student] = _student_override
        self.app.dependency_overrides[get_current_user] = _student_override

    def tearDown(self) -> None:
        self.app.dependency_overrides.clear()
        self.client.close()

    def override_database(self, session: FakeAsyncSession) -> None:
        async def _override():
            yield session

        self.app.dependency_overrides[get_db] = _override

    def test_invalid_course_invite_code_returns_not_found(self) -> None:
        self.override_database(FakeAsyncSession([None]))

        response = self.client.post(
            "/api/v1/courses/join",
            json={"invite_code": "INVALID"},
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.json()["detail"],
            "Invalid course invite code.",
        )

    def test_existing_course_enrolment_is_idempotent(self) -> None:
        course = SimpleNamespace(
            id=7,
            teacher_id="teacher-1",
            course_name="Final Year Project",
            course_code="FYP001",
            invite_code="JOIN123",
        )
        self.override_database(FakeAsyncSession([course, 99]))

        response = self.client.post(
            "/api/v1/courses/join",
            json={"invite_code": " join123 "},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["message"],
            "You are already enrolled in this course.",
        )
        self.assertEqual(response.json()["course"]["id"], 7)

    def test_missing_draft_returns_consistent_not_found_response(self) -> None:
        self.override_database(FakeAsyncSession([None]))

        response = self.client.get("/api/v1/drafts/missing-draft")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Draft not found.")

    def test_notification_list_serializes_safe_fields(self) -> None:
        notification = SimpleNamespace(
            id="notification-1",
            event_type="REVIEW_COMPLETED",
            entity_type="typing_session",
            entity_id="10",
            title="Review completed",
            body="Your submission was reviewed.",
            action_url="/sessions/10",
            is_read=False,
            created_at=datetime(2026, 7, 22, tzinfo=timezone.utc),
        )
        self.override_database(FakeAsyncSession([[notification]]))

        response = self.client.get("/api/v1/notifications")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "success")
        self.assertEqual(len(payload["notifications"]), 1)
        self.assertEqual(
            payload["notifications"][0]["id"],
            "notification-1",
        )
        self.assertNotIn("recipient_id", payload["notifications"][0])

    def test_unknown_public_certificate_returns_invalid_not_exception(self) -> None:
        with patch(
            "app.api.routes.certificates._fetch_certificate_record",
            new_callable=AsyncMock,
            return_value=None,
        ):
            response = self.client.get("/api/v1/verify/TT-UNKNOWN1")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["valid"])
        self.assertEqual(response.json()["status"], "NOT_FOUND")


if __name__ == "__main__":
    unittest.main(verbosity=2)
