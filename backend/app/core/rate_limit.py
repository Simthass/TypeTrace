"""Central SlowAPI limiter configuration for TypeTrace."""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings


def per_minute(limit: int) -> str:
    """Return a validated SlowAPI per-minute limit string."""

    if limit <= 0:
        raise ValueError("Rate limits must be positive integers.")
    return f"{limit}/minute"


limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[],
    headers_enabled=True,
    storage_uri=settings.RATE_LIMIT_STORAGE_URI or None,
)
