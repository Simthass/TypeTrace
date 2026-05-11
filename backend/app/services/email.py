# backend/app/services/email.py
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
import os
from dotenv import load_dotenv

load_dotenv()

# configuring smtp for testmail.app
# professor will like that we use env variables for security
conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME", "your_testmail_namespace"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD", "your_testmail_token"),
    MAIL_FROM=os.getenv("MAIL_FROM", "verify@typetrace.com"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", 465)),
    MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.testmail.app"),
    MAIL_STARTTLS=False,
    MAIL_SSL_TLS=True,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

async def send_otp_email(email: EmailStr, otp: str):
    """
    Sends the 6-digit OTP asynchronously via SMTP.
    """
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-w-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #EAEAEA; border-radius: 8px;">
        <h2 style="color: #111827;">TypeTrace Verification</h2>
        <p style="color: #4B5563; font-size: 16px;">Your academic integrity verification code is:</p>
        <div style="background-color: #F9FAFB; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #2A7FE0;">{otp}</span>
        </div>
        <p style="color: #9CA3AF; font-size: 12px;">This code expires in 10 minutes. If you did not request this, please ignore this email.</p>
    </div>
    """

    message = MessageSchema(
        subject="Your TypeTrace Verification Code",
        recipients=[email],
        body=html_content,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    try:
        await fm.send_message(message)
        print(f"[EMAIL SERVICE] Successfully sent OTP to {email}")
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send email: {str(e)}")