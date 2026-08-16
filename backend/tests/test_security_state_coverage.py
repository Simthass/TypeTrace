"""Coverage for privacy redaction, evidence encryption, and Redis state transitions."""

from __future__ import annotations

import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from cryptography.fernet import Fernet

from app.core import crypto, privacy
from app.core.config import settings
from app.services import redis_cache


class PrivacyAndCryptoCoverageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_key = settings.ENCRYPTION_MASTER_KEY
        self.original_secret = settings.SECRET_KEY
        self.original_legacy = settings.ALLOW_LEGACY_EVIDENCE_DECRYPTION
        settings.SECRET_KEY = "coverage-secret"
        settings.ENCRYPTION_MASTER_KEY = Fernet.generate_key().decode()
        settings.ALLOW_LEGACY_EVIDENCE_DECRYPTION = False
        crypto._cipher.cache_clear()
        crypto._legacy_cipher.cache_clear()

    def tearDown(self) -> None:
        settings.ENCRYPTION_MASTER_KEY = self.original_key
        settings.SECRET_KEY = self.original_secret
        settings.ALLOW_LEGACY_EVIDENCE_DECRYPTION = self.original_legacy
        crypto._cipher.cache_clear()
        crypto._legacy_cipher.cache_clear()

    def test_redaction_and_json_parsing_cover_empty_short_and_malformed_inputs(self) -> None:
        self.assertEqual(privacy.redact_email(None), "")
        self.assertEqual(privacy.redact_email("invalid"), "***")
        self.assertEqual(privacy.redact_email("a@EXAMPLE.COM"), "a***@example.com")
        self.assertEqual(privacy.redact_student_id(None), "")
        self.assertEqual(privacy.redact_student_id("12"), "***")
        self.assertEqual(privacy.redact_name(None), "")
        self.assertEqual(privacy.redact_name("   "), "")
        self.assertEqual(privacy.redact_name("Ada"), "A***")
        self.assertEqual(privacy.parse_json_list(None), [])
        self.assertEqual(privacy.parse_json_list([{"x": 1}, "bad"]), [{"x": 1}])
        self.assertEqual(privacy.parse_json_list('[{"x":1}, 2]'), [{"x": 1}])
        self.assertEqual(privacy.parse_json_list("not-json"), [])
        self.assertEqual(privacy.parse_json_list('{"x":1}'), [])

    def test_public_identity_and_sensitive_field_stripping_cover_disclosure_choices(self) -> None:
        public = privacy.safe_public_certificate_identity(
            student_name="Ada Lovelace", student_id="123456",
            show_name=True, show_student_id=True,
        )
        self.assertEqual(public, {"student_name": "Ada Lovelace", "student_id": "123456"})
        stripped = privacy.strip_sensitive_session_fields(
            {
                "id": 1,
                "text_content": "private",
                "raw_keystroke_data": '[{"type":"keydown","key":"Delete"}]',
            }
        )
        self.assertNotIn("text_content", stripped)
        self.assertNotIn("raw_keystroke_data", stripped)
        self.assertTrue(stripped["has_text_content"])
        self.assertEqual(stripped["keystroke_summary"]["deletion_events"], 1)

    def test_sensitive_export_includes_authorized_text_and_parsed_events(self) -> None:
        row = {
            "id": 1, "title": "Session", "wpm": None, "total_keystrokes": None,
            "deletions": None, "pauses": None, "avg_iki": None,
            "duration_seconds": None, "classification_result": "HUMAN",
            "ml_confidence_score": None, "certificate_id": None,
            "document_hash": "abc", "review_status": "PENDING",
            "review_notes": None, "risk_level": "LOW", "course_name": None,
            "course_code": None, "created_at": "now", "updated_at": "now",
            "text_content": "authorized text",
            "raw_keystroke_data": '[{"type":"paste","key":"__PASTE_EVENT__"}]',
        }
        exported = privacy.privacy_safe_export_session(row, include_sensitive=True)
        self.assertTrue(exported["sensitive_export"])
        self.assertEqual(exported["text_content"], "authorized text")
        self.assertEqual(len(exported["raw_keystroke_data"]), 1)
        self.assertNotIn("text_content_hash", exported)

    def test_development_key_requires_secret_and_primary_key_requires_production_key(self) -> None:
        settings.ENCRYPTION_MASTER_KEY = ""
        settings.SECRET_KEY = ""
        crypto._cipher.cache_clear()
        with self.assertRaisesRegex(RuntimeError, "non-empty SECRET_KEY"):
            crypto._development_key()

        settings.SECRET_KEY = "local-secret"
        derived = crypto._development_key()
        self.assertEqual(len(derived), 44)
        with patch.object(type(settings), "is_production", new_callable=lambda: property(lambda self: True)):
            with self.assertRaisesRegex(RuntimeError, "required in production"):
                crypto._primary_key()

    def test_invalid_fernet_key_and_json_type_fail_closed(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "Fernet-compatible"):
            crypto._build_cipher(b"not-a-key", "test key")
        with self.assertRaisesRegex(TypeError, "must be a string"):
            crypto.decrypt_json(123)

    def test_empty_values_and_invalid_json_plaintext_cover_safe_migration_edges(self) -> None:
        self.assertIsNone(crypto.encrypt_text(None))
        self.assertEqual(crypto.encrypt_text(""), "")
        self.assertIsNone(crypto.decrypt_text(None))
        self.assertEqual(crypto.decrypt_text(""), "")
        self.assertIsNone(crypto.encrypt_json(None))
        self.assertIsNone(crypto.decrypt_json(None))

        settings.ALLOW_LEGACY_EVIDENCE_DECRYPTION = True
        self.assertEqual(crypto.decrypt_json("plain-not-json"), "plain-not-json")


class RedisTransitionCoverageTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.original_secret = settings.SECRET_KEY
        settings.SECRET_KEY = "coverage-secret"

    async def asyncTearDown(self) -> None:
        settings.SECRET_KEY = self.original_secret

    def client(self, *, eval_result=None, get_result=None, ttl_result=90, set_result=True, delete_result=1):
        return SimpleNamespace(
            eval=AsyncMock(return_value=eval_result),
            get=AsyncMock(return_value=get_result),
            ttl=AsyncMock(return_value=ttl_result),
            set=AsyncMock(return_value=set_result),
            delete=AsyncMock(return_value=delete_result),
        )

    async def test_cancel_registration_uses_pending_email_and_decodes_status(self) -> None:
        client = self.client(eval_result=json.dumps({"status": "CANCELLED"}))
        with (
            patch.object(redis_cache, "redis_client", client),
            patch.object(redis_cache, "get_pending_registration", AsyncMock(return_value={"email": "Student@Example.com"})),
        ):
            result = await redis_cache.cancel_pending_registration("reg-1")
        self.assertEqual(result["status"], "CANCELLED")
        client.eval.assert_awaited_once()

    async def test_prepare_resend_adds_reservation_only_for_ready_state(self) -> None:
        ready = self.client(eval_result=json.dumps({"status": "READY", "email": "a@b.com"}))
        with patch.object(redis_cache, "redis_client", ready), patch.object(redis_cache.secrets, "token_urlsafe", return_value="reservation"):
            result = await redis_cache.prepare_registration_resend("reg", "123456")
        self.assertEqual(result["reservation_token"], "reservation")

        blocked = self.client(eval_result=json.dumps({"status": "COOLDOWN", "retry_after": 10}))
        with patch.object(redis_cache, "redis_client", blocked):
            result = await redis_cache.prepare_registration_resend("reg", "123456")
        self.assertNotIn("reservation_token", result)

    async def test_abort_registration_resend_maps_redis_integer_to_bool(self) -> None:
        client = self.client(eval_result=1)
        with patch.object(redis_cache, "redis_client", client):
            self.assertTrue(await redis_cache.abort_registration_resend("reg", "token"))

    async def test_create_and_delete_password_reset_cover_success_and_collision(self) -> None:
        client = self.client(set_result=True, delete_result=1)
        with (
            patch.object(redis_cache, "redis_client", client),
            patch.object(redis_cache.secrets, "token_urlsafe", return_value="reset-token"),
            patch.object(redis_cache, "_utc_timestamp", return_value=1000),
        ):
            payload = await redis_cache.create_password_reset(email=" USER@EXAMPLE.COM ", otp="123456", user_id="u1")
            self.assertEqual(payload["reset_id"], "rst_reset-token")
            self.assertEqual(payload["email"], "user@example.com")
            self.assertEqual(payload["state"], "OTP_PENDING")
            self.assertTrue(await redis_cache.delete_password_reset(payload["reset_id"]))

        collision = self.client(set_result=False)
        with patch.object(redis_cache, "redis_client", collision):
            with self.assertRaisesRegex(redis_cache.RedisStateError, "Unable to create"):
                await redis_cache.create_password_reset(email="a@b.com", otp="123456", user_id=None)

    async def test_verify_password_reset_otp_decodes_script_contract(self) -> None:
        client = self.client(eval_result=json.dumps({"status": "ISSUED", "payload": {"state": "TOKEN_ISSUED"}}))
        with patch.object(redis_cache, "redis_client", client):
            result = await redis_cache.verify_password_reset_otp("rst", "123456", proposed_jti="jti")
        self.assertEqual(result["status"], "ISSUED")

    async def test_claim_password_reset_adds_claim_token_only_when_claimed(self) -> None:
        claimed = self.client(eval_result=json.dumps({"status": "CLAIMED", "payload": {}}))
        with patch.object(redis_cache, "redis_client", claimed), patch.object(redis_cache.secrets, "token_urlsafe", return_value="claim-token"):
            result = await redis_cache.claim_password_reset("rst", "jti")
        self.assertEqual(result["claim_token"], "claim-token")

        invalid = self.client(eval_result=json.dumps({"status": "INVALID"}))
        with patch.object(redis_cache, "redis_client", invalid):
            result = await redis_cache.claim_password_reset("rst", "jti")
        self.assertNotIn("claim_token", result)

    async def test_release_and_complete_password_reset_map_script_results(self) -> None:
        client = self.client(eval_result=1)
        with patch.object(redis_cache, "redis_client", client):
            self.assertTrue(await redis_cache.release_password_reset_claim("rst", "claim"))
            self.assertTrue(await redis_cache.complete_password_reset("rst", "claim"))

    async def test_password_reset_status_clamps_ttl_and_attempt_budget(self) -> None:
        payload = json.dumps({"email": "a@b.com", "state": "TOKEN_ISSUED", "attempt_count": 99})
        client = self.client(get_result=payload, ttl_result=-1)
        with patch.object(redis_cache, "redis_client", client):
            result = await redis_cache.get_password_reset_status("rst")
        self.assertEqual(result["expires_in_seconds"], 0)
        self.assertEqual(result["attempts_remaining"], 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
