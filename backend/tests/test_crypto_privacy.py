"""Encryption and privacy-boundary tests for TypeTrace evidence."""

from __future__ import annotations

import unittest

from cryptography.fernet import Fernet

from app.core import crypto
from app.core.config import settings
from app.core.privacy import (
    privacy_safe_export_session,
    redact_email,
    redact_name,
    redact_student_id,
    safe_public_certificate_identity,
    summarize_keystroke_events,
)


class EncryptionContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_key = settings.ENCRYPTION_MASTER_KEY
        self.original_legacy = settings.ALLOW_LEGACY_EVIDENCE_DECRYPTION
        settings.ENCRYPTION_MASTER_KEY = Fernet.generate_key().decode("utf-8")
        settings.ALLOW_LEGACY_EVIDENCE_DECRYPTION = False
        crypto._cipher.cache_clear()
        crypto._legacy_cipher.cache_clear()

    def tearDown(self) -> None:
        settings.ENCRYPTION_MASTER_KEY = self.original_key
        settings.ALLOW_LEGACY_EVIDENCE_DECRYPTION = self.original_legacy
        crypto._cipher.cache_clear()
        crypto._legacy_cipher.cache_clear()

    def test_text_round_trip(self) -> None:
        plaintext = "Original student writing evidence."
        encrypted = crypto.encrypt_text(plaintext)

        self.assertIsInstance(encrypted, str)
        self.assertNotEqual(encrypted, plaintext)
        self.assertEqual(crypto.decrypt_text(encrypted), plaintext)

    def test_json_round_trip(self) -> None:
        events = [
            {"type": "keydown", "key": "A", "timestamp": 10},
            {"type": "keyup", "key": "A", "timestamp": 40},
        ]
        encrypted = crypto.encrypt_json(events)

        self.assertIsInstance(encrypted, str)
        self.assertEqual(crypto.decrypt_json(encrypted), events)

    def test_wrong_primary_key_fails_closed(self) -> None:
        encrypted = crypto.encrypt_text("private evidence")
        settings.ENCRYPTION_MASTER_KEY = Fernet.generate_key().decode("utf-8")
        crypto._cipher.cache_clear()

        with self.assertRaisesRegex(ValueError, "Evidence decryption failed"):
            crypto.decrypt_text(encrypted)

    def test_plaintext_requires_explicit_legacy_mode(self) -> None:
        with self.assertRaisesRegex(ValueError, "Evidence decryption failed"):
            crypto.decrypt_text("legacy plaintext")

        settings.ALLOW_LEGACY_EVIDENCE_DECRYPTION = True
        self.assertEqual(
            crypto.decrypt_text("legacy plaintext"),
            "legacy plaintext",
        )

    def test_unencrypted_json_requires_explicit_legacy_mode(self) -> None:
        legacy_events = [{"type": "keydown", "key": "A"}]

        with self.assertRaisesRegex(ValueError, "Unencrypted JSON evidence"):
            crypto.decrypt_json(legacy_events)

        settings.ALLOW_LEGACY_EVIDENCE_DECRYPTION = True
        self.assertEqual(
            crypto.decrypt_json(legacy_events),
            legacy_events,
        )


class PrivacyContractTests(unittest.TestCase):
    def test_identity_redaction_is_deterministic(self) -> None:
        self.assertEqual(redact_email("student@example.com"), "st***@example.com")
        self.assertEqual(redact_student_id("2540927"), "25***27")
        self.assertEqual(redact_name("Mohammed Simthass"), "Mohammed S.")

    def test_public_certificate_identity_is_private_by_default(self) -> None:
        identity = safe_public_certificate_identity(
            student_name="Mohammed Simthass",
            student_id="2540927",
            show_name=False,
            show_student_id=False,
        )

        self.assertEqual(identity["student_name"], "Mohammed S.")
        self.assertEqual(identity["student_id"], "25***27")

    def test_keystroke_summary_never_returns_raw_events(self) -> None:
        events = [
            {"type": "keydown", "key": "A"},
            {"type": "keydown", "key": "Backspace"},
            {"type": "paste", "key": "__PASTE_EVENT__"},
        ]
        summary = summarize_keystroke_events(events)

        self.assertEqual(summary["total_events"], 3)
        self.assertEqual(summary["keydown_events"], 2)
        self.assertEqual(summary["deletion_events"], 1)
        self.assertEqual(summary["paste_events"], 1)
        self.assertFalse(summary["raw_events_included"])

    def test_default_export_omits_private_text_and_events(self) -> None:
        row = {
            "id": 10,
            "title": "Session",
            "wpm": 40,
            "total_keystrokes": 120,
            "deletions": 5,
            "pauses": 3,
            "avg_iki": 180,
            "duration_seconds": 60,
            "classification_result": "HUMAN",
            "ml_confidence_score": 92,
            "certificate_id": "TT-12345678",
            "document_hash": "abc",
            "review_status": "PENDING",
            "review_notes": None,
            "risk_level": "LOW",
            "course_name": "Project",
            "course_code": "CS001",
            "created_at": "2026-07-22T00:00:00Z",
            "updated_at": "2026-07-22T00:00:00Z",
            "text_content": "Private document",
            "raw_keystroke_data": [{"type": "keydown", "key": "A"}],
        }

        exported = privacy_safe_export_session(
            row,
            include_sensitive=False,
        )

        self.assertNotIn("text_content", exported)
        self.assertNotIn("raw_keystroke_data", exported)
        self.assertFalse(exported["sensitive_export"])
        self.assertEqual(len(exported["text_content_hash"]), 64)


if __name__ == "__main__":
    unittest.main(verbosity=2)
