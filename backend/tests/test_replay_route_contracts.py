from __future__ import annotations

import json
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException, Response

from app.api.routes import replay as replay_route
from app.api.routes.replay import (
    _authorize_replay_access,
    _build_timeline_markers,
    _classification_bucket,
    _compute_replay_metrics,
    _event_deleted_characters,
    _normalize_events,
    _normalize_key,
    _parse_raw_events,
    _risk_level,
    _safe_float,
    _safe_int,
)


class ReplayRouteHelperTests(unittest.TestCase):
    def test_safe_numeric_helpers_and_classification_fail_closed(self) -> None:
        self.assertEqual(_safe_float("12.5"), 12.5)
        self.assertEqual(_safe_float(float("nan"), 7.0), 7.0)
        self.assertEqual(_safe_float("bad", 3.0), 3.0)
        self.assertEqual(_safe_int("4"), 4)
        self.assertEqual(_safe_int(None, 9), 9)

        self.assertEqual(_classification_bucket("human"), "HUMAN")
        self.assertEqual(_classification_bucket("AI-GENERATED"), "SYNTHETIC")
        self.assertEqual(_classification_bucket("other"), "UNKNOWN")
        self.assertEqual(_risk_level("SYNTHETIC", None), "HIGH")
        self.assertEqual(_risk_level("SUSPICIOUS", None), "MEDIUM")
        self.assertEqual(_risk_level("HUMAN", "low"), "LOW")

    def test_raw_event_parsing_and_key_normalization_are_privacy_safe(self) -> None:
        events = [{"type": "keydown", "key": "a"}, "bad", 3]
        self.assertEqual(_parse_raw_events(events), [events[0]])
        self.assertEqual(_parse_raw_events(json.dumps(events)), [events[0]])
        self.assertEqual(_parse_raw_events("{bad"), [])
        self.assertEqual(_parse_raw_events({"not": "a list"}), [])

        self.assertEqual(_normalize_key({"key": " "}), "Space")
        self.assertEqual(_normalize_key({"key": "__PASTE_EVENT__"}), "Paste")
        self.assertEqual(_normalize_key({"key": ""}), "Unknown")

    def test_deletion_semantics_ignore_keyup_and_respect_explicit_counts(self) -> None:
        self.assertEqual(
            _event_deleted_characters(
                {"type": "keyup", "key": "Backspace", "chars_deleted": 7}
            ),
            0,
        )
        self.assertEqual(
            _event_deleted_characters(
                {"type": "keydown", "key": "Backspace", "chars_deleted": 3}
            ),
            3,
        )
        self.assertEqual(
            _event_deleted_characters({"type": "keydown", "key": "Delete"}),
            1,
        )
        self.assertEqual(
            _event_deleted_characters({"type": "keydown", "key": "a"}),
            0,
        )

    def test_normalized_events_capture_relative_time_revision_pause_and_paste(self) -> None:
        raw = [
            {
                "type": "keydown",
                "key": "a",
                "timestamp": 1000,
                "dwell_time": 80,
                "flight_time": 120,
                "documentLength": 1,
                "cursorPosition": 1,
                "insertedText": "a",
                "insertedCharacters": 1,
            },
            {
                "type": "paste",
                "key": "__PASTE_EVENT__",
                "timestamp": 7000,
                "pastedLength": 4,
                "insertedText": "test",
                "documentLength": 5,
                "cursorPosition": 5,
                "flight_time": 6000,
            },
            {
                "type": "keydown",
                "key": "Backspace",
                "timestamp": 7100,
                "chars_deleted": 3,
                "isBulkDeletion": True,
                "documentLength": 2,
                "cursorPosition": 2,
            },
        ]

        events = _normalize_events(raw)

        self.assertEqual(
            [event["relative_time_ms"] for event in events],
            [0, 6000, 6100],
        )
        self.assertTrue(events[1]["is_paste"])
        self.assertTrue(events[1]["is_pause"])
        self.assertTrue(events[1]["is_cognitive_pause"])
        self.assertTrue(events[2]["is_deletion"])
        self.assertTrue(events[2]["is_bulk_deletion"])
        self.assertEqual(events[2]["deletedCharacters"], 3)

    def test_metrics_and_timeline_are_derived_from_normalized_events(self) -> None:
        events = _normalize_events(
            [
                {
                    "type": "keydown",
                    "key": "a",
                    "timestamp": 0,
                    "dwell_time": 100,
                    "flight_time": 100,
                },
                {
                    "type": "keydown",
                    "key": "b",
                    "timestamp": 6000,
                    "dwell_time": 120,
                    "flight_time": 6000,
                },
                {
                    "type": "paste",
                    "key": "__PASTE_EVENT__",
                    "timestamp": 6100,
                    "pastedLength": 4,
                },
                {
                    "type": "keydown",
                    "key": "Backspace",
                    "timestamp": 6200,
                    "chars_deleted": 2,
                    "bulk_deletion": True,
                },
            ]
        )
        row = {
            "text_content": "abcdef",
            "avg_iki": 0,
            "pauses": 2,
            "wpm": 42.4,
        }

        metrics = _compute_replay_metrics(events, row)
        self.assertEqual(metrics["paste_count"], 1)
        self.assertEqual(metrics["deletion_count"], 1)
        self.assertEqual(metrics["deleted_characters"], 2)
        self.assertEqual(metrics["bulk_deletion_events"], 1)
        self.assertEqual(metrics["cognitive_pause_count"], 1)
        self.assertEqual(metrics["wpm"], 42.4)

        markers = _build_timeline_markers(events)
        self.assertEqual(
            [marker["type"] for marker in markers],
            ["cognitive_pause", "paste", "deletion"],
        )

    def test_replay_authorization_is_owner_and_role_scoped(self) -> None:
        row = {"user_id": "student-1", "teacher_id": "teacher-1"}

        _authorize_replay_access(
            row,
            SimpleNamespace(id="student-1", role="STUDENT"),
        )
        _authorize_replay_access(
            row,
            SimpleNamespace(id="teacher-1", role="TEACHER"),
        )

        for user in (
            SimpleNamespace(id="student-2", role="STUDENT"),
            SimpleNamespace(id="teacher-2", role="TEACHER"),
            SimpleNamespace(id="admin", role="ADMIN"),
        ):
            with self.assertRaises(HTTPException) as ctx:
                _authorize_replay_access(row, user)
            self.assertEqual(ctx.exception.status_code, 403)


class ReplayRouteEndpointTests(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def _row() -> dict[str, object]:
        return {
            "id": 157,
            "user_id": "student-1",
            "course_id": 9,
            "title": "Replay contract",
            "text_content": "abc",
            "word_count": 1,
            "wpm": 41.2,
            "total_keystrokes": 3,
            "deletions": 0,
            "pauses": 0,
            "avg_iki": 135.0,
            "duration_seconds": 3.5,
            "classification_result": "HUMAN",
            "ml_confidence_score": 0.91,
            "raw_keystroke_data": "encrypted-value",
            "certificate_id": "TT-CONTRACT-001",
            "document_hash": "a" * 64,
            "review_status": "APPROVED",
            "review_notes": "Reviewed",
            "risk_level": "LOW",
            "created_at": datetime(2026, 8, 13, tzinfo=timezone.utc),
            "decision_source": "MODEL",
            "model_available": True,
            "degraded_analysis": False,
            "first_name": "Replay",
            "last_name": "Student",
            "email": "student@example.test",
            "student_id": "ST-1",
            "course_name": "Evidence Systems",
            "course_code": "ES101",
            "teacher_id": "teacher-1",
        }

    async def test_endpoint_rejects_invalid_and_missing_session_ids(self) -> None:
        response = Response()
        student = SimpleNamespace(id="student-1", role="STUDENT")
        db = SimpleNamespace()

        with self.assertRaises(HTTPException) as invalid_ctx:
            await replay_route.get_replay_audit(0, response, student, db)
        self.assertEqual(invalid_ctx.exception.status_code, 400)
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        self.assertEqual(response.headers["Pragma"], "no-cache")

        with patch.object(
            replay_route,
            "_fetch_replay_row",
            new=AsyncMock(return_value=None),
        ):
            with self.assertRaises(HTTPException) as missing_ctx:
                await replay_route.get_replay_audit(999, Response(), student, db)
        self.assertEqual(missing_ctx.exception.status_code, 404)

    async def test_endpoint_returns_normalized_truncated_replay_payload(self) -> None:
        raw_events = [
            {
                "type": "keydown",
                "key": "a",
                "timestamp": 1000,
                "dwell_time": 80,
                "flight_time": 120,
                "documentLength": 1,
                "cursorPosition": 1,
            },
            {
                "type": "keydown",
                "key": "b",
                "timestamp": 1120,
                "dwell_time": 75,
                "flight_time": 120,
                "documentLength": 2,
                "cursorPosition": 2,
            },
            {
                "type": "keydown",
                "key": "c",
                "timestamp": 1240,
                "dwell_time": 70,
                "flight_time": 120,
                "documentLength": 3,
                "cursorPosition": 3,
            },
        ]
        response = Response()
        student = SimpleNamespace(id="student-1", role="STUDENT")

        with (
            patch.object(
                replay_route,
                "_fetch_replay_row",
                new=AsyncMock(return_value=self._row()),
            ),
            patch.object(replay_route, "decrypt_json", return_value=raw_events),
            patch.object(replay_route, "MAX_REPLAY_EVENTS", 2),
        ):
            payload = await replay_route.get_replay_audit(
                157,
                response,
                student,
                SimpleNamespace(),
            )

        self.assertEqual(payload["status"], "success")
        self.assertEqual(payload["session"]["id"], 157)
        self.assertEqual(payload["session"]["classification_bucket"], "HUMAN")
        self.assertEqual(payload["session"]["risk_level"], "LOW")
        self.assertEqual(payload["session"]["word_count"], 1)
        self.assertEqual(payload["session"]["student_name"], "Replay Student")
        self.assertEqual(len(payload["events"]), 2)
        self.assertEqual(payload["audit"]["total_raw_events"], 3)
        self.assertEqual(payload["audit"]["total_normalized_events"], 2)
        self.assertTrue(payload["audit"]["is_truncated"])
        self.assertEqual(payload["audit"]["max_events_returned"], 2)
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        self.assertEqual(response.headers["Pragma"], "no-cache")

    async def test_compatibility_endpoint_delegates_to_primary_replay_handler(self) -> None:
        expected = {"status": "success", "events": []}
        response = Response()
        student = SimpleNamespace(id="student-1", role="STUDENT")
        db = SimpleNamespace()

        with patch.object(
            replay_route,
            "get_replay_audit",
            new=AsyncMock(return_value=expected),
        ) as primary:
            payload = await replay_route.get_session_replay_compatible(
                157,
                response,
                student,
                db,
            )

        self.assertIs(payload, expected)
        primary.assert_awaited_once_with(
            session_id=157,
            response=response,
            current_user=student,
            db=db,
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
