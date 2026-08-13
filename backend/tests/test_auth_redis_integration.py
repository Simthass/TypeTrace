"""Live Redis state-machine tests.

Run only against an isolated Redis database:
    RUN_REDIS_INTEGRATION_TESTS=1 python -m unittest \
        tests.test_auth_redis_integration -v
"""

from __future__ import annotations

import asyncio
import json
import os
import unittest

from app.schemas.user import StudentRegister
from app.services import redis_cache


@unittest.skipUnless(
    os.getenv("RUN_REDIS_INTEGRATION_TESTS") == "1",
    "Set RUN_REDIS_INTEGRATION_TESTS=1 for live Redis tests.",
)
class RedisAuthenticationStateMachineTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        await redis_cache.redis_client.ping()

    async def asyncTearDown(self) -> None:
        # Tests use random opaque IDs. Expiry is the final safety net; no FLUSHDB
        # is used because a misconfigured test must not erase a shared Redis DB.
        await redis_cache.redis_client.aclose()

    @staticmethod
    def student(email: str) -> StudentRegister:
        return StudentRegister(
            role="STUDENT",
            first_name="Redis",
            last_name="Test",
            student_id="2540927",
            email=email,
            university_name="University",
            password="Password1",
            consent=True,
        )

    async def test_concurrent_registration_claim_has_one_winner(self) -> None:
        pending = await redis_cache.create_pending_registration(
            self.student("concurrent@example.com"),
            "123456",
            "password-hash",
        )
        registration_id = str(pending["registration_id"])
        first, second = await asyncio.gather(
            redis_cache.claim_registration(registration_id, "123456"),
            redis_cache.claim_registration(registration_id, "123456"),
        )
        self.assertEqual(
            sorted([first["status"], second["status"]]),
            ["CLAIMED", "IN_PROGRESS"],
        )

        winner = first if first["status"] == "CLAIMED" else second
        await redis_cache.release_registration_claim(
            registration_id,
            str(winner["claim_token"]),
        )
        await redis_cache.cancel_pending_registration(registration_id)

    async def test_invalid_otp_locks_after_five_attempts(self) -> None:
        pending = await redis_cache.create_pending_registration(
            self.student("lock@example.com"),
            "123456",
            "password-hash",
        )
        registration_id = str(pending["registration_id"])
        statuses = []
        for _ in range(redis_cache.MAX_OTP_ATTEMPTS):
            result = await redis_cache.claim_registration(
                registration_id,
                "000000",
            )
            statuses.append(result["status"])
        self.assertEqual(statuses[-1], "LOCKED")
        self.assertEqual(
            (await redis_cache.get_registration_status(registration_id))["state"],
            "LOCKED",
        )
        await redis_cache.cancel_pending_registration(registration_id)

    async def test_failed_resend_keeps_previous_otp_valid(self) -> None:
        pending = await redis_cache.create_pending_registration(
            self.student("resend@example.com"),
            "123456",
            "password-hash",
        )
        registration_id = str(pending["registration_id"])
        key = redis_cache._registration_key(registration_id)
        state = await redis_cache.get_pending_registration(registration_id)
        self.assertIsNotNone(state)
        state["last_sent_at"] = redis_cache._utc_timestamp() - 61
        ttl = await redis_cache.redis_client.ttl(key)
        await redis_cache.redis_client.set(
            key,
            json.dumps(state),
            ex=max(int(ttl), 1),
        )

        prepared = await redis_cache.prepare_registration_resend(
            registration_id,
            "654321",
        )
        self.assertEqual(prepared["status"], "READY")
        await redis_cache.abort_registration_resend(
            registration_id,
            str(prepared["reservation_token"]),
        )
        claim = await redis_cache.claim_registration(
            registration_id,
            "123456",
        )
        self.assertEqual(claim["status"], "CLAIMED")
        await redis_cache.release_registration_claim(
            registration_id,
            str(claim["claim_token"]),
        )
        await redis_cache.cancel_pending_registration(registration_id)


    async def test_completed_registration_marker_does_not_retain_otp_hash(self) -> None:
        pending = await redis_cache.create_pending_registration(
            self.student("completed@example.com"),
            "123456",
            "password-hash",
        )
        registration_id = str(pending["registration_id"])
        claim = await redis_cache.claim_registration(registration_id, "123456")
        self.assertEqual(claim["status"], "CLAIMED")
        completed = await redis_cache.complete_registration(
            registration_id,
            str(claim["claim_token"]),
            user_id="user-1",
            email="completed@example.com",
            role="STUDENT",
        )
        self.assertTrue(completed)
        raw = await redis_cache.redis_client.get(
            redis_cache._completed_key(registration_id)
        )
        self.assertIsNotNone(raw)
        completed_state = json.loads(str(raw))
        self.assertNotIn("otp_hash", completed_state)
        await redis_cache.redis_client.delete(
            redis_cache._completed_key(registration_id)
        )

    async def test_password_reset_token_claim_is_one_time(self) -> None:
        reset = await redis_cache.create_password_reset(
            email="reset@example.com",
            otp="123456",
            user_id="user-1",
        )
        reset_id = str(reset["reset_id"])
        verified = await redis_cache.verify_password_reset_otp(
            reset_id,
            "123456",
            proposed_jti="jti-1",
        )
        self.assertEqual(verified["status"], "ISSUED")

        claimed = await redis_cache.claim_password_reset(reset_id, "jti-1")
        self.assertEqual(claimed["status"], "CLAIMED")
        concurrent = await redis_cache.claim_password_reset(reset_id, "jti-1")
        self.assertEqual(concurrent["status"], "IN_PROGRESS")

        await redis_cache.complete_password_reset(
            reset_id,
            str(claimed["claim_token"]),
        )
        reused = await redis_cache.claim_password_reset(reset_id, "jti-1")
        self.assertEqual(reused["status"], "COMPLETED")
        await redis_cache.delete_password_reset(reset_id)


if __name__ == "__main__":
    unittest.main(verbosity=2)
