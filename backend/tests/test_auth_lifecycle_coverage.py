from __future__ import annotations

import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException, Response
from jose import JWTError
from sqlalchemy.exc import IntegrityError

from app.api.routes import auth as auth_routes
from app.services import redis_cache
from app.services.email import EmailDeliveryError
from tests.helpers import FakeAsyncSession, make_user


REGISTRATION_ID = "reg_" + "A" * 64
RESET_ID = "rst_" + "B" * 64


def unwrap(func):
    current = func
    while hasattr(current, "__wrapped__"):
        current = current.__wrapped__
    return current


REGISTER = unwrap(auth_routes.register_user)
LOGIN = unwrap(auth_routes.login_user)
RESEND = unwrap(auth_routes.resend_registration_otp)
VERIFY_OTP = unwrap(auth_routes.verify_otp)
REQUEST_RESET = unwrap(auth_routes.request_password_reset)
VERIFY_RESET = unwrap(auth_routes.verify_password_reset)
CONFIRM_RESET = unwrap(auth_routes.confirm_password_reset)


def registration_input(*, student_id: str | None = "2540927") -> SimpleNamespace:
    return SimpleNamespace(
        role="STUDENT",
        first_name="Ada",
        last_name="Lovelace",
        student_id=student_id,
        email="  ADA@EXAMPLE.EDU  ",
        university_name="University of Bedfordshire",
        department=None,
        password="Password123!",
        consent=True,
    )


def pending_registration(**overrides: object) -> dict[str, object]:
    value: dict[str, object] = {
        "registration_id": REGISTRATION_ID,
        "role": "STUDENT",
        "first_name": "Ada",
        "last_name": "Lovelace",
        "email": "ada@example.edu",
        "hashed_password": "stored-password-hash",
        "student_id": "2540927",
        "university_name": "University of Bedfordshire",
        "department": None,
        "consent_accepted_at": datetime.now(timezone.utc).isoformat(),
        "consent_policy_version": "typetrace-consent-v1",
        "consent_source": "web_registration",
    }
    value.update(overrides)
    return value


def registration_status_payload(**overrides: object) -> dict[str, object]:
    value: dict[str, object] = {
        "registration_id": REGISTRATION_ID,
        "email": "ada@example.edu",
        "role": "STUDENT",
        "state": "PENDING",
        "expires_in_seconds": 600,
        "attempts_remaining": 4,
        "resends_remaining": 2,
        "resend_available_in_seconds": 0,
    }
    value.update(overrides)
    return value


def reset_status_payload(**overrides: object) -> dict[str, object]:
    value: dict[str, object] = {
        "reset_id": RESET_ID,
        "email": "ada@example.edu",
        "state": "OTP_PENDING",
        "expires_in_seconds": 600,
        "attempts_remaining": 4,
    }
    value.update(overrides)
    return value


class AuthLifecycleCoverageTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.request = SimpleNamespace()
        self.response = Response()

    async def assert_http(self, status_code: int, awaitable, contains: str | None = None):
        with self.assertRaises(HTTPException) as raised:
            await awaitable
        self.assertEqual(raised.exception.status_code, status_code)
        if contains is not None:
            self.assertIn(contains, str(raised.exception.detail))
        return raised.exception

    def test_pending_registration_helpers_validate_and_normalize_fields(self) -> None:
        naive = auth_routes._parse_consent_timestamp("2026-08-14T10:00:00")
        self.assertEqual(naive.tzinfo, timezone.utc)
        aware = auth_routes._parse_consent_timestamp("2026-08-14T10:00:00+05:30")
        self.assertEqual(aware.utcoffset().total_seconds(), 0)
        self.assertEqual(
            auth_routes._required_pending_text({"name": "  Ada  "}, "name"),
            "Ada",
        )
        with self.assertRaises(ValueError):
            auth_routes._parse_consent_timestamp(None)
        with self.assertRaises(ValueError):
            auth_routes._required_pending_text({"name": "   "}, "name")

    async def test_register_rejects_existing_email_before_pending_state(self) -> None:
        db = FakeAsyncSession(["existing-user-id"])
        create_pending = AsyncMock()
        with patch.object(auth_routes.redis_cache, "create_pending_registration", create_pending):
            await self.assert_http(
                409,
                REGISTER(
                    request=self.request,
                    response=self.response,
                    user_in=registration_input(),
                    db=db,
                ),
                "Email already registered",
            )
        create_pending.assert_not_awaited()

    async def test_register_rejects_existing_student_id(self) -> None:
        db = FakeAsyncSession([None, "student-owner"])
        await self.assert_http(
            409,
            REGISTER(
                request=self.request,
                response=self.response,
                user_in=registration_input(),
                db=db,
            ),
            "Student ID already registered",
        )

    async def test_register_active_pending_registration_returns_conflict(self) -> None:
        db = FakeAsyncSession([None, None])
        with patch.object(
            auth_routes.redis_cache,
            "create_pending_registration",
            AsyncMock(side_effect=redis_cache.ActiveRegistrationError("active")),
        ):
            await self.assert_http(
                409,
                REGISTER(
                    request=self.request,
                    response=self.response,
                    user_in=registration_input(),
                    db=db,
                ),
                "active registration",
            )

    async def test_register_pending_state_failure_returns_service_unavailable(self) -> None:
        db = FakeAsyncSession([None, None])
        with patch.object(
            auth_routes.redis_cache,
            "create_pending_registration",
            AsyncMock(side_effect=RuntimeError("redis down")),
        ):
            await self.assert_http(
                503,
                REGISTER(
                    request=self.request,
                    response=self.response,
                    user_in=registration_input(),
                    db=db,
                ),
                "temporarily unavailable",
            )

    async def test_register_email_failure_still_returns_503_when_cleanup_fails(self) -> None:
        db = FakeAsyncSession([None, None])
        with (
            patch.object(
                auth_routes.redis_cache,
                "create_pending_registration",
                AsyncMock(return_value={"registration_id": REGISTRATION_ID}),
            ),
            patch.object(
                auth_routes.redis_cache,
                "cancel_pending_registration",
                AsyncMock(side_effect=RuntimeError("cleanup down")),
            ),
            patch.object(
                auth_routes,
                "send_otp_email",
                AsyncMock(side_effect=EmailDeliveryError("smtp down")),
            ),
            patch.object(auth_routes, "get_password_hash", return_value="hash"),
        ):
            await self.assert_http(
                503,
                REGISTER(
                    request=self.request,
                    response=self.response,
                    user_in=registration_input(),
                    db=db,
                ),
                "could not be delivered",
            )

    async def test_registration_status_success_missing_and_backend_failure(self) -> None:
        with patch.object(
            auth_routes.redis_cache,
            "get_registration_status",
            AsyncMock(return_value=registration_status_payload()),
        ):
            value = await auth_routes.registration_status(REGISTRATION_ID)
        self.assertEqual(value.registration_id, REGISTRATION_ID)
        self.assertEqual(value.state, "PENDING")

        with patch.object(
            auth_routes.redis_cache,
            "get_registration_status",
            AsyncMock(return_value=None),
        ):
            await self.assert_http(
                410,
                auth_routes.registration_status(REGISTRATION_ID),
                "expired",
            )

        with patch.object(
            auth_routes.redis_cache,
            "get_registration_status",
            AsyncMock(side_effect=RuntimeError("redis down")),
        ):
            await self.assert_http(
                503,
                auth_routes.registration_status(REGISTRATION_ID),
                "temporarily unavailable",
            )

    async def test_resend_maps_missing_locked_cooldown_limit_and_in_progress_states(self) -> None:
        cases = [
            ({"status": "MISSING"}, 410, "expired"),
            ({"status": "LOCKED"}, 423, "locked"),
            ({"status": "COOLDOWN", "retry_after": 0}, 429, "1 seconds"),
            ({"status": "LIMIT"}, 429, "Maximum resend limit"),
            ({"status": "CLAIMED"}, 409, "already being processed"),
        ]
        for prepared, code, text in cases:
            with self.subTest(prepared=prepared):
                with patch.object(
                    auth_routes.redis_cache,
                    "prepare_registration_resend",
                    AsyncMock(return_value=prepared),
                ):
                    await self.assert_http(
                        code,
                        RESEND(
                            request=self.request,
                            response=self.response,
                            req=SimpleNamespace(registration_id=REGISTRATION_ID),
                        ),
                        text,
                    )

    async def test_resend_backend_failure_returns_503(self) -> None:
        with patch.object(
            auth_routes.redis_cache,
            "prepare_registration_resend",
            AsyncMock(side_effect=RuntimeError("redis down")),
        ):
            await self.assert_http(
                503,
                RESEND(
                    request=self.request,
                    response=self.response,
                    req=SimpleNamespace(registration_id=REGISTRATION_ID),
                ),
                "temporarily unavailable",
            )

    async def test_resend_email_failure_aborts_reservation_and_preserves_previous_code(self) -> None:
        abort = AsyncMock(return_value=False)
        with (
            patch.object(
                auth_routes.redis_cache,
                "prepare_registration_resend",
                AsyncMock(
                    return_value={
                        "status": "READY",
                        "reservation_token": "reservation",
                        "email": "ada@example.edu",
                    }
                ),
            ),
            patch.object(auth_routes, "send_otp_email", AsyncMock(side_effect=EmailDeliveryError("smtp"))),
            patch.object(auth_routes.redis_cache, "abort_registration_resend", abort),
        ):
            await self.assert_http(
                503,
                RESEND(
                    request=self.request,
                    response=self.response,
                    req=SimpleNamespace(registration_id=REGISTRATION_ID),
                ),
                "previous verification code remains valid",
            )
        abort.assert_awaited_once_with(REGISTRATION_ID, "reservation")

    async def test_resend_commit_failure_false_commit_and_success(self) -> None:
        prepared = {
            "status": "READY",
            "reservation_token": "reservation",
            "email": "ada@example.edu",
        }
        for commit_value, commit_error, expected_code in [
            (None, RuntimeError("redis down"), 503),
            (False, None, 409),
        ]:
            with self.subTest(expected_code=expected_code):
                commit = AsyncMock(side_effect=commit_error) if commit_error else AsyncMock(return_value=commit_value)
                with (
                    patch.object(auth_routes.redis_cache, "prepare_registration_resend", AsyncMock(return_value=prepared)),
                    patch.object(auth_routes, "send_otp_email", AsyncMock(return_value=None)),
                    patch.object(auth_routes.redis_cache, "commit_registration_resend", commit),
                ):
                    await self.assert_http(
                        expected_code,
                        RESEND(
                            request=self.request,
                            response=self.response,
                            req=SimpleNamespace(registration_id=REGISTRATION_ID),
                        ),
                    )

        with (
            patch.object(auth_routes.redis_cache, "prepare_registration_resend", AsyncMock(return_value=prepared)),
            patch.object(auth_routes, "send_otp_email", AsyncMock(return_value=None)),
            patch.object(auth_routes.redis_cache, "commit_registration_resend", AsyncMock(return_value=True)),
        ):
            value = await RESEND(
                request=self.request,
                response=self.response,
                req=SimpleNamespace(registration_id=REGISTRATION_ID),
            )
        self.assertIn("new verification code", value.message)

    async def test_cancel_registration_maps_failure_conflicts_and_terminal_states(self) -> None:
        with patch.object(
            auth_routes.redis_cache,
            "cancel_pending_registration",
            AsyncMock(side_effect=RuntimeError("redis down")),
        ):
            await self.assert_http(503, auth_routes.cancel_pending_registration(REGISTRATION_ID))

        for state, code in [("IN_PROGRESS", 409), ("COMPLETED", 409)]:
            with self.subTest(state=state):
                with patch.object(
                    auth_routes.redis_cache,
                    "cancel_pending_registration",
                    AsyncMock(return_value={"status": state}),
                ):
                    await self.assert_http(code, auth_routes.cancel_pending_registration(REGISTRATION_ID))

        for state, expected in [
            ("CANCELLED", "Pending registration cancelled."),
            ("MISSING", "Pending registration was already absent."),
        ]:
            with patch.object(
                auth_routes.redis_cache,
                "cancel_pending_registration",
                AsyncMock(return_value={"status": state}),
            ):
                value = await auth_routes.cancel_pending_registration(REGISTRATION_ID)
            self.assertEqual(value.message, expected)

    async def test_verify_otp_maps_claim_service_and_terminal_states(self) -> None:
        states = [
            ({"status": "MISSING"}, 410),
            ({"status": "LOCKED"}, 423),
            ({"status": "IN_PROGRESS"}, 409),
            ({"status": "UNKNOWN"}, 409),
        ]
        for claim, code in states:
            with self.subTest(claim=claim):
                with patch.object(auth_routes.redis_cache, "claim_registration", AsyncMock(return_value=claim)):
                    await self.assert_http(
                        code,
                        VERIFY_OTP(
                            request=self.request,
                            response=self.response,
                            otp_in=SimpleNamespace(registration_id=REGISTRATION_ID, otp="123456"),
                            db=FakeAsyncSession([None]),
                        ),
                    )

        with patch.object(
            auth_routes.redis_cache,
            "claim_registration",
            AsyncMock(side_effect=RuntimeError("redis down")),
        ):
            await self.assert_http(
                503,
                VERIFY_OTP(
                    request=self.request,
                    response=self.response,
                    otp_in=SimpleNamespace(registration_id=REGISTRATION_ID, otp="123456"),
                    db=FakeAsyncSession([None]),
                ),
            )

    async def test_verify_otp_invalid_reports_remaining_attempts(self) -> None:
        with patch.object(
            auth_routes.redis_cache,
            "claim_registration",
            AsyncMock(return_value={"status": "INVALID", "attempts": redis_cache.MAX_OTP_ATTEMPTS - 2}),
        ):
            exc = await self.assert_http(
                401,
                VERIFY_OTP(
                    request=self.request,
                    response=self.response,
                    otp_in=SimpleNamespace(registration_id=REGISTRATION_ID, otp="123456"),
                    db=FakeAsyncSession([None]),
                ),
                "2 attempts remaining",
            )
        self.assertEqual(exc.status_code, 401)

    async def test_verify_otp_malformed_claim_payload_releases_claim(self) -> None:
        release = AsyncMock(return_value=True)
        with (
            patch.object(
                auth_routes.redis_cache,
                "claim_registration",
                AsyncMock(return_value={"status": "CLAIMED", "claim_token": "claim", "payload": "invalid"}),
            ),
            patch.object(auth_routes.redis_cache, "release_registration_claim", release),
        ):
            await self.assert_http(
                503,
                VERIFY_OTP(
                    request=self.request,
                    response=self.response,
                    otp_in=SimpleNamespace(registration_id=REGISTRATION_ID, otp="123456"),
                    db=FakeAsyncSession([None]),
                ),
                "session is invalid",
            )
        release.assert_awaited_once_with(REGISTRATION_ID, "claim")

    async def test_verify_otp_invalid_pending_role_releases_claim(self) -> None:
        release = AsyncMock(return_value=True)
        with (
            patch.object(
                auth_routes.redis_cache,
                "claim_registration",
                AsyncMock(
                    return_value={
                        "status": "CLAIMED",
                        "claim_token": "claim",
                        "payload": pending_registration(role="ADMIN"),
                    }
                ),
            ),
            patch.object(auth_routes.redis_cache, "release_registration_claim", release),
        ):
            await self.assert_http(
                503,
                VERIFY_OTP(
                    request=self.request,
                    response=self.response,
                    otp_in=SimpleNamespace(registration_id=REGISTRATION_ID, otp="123456"),
                    db=FakeAsyncSession([None]),
                ),
            )
        release.assert_awaited_once()

    async def test_verify_otp_integrity_retry_returns_existing_committed_user(self) -> None:
        existing = make_user(user_id="existing-user", email="ada@example.edu")
        existing.registration_id = REGISTRATION_ID
        db = FakeAsyncSession(
            [None, existing],
            commit_exception=IntegrityError("INSERT", {}, RuntimeError("duplicate")),
        )
        with (
            patch.object(
                auth_routes.redis_cache,
                "claim_registration",
                AsyncMock(
                    return_value={
                        "status": "CLAIMED",
                        "claim_token": "claim",
                        "payload": pending_registration(),
                    }
                ),
            ),
            patch.object(auth_routes, "create_audit_log", return_value=SimpleNamespace()),
            patch.object(auth_routes, "create_access_token", return_value="token"),
        ):
            value = await VERIFY_OTP(
                request=self.request,
                response=self.response,
                otp_in=SimpleNamespace(registration_id=REGISTRATION_ID, otp="123456"),
                db=db,
            )
        self.assertTrue(value.already_completed)
        self.assertEqual(value.user.id, "existing-user")
        self.assertEqual(db.rollbacks, 1)

    async def test_verify_otp_integrity_conflict_releases_claim_when_no_existing_user(self) -> None:
        release = AsyncMock(return_value=True)
        db = FakeAsyncSession(
            [None, None],
            commit_exception=IntegrityError("INSERT", {}, RuntimeError("duplicate")),
        )
        with (
            patch.object(
                auth_routes.redis_cache,
                "claim_registration",
                AsyncMock(
                    return_value={
                        "status": "CLAIMED",
                        "claim_token": "claim",
                        "payload": pending_registration(),
                    }
                ),
            ),
            patch.object(auth_routes.redis_cache, "release_registration_claim", release),
            patch.object(auth_routes, "create_audit_log", return_value=SimpleNamespace()),
        ):
            await self.assert_http(
                409,
                VERIFY_OTP(
                    request=self.request,
                    response=self.response,
                    otp_in=SimpleNamespace(registration_id=REGISTRATION_ID, otp="123456"),
                    db=db,
                ),
                "already exists",
            )
        release.assert_awaited_once_with(REGISTRATION_ID, "claim")

    async def test_verify_otp_database_failure_rolls_back_and_releases_claim(self) -> None:
        release = AsyncMock(return_value=True)
        db = FakeAsyncSession([None], commit_exception=RuntimeError("database down"))
        with (
            patch.object(
                auth_routes.redis_cache,
                "claim_registration",
                AsyncMock(
                    return_value={
                        "status": "CLAIMED",
                        "claim_token": "claim",
                        "payload": pending_registration(),
                    }
                ),
            ),
            patch.object(auth_routes.redis_cache, "release_registration_claim", release),
            patch.object(auth_routes, "create_audit_log", return_value=SimpleNamespace()),
        ):
            await self.assert_http(
                500,
                VERIFY_OTP(
                    request=self.request,
                    response=self.response,
                    otp_in=SimpleNamespace(registration_id=REGISTRATION_ID, otp="123456"),
                    db=db,
                ),
                "may retry",
            )
        self.assertEqual(db.rollbacks, 1)
        release.assert_awaited_once()

    async def test_login_rejects_unverified_account_and_simple_auth_endpoints_serialize(self) -> None:
        user = make_user(verified=False)
        with patch.object(auth_routes, "verify_password", return_value=True):
            await self.assert_http(
                403,
                LOGIN(
                    request=self.request,
                    response=self.response,
                    login_in=SimpleNamespace(email="student@example.com", password="Password123!"),
                    db=FakeAsyncSession([user]),
                ),
                "not verified",
            )

        verified = make_user()
        me = await auth_routes.get_me(verified)
        token = await auth_routes.verify_token(verified)
        logout = await auth_routes.logout_user()
        self.assertEqual(me.id, str(verified.id))
        self.assertTrue(token.valid)
        self.assertIn("Logged out", logout.message)

    async def test_password_reset_request_backend_failure_returns_503(self) -> None:
        with patch.object(
            auth_routes.redis_cache,
            "create_password_reset",
            AsyncMock(side_effect=RuntimeError("redis down")),
        ):
            await self.assert_http(
                503,
                REQUEST_RESET(
                    request=self.request,
                    response=self.response,
                    req=SimpleNamespace(email="ada@example.edu"),
                    db=FakeAsyncSession([None]),
                ),
                "temporarily unavailable",
            )

    async def test_password_reset_email_cleanup_failure_preserves_503(self) -> None:
        user = make_user(email="ada@example.edu")
        with (
            patch.object(auth_routes.redis_cache, "create_password_reset", AsyncMock(return_value={"reset_id": RESET_ID})),
            patch.object(auth_routes, "send_otp_email", AsyncMock(side_effect=EmailDeliveryError("smtp"))),
            patch.object(auth_routes.redis_cache, "delete_password_reset", AsyncMock(side_effect=RuntimeError("redis"))),
        ):
            await self.assert_http(
                503,
                REQUEST_RESET(
                    request=self.request,
                    response=self.response,
                    req=SimpleNamespace(email="ada@example.edu"),
                    db=FakeAsyncSession([user]),
                ),
                "could not be delivered",
            )

    async def test_password_reset_status_success_missing_and_backend_failure(self) -> None:
        with patch.object(auth_routes.redis_cache, "get_password_reset_status", AsyncMock(return_value=reset_status_payload())):
            value = await auth_routes.password_reset_status(RESET_ID)
        self.assertEqual(value.reset_id, RESET_ID)

        with patch.object(auth_routes.redis_cache, "get_password_reset_status", AsyncMock(return_value=None)):
            await self.assert_http(410, auth_routes.password_reset_status(RESET_ID), "expired")

        with patch.object(auth_routes.redis_cache, "get_password_reset_status", AsyncMock(side_effect=RuntimeError("redis"))):
            await self.assert_http(503, auth_routes.password_reset_status(RESET_ID))

    async def test_cancel_password_reset_maps_failures_conflicts_and_terminal_states(self) -> None:
        with patch.object(auth_routes.redis_cache, "cancel_password_reset", AsyncMock(side_effect=RuntimeError("redis"))):
            await self.assert_http(503, auth_routes.cancel_password_reset(RESET_ID))

        for state in ("IN_PROGRESS", "COMPLETED"):
            with patch.object(auth_routes.redis_cache, "cancel_password_reset", AsyncMock(return_value={"status": state})):
                await self.assert_http(409, auth_routes.cancel_password_reset(RESET_ID))

        for state, message in [
            ("CANCELLED", "Password-reset session cancelled."),
            ("MISSING", "Password-reset session was already absent."),
        ]:
            with patch.object(auth_routes.redis_cache, "cancel_password_reset", AsyncMock(return_value={"status": state})):
                value = await auth_routes.cancel_password_reset(RESET_ID)
            self.assertEqual(value.message, message)

    async def test_verify_reset_maps_service_and_state_failures(self) -> None:
        with patch.object(auth_routes.redis_cache, "verify_password_reset_otp", AsyncMock(side_effect=RuntimeError("redis"))):
            await self.assert_http(
                503,
                VERIFY_RESET(
                    request=self.request,
                    response=self.response,
                    req=SimpleNamespace(reset_id=RESET_ID, otp="123456"),
                ),
            )

        cases = [
            ({"status": "MISSING"}, 410),
            ({"status": "INVALID"}, 401),
            ({"status": "LOCKED"}, 423),
            ({"status": "COMPLETED"}, 409),
            ({"status": "IN_PROGRESS"}, 409),
            ({"status": "ISSUED", "payload": "invalid"}, 409),
            ({"status": "OTHER", "payload": {}}, 409),
        ]
        for result, code in cases:
            with self.subTest(result=result):
                with patch.object(auth_routes.redis_cache, "verify_password_reset_otp", AsyncMock(return_value=result)):
                    await self.assert_http(
                        code,
                        VERIFY_RESET(
                            request=self.request,
                            response=self.response,
                            req=SimpleNamespace(reset_id=RESET_ID, otp="123456"),
                        ),
                    )

    async def test_verify_reset_decoy_is_generic_401_and_valid_state_issues_token(self) -> None:
        with patch.object(
            auth_routes.redis_cache,
            "verify_password_reset_otp",
            AsyncMock(return_value={"status": "ISSUED", "payload": {"email": "ada@example.edu"}}),
        ):
            await self.assert_http(
                401,
                VERIFY_RESET(
                    request=self.request,
                    response=self.response,
                    req=SimpleNamespace(reset_id=RESET_ID, otp="123456"),
                ),
            )

        with (
            patch.object(
                auth_routes.redis_cache,
                "verify_password_reset_otp",
                AsyncMock(
                    return_value={
                        "status": "ISSUED",
                        "payload": {
                            "user_id": "user-1",
                            "email": "ada@example.edu",
                            "token_jti": "reset-jti",
                        },
                    }
                ),
            ),
            patch.object(auth_routes, "create_reset_token", return_value=("reset-token", "reset-jti")),
        ):
            value = await VERIFY_RESET(
                request=self.request,
                response=self.response,
                req=SimpleNamespace(reset_id=RESET_ID, otp="123456"),
            )
        self.assertEqual(value.reset_token, "reset-token")

    async def test_confirm_reset_rejects_bad_token_claim_service_and_claim_states(self) -> None:
        with patch.object(auth_routes, "decode_reset_token", side_effect=JWTError("bad token")):
            await self.assert_http(
                401,
                CONFIRM_RESET(
                    request=self.request,
                    response=self.response,
                    req=SimpleNamespace(reset_token="x" * 80, new_password="NewPassword123!"),
                    db=FakeAsyncSession(),
                ),
            )

        payload = {"reset_id": RESET_ID, "jti": "jti", "user_id": "user-1", "sub": "ada@example.edu"}
        with (
            patch.object(auth_routes, "decode_reset_token", return_value=payload),
            patch.object(auth_routes.redis_cache, "claim_password_reset", AsyncMock(side_effect=RuntimeError("redis"))),
        ):
            await self.assert_http(
                503,
                CONFIRM_RESET(
                    request=self.request,
                    response=self.response,
                    req=SimpleNamespace(reset_token="x" * 80, new_password="NewPassword123!"),
                    db=FakeAsyncSession(),
                ),
            )

        for claim, code in [
            ({"status": "MISSING"}, 401),
            ({"status": "INVALID"}, 401),
            ({"status": "COMPLETED"}, 401),
            ({"status": "IN_PROGRESS"}, 409),
            ({"status": "OTHER", "payload": {}}, 401),
            ({"status": "CLAIMED", "payload": "bad"}, 401),
        ]:
            with self.subTest(claim=claim):
                with (
                    patch.object(auth_routes, "decode_reset_token", return_value=payload),
                    patch.object(auth_routes.redis_cache, "claim_password_reset", AsyncMock(return_value=claim)),
                ):
                    await self.assert_http(
                        code,
                        CONFIRM_RESET(
                            request=self.request,
                            response=self.response,
                            req=SimpleNamespace(reset_token="x" * 80, new_password="NewPassword123!"),
                            db=FakeAsyncSession(),
                        ),
                    )

    async def test_confirm_reset_mismatched_state_releases_claim(self) -> None:
        release = AsyncMock(return_value=True)
        payload = {"reset_id": RESET_ID, "jti": "jti", "user_id": "user-1", "sub": "ada@example.edu"}
        claim = {
            "status": "CLAIMED",
            "claim_token": "claim",
            "payload": {"user_id": "other-user", "email": "other@example.edu"},
        }
        with (
            patch.object(auth_routes, "decode_reset_token", return_value=payload),
            patch.object(auth_routes.redis_cache, "claim_password_reset", AsyncMock(return_value=claim)),
            patch.object(auth_routes.redis_cache, "release_password_reset_claim", release),
        ):
            await self.assert_http(
                401,
                CONFIRM_RESET(
                    request=self.request,
                    response=self.response,
                    req=SimpleNamespace(reset_token="x" * 80, new_password="NewPassword123!"),
                    db=FakeAsyncSession(),
                ),
            )
        release.assert_awaited_once_with(RESET_ID, "claim")

    async def test_confirm_reset_absent_or_unverified_user_releases_claim(self) -> None:
        payload = {"reset_id": RESET_ID, "jti": "jti", "user_id": "user-1", "sub": "ada@example.edu"}
        claim = {
            "status": "CLAIMED",
            "claim_token": "claim",
            "payload": {"user_id": "user-1", "email": "ada@example.edu"},
        }
        for user in (None, make_user(user_id="user-1", email="ada@example.edu", verified=False)):
            release = AsyncMock(return_value=True)
            with self.subTest(user=user):
                with (
                    patch.object(auth_routes, "decode_reset_token", return_value=payload),
                    patch.object(auth_routes.redis_cache, "claim_password_reset", AsyncMock(return_value=claim)),
                    patch.object(auth_routes.redis_cache, "release_password_reset_claim", release),
                ):
                    await self.assert_http(
                        401,
                        CONFIRM_RESET(
                            request=self.request,
                            response=self.response,
                            req=SimpleNamespace(reset_token="x" * 80, new_password="NewPassword123!"),
                            db=FakeAsyncSession([user]),
                        ),
                    )
                release.assert_awaited_once()

    async def test_confirm_reset_idempotent_previous_commit_finalizes_cache(self) -> None:
        user = make_user(user_id="user-1", email="ada@example.edu")
        user.last_password_reset_id = RESET_ID
        complete = AsyncMock(return_value=False)
        payload = {"reset_id": RESET_ID, "jti": "jti", "user_id": "user-1", "sub": "ada@example.edu"}
        claim = {
            "status": "CLAIMED",
            "claim_token": "claim",
            "payload": {"user_id": "user-1", "email": "ada@example.edu"},
        }
        with (
            patch.object(auth_routes, "decode_reset_token", return_value=payload),
            patch.object(auth_routes.redis_cache, "claim_password_reset", AsyncMock(return_value=claim)),
            patch.object(auth_routes.redis_cache, "complete_password_reset", complete),
        ):
            value = await CONFIRM_RESET(
                request=self.request,
                response=self.response,
                req=SimpleNamespace(reset_token="x" * 80, new_password="NewPassword123!"),
                db=FakeAsyncSession([user]),
            )
        self.assertIn("already updated", value.message)
        complete.assert_awaited_once()

    async def test_confirm_reset_rejects_unchanged_password_and_releases_claim(self) -> None:
        user = make_user(user_id="user-1", email="ada@example.edu")
        release = AsyncMock(return_value=True)
        payload = {"reset_id": RESET_ID, "jti": "jti", "user_id": "user-1", "sub": "ada@example.edu"}
        claim = {
            "status": "CLAIMED",
            "claim_token": "claim",
            "payload": {"user_id": "user-1", "email": "ada@example.edu"},
        }
        with (
            patch.object(auth_routes, "decode_reset_token", return_value=payload),
            patch.object(auth_routes.redis_cache, "claim_password_reset", AsyncMock(return_value=claim)),
            patch.object(auth_routes.redis_cache, "release_password_reset_claim", release),
            patch.object(auth_routes, "verify_password", return_value=True),
        ):
            await self.assert_http(
                400,
                CONFIRM_RESET(
                    request=self.request,
                    response=self.response,
                    req=SimpleNamespace(reset_token="x" * 80, new_password="NewPassword123!"),
                    db=FakeAsyncSession([user]),
                ),
                "different",
            )
        release.assert_awaited_once()

    async def test_confirm_reset_database_failure_rolls_back_and_restores_claim(self) -> None:
        user = make_user(user_id="user-1", email="ada@example.edu")
        release = AsyncMock(return_value=True)
        payload = {"reset_id": RESET_ID, "jti": "jti", "user_id": "user-1", "sub": "ada@example.edu"}
        claim = {
            "status": "CLAIMED",
            "claim_token": "claim",
            "payload": {"user_id": "user-1", "email": "ada@example.edu"},
        }
        db = FakeAsyncSession([user], commit_exception=RuntimeError("database down"))
        with (
            patch.object(auth_routes, "decode_reset_token", return_value=payload),
            patch.object(auth_routes.redis_cache, "claim_password_reset", AsyncMock(return_value=claim)),
            patch.object(auth_routes.redis_cache, "release_password_reset_claim", release),
            patch.object(auth_routes, "verify_password", return_value=False),
            patch.object(auth_routes, "get_password_hash", return_value="new-hash"),
            patch.object(auth_routes, "create_audit_log", return_value=SimpleNamespace()),
        ):
            await self.assert_http(
                500,
                CONFIRM_RESET(
                    request=self.request,
                    response=self.response,
                    req=SimpleNamespace(reset_token="x" * 80, new_password="NewPassword123!"),
                    db=db,
                ),
                "may retry",
            )
        self.assertEqual(db.rollbacks, 1)
        release.assert_awaited_once()

    async def test_confirm_reset_post_commit_cache_failure_remains_successful(self) -> None:
        user = make_user(user_id="user-1", email="ada@example.edu")
        payload = {"reset_id": RESET_ID, "jti": "jti", "user_id": "user-1", "sub": "ada@example.edu"}
        claim = {
            "status": "CLAIMED",
            "claim_token": "claim",
            "payload": {"user_id": "user-1", "email": "ada@example.edu"},
        }
        with (
            patch.object(auth_routes, "decode_reset_token", return_value=payload),
            patch.object(auth_routes.redis_cache, "claim_password_reset", AsyncMock(return_value=claim)),
            patch.object(auth_routes.redis_cache, "complete_password_reset", AsyncMock(side_effect=RuntimeError("redis"))),
            patch.object(auth_routes, "verify_password", return_value=False),
            patch.object(auth_routes, "get_password_hash", return_value="new-hash"),
            patch.object(auth_routes, "create_audit_log", return_value=SimpleNamespace()),
        ):
            value = await CONFIRM_RESET(
                request=self.request,
                response=self.response,
                req=SimpleNamespace(reset_token="x" * 80, new_password="NewPassword123!"),
                db=FakeAsyncSession([user]),
            )
        self.assertIn("Password updated successfully", value.message)
        self.assertEqual(user.token_version, 1)
        self.assertEqual(user.last_password_reset_id, RESET_ID)


if __name__ == "__main__":
    unittest.main(verbosity=2)
