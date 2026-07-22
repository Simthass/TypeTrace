import logging
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.api.routes.notifications import router as notifications_router

from app.core.config import settings
from app.core.rate_limit import limiter

from app.middleware.security_headers import SecurityHeadersMiddleware


logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)

logger = logging.getLogger("typetrace")


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _error_payload(
    *,
    code: str,
    message: str,
    path: str,
    status_code: int,
    details: Any = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "success": False,
        "error": {
            "code": code,
            "message": message,
            "status_code": status_code,
            "path": path,
            "timestamp": _utc_now(),
        },
        "detail": message,
    }

    if details is not None:
        payload["error"]["details"] = details

    return payload


def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        docs_url="/docs" if settings.api_docs_enabled else None,
        redoc_url="/redoc" if settings.api_docs_enabled else None,
        openapi_url="/openapi.json" if settings.api_docs_enabled else None,
    )
    
    app.state.limiter = limiter

    app.add_middleware(SecurityHeadersMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        message = str(exc.detail or "Request failed.")

        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload(
                code=f"HTTP_{exc.status_code}",
                message=message,
                path=str(request.url.path),
                status_code=exc.status_code,
            ),
        )

    @app.exception_handler(HTTPException)
    async def fastapi_http_exception_handler(request: Request, exc: HTTPException):
        message = str(exc.detail or "Request failed.")

        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload(
                code=f"HTTP_{exc.status_code}",
                message=message,
                path=str(request.url.path),
                status_code=exc.status_code,
            ),
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request,
        exc: RequestValidationError,
    ):
        return JSONResponse(
            status_code=422,
            content=_error_payload(
                code="VALIDATION_ERROR",
                message="Some submitted fields are invalid.",
                path=str(request.url.path),
                status_code=422,
                details=exc.errors(),
            ),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled server error: %s", exc)

        return JSONResponse(
            status_code=500,
            content=_error_payload(
                code="INTERNAL_SERVER_ERROR",
                message="The server had a problem processing this request.",
                path=str(request.url.path),
                status_code=500,
            ),
        )

    from app.api.routes.auth import router as auth_router
    from app.api.routes.certificates import router as certificates_router
    from app.api.routes.courses import router as courses_router
    from app.api.routes.drafts import router as drafts_router
    from app.api.routes.health import router as health_router
    from app.api.routes.model import router as model_router
    from app.api.routes.replay import router as replay_router
    from app.api.routes.sessions import router as sessions_router
    from app.api.routes.student import router as student_router
    from app.api.routes.teacher import router as teacher_router
    from app.api.routes.user import router as user_router

    app.include_router(
        health_router,
        prefix=settings.API_V1_PREFIX,
        tags=["Health"],
    )

    app.include_router(
        auth_router,
        prefix=f"{settings.API_V1_PREFIX}/auth",
        tags=["Authentication"],
    )
    
    app.include_router(
        notifications_router,
        prefix=f"{settings.API_V1_PREFIX}/notifications",
        tags=["Notifications"],
    )

    app.include_router(
        model_router,
        prefix=settings.API_V1_PREFIX,
        tags=["ML Model"],
    )

    app.include_router(
        sessions_router,
        prefix=f"{settings.API_V1_PREFIX}/sessions",
        tags=["Writing Sessions"],
    )

    app.include_router(
        replay_router,
        prefix=settings.API_V1_PREFIX,
        tags=["Replay Audit"],
    )

    app.include_router(
        drafts_router,
        prefix=settings.API_V1_PREFIX,
        tags=["Draft Sessions"],
    )

    app.include_router(
        student_router,
        prefix=settings.API_V1_PREFIX,
        tags=["Student"],
    )

    app.include_router(
        teacher_router,
        prefix=settings.API_V1_PREFIX,
        tags=["Teacher"],
    )

    app.include_router(
        courses_router,
        prefix=settings.API_V1_PREFIX,
        tags=["Courses"],
    )

    app.include_router(
        user_router,
        prefix=settings.API_V1_PREFIX,
        tags=["User Account"],
    )

    app.include_router(
        certificates_router,
        prefix=settings.API_V1_PREFIX,
        tags=["Certificates"],
    )

    logger.info("TypeTrace API started successfully.")
    return app


app = create_application()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
