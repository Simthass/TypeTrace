# backend/app/core/security.py

import re
import secrets
import string

import bcrypt


PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128

OTP_LENGTH = 6
OTP_PATTERN = re.compile(r"^\d{6}$")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain-text password against a stored bcrypt hash.
    """

    if not plain_password or not hashed_password:
        return False

    password_bytes = plain_password.encode("utf-8")
    hashed_bytes = hashed_password.encode("utf-8")

    try:
        return bcrypt.checkpw(
            password=password_bytes,
            hashed_password=hashed_bytes,
        )
    except ValueError:
        return False


def validate_password_strength(password: str) -> None:
    """
    Backend password policy.

    Keep this realistic for academic prototype use:
    - minimum 8 characters
    - maximum 128 characters
    - at least one letter
    - at least one number
    """

    if len(password) < PASSWORD_MIN_LENGTH:
        raise ValueError("Password must be at least 8 characters long.")

    if len(password) > PASSWORD_MAX_LENGTH:
        raise ValueError("Password must not exceed 128 characters.")

    if not any(char.isalpha() for char in password):
        raise ValueError("Password must contain at least one letter.")

    if not any(char.isdigit() for char in password):
        raise ValueError("Password must contain at least one number.")


def get_password_hash(password: str) -> str:
    """
    Hashes a plain-text password with bcrypt.
    """

    validate_password_strength(password)

    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    hashed_bytes = bcrypt.hashpw(password=password_bytes, salt=salt)

    return hashed_bytes.decode("utf-8")


def generate_otp() -> str:
    """
    Generates a cryptographically secure 6-digit OTP.
    """

    return "".join(secrets.choice(string.digits) for _ in range(OTP_LENGTH))


def is_valid_otp_format(value: str) -> bool:
    return bool(OTP_PATTERN.fullmatch(value.strip()))


def secure_compare(value_a: str, value_b: str) -> bool:
    """
    Constant-time string comparison for OTP/reset-token comparisons.
    """

    return secrets.compare_digest(str(value_a), str(value_b))


def redact_email(email: str) -> str:
    """
    Privacy-safe email display for logs/messages.
    """

    clean = email.strip().lower()

    if "@" not in clean:
        return "***"

    local, domain = clean.split("@", 1)

    if len(local) <= 2:
        masked = f"{local[:1]}***"
    else:
        masked = f"{local[:2]}***"

    return f"{masked}@{domain}"