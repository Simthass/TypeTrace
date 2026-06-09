# backend/app/core/security.py

import secrets
import string

import bcrypt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain-text password against a stored bcrypt hash.
    """

    password_bytes = plain_password.encode("utf-8")
    hashed_bytes = hashed_password.encode("utf-8")

    return bcrypt.checkpw(
        password=password_bytes,
        hashed_password=hashed_bytes,
    )


def get_password_hash(password: str) -> str:
    """
    Hashes a plain-text password with bcrypt.
    """

    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed_bytes = bcrypt.hashpw(password=password_bytes, salt=salt)

    return hashed_bytes.decode("utf-8")


def generate_otp() -> str:
    """
    Generates a cryptographically secure 6-digit OTP.
    """

    return "".join(secrets.choice(string.digits) for _ in range(6))