# backend/app/core/config.py

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = BASE_DIR.parent


class Settings(BaseSettings):
    """
    Central application configuration for TypeTrace.

    All environment-based settings are loaded here instead of being scattered
    across main.py, database.py, jwt.py, and ml_service.py.
    """

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "TypeTrace API"
    APP_VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = Field(default="development")

    SECRET_KEY: str = Field(default="")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    RESET_TOKEN_EXPIRE_MINUTES: int = 15

    DATABASE_URL: str = (
        "postgresql+asyncpg://typetrace_admin:secure_password_123"
        "@localhost:5432/typetracedb"
    )

    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    FRONTEND_URL: str = "http://localhost:5173"
    ALLOWED_ORIGINS: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "https://typetrace.app,"
        "https://www.typetrace.app"
    )

    LOG_LEVEL: str = "INFO"

    @property
    def cors_origins(self) -> List[str]:
        return [
            origin.strip()
            for origin in self.ALLOWED_ORIGINS.split(",")
            if origin.strip()
        ]

    @property
    def sync_database_url(self) -> str:
        """
        Converts async SQLAlchemy URL into sync SQLAlchemy URL.

        This is only for legacy code that still uses sync SQLAlchemy.
        In Part 3, we will remove the legacy sync path properly.
        """
        return self.DATABASE_URL.replace("+asyncpg", "")

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    def validate_required_settings(self) -> None:
        """
        Fail fast when critical production settings are missing.
        """
        if not self.SECRET_KEY:
            if self.is_production:
                raise RuntimeError("SECRET_KEY must be set in production.")
            self.SECRET_KEY = "dev-only-change-this-secret-key"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_required_settings()
    return settings


settings = get_settings()