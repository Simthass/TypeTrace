from __future__ import annotations

import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from pydantic import ValidationError

from app.api.routes import teacher as teacher_routes
from app.core.crypto import encrypt_json, encrypt_text
from tests.helpers import make_user
from tests.workflow_coverage_helpers import SequenceAsyncSession


NOW = datetime(2026, 8, 14, 7, 0, tzinfo=timezone.utc)


def submission_row(**overrides):
    row = {
        "id": 157,
        "title": "Evidence report",
        "first_name": "Grace",
        "last_name": "Hopper",
        "email": "grace@example.com",
        "student_id": "STU-157",
        "course_id": 5,
        "course_name": "Dissertation",
        "course_code": "FYP401",
        "classification": "SUSPICIOUS",
        "confidence": 61.29,
        "risk_level": None,
        "review_status": "PENDING",
        "review_notes": None,
        "wpm": 38.5,
        "duration_seconds": 260.0,
        "total_keystrokes": 1200,
        "deletions": 44,
        "pauses": 16,
        "avg_iki": 205.4,
        "word_count": 310,
        "certificate_id": "TT-COVERAGE-157",
        "document_hash": "hash-157",
        "decision_source": "MODEL_FUSION",
        "model_available": True,
        "degraded_analysis": False,
        "created_at": NOW,
    }
    row.update(overrides)
    return row


class TeacherRouteCoverageTests(unittest.IsolatedAsyncioTestCase):
    def test_teacher_models_helpers_and_invite_code_contract(self) -> None:
        course = teacher_routes.TeacherCourseCreate(course_name="Research", course_code="FYP401")
        self.assertEqual(course.course_code, "FYP401")
        review = teacher_routes.TeacherReviewUpdate(status="NEEDS_DISCUSSION", notes="Meet student")
        self.assertEqual(review.status, "NEEDS_DISCUSSION")
        with self.assertRaises(ValidationError):
            teacher_routes.TeacherReviewUpdate(status="INVALID", notes=None)
        self.assertEqual(teacher_routes._classification_bucket("AI-GENERATED"), "SYNTHETIC")
        self.assertEqual(teacher_routes._risk_level("SUSPICIOUS", None), "MEDIUM")
        self.assertEqual(teacher_routes._format_datetime(None), "Unknown")
        invite = teacher_routes._generate_invite_code()
        self.assertTrue(invite.startswith("TT-"))
        self.assertEqual(len(invite), 11)

    def test_submission_and_course_payloads_normalize_dashboard_values(self) -> None:
        submission = teacher_routes._submission_payload(submission_row())
        self.assertEqual(submission["student_name"], "Grace Hopper")
        self.assertEqual(submission["classification_bucket"], "SUSPICIOUS")
        self.assertEqual(submission["risk_level"], "MEDIUM")
        self.assertEqual(submission["review_status"], "PENDING")
        course = teacher_routes._course_payload(
            {
                "id": 5,
                "course_name": "Dissertation",
                "course_code": "FYP401",
                "invite_code": "TT-ABCDEFGH",
                "created_at": NOW,
                "student_count": 14,
                "submission_count": 9,
                "pending_count": 3,
                "approved_count": 5,
                "flagged_count": 1,
                "avg_confidence": 81.2,
                "avg_wpm": 42.7,
            }
        )
        self.assertEqual(course["student_count"], 14)
        self.assertEqual(course["course_code"], "FYP401")

    async def test_dashboard_serializes_teacher_workspace(self) -> None:
        summary = {
            "total_courses": 2,
            "total_students": 18,
            "total_submissions": 12,
            "pending_reviews": 4,
            "approved_reviews": 6,
            "flagged_reviews": 2,
            "human_submissions": 7,
            "suspicious_submissions": 4,
            "synthetic_submissions": 1,
            "avg_confidence": 79.5,
            "avg_wpm": 41.2,
        }
        course = {
            "id": 5,
            "course_name": "Dissertation",
            "course_code": "FYP401",
            "invite_code": "TT-ABCDEFGH",
            "created_at": NOW,
            "student_count": 10,
            "submission_count": 8,
            "pending_count": 3,
            "approved_count": 4,
            "flagged_count": 1,
            "avg_confidence": 80,
            "avg_wpm": 42,
        }
        db = SequenceAsyncSession([summary, [submission_row()], [course]])
        result = await teacher_routes.get_teacher_dashboard(
            current_user=make_user(user_id="teacher-a", role="TEACHER"),
            db=db,
        )
        self.assertEqual(result["summary"]["pending_reviews"], 4)
        self.assertEqual(result["recent_submissions"][0]["student_name"], "Grace Hopper")
        self.assertEqual(result["courses"][0]["student_count"], 10)
        self.assertEqual(len(db.executed), 3)

    async def test_student_roster_serializes_activity_and_review_counts(self) -> None:
        row = {
            "id": "student-a",
            "first_name": "Grace",
            "last_name": "Hopper",
            "email": "grace@example.com",
            "student_id": "STU-157",
            "university_name": "TypeTrace University",
            "course_id": 5,
            "course_name": "Dissertation",
            "course_code": "FYP401",
            "joined_at": NOW,
            "submission_count": 4,
            "avg_confidence": 82.2,
            "avg_wpm": 43.8,
            "pending_count": 1,
            "flagged_count": 2,
            "last_submission_at": NOW,
        }
        result = await teacher_routes.list_teacher_students(
            current_user=make_user(user_id="teacher-a", role="TEACHER"),
            db=SequenceAsyncSession([[row]]),
        )
        student = result["students"][0]
        self.assertEqual(student["student_name"], "Grace Hopper")
        self.assertEqual(student["submission_count"], 4)
        self.assertEqual(student["flagged_count"], 2)
        self.assertEqual(student["joined_at"], "2026-08-14 07:00 UTC")

    async def test_submission_queue_forwards_owner_filters_and_pagination(self) -> None:
        with patch.object(
            teacher_routes,
            "list_teacher_submission_rows",
            new_callable=AsyncMock,
            return_value=(1, [submission_row()]),
        ) as repository:
            result = await teacher_routes.list_teacher_submissions(
                course_id=5,
                review_status="PENDING",
                risk_level="MEDIUM",
                search="Grace",
                limit=20,
                offset=40,
                current_user=make_user(user_id="teacher-a", role="TEACHER"),
                db=SequenceAsyncSession(),
            )
        self.assertEqual(result["total"], 1)
        self.assertEqual(result["sessions"][0]["risk_level"], "MEDIUM")
        kwargs = repository.await_args.kwargs
        self.assertEqual(kwargs["teacher_id"], "teacher-a")
        self.assertEqual(kwargs["filters"].course_id, 5)
        self.assertEqual(kwargs["filters"].review_status, "PENDING")
        self.assertEqual(kwargs["filters"].risk_level, "MEDIUM")
        self.assertEqual(kwargs["filters"].search, "Grace")
        self.assertEqual(kwargs["limit"], 20)
        self.assertEqual(kwargs["offset"], 40)

    async def test_submission_detail_decrypts_text_and_redacts_raw_events(self) -> None:
        row = submission_row(
            text_content=encrypt_text("x" * 1300),
            raw_keystroke_data=encrypt_json([{"type": "keydown", "key": "a", "timestamp": 1}]),
            review_saved_at=NOW,
        )
        result = await teacher_routes.get_teacher_submission_detail(
            session_id=157,
            current_user=make_user(user_id="teacher-a", role="TEACHER"),
            db=SequenceAsyncSession([row]),
        )
        session = result["session"]
        self.assertEqual(session["text_content"], "x" * 1300)
        self.assertEqual(session["text_preview"], "x" * 1200)
        self.assertTrue(session["text_preview_truncated"])
        self.assertTrue(session["has_raw_keystroke_data"])
        self.assertIsNone(session["raw_keystroke_data"])
        self.assertIn("Raw keystroke events are not returned", result["privacy_notice"])

    async def test_submission_detail_fails_closed_outside_teacher_scope(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            await teacher_routes.get_teacher_submission_detail(
                session_id=999,
                current_user=make_user(user_id="teacher-a", role="TEACHER"),
                db=SequenceAsyncSession([None]),
            )
        self.assertEqual(raised.exception.status_code, 404)
        self.assertEqual(raised.exception.detail, "Submission not found.")


if __name__ == "__main__":
    unittest.main(verbosity=2)
