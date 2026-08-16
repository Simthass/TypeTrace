from __future__ import annotations

import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from app.api.routes import student as student_routes
from app.core.crypto import encrypt_text
from tests.helpers import make_user
from tests.workflow_coverage_helpers import SequenceAsyncSession


NOW = datetime(2026, 8, 14, 8, 30, tzinfo=timezone.utc)


def session_row(**overrides):
    row = {
        "id": 41,
        "title": "Research reflection",
        "classification": "AI-GENERATED",
        "confidence": 78.456,
        "risk_level": None,
        "review_status": "FLAGGED",
        "review_notes": "Discuss evidence",
        "wpm": 42.44,
        "duration_seconds": 180.26,
        "total_keystrokes": 920,
        "deletions": 31,
        "pauses": 8,
        "avg_iki": 181.24,
        "word_count": 248,
        "certificate_id": "TT-COVERAGE-41",
        "document_hash": "hash-41",
        "decision_source": "MODEL_FUSION",
        "model_available": True,
        "degraded_analysis": False,
        "course_name": "Dissertation",
        "course_code": "FYP401",
        "created_at": NOW,
    }
    row.update(overrides)
    return row


class StudentRouteCoverageTests(unittest.IsolatedAsyncioTestCase):
    def test_student_helper_normalization_covers_aliases_fallbacks_and_dates(self) -> None:
        self.assertEqual(student_routes._format_datetime(None), "Unknown")
        self.assertEqual(student_routes._format_datetime(NOW), "2026-08-14 08:30 UTC")
        self.assertEqual(student_routes._format_day(NOW), "2026-08-14")
        self.assertEqual(student_routes._classification_bucket("AI"), "SYNTHETIC")
        self.assertEqual(student_routes._classification_bucket("unexpected"), "UNKNOWN")
        self.assertEqual(student_routes._review_outcome("APPROVED"), "Accepted by teacher")
        self.assertEqual(student_routes._review_outcome("NEEDS_DISCUSSION"), "Discussion requested")
        self.assertEqual(student_routes._risk_level("SYNTHETIC", None), "HIGH")
        self.assertEqual(student_routes._risk_level("SUSPICIOUS", None), "MEDIUM")
        self.assertEqual(student_routes._risk_level("HUMAN", None), "LOW")
        self.assertEqual(student_routes._risk_level("HUMAN", "medium"), "MEDIUM")

    def test_session_payload_normalizes_student_ledger_values(self) -> None:
        result = student_routes._session_to_dict(session_row())
        self.assertEqual(result["classification_bucket"], "SYNTHETIC")
        self.assertEqual(result["risk_level"], "HIGH")
        self.assertEqual(result["review_outcome"], "Flagged for academic review")
        self.assertEqual(result["confidence"], 78.46)
        self.assertEqual(result["wpm"], 42.4)
        self.assertEqual(result["created_at"], "2026-08-14 08:30 UTC")

    async def test_dashboard_serializes_summary_recent_trend_and_courses(self) -> None:
        summary = {
            "total_sessions": 7,
            "avg_wpm": 44.5,
            "avg_confidence": 82.5,
            "total_seconds": 920,
            "total_keystrokes": 5200,
            "total_deletions": 180,
            "total_pauses": 44,
            "human_sessions": 4,
            "suspicious_sessions": 2,
            "synthetic_sessions": 1,
            "certificate_count": 6,
            "approved_count": 3,
            "flagged_count": 1,
            "pending_count": 3,
        }
        trend = {
            "day": NOW,
            "session_count": 2,
            "avg_wpm": 46.3,
            "avg_confidence": 88.2,
            "human_count": 1,
            "suspicious_count": 1,
            "synthetic_count": 0,
        }
        course = {
            "course_name": "Dissertation",
            "course_code": "FYP401",
            "session_count": 4,
            "avg_wpm": 45.0,
            "avg_confidence": 85.0,
            "human_count": 3,
        }
        db = SequenceAsyncSession([summary, [session_row()], [trend], [course]])
        user = make_user(user_id="student-a", role="STUDENT")

        result = await student_routes.get_student_dashboard(current_user=user, db=db)

        self.assertEqual(result["summary"]["total_sessions"], 7)
        self.assertEqual(result["recent_sessions"][0]["classification_bucket"], "SYNTHETIC")
        self.assertEqual(result["trend"][0]["day"], "2026-08-14")
        self.assertEqual(result["courses"][0]["course_code"], "FYP401")
        self.assertEqual(len(db.executed), 4)

    async def test_dashboard_defaults_cleanly_for_new_student(self) -> None:
        db = SequenceAsyncSession([None, [], [], []])
        result = await student_routes.get_student_dashboard(
            current_user=make_user(user_id="student-new", role="STUDENT"),
            db=db,
        )
        self.assertEqual(result["summary"]["total_sessions"], 0)
        self.assertEqual(result["summary"]["avg_wpm"], 0.0)
        self.assertEqual(result["recent_sessions"], [])
        self.assertEqual(result["trend"], [])
        self.assertEqual(result["courses"], [])

    async def test_session_list_forwards_filters_pagination_and_serializes_rows(self) -> None:
        with patch.object(
            student_routes,
            "list_student_session_rows",
            new_callable=AsyncMock,
            return_value=(1, [session_row(classification="HUMAN", risk_level="LOW")]),
        ) as repository:
            result = await student_routes.get_student_sessions(
                classification="human",
                review_status="approved",
                search="reflection",
                limit=25,
                offset=10,
                current_user=make_user(user_id="student-a", role="STUDENT"),
                db=SequenceAsyncSession(),
            )

        self.assertEqual(result["total"], 1)
        self.assertEqual(result["sessions"][0]["classification_bucket"], "HUMAN")
        kwargs = repository.await_args.kwargs
        self.assertEqual(kwargs["user_id"], "student-a")
        self.assertEqual(kwargs["limit"], 25)
        self.assertEqual(kwargs["offset"], 10)
        self.assertEqual(kwargs["filters"].classification, "human")
        self.assertEqual(kwargs["filters"].review_status, "approved")
        self.assertEqual(kwargs["filters"].search, "reflection")

    async def test_session_detail_decrypts_only_owned_text(self) -> None:
        row = session_row(text_content=encrypt_text("private student draft"))
        db = SequenceAsyncSession([row])
        result = await student_routes.get_student_session_detail(
            session_id=41,
            current_user=make_user(user_id="student-a", role="STUDENT"),
            db=db,
        )
        self.assertEqual(result["session"]["text_content"], "private student draft")
        self.assertEqual(result["session"]["word_count"], 248)
        _, params = db.executed[0]
        self.assertEqual(params, {"session_id": 41, "user_id": "student-a"})

    async def test_analytics_serializes_daily_course_and_best_metrics(self) -> None:
        daily = {
            "day": NOW,
            "session_count": 2,
            "avg_wpm": 41.1,
            "avg_confidence": 79.2,
            "total_keys": 1100,
            "deletions": 42,
            "pauses": 12,
        }
        course = {
            "course_name": "Dissertation",
            "course_code": "FYP401",
            "session_count": 5,
            "avg_wpm": 43.2,
            "avg_confidence": 81.1,
            "human_count": 3,
            "suspicious_count": 1,
            "synthetic_count": 1,
        }
        bests = {
            "best_wpm": 58.5,
            "best_confidence": 96.2,
            "longest_session": 1220,
            "best_iki": 131.5,
            "total_sessions": 8,
            "total_seconds": 4200,
        }
        db = SequenceAsyncSession([[daily], [course], bests])
        result = await student_routes.get_student_analytics_clean(
            current_user=make_user(user_id="student-a", role="STUDENT"),
            db=db,
        )
        self.assertEqual(result["daily"][0]["day"], "2026-08-14")
        self.assertEqual(result["courses"][0]["synthetic_count"], 1)
        self.assertEqual(result["bests"]["best_wpm"], 58.5)
        self.assertEqual(result["bests"]["total_sessions"], 8)

    async def test_analytics_defaults_when_no_history_exists(self) -> None:
        result = await student_routes.get_student_analytics_clean(
            current_user=make_user(user_id="student-new", role="STUDENT"),
            db=SequenceAsyncSession([[], [], None]),
        )
        self.assertEqual(result["daily"], [])
        self.assertEqual(result["courses"], [])
        self.assertEqual(result["bests"]["best_confidence"], 0)
        self.assertEqual(result["bests"]["total_seconds"], 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
