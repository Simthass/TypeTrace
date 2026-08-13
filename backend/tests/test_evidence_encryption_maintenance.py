from __future__ import annotations

import json
import unittest

from cryptography.fernet import Fernet

from scripts.evidence_encryption_maintenance import (
    classify_json,
    classify_text,
    looks_like_fernet_token,
)


class EvidenceEncryptionMaintenanceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.active = Fernet(Fernet.generate_key())
        self.legacy = Fernet(Fernet.generate_key())
        self.unknown = Fernet(Fernet.generate_key())

    def test_active_text_is_recognized(self) -> None:
        token = self.active.encrypt("private essay".encode()).decode()
        result = classify_text(
            token,
            active_cipher=self.active,
            legacy_cipher=self.legacy,
        )
        self.assertEqual(result.status, "ACTIVE_CIPHER")
        self.assertEqual(result.plaintext, "private essay")

    def test_legacy_text_is_migratable(self) -> None:
        token = self.legacy.encrypt("legacy essay".encode()).decode()
        result = classify_text(
            token,
            active_cipher=self.active,
            legacy_cipher=self.legacy,
        )
        self.assertEqual(result.status, "LEGACY_CIPHER")
        self.assertEqual(result.plaintext, "legacy essay")

    def test_plaintext_text_is_migratable(self) -> None:
        result = classify_text(
            "historical plaintext",
            active_cipher=self.active,
            legacy_cipher=self.legacy,
        )
        self.assertEqual(result.status, "PLAINTEXT")

    def test_unknown_key_token_is_never_treated_as_plaintext(self) -> None:
        token = self.unknown.encrypt("do not double encrypt".encode()).decode()
        self.assertTrue(looks_like_fernet_token(token))
        result = classify_text(
            token,
            active_cipher=self.active,
            legacy_cipher=self.legacy,
        )
        self.assertEqual(result.status, "UNKNOWN_FERNET_KEY")
        self.assertIsNone(result.plaintext)

    def test_active_json_array_is_recognized(self) -> None:
        events = [{"type": "keydown", "key": "a"}]
        token = self.active.encrypt(
            json.dumps(events, separators=(",", ":")).encode()
        ).decode()
        result = classify_json(
            token,
            active_cipher=self.active,
            legacy_cipher=self.legacy,
        )
        self.assertEqual(result.status, "ACTIVE_CIPHER")
        self.assertEqual(result.plaintext, events)

    def test_plain_jsonb_array_is_migratable(self) -> None:
        events = [{"type": "paste", "text": "x"}]
        result = classify_json(
            events,
            active_cipher=self.active,
            legacy_cipher=self.legacy,
        )
        self.assertEqual(result.status, "PLAINTEXT")
        self.assertEqual(result.plaintext, events)

    def test_stringified_json_array_is_migratable(self) -> None:
        events = [{"type": "keydown"}]
        result = classify_json(
            json.dumps(events),
            active_cipher=self.active,
            legacy_cipher=self.legacy,
        )
        self.assertEqual(result.status, "PLAINTEXT_JSON_STRING")
        self.assertEqual(result.plaintext, events)

    def test_malformed_or_wrong_shape_json_blocks_migration(self) -> None:
        malformed = classify_json(
            "not-json",
            active_cipher=self.active,
            legacy_cipher=self.legacy,
        )
        wrong_shape = classify_json(
            {"event": "keydown"},
            active_cipher=self.active,
            legacy_cipher=self.legacy,
        )
        self.assertEqual(malformed.status, "INVALID_JSON")
        self.assertEqual(wrong_shape.status, "INVALID_JSON_SHAPE")


if __name__ == "__main__":
    unittest.main()
