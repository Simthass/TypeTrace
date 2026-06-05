# backend/app/core/jwt.py

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from jose import JWTError, jwt

from app.core.config import settings


SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a signed JWT access token.

    Expected data:
    - sub: user email
    - id: user id
    - role: STUDENT or TEACHER
    """

    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_reset_token(email: str) -> str:
    """
    Create a short-lived password reset token.
    """

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.RESET_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": email,
        "exp": expire,
        "type": "password_reset",
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_reset_token(token: str, email: str) -> bool:
    """
    Verify password reset token validity.
    """

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        return (
            payload.get("type") == "password_reset"
            and payload.get("sub") == email
        )

    except JWTError:
        return False


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode a JWT access token.

    Raises JWTError if invalid or expired.
    """

    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])