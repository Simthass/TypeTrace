from __future__ import annotations

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
    to_encode = data.copy()
    issued_at = _now()
    expire = issued_at + (
        expires_delta
        or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
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


def create_reset_token(
    email: str,
    *,
    user_id: str,
    reset_id: str,
    jti: Optional[str] = None,
) -> tuple[str, str]:
    issued_at = _now()
    token_jti = jti or str(uuid4())
    payload = {
        "sub": email,
        "user_id": user_id,
        "reset_id": reset_id,
        "exp": issued_at
        + timedelta(minutes=settings.RESET_TOKEN_EXPIRE_MINUTES),
        "iat": issued_at,
        "jti": token_jti,
        "iss": settings.JWT_ISSUER,
        "type": "password_reset",
    }
    return (
        jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM),
        token_jti,
    )


def decode_reset_token(token: str) -> Dict[str, Any]:
    payload = jwt.decode(
        token,
        SECRET_KEY,
        algorithms=[ALGORITHM],
        issuer=settings.JWT_ISSUER,
    )
    if payload.get("type") != "password_reset":
        raise JWTError("Invalid token type.")
    required = ("sub", "user_id", "jti", "reset_id")
    if any(not payload.get(field) for field in required):
        raise JWTError("Incomplete reset token.")
    return payload


def decode_access_token(token: str) -> Dict[str, Any]:
    payload = jwt.decode(
        token,
        SECRET_KEY,
        algorithms=[ALGORITHM],
        issuer=settings.JWT_ISSUER,
    )
    if payload.get("type") != "access":
        raise JWTError("Invalid token type.")
    return payload
