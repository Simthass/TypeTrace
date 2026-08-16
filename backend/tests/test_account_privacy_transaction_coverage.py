from __future__ import annotations

import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException, Response

from app.api.routes import user as user_routes
from app.core.crypto import encrypt_json, encrypt_text
from app.schemas.responses import SensitiveExportRequest
from tests.helpers import make_user
from tests.persistence_coverage_helpers import CoverageSession, make_request


NOW = datetime(2026, 8, 14, 14, 0, tzinfo=timezone.utc)


def account_user(*, role: str = "STUDENT", user_id: str = "student-a"):
    user = make_user(user_id=user_id, role=role)
    user.created_at = NOW
    user.updated_at = NOW
    return user


class AccountPrivacyTransactionCoverageTests(unittest.IsolatedAsyncioTestCase):
    def test_password_change_schema_rejects_missing_letter_or_digit(self) -> None:
        with self.assertRaises(ValueError):
            user_routes.PasswordChangeRequest(current_password="Current1", new_password="12345678")
        with self.assertRaises(ValueError):
            user_routes.PasswordChangeRequest(current_password="Current1", new_password="abcdefgh")

    async def test_account_summary_maps_database_aggregates(self) -> None:
        db = CoverageSession([
            {
                "total_sessions": 4,
                "certificate_count": 2,
                "total_seconds": 720.5,
                "total_keystrokes": 6000,
                "avg_wpm": 42.3,
                "avg_confidence": 84.4,
                "last_session_at": NOW,
            },
            3,
            1,
        ])
        result = await user_routes._fetch_account_summary(db, "student-a")
        self.assertEqual(result["total_sessions"], 4)
        self.assertEqual(result["certificate_count"], 2)
        self.assertEqual(result["enrolled_courses"], 3)
        self.assertEqual(result["owned_courses"], 1)

    async def test_build_sensitive_export_decrypts_authorized_session_and_serializes_related_records(self) -> None:
        session_rows = [{
            "id": 157,
            "title": "Private essay",
            "text_content": encrypt_text("secret essay text"),
            "word_count": 3,
            "wpm": 40.0,
            "total_keystrokes": 100,
            "deletions": 2,
            "pauses": 1,
            "avg_iki": 180.0,
            "duration_seconds": 60.0,
            "classification_result": "HUMAN",
            "ml_confidence_score": 91.0,
            "raw_keystroke_data": encrypt_json([{"type": "keydown", "key": "a", "timestamp": 1}]),
            "certificate_id": "TT-157",
            "document_hash": "a" * 64,
            "review_status": "APPROVED",
            "review_notes": "Reviewed",
            "risk_level": "LOW",
            "decision_source": "MODEL_FUSION",
            "model_available": True,
            "degraded_analysis": False,
            "created_at": NOW,
            "updated_at": NOW,
            "course_name": "Dissertation",
            "course_code": "FYP401",
        }]
        certificate_rows = [{
            "id": 1,
            "certificate_id": "TT-157",
            "document_hash": "a" * 64,
            "verification_status": "VALID",
            "revoked_at": None,
            "generated_at": NOW,
            "session_title": "Private essay",
        }]
        enrolled_rows = [{
            "id": 5,
            "course_name": "Dissertation",
            "course_code": "FYP401",
            "is_archived": False,
            "joined_at": NOW,
        }]
        owned_rows = [{
            "id": 8,
            "course_name": "Owned course",
            "course_code": "OWN1",
            "is_archived": False,
            "created_at": NOW,
            "student_count": 4,
            "submission_count": 9,
        }]
        summary_row = {
            "total_sessions": 1,
            "certificate_count": 1,
            "total_seconds": 60,
            "total_keystrokes": 100,
            "avg_wpm": 40,
            "avg_confidence": 91,
            "last_session_at": NOW,
        }
        db = CoverageSession([
            session_rows,
            certificate_rows,
            enrolled_rows,
            owned_rows,
            summary_row,
            1,
            1,
        ])
        result = await user_routes._build_export(
            db=db,
            current_user=account_user(),
            include_sensitive=True,
        )
        self.assertTrue(result["privacy"]["include_sensitive"])
        self.assertEqual(result["sessions"][0]["text_content"], "secret essay text")
        self.assertEqual(result["sessions"][0]["raw_keystroke_data"][0]["key"], "a")
        self.assertEqual(result["certificates"][0]["certificate_id"], "TT-157")
        self.assertEqual(result["enrolled_courses"][0]["course_code"], "FYP401")
        self.assertEqual(result["owned_courses"][0]["student_count"], 4)

    async def test_sensitive_export_rejects_wrong_password_with_no_store_headers(self) -> None:
        response = Response()
        with patch.object(user_routes, "verify_password", return_value=False):
            with self.assertRaises(HTTPException) as raised:
                await user_routes.export_sensitive_user_data(
                    payload=SensitiveExportRequest(current_password="WrongPass1", confirmation="EXPORT"),
                    request=make_request("/api/v1/user/data-export/sensitive"),
                    response=response,
                    current_user=account_user(),
                    db=CoverageSession(),
                )
        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    async def test_sensitive_export_audits_and_commits_after_reauthentication(self) -> None:
        db = CoverageSession()
        audit = SimpleNamespace(event_type="SENSITIVE_DATA_EXPORTED")
        with (
            patch.object(user_routes, "verify_password", return_value=True),
            patch.object(user_routes, "_build_export", new_callable=AsyncMock, return_value={"status": "success", "privacy": {"include_sensitive": True}}) as build,
            patch.object(user_routes, "create_audit_log", return_value=audit),
        ):
            result = await user_routes.export_sensitive_user_data(
                payload=SensitiveExportRequest(current_password="Current123!", confirmation="EXPORT"),
                request=make_request("/api/v1/user/data-export/sensitive"),
                response=Response(),
                current_user=account_user(),
                db=db,
            )
        self.assertEqual(result["status"], "success")
        self.assertTrue(build.await_args.kwargs["include_sensitive"])
        self.assertIn(audit, db.added)
        self.assertEqual(db.commits, 1)

    async def test_sensitive_export_commit_failure_rolls_back(self) -> None:
        db = CoverageSession(commit_exception=RuntimeError("database down"))
        with (
            patch.object(user_routes, "verify_password", return_value=True),
            patch.object(user_routes, "_build_export", new_callable=AsyncMock, return_value={"status": "success"}),
        ):
            with self.assertRaises(RuntimeError):
                await user_routes.export_sensitive_user_data(
                    payload=SensitiveExportRequest(current_password="Current123!", confirmation="EXPORT"),
                    request=make_request("/api/v1/user/data-export/sensitive"),
                    response=Response(),
                    current_user=account_user(),
                    db=db,
                )
        self.assertEqual(db.rollbacks, 1)

    async def test_delete_account_requires_confirmation_and_correct_password(self) -> None:
        student = account_user()
        with self.assertRaises(HTTPException) as confirmation:
            await user_routes.delete_user_account(
                payload=user_routes.DeleteAccountRequest(password="Current123!", confirmation="NO"),
                request=make_request("/api/v1/user/account", "DELETE"),
                response=Response(),
                current_user=student,
                db=CoverageSession(),
            )
        self.assertEqual(confirmation.exception.status_code, 400)

        with patch.object(user_routes, "verify_password", return_value=False):
            with self.assertRaises(HTTPException) as password:
                await user_routes.delete_user_account(
                    payload=user_routes.DeleteAccountRequest(password="wrong", confirmation="DELETE"),
                    request=make_request("/api/v1/user/account", "DELETE"),
                    response=Response(),
                    current_user=student,
                    db=CoverageSession(),
                )
        self.assertIn("incorrect", password.exception.detail.lower())

    async def test_student_delete_anonymizes_identity_and_removes_enrollment_membership(self) -> None:
        db = CoverageSession([None, None])
        audit = SimpleNamespace(event_type="ACCOUNT_ANONYMIZED")
        with (
            patch.object(user_routes, "verify_password", return_value=True),
            patch.object(user_routes, "get_password_hash", return_value="disabled-hash"),
            patch.object(user_routes, "create_audit_log", return_value=audit),
        ):
            result = await user_routes.delete_user_account(
                payload=user_routes.DeleteAccountRequest(password="Current123!", confirmation=" delete "),
                request=make_request("/api/v1/user/account", "DELETE"),
                response=Response(),
                current_user=account_user(),
                db=db,
            )
        self.assertEqual(result["status"], "success")
        self.assertIn("course_students", str(db.executed[0][0]))
        self.assertEqual(db.executed[1][1]["email"], "deleted-student-a@typetrace.local")
        self.assertEqual(db.executed[1][1]["student_id"], "deleted-student-a")
        self.assertIn(audit, db.added)
        self.assertEqual(db.commits, 1)

    async def test_teacher_delete_archives_owned_courses_before_anonymization(self) -> None:
        db = CoverageSession([None, None])
        with (
            patch.object(user_routes, "verify_password", return_value=True),
            patch.object(user_routes, "get_password_hash", return_value="disabled-hash"),
        ):
            result = await user_routes.delete_user_account(
                payload=user_routes.DeleteAccountRequest(password="Current123!", confirmation="DELETE"),
                request=make_request("/api/v1/user/account", "DELETE"),
                response=Response(),
                current_user=account_user(role="TEACHER", user_id="teacher-a"),
                db=db,
            )
        self.assertEqual(result["status"], "success")
        self.assertIn("UPDATE courses", str(db.executed[0][0]))
        self.assertEqual(db.executed[1][1]["student_id"], None)
        self.assertEqual(db.commits, 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
