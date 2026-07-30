from __future__ import annotations

import logging
from html import escape
from typing import Literal, Optional

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
from pydantic import EmailStr

from app.core.config import settings

logger = logging.getLogger("typetrace.email")
EmailPurpose = Literal["verification", "password reset"]


class EmailDeliveryError(RuntimeError):
    """Raised when an authentication email could not be delivered."""


def _connection_config() -> ConnectionConfig:
    return ConnectionConfig(
        MAIL_USERNAME=settings.MAIL_USERNAME,
        MAIL_PASSWORD=settings.MAIL_PASSWORD,
        MAIL_FROM=settings.MAIL_FROM,
        MAIL_PORT=settings.MAIL_PORT,
        MAIL_SERVER=settings.MAIL_SERVER,
        MAIL_STARTTLS=settings.MAIL_STARTTLS,
        MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
        USE_CREDENTIALS=settings.MAIL_USE_CREDENTIALS,
        VALIDATE_CERTS=settings.MAIL_VALIDATE_CERTS,
    )


def _message(
    email: EmailStr,
    otp: str,
    purpose: EmailPurpose,
    action_url: Optional[str],
) -> MessageSchema:
    subject = (
        "Your TypeTrace verification code"
        if purpose == "verification"
        else "Your TypeTrace password reset code"
    )
    action_markup = ""
    if action_url:
        safe_url = escape(action_url, quote=True)
        action_markup = f"""
        <p style="text-align:center;margin:20px 0">
          <a href="{safe_url}" style="display:inline-block;background:#2A7FE0;color:#FFFFFF;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:700">Open secure verification page</a>
        </p>
        <p style="color:#6B7280;font-size:12px;word-break:break-all">If the button does not work, open: {safe_url}</p>
        """

    html_content = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #EAEAEA;border-radius:8px">
      <h2 style="color:#111827">TypeTrace</h2>
      <p style="color:#4B5563;font-size:16px">Your {purpose} code is:</p>
      <div style="background:#F9FAFB;padding:16px;border-radius:6px;text-align:center;margin:24px 0">
        <span style="font-size:32px;font-weight:700;letter-spacing:4px;color:#2A7FE0">{otp}</span>
      </div>
      {action_markup}
      <p style="color:#9CA3AF;font-size:12px">This code expires in 10 minutes. If you did not request it, ignore this email.</p>
    </div>
    """
    return MessageSchema(
        subject=subject,
        recipients=[email],
        body=html_content,
        subtype=MessageType.html,
    )


async def send_otp_email(
    email: EmailStr,
    otp: str,
    *,
    purpose: EmailPurpose = "verification",
    action_url: Optional[str] = None,
) -> None:
    """Send an OTP or raise; callers must never report success after failure."""

    try:
        await FastMail(_connection_config()).send_message(
            _message(email, otp, purpose, action_url)
        )
    except Exception as exc:
        # Do not log the recipient address or the OTP. The exception trace is enough
        # for operational diagnosis and avoids leaking authentication secrets.
        logger.exception("Authentication email delivery failed")
        raise EmailDeliveryError(
            "The authentication email could not be delivered."
        ) from exc
