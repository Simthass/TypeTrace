from __future__ import annotations

import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import BackgroundTasks, HTTPException
from sqlalchemy.exc import IntegrityError

from app.api.routes import teacher as teacher_routes
from tests.helpers import make_user
from tests.persistence_coverage_helpers import CoverageSession, make_request


NOW = datetime(2026, 8, 14, 13, 0, tzinfo=timezone.utc)


def teacher_user():
    return make_user(user_id="teacher-a", role="TEACHER")


def course_row(**overrides):
    row = {
        "id": 5,
        "course_name": "Dissertation",
        "course_code": "FYP401",
        "invite_code": "TT-ABCDEFGH",
        "created_at": NOW,
        "student_count": 2,
        "submission_count": 3,
        "pending_count": 1,
        "approved_count": 1,
        "flagged_count": 1,
        "avg_confidence": 76.5,
        "avg_wpm": 41.2,
    }
    row.update(overrides)
    return row


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
        "risk_level": "MEDIUM",
        "review_status": "PENDING",
        "review_notes": "",
        "wpm": 38.5,
        "duration_seconds": 260.0,
        "total_keystrokes": 1200,
        "deletions": 44,
        "pauses": 16,
        "avg_iki": 205.4,
        "word_count": 310,
        "certificate_id": None,
        "document_hash": "hash-157",
        "decision_source": "MODEL_FUSION",
        "model_available": True,
        "degraded_analysis": False,
        "created_at": NOW,
        "review_saved_at": NOW,
    }
    row.update(overrides)
    return row


class TeacherTransactionCoverageTests(unittest.IsolatedAsyncioTestCase):
    async def test_safe_unread_cache_contains_post_commit_failure(self) -> None:
        with patch.object(teacher_routes, "bump_unread_cache", new_callable=AsyncMock, side_effect=RuntimeError("redis down")) as bump:
            await teacher_routes._safe_bump_unread_cache("student-a")
        bump.assert_awaited_once_with(recipient_id="student-a")

    async def test_create_course_normalizes_input_and_commits(self) -> None:
        row = {
            "id": 5,
            "course_name": "Research Methods",
            "course_code": "FYP401",
            "invite_code": "TT-ABCDEFGH",
            "created_at": NOW,
        }
        db = CoverageSession([row])
        with patch.object(teacher_routes, "_generate_invite_code", return_value="TT-ABCDEFGH"):
            result = await teacher_routes.create_teacher_course(
                payload=teacher_routes.TeacherCourseCreate(course_name="  Research Methods  ", course_code=" fyp401 "),
                current_user=teacher_user(),
                db=db,
            )
        self.assertEqual(result["course"]["course_code"], "FYP401")
        self.assertEqual(db.commits, 1)
        self.assertEqual(db.executed[0][1]["course_name"], "Research Methods")
        self.assertEqual(db.executed[0][1]["invite_code"], "TT-ABCDEFGH")

    async def test_create_course_rolls_back_duplicate_code(self) -> None:
        duplicate = IntegrityError("insert", {}, RuntimeError("duplicate"))
        db = CoverageSession([duplicate])
        with self.assertRaises(HTTPException) as raised:
            await teacher_routes.create_teacher_course(
                payload=teacher_routes.TeacherCourseCreate(course_name="Research", course_code="FYP401"),
                current_user=teacher_user(),
                db=db,
            )
        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(db.rollbacks, 1)

    async def test_list_courses_serializes_aggregate_rows(self) -> None:
        result = await teacher_routes.list_teacher_courses(
            current_user=teacher_user(),
            db=CoverageSession([[course_row(), course_row(id=6, course_code="FYP402")]]),
        )
        self.assertEqual([course["id"] for course in result["courses"]], [5, 6])
        self.assertEqual(result["courses"][0]["pending_count"], 1)

    async def test_course_detail_serializes_students_and_recent_submissions(self) -> None:
        student_rows = [{
            "id": "student-a",
            "first_name": "Grace",
            "last_name": "Hopper",
            "email": "grace@example.com",
            "student_id": "STU-157",
            "joined_at": NOW,
            "submission_count": 3,
            "avg_confidence": 77.5,
            "avg_wpm": 40.0,
            "last_submission_at": NOW,
        }]
        result = await teacher_routes.get_teacher_course_detail(
            course_id=5,
            current_user=teacher_user(),
            db=CoverageSession([course_row(), student_rows, [submission_row()]]),
        )
        self.assertEqual(result["course"]["course_name"], "Dissertation")
        self.assertEqual(result["students"][0]["student_name"], "Grace Hopper")
        self.assertEqual(result["submissions"][0]["id"], 157)

    async def test_course_detail_fails_closed_for_foreign_course(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            await teacher_routes.get_teacher_course_detail(
                course_id=999,
                current_user=teacher_user(),
                db=CoverageSession([None]),
            )
        self.assertEqual(raised.exception.status_code, 404)

    async def test_review_returns_idempotent_result_without_write(self) -> None:
        existing = {
            "id": 157,
            "user_id": "student-a",
            "title": "Evidence report",
            "review_status": "APPROVED",
            "review_notes": "Looks good",
            "reviewed_by": "teacher-a",
            "updated_at": NOW,
        }
        db = CoverageSession([existing])
        result = await teacher_routes.review_teacher_submission(
            session_id=157,
            payload=teacher_routes.TeacherReviewUpdate(status="APPROVED", notes=" Looks good "),
            request=make_request("/api/v1/teacher/sessions/157/review", "PATCH"),
            background_tasks=BackgroundTasks(),
            current_user=teacher_user(),
            db=db,
        )
        self.assertFalse(result["review_changed"])
        self.assertFalse(result["notification_created"])
        self.assertEqual(db.commits, 0)

    async def test_review_update_writes_notification_audit_and_background_cache_task(self) -> None:
        existing = {
            "id": 157,
            "user_id": "student-a",
            "title": "Evidence report",
            "review_status": "PENDING",
            "review_notes": "",
            "reviewed_by": None,
            "updated_at": NOW,
        }
        updated = {"updated_at": NOW}
        audit = SimpleNamespace(event_type="TEACHER_REVIEW_UPDATED")
        db = CoverageSession([existing, updated, None])
        background = BackgroundTasks()
        with (
            patch.object(teacher_routes, "create_audit_log", return_value=audit),
            patch.object(teacher_routes.uuid, "uuid4", return_value="notification-1"),
        ):
            result = await teacher_routes.review_teacher_submission(
                session_id=157,
                payload=teacher_routes.TeacherReviewUpdate(status="FLAGGED", notes=" Review required "),
                request=make_request("/api/v1/teacher/sessions/157/review", "PATCH"),
                background_tasks=background,
                current_user=teacher_user(),
                db=db,
            )
        self.assertTrue(result["review_changed"])
        self.assertTrue(result["notification_created"])
        self.assertEqual(result["review_notes"], "Review required")
        self.assertIn(audit, db.added)
        self.assertEqual(db.commits, 1)
        self.assertEqual(len(background.tasks), 1)
        self.assertEqual(db.executed[2][1]["recipient_id"], "student-a")

    async def test_review_commit_failure_rolls_back_and_propagates(self) -> None:
        existing = {
            "id": 157,
            "user_id": "student-a",
            "title": "Evidence report",
            "review_status": "PENDING",
            "review_notes": "",
            "reviewed_by": None,
            "updated_at": NOW,
        }
        db = CoverageSession([existing, {"updated_at": NOW}, None], commit_exception=RuntimeError("database down"))
        with self.assertRaises(RuntimeError):
            await teacher_routes.review_teacher_submission(
                session_id=157,
                payload=teacher_routes.TeacherReviewUpdate(status="NEEDS_DISCUSSION", notes="Meet student"),
                request=make_request("/api/v1/teacher/sessions/157/review", "PATCH"),
                background_tasks=BackgroundTasks(),
                current_user=teacher_user(),
                db=db,
            )
        self.assertEqual(db.rollbacks, 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
