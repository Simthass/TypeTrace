
import bcrypt
import secrets
import string


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain-text password against a stored bcrypt hash.

    Both arguments are strings; we encode to bytes before calling bcrypt
    because the library operates on bytes, not str.

    Used by:
      - app/api/routes/auth.py  → login endpoint
      - app/ml/ml_service.py   → change_password endpoint  (✅ unified here)
    """
    password_bytes = plain_password.encode("utf-8")
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(password=password_bytes, hashed_password=hashed_bytes)


def get_password_hash(password: str) -> str:
    """
    Hashes a plain-text password with bcrypt + a freshly generated salt.
    Returns a UTF-8 string suitable for storing in PostgreSQL VARCHAR.

    Used by:
      - app/api/routes/auth.py  → register + password reset endpoints
      - app/ml/ml_service.py   → change_password endpoint  (✅ unified here)
    """
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed_bytes = bcrypt.hashpw(password=pwd_bytes, salt=salt)
    return hashed_bytes.decode("utf-8")


def generate_otp() -> str:
    """
    Generates a cryptographically secure 6-digit OTP string.

    Uses the `secrets` module (not `random`) because `random` is seeded
    from system time and is predictable. `secrets` uses the OS CSPRNG.
    """
    digits = string.digits
    return "".join(secrets.choice(digits) for _ in range(6))