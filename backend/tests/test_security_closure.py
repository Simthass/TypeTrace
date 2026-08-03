"""Part 4A/4B correctness, privacy, ownership, and notification tests."""

from __future__ import annotations

import json
import unittest
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import BackgroundTasks, HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request
from starlette.responses import Response

from app.api.routes.certificates import (
    _authorize_certificate_audit,
    revoke_certificate,
)
from app.api.routes.courses import join_course
from app.api.routes.drafts import DraftUpsertRequest, get_draft, upsert_draft
from app.api.routes.replay import _authorize_replay_access
from app.api.routes.student import get_student_session_detail
from app.api.routes.sessions import analyze_session
from app.api.deps import get_current_user, require_student
from app.api.routes.teacher import (
    TeacherReviewUpdate,
    get_teacher_course_detail,
    review_teacher_submission,
)
from app.core.crypto import decrypt_json, decrypt_text, encrypt_json, encrypt_text
from app.core.rate_limit import reauth_rate_limit_key
from app.models.notification import Notification
from app.services.notifications import dispatch_notification
from app.db.database import get_db
from app.main import create_application
from app.models.audit import AuditLog
from app.models.draft import DraftSession
from app.models.session import TypingSession
from app.schemas.evidence import KeystrokeSessionAnalyzeRequest
from tests.helpers import FakeAsyncSession, make_user


def request(path: str, method: str = "POST") -> Request:
    return Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": method,
            "scheme": "http",
            "path": path,
            "raw_path": path.encode("ascii"),
            "query_string": b"",
            "headers": [(b"user-agent", b"typetrace-tests")],
            "client": ("127.0.0.1", 41000),
            "server": ("testserver", 80),
        }
    )


class AssigningFakeSession(FakeAsyncSession):
    async def flush(self) -> None:
        await super().flush()
        for value in self.added:
            if isinstance(value, TypingSession) and value.id is None:
                value.id = 501
            if isinstance(value, DraftSession) and value.id is None:
                value.id = "draft-server-501"




class StructuredErrorEnvelopeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = create_application()
        self.client = TestClient(self.app)
        self.student = make_user(user_id="student-envelope", role="STUDENT")

        async def student_override():
            return self.student

        self.app.dependency_overrides[require_student] = student_override
        self.app.dependency_overrides[get_current_user] = student_override

    def tearDown(self) -> None:
        self.app.dependency_overrides.clear()
        self.client.close()

    def override_database(self, session: FakeAsyncSession) -> None:
        async def database_override():
            yield session

        self.app.dependency_overrides[get_db] = database_override

    def test_draft_conflict_uses_machine_readable_error_envelope(self) -> None:
        now = datetime.now(timezone.utc)
        draft = SimpleNamespace(
            id="draft-server-envelope",
            local_draft_id="local-envelope",
            title="Server title",
            text_content=encrypt_text("server plaintext"),
            course_id=None,
            keystroke_array=encrypt_json([]),
            active_duration_ms=1000,
            started_at=now,
            last_activity_at=now,
            paused_at=now,
            version=4,
            lifecycle_status="PAUSED",
            sync_status="SYNCED",
            save_reason="autosave",
            created_at=now,
            updated_at=now,
        )
        self.override_database(FakeAsyncSession([draft]))

        response = self.client.post(
            "/api/v1/drafts",
            json={
                "draft_id": "local-envelope",
                "title": "Stale",
                "text_content": "stale",
                "keystroke_array": [],
                "expected_version": 3,
            },
        )

        self.assertEqual(response.status_code, 409)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "DRAFT_VERSION_CONFLICT")
        self.assertEqual(
            payload["error"]["details"]["server_draft"]["text_content"],
            "server plaintext",
        )
        self.assertEqual(payload["detail"], "Draft version conflict.")

    def test_password_reauthentication_is_rate_limited(self) -> None:
        self.override_database(FakeAsyncSession())
        unique_token = f"Bearer part4-{uuid.uuid4()}"

        with patch("app.api.routes.user.verify_password", return_value=False):
            responses = [
                self.client.post(
                    "/api/v1/user/change-password",
                    headers={"Authorization": unique_token},
                    json={
                        "current_password": "wrong-password",
                        "new_password": "abc12345",
                    },
                )
                for _ in range(6)
            ]

        self.assertTrue(all(item.status_code == 400 for item in responses[:5]))
        self.assertEqual(responses[5].status_code, 429)

    def test_reauthentication_key_never_contains_the_bearer_token(self) -> None:
        raw_token = f"secret-token-{uuid.uuid4()}"
        scoped_request = Request(
            {
                "type": "http",
                "http_version": "1.1",
                "method": "POST",
                "scheme": "http",
                "path": "/api/v1/user/change-password",
                "raw_path": b"/api/v1/user/change-password",
                "query_string": b"",
                "headers": [
                    (b"authorization", f"Bearer {raw_token}".encode("ascii")),
                ],
                "client": ("127.0.0.1", 41001),
                "server": ("testserver", 80),
            }
        )

        key = reauth_rate_limit_key(scoped_request)

        self.assertTrue(key.startswith("reauth:127.0.0.1:"))
        self.assertNotIn(raw_token, key)
        self.assertNotIn("Bearer", key)


class DraftSecurityTests(unittest.IsolatedAsyncioTestCase):
    async def test_draft_write_persists_ciphertext_but_returns_plaintext(self) -> None:
        db = AssigningFakeSession([None])
        student = make_user(user_id="student-a")
        payload = DraftUpsertRequest(
            draft_id="local-a",
            title="Private draft",
            text_content="private essay text",
            keystroke_array=[],
            expected_version=None,
        )

        result = await upsert_draft(
            payload=payload,
            request=request("/api/v1/drafts"),
            current_user=student,
            db=db,
        )

        stored = next(item for item in db.added if isinstance(item, DraftSession))
        self.assertNotEqual(stored.text_content, "private essay text")
        self.assertEqual(decrypt_text(stored.text_content), "private essay text")
        self.assertEqual(decrypt_json(stored.keystroke_array), [])
        self.assertEqual(result["draft"]["text_content"], "private essay text")
        self.assertEqual(result["draft"]["keystroke_array"], [])

    async def test_version_conflict_returns_decrypted_authorized_snapshot(self) -> None:
        now = datetime.now(timezone.utc)
        draft = SimpleNamespace(
            id="draft-server-1",
            local_draft_id="local-1",
            title="Server title",
            text_content=encrypt_text("server plaintext"),
            course_id=None,
            keystroke_array=encrypt_json([]),
            active_duration_ms=1000,
            started_at=now,
            last_activity_at=now,
            paused_at=now,
            version=4,
            lifecycle_status="PAUSED",
            sync_status="SYNCED",
            save_reason="autosave",
            created_at=now,
            updated_at=now,
        )
        db = FakeAsyncSession([draft])
        payload = DraftUpsertRequest(
            draft_id="local-1",
            title="Stale title",
            text_content="stale text",
            keystroke_array=[],
            expected_version=3,
        )

        with self.assertRaises(HTTPException) as raised:
            await upsert_draft(
                payload=payload,
                request=request("/api/v1/drafts"),
                current_user=make_user(user_id="student-a"),
                db=db,
            )

        exc = raised.exception
        self.assertEqual(exc.status_code, 409)
        self.assertEqual(getattr(exc, "code", None), "DRAFT_VERSION_CONFLICT")
        details = getattr(exc, "details", {})
        self.assertEqual(
            details["server_draft"]["text_content"],
            "server plaintext",
        )
        self.assertNotIn(str(draft.text_content), json.dumps(details))


class OwnershipBoundaryTests(unittest.IsolatedAsyncioTestCase):
    async def test_student_session_query_is_scoped_to_current_user(self) -> None:
        db = FakeAsyncSession([None])
        with self.assertRaises(HTTPException) as raised:
            await get_student_session_detail(
                session_id=77,
                current_user=make_user(user_id="student-a", role="STUDENT"),
                db=db,
            )
        self.assertEqual(raised.exception.status_code, 404)
        statement, parameters = db.executed[0]
        self.assertIn("ts.user_id = :user_id", str(statement))
        self.assertEqual(parameters["user_id"], "student-a")

    async def test_student_cannot_fetch_foreign_draft(self) -> None:
        db = FakeAsyncSession([None])
        with self.assertRaises(HTTPException) as raised:
            await get_draft(
                draft_id="foreign-draft",
                current_user=make_user(user_id="student-a", role="STUDENT"),
                db=db,
            )
        self.assertEqual(raised.exception.status_code, 404)
        statement, _ = db.executed[0]
        self.assertIn("draft_sessions.user_id", str(statement))

    async def test_unrelated_teacher_cannot_review_foreign_submission(self) -> None:
        db = FakeAsyncSession([None])
        with self.assertRaises(HTTPException) as raised:
            await review_teacher_submission(
                session_id=88,
                payload=TeacherReviewUpdate(status="APPROVED", notes="Accepted"),
                request=request("/api/v1/teacher/sessions/88/review", "PATCH"),
                background_tasks=BackgroundTasks(),
                current_user=make_user(user_id="teacher-a", role="TEACHER"),
                db=db,
            )
        self.assertEqual(raised.exception.status_code, 404)
        _, parameters = db.executed[0]
        self.assertEqual(parameters["teacher_id"], "teacher-a")


    async def test_unrelated_teacher_cannot_open_foreign_course(self) -> None:
        db = FakeAsyncSession([None])
        with self.assertRaises(HTTPException) as raised:
            await get_teacher_course_detail(
                course_id=91,
                current_user=make_user(user_id="teacher-a", role="TEACHER"),
                db=db,
            )

        self.assertEqual(raised.exception.status_code, 404)
        _, parameters = db.executed[0]
        self.assertEqual(parameters["course_id"], 91)
        self.assertEqual(parameters["teacher_id"], "teacher-a")

    def test_student_cannot_open_foreign_authenticated_certificate_audit(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            _authorize_certificate_audit(
                {"user_id": "student-b", "teacher_id": "teacher-a"},
                make_user(user_id="student-a", role="STUDENT"),
            )
        self.assertEqual(raised.exception.status_code, 403)

    def test_teacher_cannot_open_foreign_authenticated_certificate_audit(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            _authorize_certificate_audit(
                {"user_id": "student-a", "teacher_id": "teacher-b"},
                make_user(user_id="teacher-a", role="TEACHER"),
            )
        self.assertEqual(raised.exception.status_code, 403)

    async def test_unrelated_teacher_cannot_revoke_foreign_certificate(self) -> None:
        locked = {
            "teacher_id": "teacher-b",
            "user_id": "student-a",
            "session_id": 10,
            "title": "Evidence",
            "revoked_at": None,
            "verification_status": "VALID",
        }
        with patch(
            "app.api.routes.certificates.lock_certificate_for_revocation",
            new_callable=AsyncMock,
            return_value=locked,
        ):
            with self.assertRaises(HTTPException) as raised:
                await revoke_certificate(
                    cert_id="TT-FOREIGNCERT",
                    payload=SimpleNamespace(reason="Confirmed policy correction"),
                    request=request("/api/v1/certificates/TT-FOREIGNCERT/revoke"),
                    background_tasks=BackgroundTasks(),
                    current_user=make_user(user_id="teacher-a", role="TEACHER"),
                    db=FakeAsyncSession(),
                )
        self.assertEqual(raised.exception.status_code, 403)

    def test_foreign_student_cannot_replay_another_students_session(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            _authorize_replay_access(
                {"user_id": "student-b", "teacher_id": "teacher-a"},
                make_user(user_id="student-a", role="STUDENT"),
            )
        self.assertEqual(raised.exception.status_code, 403)

    def test_unrelated_teacher_cannot_replay_foreign_course_submission(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            _authorize_replay_access(
                {"user_id": "student-a", "teacher_id": "teacher-b"},
                make_user(user_id="teacher-a", role="TEACHER"),
            )
        self.assertEqual(raised.exception.status_code, 403)


class AsyncSessionContext:
    def __init__(self, session: FakeAsyncSession) -> None:
        self.session = session

    async def __aenter__(self) -> FakeAsyncSession:
        return self.session

    async def __aexit__(self, exc_type, exc, traceback) -> None:
        return None


class NotificationAndReviewTests(unittest.IsolatedAsyncioTestCase):
    async def test_dispatch_notification_persists_before_bumping_cache(self) -> None:
        db = FakeAsyncSession()
        with (
            patch(
                "app.services.notifications.AsyncSessionLocal",
                return_value=AsyncSessionContext(db),
            ),
            patch(
                "app.services.notifications.bump_unread_cache",
                new_callable=AsyncMock,
            ) as bump,
        ):
            await dispatch_notification(
                recipient_id="student-a",
                actor_id="teacher-a",
                event_type="REVIEW_COMPLETED",
                entity_type="typing_session",
                entity_id="22",
                title="Review complete",
                body="Your evidence was reviewed.",
                action_url="/sessions/22",
            )

        notifications = [
            item for item in db.added if isinstance(item, Notification)
        ]
        self.assertEqual(len(notifications), 1)
        self.assertEqual(notifications[0].recipient_id, "student-a")
        self.assertEqual(notifications[0].event_type, "REVIEW_COMPLETED")
        self.assertEqual(db.commits, 1)
        bump.assert_awaited_once_with("student-a")

    async def test_course_join_schedules_exactly_one_teacher_notification(self) -> None:
        course = SimpleNamespace(
            id=7,
            teacher_id="teacher-a",
            course_name="Final Year Project",
            course_code="FYP001",
            invite_code="JOIN123",
        )
        db = FakeAsyncSession([course, None])
        tasks = BackgroundTasks()
        student = make_user(user_id="student-a", role="STUDENT")

        with patch(
            "app.api.routes.courses.dispatch_notification",
            new_callable=AsyncMock,
        ) as dispatch:
            result = await join_course(
                payload=SimpleNamespace(invite_code="JOIN123"),
                background_tasks=tasks,
                current_user=student,
                db=db,
            )

            self.assertEqual(result["status"], "success")
            self.assertEqual(len(tasks.tasks), 1)
            task = tasks.tasks[0]
            self.assertIs(task.func, dispatch)
            self.assertEqual(task.kwargs["recipient_id"], "teacher-a")
            self.assertEqual(task.kwargs["event_type"], "COURSE_JOINED")

    async def test_changed_teacher_review_is_audited_and_notified_once(self) -> None:
        existing = {
            "id": 22,
            "user_id": "student-a",
            "title": "Evidence report",
            "review_status": "PENDING",
            "review_notes": "",
            "reviewed_by": None,
            "updated_at": datetime(2026, 8, 1, tzinfo=timezone.utc),
        }
        updated = {"updated_at": datetime(2026, 8, 2, tzinfo=timezone.utc)}
        db = FakeAsyncSession([existing, updated, None])
        tasks = BackgroundTasks()

        result = await review_teacher_submission(
            session_id=22,
            payload=TeacherReviewUpdate(status="APPROVED", notes="Accepted"),
            request=request("/api/v1/teacher/sessions/22/review", "PATCH"),
            background_tasks=tasks,
            current_user=make_user(user_id="teacher-a", role="TEACHER"),
            db=db,
        )

        self.assertTrue(result["review_changed"])
        self.assertTrue(result["notification_created"])
        self.assertEqual(db.commits, 1)
        audit_rows = [item for item in db.added if isinstance(item, AuditLog)]
        self.assertEqual(len(audit_rows), 1)
        self.assertEqual(audit_rows[0].event_type, "TEACHER_REVIEW_UPDATED")
        self.assertEqual(audit_rows[0].event_metadata["previous_status"], "PENDING")
        self.assertEqual(audit_rows[0].event_metadata["new_status"], "APPROVED")
        self.assertNotIn("Accepted", json.dumps(audit_rows[0].event_metadata))
        self.assertEqual(len(tasks.tasks), 1)

        notification_sql, notification_parameters = db.executed[2]
        self.assertIn("INSERT INTO notifications", str(notification_sql))
        self.assertEqual(notification_parameters["recipient_id"], "student-a")
        self.assertEqual(notification_parameters["entity_id"], "22")

    async def test_identical_teacher_review_is_idempotent(self) -> None:
        existing = {
            "id": 22,
            "user_id": "student-a",
            "title": "Evidence report",
            "review_status": "APPROVED",
            "review_notes": "Accepted",
            "reviewed_by": "teacher-a",
            "updated_at": datetime(2026, 8, 2, tzinfo=timezone.utc),
        }
        db = FakeAsyncSession([existing])
        tasks = BackgroundTasks()

        result = await review_teacher_submission(
            session_id=22,
            payload=TeacherReviewUpdate(status="APPROVED", notes="Accepted"),
            request=request("/api/v1/teacher/sessions/22/review", "PATCH"),
            background_tasks=tasks,
            current_user=make_user(user_id="teacher-a", role="TEACHER"),
            db=db,
        )

        self.assertFalse(result["review_changed"])
        self.assertFalse(result["notification_created"])
        self.assertEqual(db.commits, 0)
        self.assertEqual(len(db.executed), 1)
        self.assertEqual(db.added, [])
        self.assertEqual(tasks.tasks, [])

    async def test_session_submission_schedules_teacher_notification_and_encrypts(self) -> None:
        payload = KeystrokeSessionAnalyzeRequest.model_validate(
            {
                "submission_id": "submission-part4-0001",
                "title": "Encrypted submission",
                "text_content": "hello",
                "keystroke_array": [
                    {
                        "key": "__PASTE_EVENT__",
                        "keyCode": 0,
                        "code": "Paste",
                        "type": "paste",
                        "timestamp": 1_785_280_000_000,
                        "documentLength": 0,
                        "documentLengthBefore": 0,
                        "documentLengthAfter": 5,
                        "cursorPosition": 0,
                        "selectionStartBefore": 0,
                        "selectionEndBefore": 0,
                        "selection_length_before": 0,
                        "pastedLength": 5,
                        "insertedCharacters": 5,
                        "insertedText": "hello",
                        "deletedCharacters": 0,
                        "chars_deleted": 0,
                        "deltaLength": 5,
                    }
                ],
                "stats": {
                    "wpm": 10,
                    "keystrokes": 0,
                    "deletions": 0,
                    "pauses": 0,
                    "avgIki": 0,
                    "sessionSeconds": 1,
                },
                "course_id": 7,
                "active_duration_ms": 1000,
            }
        )
        db = AssigningFakeSession()
        tasks = BackgroundTasks()
        course = SimpleNamespace(teacher_id="teacher-a")
        inference = SimpleNamespace(
            classification="HUMAN",
            confidence_score=90.0,
            risk_score=10.0,
            risk_level="LOW",
            decision_source="MODEL",
            advanced_stats={},
        )
        paste_result = {
            "classification": "HUMAN",
            "confidence_score": 90.0,
            "risk_score": 10.0,
            "risk_level": "LOW",
            "kill_switch_triggered": False,
            "kill_switch_reason": None,
            "advanced_stats": {
                "model_version": "test-model",
                "model_score": 10.0,
                "decision_source": "MODEL",
                "model_available": True,
                "degraded_analysis": False,
            },
        }
        signature = SimpleNamespace(
            algorithm="Ed25519",
            signing_key_id="test-key",
            payload_hash="hash",
        )

        with (
            patch(
                "app.api.routes.sessions._load_idempotent_response",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch(
                "app.api.routes.sessions._ensure_student_can_submit_to_course",
                new_callable=AsyncMock,
                return_value=course,
            ),
            patch(
                "app.api.routes.sessions._create_unique_certificate_id",
                new_callable=AsyncMock,
                return_value="TT-PART4TEST0001",
            ),
            patch(
                "app.api.routes.sessions.inference_engine.analyze",
                return_value=inference,
            ),
            patch(
                "app.api.routes.sessions.apply_paste_policy",
                return_value=paste_result,
            ),
            patch(
                "app.api.routes.sessions.sign_certificate_for_session",
                return_value=signature,
            ),
            patch(
                "app.api.routes.sessions.dispatch_notification",
                new_callable=AsyncMock,
            ) as dispatch,
        ):
            result = await analyze_session(
                payload=payload,
                request=request("/api/v1/sessions/analyze"),
                response=Response(),
                background_tasks=tasks,
                current_user=make_user(user_id="student-a", role="STUDENT"),
                db=db,
            )

        stored = next(item for item in db.added if isinstance(item, TypingSession))
        self.assertNotEqual(stored.text_content, "hello")
        self.assertEqual(decrypt_text(stored.text_content), "hello")
        self.assertEqual(
            decrypt_json(stored.raw_keystroke_data)[0]["insertedText"],
            "hello",
        )
        self.assertEqual(result.session_id, 501)
        self.assertEqual(len(tasks.tasks), 1)
        task = tasks.tasks[0]
        self.assertIs(task.func, dispatch)
        self.assertEqual(task.kwargs["recipient_id"], "teacher-a")
        self.assertEqual(task.kwargs["event_type"], "SESSION_SUBMITTED")


class CertificateRevocationTests(unittest.IsolatedAsyncioTestCase):
    async def test_revocation_inserts_one_notification_and_is_idempotent(self) -> None:
        locked = {
            "teacher_id": "teacher-a",
            "user_id": "student-a",
            "session_id": 10,
            "title": "Evidence report",
            "revoked_at": None,
            "verification_status": "VALID",
        }
        record = {"certificate_id": "TT-PART4CERT1"}
        public = {
            "record_found": True,
            "ledger_verified": True,
            "certificate_active": False,
            "valid": False,
            "status": "REVOKED",
            "certificate_id": "TT-PART4CERT1",
        }
        db = FakeAsyncSession([None, None, None])
        tasks = BackgroundTasks()

        with (
            patch(
                "app.api.routes.certificates.lock_certificate_for_revocation",
                new_callable=AsyncMock,
                return_value=locked,
            ),
            patch(
                "app.api.routes.certificates._fetch_certificate_record",
                new_callable=AsyncMock,
                return_value=record,
            ),
            patch(
                "app.api.routes.certificates._public_certificate_payload",
                return_value=public,
            ),
        ):
            result = await revoke_certificate(
                cert_id="TT-PART4CERT1",
                payload=SimpleNamespace(reason="Confirmed academic correction"),
                request=request("/api/v1/certificates/TT-PART4CERT1/revoke"),
                background_tasks=tasks,
                current_user=make_user(user_id="teacher-a", role="TEACHER"),
                db=db,
            )

        self.assertFalse(result["already_revoked"])
        self.assertEqual(db.commits, 1)
        self.assertEqual(len(db.executed), 3)
        notification_sql, params = db.executed[2]
        self.assertIn("INSERT INTO notifications", str(notification_sql))
        self.assertEqual(params["recipient_id"], "student-a")
        self.assertEqual(params["entity_id"], "TT-PART4CERT1")
        self.assertEqual(len(tasks.tasks), 1)

        already = dict(locked, revoked_at=datetime.now(timezone.utc))
        retry_db = FakeAsyncSession()
        retry_tasks = BackgroundTasks()
        with (
            patch(
                "app.api.routes.certificates.lock_certificate_for_revocation",
                new_callable=AsyncMock,
                return_value=already,
            ),
            patch(
                "app.api.routes.certificates._fetch_certificate_record",
                new_callable=AsyncMock,
                return_value=record,
            ),
            patch(
                "app.api.routes.certificates._public_certificate_payload",
                return_value=public,
            ),
        ):
            retry = await revoke_certificate(
                cert_id="TT-PART4CERT1",
                payload=SimpleNamespace(reason="Confirmed academic correction"),
                request=request("/api/v1/certificates/TT-PART4CERT1/revoke"),
                background_tasks=retry_tasks,
                current_user=make_user(user_id="teacher-a", role="TEACHER"),
                db=retry_db,
            )

        self.assertTrue(retry["already_revoked"])
        self.assertEqual(retry_db.executed, [])
        self.assertEqual(retry_db.commits, 0)
        self.assertEqual(retry_db.rollbacks, 1)
        self.assertEqual(retry_tasks.tasks, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
