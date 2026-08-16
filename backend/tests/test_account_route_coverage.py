from __future__ import annotations

import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException, Response

from app.api.routes import user as user_routes
from tests.helpers import make_user
from tests.workflow_coverage_helpers import SequenceAsyncSession, make_request


NOW = datetime(2026, 8, 14, 9, 0, tzinfo=timezone.utc)


class AccountRouteCoverageTests(unittest.IsolatedAsyncioTestCase):
    def test_profile_serialization_and_datetime_fallbacks(self) -> None:
        user = make_user(user_id="student-a", role="STUDENT")
        user.created_at = NOW
        user.updated_at = None

        serialized = user_routes._serialize_user(user)

        self.assertEqual(serialized["id"], "student-a")
        self.assertEqual(serialized["role"], "STUDENT")
        self.assertEqual(serialized["created_at"], "2026-08-14 09:00 UTC")
        self.assertEqual(serialized["updated_at"], "Unknown")
        self.assertEqual(user_routes._format_datetime(None), "Unknown")
        self.assertEqual(user_routes._format_datetime(NOW), "2026-08-14 09:00 UTC")

    async def test_privacy_summary_reports_stored_categories_without_exposing_content(self) -> None:
        db = SequenceAsyncSession(
            [
                {
                    "total_sessions": 5,
                    "sessions_with_keystrokes": 4,
                    "sessions_with_text": 5,
                    "certificates": 3,
                    "total_keystrokes": 4200,
                },
                2,
                1,
            ]
        )
        result = await user_routes.get_privacy_summary(
            current_user=make_user(user_id="student-a", role="STUDENT"),
            db=db,
        )
        privacy = result["privacy"]
        self.assertEqual(privacy["total_sessions"], 5)
        self.assertEqual(privacy["course_enrollments"], 2)
        self.assertEqual(privacy["owned_courses"], 1)
        self.assertTrue(privacy["sensitive_export_requires_password"])
        self.assertEqual(privacy["delete_mode"], "anonymize_account_preserve_academic_records")
        self.assertNotIn("text_content", privacy)

    async def test_profile_update_normalizes_values_and_commits(self) -> None:
        row = {
            "id": "student-a",
            "first_name": "Grace",
            "last_name": "",
            "email": "grace@example.com",
            "role": "STUDENT",
            "student_id": "STU-1",
            "university_name": None,
            "department": "Computing",
            "is_verified": True,
            "created_at": NOW,
            "updated_at": NOW,
        }
        db = SequenceAsyncSession([row])
        payload = user_routes.ProfileUpdateRequest(
            first_name="  Grace  ",
            last_name="  ",
            university_name="   ",
            department=" Computing ",
        )
        result = await user_routes.update_user_profile(
            payload=payload,
            current_user=make_user(user_id="student-a", role="STUDENT"),
            db=db,
        )
        self.assertEqual(result["profile"]["first_name"], "Grace")
        self.assertEqual(result["profile"]["last_name"], "")
        self.assertEqual(db.commits, 1)
        _, params = db.executed[0]
        self.assertEqual(params["first_name"], "Grace")
        self.assertIsNone(params["university_name"])
        self.assertEqual(params["department"], "Computing")

    async def test_profile_update_rolls_back_when_account_disappears(self) -> None:
        payload = user_routes.ProfileUpdateRequest(first_name="Grace")
        db = SequenceAsyncSession([None])
        with self.assertRaises(HTTPException) as raised:
            await user_routes.update_user_profile(
                payload=payload,
                current_user=make_user(user_id="missing", role="STUDENT"),
                db=db,
            )
        self.assertEqual(raised.exception.status_code, 404)
        self.assertEqual(db.rollbacks, 1)

    async def test_change_password_rejects_wrong_and_reused_passwords(self) -> None:
        payload = user_routes.PasswordChangeRequest(
            current_password="Current123!",
            new_password="NewPassword123!",
        )
        user = make_user(user_id="student-a", role="STUDENT")
        with patch.object(user_routes, "verify_password", side_effect=[False]):
            with self.assertRaises(HTTPException) as wrong:
                await user_routes.change_password(
                    payload=payload,
                    request=make_request("/api/v1/user/change-password"),
                    response=Response(),
                    current_user=user,
                    db=SequenceAsyncSession(),
                )
        self.assertEqual(wrong.exception.status_code, 400)

        with patch.object(user_routes, "verify_password", side_effect=[True, True]):
            with self.assertRaises(HTTPException) as reused:
                await user_routes.change_password(
                    payload=payload,
                    request=make_request("/api/v1/user/change-password"),
                    response=Response(),
                    current_user=user,
                    db=SequenceAsyncSession(),
                )
        self.assertIn("different", reused.exception.detail)

    async def test_change_password_hashes_updates_audit_and_commits(self) -> None:
        payload = user_routes.PasswordChangeRequest(
            current_password="Current123!",
            new_password="NewPassword123!",
        )
        db = SequenceAsyncSession([None])
        audit = SimpleNamespace(event_type="PASSWORD_CHANGED")
        with (
            patch.object(user_routes, "verify_password", side_effect=[True, False]),
            patch.object(user_routes, "get_password_hash", return_value="hashed-new"),
            patch.object(user_routes, "create_audit_log", return_value=audit),
        ):
            result = await user_routes.change_password(
                payload=payload,
                request=make_request("/api/v1/user/change-password"),
                response=Response(),
                current_user=make_user(user_id="student-a", role="STUDENT"),
                db=db,
            )
        self.assertIn("Sign in again", result["message"])
        self.assertEqual(db.commits, 1)
        self.assertIn(audit, db.added)
        _, params = db.executed[0]
        self.assertEqual(params["hashed_password"], "hashed-new")

    async def test_redacted_export_blocks_sensitive_query_and_sets_no_store_headers(self) -> None:
        response = Response()
        with self.assertRaises(HTTPException) as raised:
            await user_routes.export_user_data(
                response=response,
                include_sensitive=True,
                current_user=make_user(user_id="student-a", role="STUDENT"),
                db=SequenceAsyncSession(),
            )
        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(response.headers["Cache-Control"], "no-store")

        with patch.object(user_routes, "_build_export", new_callable=AsyncMock, return_value={"status": "success"}) as build:
            response = Response()
            result = await user_routes.export_user_data(
                response=response,
                include_sensitive=False,
                current_user=make_user(user_id="student-a", role="STUDENT"),
                db=SequenceAsyncSession(),
            )
        self.assertEqual(result["status"], "success")
        self.assertFalse(build.await_args.kwargs["include_sensitive"])
        self.assertEqual(response.headers["Pragma"], "no-cache")


if __name__ == "__main__":
    unittest.main(verbosity=2)
