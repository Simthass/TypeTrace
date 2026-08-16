"""Deterministic unit coverage for Redis-backed authentication state helpers.

These tests patch the Redis client with AsyncMock objects.  They exercise the
Python state-machine wrappers and fail-closed decoding behavior without
requiring a live Redis server or modifying application data.
"""

from __future__ import annotations

import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.services import redis_cache


TEST_SETTINGS = SimpleNamespace(SECRET_KEY="coverage-secret")


def fake_redis(
    *,
    eval_result=None,
    get_result=None,
    ttl_result=300,
) -> SimpleNamespace:
    return SimpleNamespace(
        eval=AsyncMock(return_value=eval_result),
        get=AsyncMock(return_value=get_result),
        ttl=AsyncMock(return_value=ttl_result),
    )


class RedisStateHelperCoverageTests(unittest.TestCase):
    def test_timestamp_hashes_and_key_helpers_are_stable(self) -> None:
        timestamp = redis_cache._utc_timestamp()
        self.assertIsInstance(timestamp, int)
        self.assertGreater(timestamp, 0)

        with patch.object(redis_cache, "settings", TEST_SETTINGS):
            first_hash = redis_cache._otp_hash("123456")
            second_hash = redis_cache._otp_hash("123456")
            changed_hash = redis_cache._otp_hash("654321")
            normalized = redis_cache._email_fingerprint(" Student@Example.COM ")
            normalized_again = redis_cache._email_fingerprint("student@example.com")

        self.assertEqual(first_hash, second_hash)
        self.assertNotEqual(first_hash, changed_hash)
        self.assertEqual(len(first_hash), 64)
        self.assertEqual(normalized, normalized_again)
        self.assertEqual(redis_cache._registration_key("abc"), "pending_registration:abc")
        self.assertEqual(redis_cache._completed_key("abc"), "completed_registration:abc")
        self.assertEqual(redis_cache._reset_key("rst"), "password_reset:rst")

    def test_hash_helpers_fail_closed_without_secret_key(self) -> None:
        with patch.object(redis_cache, "settings", SimpleNamespace(SECRET_KEY="")):
            with self.assertRaisesRegex(redis_cache.RedisStateError, "OTP hashing"):
                redis_cache._otp_hash("123456")
            with self.assertRaisesRegex(redis_cache.RedisStateError, "registration indexing"):
                redis_cache._email_fingerprint("student@example.com")

    def test_decode_object_accepts_dict_and_rejects_malformed_state(self) -> None:
        self.assertIsNone(redis_cache._decode_object(None, label="state"))
        self.assertEqual(
            redis_cache._decode_object('{"state":"PENDING"}', label="state"),
            {"state": "PENDING"},
        )

        with self.assertRaisesRegex(redis_cache.RedisStateError, "Malformed state state"):
            redis_cache._decode_object("{not-json", label="state")
        with self.assertRaisesRegex(redis_cache.RedisStateError, "Invalid state state type"):
            redis_cache._decode_object("[]", label="state")

    def test_decode_script_result_requires_status(self) -> None:
        self.assertEqual(
            redis_cache._decode_script_result(
                '{"status":"CREATED"}',
                label="registration creation",
            ),
            {"status": "CREATED"},
        )
        with self.assertRaisesRegex(redis_cache.RedisStateError, "Invalid registration creation"):
            redis_cache._decode_script_result("{}", label="registration creation")
        with self.assertRaisesRegex(redis_cache.RedisStateError, "Invalid registration creation"):
            redis_cache._decode_script_result(None, label="registration creation")


class RedisRegistrationCoverageTests(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def student() -> SimpleNamespace:
        return SimpleNamespace(
            role="STUDENT",
            first_name="Redis",
            last_name="Coverage",
            email=" Student@Example.COM ",
            student_id="STU-REDIS-1",
            university_name="Example University",
            department=None,
        )

    async def test_create_pending_registration_returns_normalized_payload(self) -> None:
        client = fake_redis(eval_result='{"status":"CREATED"}')

        with (
            patch.object(redis_cache, "settings", TEST_SETTINGS),
            patch.object(redis_cache, "redis_client", client),
            patch.object(redis_cache.secrets, "token_urlsafe", return_value="registration-token"),
            patch.object(redis_cache, "_utc_timestamp", return_value=1_000),
        ):
            payload = await redis_cache.create_pending_registration(
                self.student(),
                "123456",
                "stored-password-hash",
            )

        self.assertEqual(payload["registration_id"], "reg_registration-token")
        self.assertEqual(payload["email"], "student@example.com")
        self.assertEqual(payload["state"], "PENDING")
        self.assertEqual(payload["hashed_password"], "stored-password-hash")
        self.assertEqual(payload["created_at"], 1_000)
        self.assertEqual(
            payload["expires_at"],
            1_000 + redis_cache.REGISTRATION_TTL_SECONDS,
        )
        self.assertEqual(
            payload["consent_policy_version"],
            redis_cache.CONSENT_POLICY_VERSION,
        )
        client.eval.assert_awaited_once()

    async def test_create_pending_registration_rejects_active_registration(self) -> None:
        client = fake_redis(eval_result='{"status":"ACTIVE"}')

        with (
            patch.object(redis_cache, "settings", TEST_SETTINGS),
            patch.object(redis_cache, "redis_client", client),
            patch.object(redis_cache.secrets, "token_urlsafe", return_value="registration-token"),
            patch.object(redis_cache, "_utc_timestamp", return_value=1_000),
        ):
            with self.assertRaises(redis_cache.ActiveRegistrationError):
                await redis_cache.create_pending_registration(
                    self.student(),
                    "123456",
                    "stored-password-hash",
                )

    async def test_create_pending_registration_rejects_unexpected_script_state(self) -> None:
        client = fake_redis(eval_result='{"status":"COLLISION"}')

        with (
            patch.object(redis_cache, "settings", TEST_SETTINGS),
            patch.object(redis_cache, "redis_client", client),
            patch.object(redis_cache.secrets, "token_urlsafe", return_value="registration-token"),
            patch.object(redis_cache, "_utc_timestamp", return_value=1_000),
        ):
            with self.assertRaisesRegex(redis_cache.RedisStateError, "unique registration"):
                await redis_cache.create_pending_registration(
                    self.student(),
                    "123456",
                    "stored-password-hash",
                )

    async def test_get_pending_registration_decodes_present_and_missing_state(self) -> None:
        client = fake_redis(get_result='{"email":"student@example.com","state":"PENDING"}')
        with patch.object(redis_cache, "redis_client", client):
            present = await redis_cache.get_pending_registration("reg-1")
        self.assertEqual(present["state"], "PENDING")

        client = fake_redis(get_result=None)
        with patch.object(redis_cache, "redis_client", client):
            missing = await redis_cache.get_pending_registration("reg-2")
        self.assertIsNone(missing)

    async def test_claim_registration_adds_claim_token_only_when_claimed(self) -> None:
        claimed_client = fake_redis(
            eval_result='{"status":"CLAIMED","payload":{"email":"student@example.com"}}'
        )
        with (
            patch.object(redis_cache, "settings", TEST_SETTINGS),
            patch.object(redis_cache, "redis_client", claimed_client),
            patch.object(redis_cache.secrets, "token_urlsafe", return_value="claim-token"),
            patch.object(redis_cache, "_utc_timestamp", return_value=2_000),
        ):
            claimed = await redis_cache.claim_registration("reg-1", "123456")

        self.assertEqual(claimed["status"], "CLAIMED")
        self.assertEqual(claimed["claim_token"], "claim-token")

        pending_client = fake_redis(eval_result='{"status":"INVALID_OTP"}')
        with (
            patch.object(redis_cache, "settings", TEST_SETTINGS),
            patch.object(redis_cache, "redis_client", pending_client),
            patch.object(redis_cache.secrets, "token_urlsafe", return_value="unused-token"),
            patch.object(redis_cache, "_utc_timestamp", return_value=2_000),
        ):
            not_claimed = await redis_cache.claim_registration("reg-1", "000000")

        self.assertEqual(not_claimed, {"status": "INVALID_OTP"})
        self.assertNotIn("claim_token", not_claimed)

    async def test_release_and_complete_registration_map_redis_results_to_bool(self) -> None:
        release_client = fake_redis(eval_result=1)
        with patch.object(redis_cache, "redis_client", release_client):
            released = await redis_cache.release_registration_claim("reg-1", "claim-token")
        self.assertTrue(released)

        complete_client = fake_redis(eval_result=1)
        with (
            patch.object(redis_cache, "settings", TEST_SETTINGS),
            patch.object(redis_cache, "redis_client", complete_client),
            patch.object(redis_cache, "_utc_timestamp", return_value=3_000),
        ):
            completed = await redis_cache.complete_registration(
                "reg-1",
                "claim-token",
                user_id="user-1",
                email="student@example.com",
                role="STUDENT",
            )
        self.assertTrue(completed)
        complete_client.eval.assert_awaited_once()

    async def test_registration_status_handles_completed_pending_and_missing(self) -> None:
        completed_client = fake_redis(
            get_result=json.dumps(
                {
                    "email": "student@example.com",
                    "role": "STUDENT",
                    "state": "COMPLETED",
                }
            ),
            ttl_result=-1,
        )
        with patch.object(redis_cache, "redis_client", completed_client):
            completed = await redis_cache.get_registration_status("reg-1")

        self.assertEqual(completed["state"], "COMPLETED")
        self.assertEqual(completed["expires_in_seconds"], 0)
        self.assertEqual(completed["attempts_remaining"], 0)

        pending_client = fake_redis(ttl_result=480)
        pending_client.get = AsyncMock(
            side_effect=[
                None,
                json.dumps(
                    {
                        "email": "student@example.com",
                        "role": "STUDENT",
                        "state": "PENDING",
                        "attempt_count": 2,
                        "resend_count": 1,
                        "last_sent_at": 970,
                    }
                ),
            ]
        )
        with (
            patch.object(redis_cache, "redis_client", pending_client),
            patch.object(redis_cache, "_utc_timestamp", return_value=1_000),
        ):
            pending = await redis_cache.get_registration_status("reg-2")

        self.assertEqual(pending["state"], "PENDING")
        self.assertEqual(pending["expires_in_seconds"], 480)
        self.assertEqual(
            pending["attempts_remaining"],
            redis_cache.MAX_OTP_ATTEMPTS - 2,
        )
        self.assertEqual(
            pending["resends_remaining"],
            redis_cache.MAX_RESENDS - 1,
        )
        self.assertEqual(pending["resend_available_in_seconds"], 30)

        missing_client = fake_redis()
        missing_client.get = AsyncMock(side_effect=[None, None])
        with patch.object(redis_cache, "redis_client", missing_client):
            missing = await redis_cache.get_registration_status("reg-3")
        self.assertIsNone(missing)


class RedisPasswordResetCoverageTests(unittest.IsolatedAsyncioTestCase):
    async def test_cancel_password_reset_decodes_script_response(self) -> None:
        client = fake_redis(eval_result='{"status":"CANCELLED"}')
        with patch.object(redis_cache, "redis_client", client):
            result = await redis_cache.cancel_password_reset("rst-1")
        self.assertEqual(result, {"status": "CANCELLED"})

    async def test_password_reset_status_handles_pending_and_missing(self) -> None:
        client = fake_redis(
            get_result=json.dumps(
                {
                    "email": "student@example.com",
                    "state": "OTP_PENDING",
                    "attempt_count": 2,
                }
            ),
            ttl_result=-4,
        )
        with patch.object(redis_cache, "redis_client", client):
            result = await redis_cache.get_password_reset_status("rst-1")

        self.assertEqual(result["reset_id"], "rst-1")
        self.assertEqual(result["state"], "OTP_PENDING")
        self.assertEqual(result["expires_in_seconds"], 0)
        self.assertEqual(
            result["attempts_remaining"],
            redis_cache.MAX_OTP_ATTEMPTS - 2,
        )

        missing_client = fake_redis(get_result=None)
        with patch.object(redis_cache, "redis_client", missing_client):
            missing = await redis_cache.get_password_reset_status("rst-2")
        self.assertIsNone(missing)


if __name__ == "__main__":
    unittest.main(verbosity=2)
