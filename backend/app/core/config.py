# backend/app/core/config.py

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    """
    Central environment-based configuration for TypeTrace.
    """

    model_config = SettingsConfigDict(
        env_file=(
            str(PROJECT_ROOT / ".env"),
            str(BACKEND_DIR / ".env"),
        ),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    APP_NAME: str = "TypeTrace API"
    APP_VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = Field(default="development")

    SECRET_KEY: str = Field(default="")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    RESET_TOKEN_EXPIRE_MINUTES: int = 15

    DATABASE_URL: str = Field(default="")

    REDIS_HOST: str = Field(default="localhost")
    REDIS_PORT: int = Field(default=6379)
    REDIS_DB: int = Field(default=0)

    FRONTEND_URL: str = Field(default="http://localhost:5173")
    ALLOWED_ORIGINS: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173"
    )

    LOG_LEVEL: str = Field(default="INFO")

    @field_validator("ENVIRONMENT", "LOG_LEVEL")
    @classmethod
    def strip_string_fields(cls, value: str) -> str:
        return value.strip()

    @property
    def cors_origins(self) -> List[str]:
        return [
            origin.strip()
            for origin in self.ALLOWED_ORIGINS.split(",")
            if origin.strip()
        ]

    @property
    def sync_database_url(self) -> str:
        return (
            self.DATABASE_URL
            .replace("+asyncpg", "")
            .replace("+psycopg", "")
        )

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    def validate_required_settings(self) -> None:
        missing = []

        if not self.DATABASE_URL:
            missing.append("DATABASE_URL")

        if not self.SECRET_KEY:
            missing.append("SECRET_KEY")

        if missing:
            raise RuntimeError(
                "Missing required environment variables: "
                + ", ".join(missing)
                + ". Create a .env file from .env.example."
            )


@lru_cache
def get_settings() -> Settings:
    app_settings = Settings()
    app_settings.validate_required_settings()
    return app_settings


settings = get_settings()