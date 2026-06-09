# backend/app/main.py

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings


logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)

logger = logging.getLogger("typetrace")


def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled server error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error.",
                "path": str(request.url.path),
            },
        )

    from app.api.routes.auth import router as auth_router
    from app.api.routes.certificates import router as certificates_router
    from app.api.routes.courses import router as courses_router
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