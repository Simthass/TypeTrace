# backend/app/core/jwt.py

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from uuid import uuid4

from jose import JWTError, jwt

from app.core.config import settings


SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a signed JWT access token.

    Required payload fields:
    - sub: user email
    - id: user id
    - role: STUDENT or TEACHER
    """

    to_encode = data.copy()

    issued_at = _now()
    expire = issued_at + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    to_encode.update(
        {
            "exp": expire,
            "iat": issued_at,
            "jti": str(uuid4()),
            "iss": settings.JWT_ISSUER,
            "type": "access",
        }
    )

    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_reset_token(email: str) -> str:
    """
    Create a short-lived password reset token.
    """

    issued_at = _now()
    expire = issued_at + timedelta(
        minutes=settings.RESET_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": email,
        "exp": expire,
        "iat": issued_at,
        "jti": str(uuid4()),
        "iss": settings.JWT_ISSUER,
        "type": "password_reset",
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_reset_token(token: str, email: str) -> bool:
    """
    Verify password reset token validity.
    """

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            issuer=settings.JWT_ISSUER,
        )

        return (
            payload.get("type") == "password_reset"
            and payload.get("sub") == email
        )

    except JWTError:
        return False


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode a JWT access token.

    Raises JWTError if invalid, expired, wrong issuer, or wrong token type.
    """

    payload = jwt.decode(
        token,
        SECRET_KEY,
        algorithms=[ALGORITHM],
        issuer=settings.JWT_ISSUER,
    )

    if payload.get("type") != "access":
        raise JWTError("Invalid token type.")

    return payload