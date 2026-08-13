from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.services import email as email_service


class EmailServiceTests(unittest.IsolatedAsyncioTestCase):
    def test_message_uses_correct_subject_and_escapes_action_url(self) -> None:
        message = email_service._message(
            "student@example.com",
            "123456",
            "verification",
            'https://example.com/verify?a=1&b="unsafe"',
        )
        self.assertEqual(message.subject, "Your TypeTrace verification code")
        self.assertIn("123456", str(message.body))
        self.assertIn("&amp;", str(message.body))
        self.assertIn("&quot;", str(message.body))

        reset = email_service._message(
            "student@example.com",
            "654321",
            "password reset",
            None,
        )
        self.assertEqual(reset.subject, "Your TypeTrace password reset code")
        self.assertNotIn("Open secure verification page", str(reset.body))

    async def test_send_otp_email_propagates_a_controlled_delivery_error(self) -> None:
        sender = SimpleNamespace(send_message=AsyncMock(side_effect=RuntimeError("smtp down")))
        with (
            patch.object(email_service, "_connection_config", return_value=object()),
            patch.object(email_service, "FastMail", return_value=sender),
        ):
            with self.assertRaises(email_service.EmailDeliveryError):
                await email_service.send_otp_email(
                    "student@example.com",
                    "123456",
                )

    async def test_send_otp_email_awaits_provider_success(self) -> None:
        sender = SimpleNamespace(send_message=AsyncMock(return_value=None))
        with (
            patch.object(email_service, "_connection_config", return_value=object()),
            patch.object(email_service, "FastMail", return_value=sender),
        ):
            await email_service.send_otp_email(
                "student@example.com",
                "123456",
                purpose="password reset",
            )
        sender.send_message.assert_awaited_once()


if __name__ == "__main__":
    unittest.main(verbosity=2)
