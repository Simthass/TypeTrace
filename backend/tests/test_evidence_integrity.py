"""Regression tests for evidence and certificate integrity contracts."""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import patch

from pydantic import ValidationError

from app.ml.inference_engine import (
    InferenceInternalError,
    TypeTraceInferenceEngine,
)
from app.services.certificate_status import resolve_public_certificate_state
from app.schemas.evidence import (
    MAX_ANALYSIS_TEXT_CHARACTERS,
    MAX_TOTAL_PASTED_CHARACTERS,
    KeystrokeSessionAnalyzeRequest,
)


def valid_event(index: int = 0) -> dict[str, object]:
    timestamp = 1_785_280_000_000 + index * 150
    return {
        "key": "a",
        "keyCode": 65,
        "code": "KeyA",
        "type": "keydown",
        "timestamp": timestamp,
        "down_time": 100.0 + index,
        "up_time": 180.0 + index,
        "dwell_time": 80.0,
        "flight_time": 150.0 if index else None,
        "documentLength": index + 1,
        "cursorPosition": index,
        "insertedCharacters": 1,
        "insertedText": "a",
    }


def valid_payload() -> dict[str, object]:
    events = [valid_event(index) for index in range(30)]
    return {
        "submission_id": "submission:0123456789abcdef",
        "title": "Evidence integrity test",
        "text_content": "a" * 30,
        "keystroke_array": events,
        "stats": {
            "wpm": 36,
            "keystrokes": 30,
            "deletions": 0,
            "deletedCharacters": 0,
            "bulkDeletionEvents": 0,
            "largestDeletionChars": 0,
            "selectionDeletionEvents": 0,
            "wordDeletionEvents": 0,
            "cutEvents": 0,
            "pauses": 0,
            "avgIki": 150,
            "sessionSeconds": 10,
        },
        "active_duration_ms": 10_000,
        "client_metadata": {"source": "test"},
    }


class EvidencePayloadTests(unittest.TestCase):
    def test_frontend_wall_clock_event_shape_is_accepted(self) -> None:
        parsed = KeystrokeSessionAnalyzeRequest.model_validate(valid_payload())
        self.assertEqual(len(parsed.keystroke_array), 30)
        self.assertEqual(parsed.keystroke_array[0].type, "keydown")

    def test_unknown_event_fields_are_rejected(self) -> None:
        payload = valid_payload()
        payload["keystroke_array"][0]["unexpected_secret"] = "reject-me"  # type: ignore[index]
        with self.assertRaises(ValidationError):
            KeystrokeSessionAnalyzeRequest.model_validate(payload)

    def test_submission_id_is_required_and_bounded(self) -> None:
        payload = valid_payload()
        payload.pop("submission_id")
        with self.assertRaises(ValidationError):
            KeystrokeSessionAnalyzeRequest.model_validate(payload)

        payload = valid_payload()
        payload["submission_id"] = "too-short"
        with self.assertRaises(ValidationError):
            KeystrokeSessionAnalyzeRequest.model_validate(payload)

    def test_unknown_top_level_fields_are_rejected(self) -> None:
        payload = valid_payload()
        payload["server_trusted_classification"] = "HUMAN"
        with self.assertRaises(ValidationError):
            KeystrokeSessionAnalyzeRequest.model_validate(payload)

    def test_oversized_document_is_rejected(self) -> None:
        payload = valid_payload()
        payload["text_content"] = "x" * (MAX_ANALYSIS_TEXT_CHARACTERS + 1)
        with self.assertRaises(ValidationError):
            KeystrokeSessionAnalyzeRequest.model_validate(payload)

    def test_total_paste_limit_is_enforced(self) -> None:
        payload = valid_payload()
        payload["keystroke_array"] = [
            {
                "key": "__PASTE_EVENT__",
                "keyCode": 0,
                "type": "paste",
                "timestamp": 1_785_280_000_000,
                "documentLength": MAX_TOTAL_PASTED_CHARACTERS,
                "cursorPosition": 0,
                "pastedLength": MAX_TOTAL_PASTED_CHARACTERS,
                "insertedCharacters": MAX_TOTAL_PASTED_CHARACTERS,
                "insertedText": "x" * MAX_TOTAL_PASTED_CHARACTERS,
            },
            {
                "key": "__PASTE_EVENT__",
                "keyCode": 0,
                "type": "paste",
                "timestamp": 1_785_280_000_100,
                "documentLength": MAX_TOTAL_PASTED_CHARACTERS,
                "cursorPosition": 0,
                "pastedLength": 1,
                "insertedCharacters": 1,
                "insertedText": "x",
            },
        ]
        with self.assertRaises(ValidationError):
            KeystrokeSessionAnalyzeRequest.model_validate(payload)


class InferenceFailureTests(unittest.TestCase):
    def test_unexpected_feature_failure_does_not_become_fallback(self) -> None:
        engine = TypeTraceInferenceEngine()
        stats = SimpleNamespace(
            wpm=30,
            keystrokes=30,
            deletions=0,
            deletedCharacters=0,
            pauses=0,
            avgIki=150,
            sessionSeconds=10,
        )
        with patch(
            "app.ml.inference_engine.extract_typetrace_event_features",
            side_effect=RuntimeError("programming defect"),
        ):
            with self.assertRaises(InferenceInternalError):
                engine.analyze(
                    events=[valid_event()],
                    stats=stats,
                    text_content="a",
                )


class CertificateStateTests(unittest.TestCase):
    def test_revoked_record_is_never_active_or_valid(self) -> None:
        state = resolve_public_certificate_state(
            record_found=True,
            ledger_status="VALID",
            revoked=True,
            signature_valid=True,
            signature_status="VALID",
            signature_algorithm="Ed25519",
        )
        self.assertEqual(state.status, "REVOKED")
        self.assertTrue(state.ledger_verified)
        self.assertFalse(state.certificate_active)
        self.assertFalse(state.compatibility_valid)

    def test_invalid_signature_is_never_active_or_valid(self) -> None:
        state = resolve_public_certificate_state(
            record_found=True,
            ledger_status="VALID",
            signature_valid=False,
            signature_status="INVALID_SIGNATURE",
            signature_algorithm="Ed25519",
        )
        self.assertEqual(state.status, "INVALID_SIGNATURE")
        self.assertFalse(state.ledger_verified)
        self.assertFalse(state.certificate_active)
        self.assertFalse(state.compatibility_valid)

    def test_legacy_unsigned_record_is_not_active(self) -> None:
        state = resolve_public_certificate_state(
            record_found=True,
            ledger_status="VALID",
            signature_valid=True,
            signature_status="VALID_LEGACY",
            signature_algorithm="UNSIGNED_LEGACY",
        )
        self.assertEqual(state.status, "LEGACY_UNSIGNED")
        self.assertFalse(state.ledger_verified)
        self.assertFalse(state.certificate_active)

    def test_review_required_signed_record_remains_active(self) -> None:
        state = resolve_public_certificate_state(
            record_found=True,
            ledger_status="REVIEW_REQUIRED",
            signature_valid=True,
            signature_status="VALID",
            signature_algorithm="Ed25519",
        )
        self.assertEqual(state.status, "REVIEW_REQUIRED")
        self.assertTrue(state.ledger_verified)
        self.assertTrue(state.certificate_active)


if __name__ == "__main__":
    unittest.main(verbosity=2)
