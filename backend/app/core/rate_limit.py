"""Central SlowAPI limiter configuration for TypeTrace."""

from __future__ import annotations

import hashlib

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings


def per_minute(limit: int) -> str:
    """Return a validated SlowAPI per-minute limit string."""

    if limit <= 0:
        raise ValueError("Rate limits must be positive integers.")
    return f"{limit}/minute"


def reauth_rate_limit_key(request: Request) -> str:
    """Rate-limit password re-authentication by client address and token.

    The Authorization value is never used directly as a storage key. A short
    SHA-256 digest separates authenticated sessions sharing one public IP while
    retaining an address component that also constrains token rotation attacks.
    """

    address = get_remote_address(request) or "unknown"
    authorization = request.headers.get("authorization", "").strip()
    if not authorization:
        return f"reauth:{address}:anonymous"
    token_digest = hashlib.sha256(authorization.encode("utf-8")).hexdigest()[:24]
    return f"reauth:{address}:{token_digest}"


limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[],
    headers_enabled=True,
    storage_uri=settings.RATE_LIMIT_STORAGE_URI or None,
)
