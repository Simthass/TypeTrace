from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import BackgroundTasks, HTTPException, Response
from sqlalchemy.exc import IntegrityError

from app.api.routes import sessions as session_routes
from app.ml.inference_engine import InferenceInputError, InferenceInternalError
from app.schemas.evidence import AnalysisResponse, KeystrokeSessionAnalyzeRequest, SessionStats
from app.services.evidence_replay import EvidenceReplayMismatch
from tests.helpers import FakeAsyncSession


def make_payload(*, course_id: int | None = None, draft_id: str | None = None) -> KeystrokeSessionAnalyzeRequest:
    return KeystrokeSessionAnalyzeRequest.model_validate(
        {
            "submission_id": "submission-coverage-20260814-0001",
            "title": "  Authorship evidence  ",
            "text_content": "hello world",
            "keystroke_array": [
                {
                    "key": chr(97 + (index % 26)),
                    "keyCode": 65 + (index % 26),
                    "type": "keydown",
                    "timestamp": 1_786_680_000_000 + (index * 120),
                    "documentLength": min(index + 1, 11),
                    "cursorPosition": min(index + 1, 11),
                }
                for index in range(30)
            ],
            "stats": {
                "wpm": 42,
                "keystrokes": 30,
                "deletions": 2,
                "deletedCharacters": 2,
                "bulkDeletionEvents": 0,
                "largestDeletionChars": 1,
                "selectionDeletionEvents": 0,
                "wordDeletionEvents": 0,
                "cutEvents": 0,
                "pauses": 1,
                "avgIki": 145,
                "sessionSeconds": 30,
            },
            "course_id": course_id,
            "draft_id": draft_id,
            "active_duration_ms": 25_000,
            "client_metadata": {"capture_version": "coverage-test"},
        }
    )


def canonical_fixture() -> SimpleNamespace:
    return SimpleNamespace(
        evidence_hash="evidence-hash-coverage",
        document_hash="document-hash-coverage",
        event_counts={
            "event_count": 30,
            "keydown_count": 30,
            "paste_count": 0,
        },
        stats={
            "wpm": 42,
            "keystrokes": 30,
            "deletions": 2,
            "deletedCharacters": 2,
            "bulkDeletionEvents": 0,
            "largestDeletionChars": 1,
            "selectionDeletionEvents": 0,
            "wordDeletionEvents": 0,
            "cutEvents": 0,
            "pauses": 1,
            "avgIki": 145,
            "sessionSeconds": 30,
        },
        evidence_metadata={
            "duration_source": "server-canonical",
            "idle_break_count": 1,
        },
        canonical_stats_json={
            "wpm": 42,
            "keystrokes": 30,
            "deletions": 2,
            "deletedCharacters": 2,
            "bulkDeletionEvents": 0,
            "largestDeletionChars": 1,
            "selectionDeletionEvents": 0,
            "wordDeletionEvents": 0,
            "cutEvents": 0,
            "pauses": 1,
            "avgIki": 145,
            "sessionSeconds": 30,
        },
        active_duration_ms=25_000,
        idle_breaks=[{"start_ms": 10_000, "duration_ms": 4_000}],
    )


def inference_fixture() -> SimpleNamespace:
    return SimpleNamespace(
        classification="REAL",
        confidence_score=87.5,
        risk_score=12.5,
        risk_level="LOW",
        decision_source="MODEL_FUSION",
    )


def paste_policy_fixture(*, degraded: bool = False) -> dict[str, object]:
    return {
        "classification": "HUMAN",
        "confidence_score": 87.5,
        "risk_score": 12.5,
        "risk_level": "LOW",
        "kill_switch_triggered": False,
        "kill_switch_reason": None,
        "advanced_stats": {
            "decision_source": "MODEL_FUSION",
            "model_available": not degraded,
            "degraded_analysis": degraded,
            "model_version": "isolation-forest-v2-timing-only",
            "model_score": 12.5,
            "model_feature_family": "timing-only",
        },
    }


def analysis_fixture(*, replay: bool = True) -> AnalysisResponse:
    return AnalysisResponse(
        classification="HUMAN",
        confidence_score=90,
        kill_switch_triggered=False,
        kill_switch_reason=None,
        advanced_stats={
            "decision_source": "MODEL_FUSION",
            "model_available": True,
            "degraded_analysis": False,
        },
        stats=SessionStats(
            wpm=42,
            keystrokes=30,
            deletions=2,
            deletedCharacters=2,
            bulkDeletionEvents=0,
            largestDeletionChars=1,
            selectionDeletionEvents=0,
            wordDeletionEvents=0,
            cutEvents=0,
            pauses=1,
            avgIki=145,
            sessionSeconds=30,
        ),
        session_id=501,
        certificate_id="TT-COVERAGE001",
        document_hash="document-hash-coverage",
        risk_level="LOW",
        risk_score=10,
        evidence_hash="evidence-hash-coverage",
        canonical_stats={"wpm": 42, "keystrokes": 30},
        submission_id="submission-coverage-20260814-0001",
        idempotent_replay=replay,
        decision_source="MODEL_FUSION",
        model_available=True,
        degraded_analysis=False,
    )


class SessionAnalysisCoverageTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.request = SimpleNamespace()
        self.user = SimpleNamespace(id="student-coverage", first_name="Ada")

    async def _call_analyze(
        self,
        *,
        payload: KeystrokeSessionAnalyzeRequest | None = None,
        db: FakeAsyncSession | None = None,
        course: object | None = None,
        draft: object | None = None,
        result: object | None = None,
        paste_policy: dict[str, object] | None = None,
    ) -> tuple[AnalysisResponse, Response, BackgroundTasks, FakeAsyncSession]:
        payload = payload or make_payload()
        db = db or FakeAsyncSession()
        response = Response()
        background_tasks = BackgroundTasks()
        canonical = canonical_fixture()
        result = result or inference_fixture()
        paste_policy = paste_policy or paste_policy_fixture()

        def make_session(**kwargs):
            return SimpleNamespace(id=501, **kwargs)

        def make_certificate(**kwargs):
            return SimpleNamespace(**kwargs)

        signature = SimpleNamespace(
            algorithm="Ed25519",
            signing_key_id="coverage-key",
            payload_hash="signed-payload-hash",
        )

        with (
            patch.object(session_routes, "compute_canonical_evidence", return_value=canonical),
            patch.object(session_routes, "_load_idempotent_response", AsyncMock(return_value=None)),
            patch.object(session_routes, "validate_evidence_text", return_value=None),
            patch.object(session_routes, "_ensure_student_can_submit_to_course", AsyncMock(return_value=course)),
            patch.object(session_routes, "_load_owned_draft", AsyncMock(return_value=draft)),
            patch.object(session_routes.inference_engine, "analyze", return_value=result),
            patch.object(session_routes, "apply_paste_policy", return_value=paste_policy),
            patch.object(session_routes, "_create_unique_certificate_id", AsyncMock(return_value="TT-COVERAGE001")),
            patch.object(session_routes, "TypingSession", side_effect=make_session),
            patch.object(session_routes, "Certificate", side_effect=make_certificate),
            patch.object(session_routes, "encrypt_text", side_effect=lambda value: f"enc:{value}"),
            patch.object(session_routes, "encrypt_json", side_effect=lambda value: {"encrypted": value}),
            patch.object(session_routes, "sign_certificate_for_session", return_value=signature),
            patch.object(session_routes, "create_audit_log", side_effect=lambda **kwargs: SimpleNamespace(**kwargs)),
        ):
            value = await session_routes.analyze_session(
                payload=payload,
                request=self.request,
                response=response,
                background_tasks=background_tasks,
                current_user=self.user,
                db=db,
            )
        return value, response, background_tasks, db

    async def test_analyze_success_persists_session_certificate_and_audits(self) -> None:
        value, response, tasks, db = await self._call_analyze()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(value.classification, "HUMAN")
        self.assertEqual(value.session_id, 501)
        self.assertEqual(value.certificate_id, "TT-COVERAGE001")
        self.assertEqual(value.risk_level, "LOW")
        self.assertFalse(value.idempotent_replay)
        self.assertEqual(db.commits, 1)
        self.assertEqual(db.refreshes, 1)
        self.assertGreaterEqual(len(db.added), 4)
        self.assertEqual(tasks.tasks, [])

        session = db.added[0]
        self.assertEqual(session.text_content, "enc:hello world")
        self.assertEqual(session.review_status, "NOT_APPLICABLE")
        self.assertEqual(
            session.evidence_metadata["analysis_response"]["classification"],
            "HUMAN",
        )

    async def test_analyze_course_and_draft_submission_updates_lifecycle_and_queues_notification(self) -> None:
        draft = SimpleNamespace(
            lifecycle_status="ACTIVE",
            sync_status="SYNCED",
            submitted_session_id=None,
            conflict_payload=None,
        )
        course = SimpleNamespace(teacher_id="teacher-coverage")
        payload = make_payload(course_id=7, draft_id="draft-coverage")

        with patch.object(session_routes, "_verify_draft_matches_submission") as verify_draft:
            value, _response, tasks, db = await self._call_analyze(
                payload=payload,
                course=course,
                draft=draft,
            )

        verify_draft.assert_called_once()
        self.assertEqual(value.classification, "HUMAN")
        self.assertEqual(draft.lifecycle_status, "SUBMITTED")
        self.assertEqual(draft.sync_status, "SYNCED")
        self.assertEqual(draft.submitted_session_id, 501)
        self.assertEqual(draft.conflict_payload["submission_id"], payload.submission_id)
        self.assertEqual(db.added[0].review_status, "PENDING")
        self.assertEqual(len(tasks.tasks), 1)

    async def test_analyze_returns_exact_idempotent_replay_before_revalidation(self) -> None:
        payload = make_payload()
        canonical = canonical_fixture()
        replay = analysis_fixture(replay=True)
        response = Response()

        with (
            patch.object(session_routes, "compute_canonical_evidence", return_value=canonical),
            patch.object(session_routes, "_load_idempotent_response", AsyncMock(return_value=replay)),
            patch.object(session_routes, "validate_evidence_text") as validate_text,
        ):
            value = await session_routes.analyze_session(
                payload=payload,
                request=self.request,
                response=response,
                background_tasks=BackgroundTasks(),
                current_user=self.user,
                db=FakeAsyncSession(),
            )

        self.assertIs(value, replay)
        self.assertEqual(response.status_code, 200)
        validate_text.assert_not_called()

    async def test_analyze_rejects_replay_text_mismatch_before_inference(self) -> None:
        canonical = canonical_fixture()
        with (
            patch.object(session_routes, "compute_canonical_evidence", return_value=canonical),
            patch.object(session_routes, "_load_idempotent_response", AsyncMock(return_value=None)),
            patch.object(
                session_routes,
                "validate_evidence_text",
                side_effect=EvidenceReplayMismatch("Final text does not match replay."),
            ),
            patch.object(session_routes.inference_engine, "analyze") as analyze,
        ):
            with self.assertRaises(HTTPException) as raised:
                await session_routes.analyze_session(
                    payload=make_payload(),
                    request=self.request,
                    response=Response(),
                    background_tasks=BackgroundTasks(),
                    current_user=self.user,
                    db=FakeAsyncSession(),
                )
        self.assertEqual(raised.exception.status_code, 422)
        self.assertIn("does not match replay", raised.exception.detail)
        analyze.assert_not_called()

    async def test_analyze_translates_inference_input_failure_to_422(self) -> None:
        canonical = canonical_fixture()
        with (
            patch.object(session_routes, "compute_canonical_evidence", return_value=canonical),
            patch.object(session_routes, "_load_idempotent_response", AsyncMock(return_value=None)),
            patch.object(session_routes, "validate_evidence_text", return_value=None),
            patch.object(session_routes, "_ensure_student_can_submit_to_course", AsyncMock(return_value=None)),
            patch.object(session_routes, "_load_owned_draft", AsyncMock(return_value=None)),
            patch.object(
                session_routes.inference_engine,
                "analyze",
                side_effect=InferenceInputError("insufficient timing evidence"),
            ),
        ):
            with self.assertRaises(HTTPException) as raised:
                await session_routes.analyze_session(
                    payload=make_payload(),
                    request=self.request,
                    response=Response(),
                    background_tasks=BackgroundTasks(),
                    current_user=self.user,
                    db=FakeAsyncSession(),
                )
        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(raised.exception.detail, "insufficient timing evidence")

    async def test_analyze_translates_internal_inference_failure_to_503_without_writes(self) -> None:
        canonical = canonical_fixture()
        db = FakeAsyncSession()
        with (
            patch.object(session_routes, "compute_canonical_evidence", return_value=canonical),
            patch.object(session_routes, "_load_idempotent_response", AsyncMock(return_value=None)),
            patch.object(session_routes, "validate_evidence_text", return_value=None),
            patch.object(session_routes, "_ensure_student_can_submit_to_course", AsyncMock(return_value=None)),
            patch.object(session_routes, "_load_owned_draft", AsyncMock(return_value=None)),
            patch.object(
                session_routes.inference_engine,
                "analyze",
                side_effect=InferenceInternalError("model unavailable"),
            ),
        ):
            with self.assertRaises(HTTPException) as raised:
                await session_routes.analyze_session(
                    payload=make_payload(),
                    request=self.request,
                    response=Response(),
                    background_tasks=BackgroundTasks(),
                    current_user=self.user,
                    db=db,
                )
        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(db.added, [])
        self.assertEqual(db.commits, 0)

    async def test_analyze_integrity_conflict_returns_committed_idempotent_replay(self) -> None:
        replay = analysis_fixture(replay=True)
        db = FakeAsyncSession(
            commit_exception=IntegrityError("INSERT", {}, RuntimeError("duplicate"))
        )
        payload = make_payload()

        canonical = canonical_fixture()
        result = inference_fixture()
        signature = SimpleNamespace(
            algorithm="Ed25519",
            signing_key_id="coverage-key",
            payload_hash="signed-payload-hash",
        )

        async def idempotent_lookup(**kwargs):
            # First call: no prior record. Second call after rollback: committed replay.
            idempotent_lookup.calls += 1
            return None if idempotent_lookup.calls == 1 else replay

        idempotent_lookup.calls = 0

        with (
            patch.object(session_routes, "compute_canonical_evidence", return_value=canonical),
            patch.object(session_routes, "_load_idempotent_response", side_effect=idempotent_lookup),
            patch.object(session_routes, "validate_evidence_text", return_value=None),
            patch.object(session_routes, "_ensure_student_can_submit_to_course", AsyncMock(return_value=None)),
            patch.object(session_routes, "_load_owned_draft", AsyncMock(return_value=None)),
            patch.object(session_routes.inference_engine, "analyze", return_value=result),
            patch.object(session_routes, "apply_paste_policy", return_value=paste_policy_fixture()),
            patch.object(session_routes, "_create_unique_certificate_id", AsyncMock(return_value="TT-COVERAGE001")),
            patch.object(session_routes, "TypingSession", side_effect=lambda **kw: SimpleNamespace(id=501, **kw)),
            patch.object(session_routes, "Certificate", side_effect=lambda **kw: SimpleNamespace(**kw)),
            patch.object(session_routes, "encrypt_text", side_effect=lambda value: value),
            patch.object(session_routes, "encrypt_json", side_effect=lambda value: value),
            patch.object(session_routes, "sign_certificate_for_session", return_value=signature),
            patch.object(session_routes, "create_audit_log", side_effect=lambda **kw: SimpleNamespace(**kw)),
        ):
            response = Response()
            value = await session_routes.analyze_session(
                payload=payload,
                request=self.request,
                response=response,
                background_tasks=BackgroundTasks(),
                current_user=self.user,
                db=db,
            )

        self.assertIs(value, replay)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(db.rollbacks, 1)
        self.assertEqual(idempotent_lookup.calls, 2)

    async def test_analyze_integrity_conflict_without_replay_returns_409(self) -> None:
        db = FakeAsyncSession(
            commit_exception=IntegrityError("INSERT", {}, RuntimeError("duplicate"))
        )
        canonical = canonical_fixture()
        signature = SimpleNamespace(
            algorithm="Ed25519",
            signing_key_id="coverage-key",
            payload_hash="signed-payload-hash",
        )

        with (
            patch.object(session_routes, "compute_canonical_evidence", return_value=canonical),
            patch.object(session_routes, "_load_idempotent_response", AsyncMock(return_value=None)),
            patch.object(session_routes, "validate_evidence_text", return_value=None),
            patch.object(session_routes, "_ensure_student_can_submit_to_course", AsyncMock(return_value=None)),
            patch.object(session_routes, "_load_owned_draft", AsyncMock(return_value=None)),
            patch.object(session_routes.inference_engine, "analyze", return_value=inference_fixture()),
            patch.object(session_routes, "apply_paste_policy", return_value=paste_policy_fixture()),
            patch.object(session_routes, "_create_unique_certificate_id", AsyncMock(return_value="TT-COVERAGE001")),
            patch.object(session_routes, "TypingSession", side_effect=lambda **kw: SimpleNamespace(id=501, **kw)),
            patch.object(session_routes, "Certificate", side_effect=lambda **kw: SimpleNamespace(**kw)),
            patch.object(session_routes, "encrypt_text", side_effect=lambda value: value),
            patch.object(session_routes, "encrypt_json", side_effect=lambda value: value),
            patch.object(session_routes, "sign_certificate_for_session", return_value=signature),
            patch.object(session_routes, "create_audit_log", side_effect=lambda **kw: SimpleNamespace(**kw)),
        ):
            with self.assertRaises(HTTPException) as raised:
                await session_routes.analyze_session(
                    payload=make_payload(),
                    request=self.request,
                    response=Response(),
                    background_tasks=BackgroundTasks(),
                    current_user=self.user,
                    db=db,
                )
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(db.rollbacks, 1)

    async def test_analyze_generic_commit_failure_rolls_back_and_propagates(self) -> None:
        db = FakeAsyncSession(commit_exception=RuntimeError("database unavailable"))
        with self.assertRaisesRegex(RuntimeError, "database unavailable"):
            await self._call_analyze(db=db)
        self.assertEqual(db.rollbacks, 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
