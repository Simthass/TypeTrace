from __future__ import annotations

import logging
from pathlib import Path
from typing import Literal, Optional

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
from fastapi_mail.schemas import MultipartSubtypeEnum
from pydantic import EmailStr

from app.core.config import settings

logger = logging.getLogger("typetrace.email")
EmailPurpose = Literal["verification", "password reset"]

# Inline logo, embedded via Content-ID so it renders offline in every mail
# client without depending on an externally hosted image (which mail
# clients frequently block by default) and without relying on base64 data
# URIs in the <img> tag (which most mail clients strip for security reasons
# - unlike browsers, where that approach is fine).
_LOGO_PATH = Path(__file__).resolve().parents[1] / "assets" / "Logo.png"
_LOGO_CID = "typetrace_logo"


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


def _logo_attachment() -> Optional[dict]:
    if not _LOGO_PATH.is_file():
        logger.warning("Email logo asset missing at %s; sending without it", _LOGO_PATH)
        return None
    return {
        "file": str(_LOGO_PATH),
        "mime_type": "image",
        "mime_subtype": "png",
        "headers": {
            "Content-ID": f"<{_LOGO_CID}>",
            "Content-Disposition": 'inline; filename="typetrace-logo.png"',
        },
    }


def _message(
    email: EmailStr,
    otp: str,
    purpose: EmailPurpose,
    first_name: Optional[str],
) -> MessageSchema:
    subject = (
        "Verify your email - TypeTrace"
        if purpose == "verification"
        else "Reset your password - TypeTrace"
    )
    greeting = f"Hi {first_name}" if first_name else "Hi there"

    html_content = f"""\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F5F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F5F7;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#FFFFFF;border-radius:8px;border:1px solid #E5E7EB;">

          <!-- Header: left-aligned wordmark, no colour band -->
          <tr>
            <td style="padding:36px 40px 28px 40px;text-align:left;">
              <img src="cid:{_LOGO_CID}" alt="TypeTrace" height="28" style="display:inline-block;height:28px;width:auto;border:0;outline:none;text-decoration:none;vertical-align:middle;">
            </td>
          </tr>

          <!-- Greeting + intro -->
          <tr>
            <td style="padding:0 40px;">
              <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#1F2937;">
                {greeting}, {"welcome to TypeTrace!" if purpose == "verification" else "we received a request to reset your password."}
              </p>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#1F2937;">
                {"Use the code below to verify your email address and activate your account." if purpose == "verification" else "Use the code below to reset it. If you didn't request this, you can safely ignore this email - your password won't change."}
              </p>
            </td>
          </tr>

          <!-- OTP code -->
          <tr>
            <td style="padding:0 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#111827;border-radius:6px;padding:14px 32px;">
                    <span style="font-family:'Courier New',Courier,monospace;font-size:28px;font-weight:700;letter-spacing:8px;color:#FFFFFF;">{otp}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body copy -->
          <tr>
            <td style="padding:28px 40px 0 40px;">
              <p style="margin:0;font-size:15px;line-height:1.6;color:#1F2937;">
                TypeTrace captures the writing process behind a document - timing, pauses and revisions - so
                academic reviewers have more than just the finished text to go on.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:32px 40px 0 40px;">
              <div style="border-top:1px solid #E5E7EB;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 36px 40px;">
              <p style="margin:0 0 4px 0;font-size:13px;line-height:1.6;color:#6B7280;">
                This code expires in 10 minutes and should not be shared with anyone.
              </p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#6B7280;">
                Didn't request this? You can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    attachments = []
    logo = _logo_attachment()
    if logo:
        attachments.append(logo)

    return MessageSchema(
        subject=subject,
        recipients=[email],
        body=html_content,
        subtype=MessageType.html,
        attachments=attachments,
        # Critical for inline CID images: the default "mixed" subtype puts the
        # HTML body and the logo as flat sibling parts, which is exactly the
        # structure most mail clients (Gmail included) render as "message
        # with an attachment" rather than an inline image. "related" nests
        # them correctly so the logo displays inline instead.
        multipart_subtype=MultipartSubtypeEnum.related,
    )


async def send_otp_email(
    email: EmailStr,
    otp: str,
    *,
    purpose: EmailPurpose = "verification",
    first_name: Optional[str] = None,
) -> None:
    """Send an OTP or raise; callers must never report success after failure."""

    try:
        await FastMail(_connection_config()).send_message(
            _message(email, otp, purpose, first_name)
        )
    except Exception as exc:
        # Do not log the recipient address or the OTP. The exception trace is enough
        # for operational diagnosis and avoids leaking authentication secrets.
        logger.exception("Authentication email delivery failed")
        raise EmailDeliveryError(
            "The authentication email could not be delivered."
        ) from exc