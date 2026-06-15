# backend/app/middleware/security_headers.py

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adds browser security headers to every response.

    This is useful even for a final-year prototype because TypeTrace handles
    private writing evidence, certificate data, and authenticated user sessions.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        if not settings.SECURITY_HEADERS_ENABLED:
            return response

        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        response.headers.setdefault("Cross-Origin-Resource-Policy", "same-origin")

        if settings.is_production and settings.ENABLE_HSTS:
            response.headers.setdefault(
                "Strict-Transport-Security",
                settings.hsts_header_value,
            )

        return response