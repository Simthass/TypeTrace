from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    """
    Central environment-based configuration for TypeTrace.

    Security note:
    In production, SECRET_KEY must be a strong random value and CORS must be
    restricted to trusted frontend origins only.
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
    JWT_ISSUER: str = "typetrace-api"
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
    ENABLE_API_DOCS: bool = True

    SECURITY_HEADERS_ENABLED: bool = True
    ENABLE_HSTS: bool = False
    HSTS_MAX_AGE_SECONDS: int = 31536000

    MAX_LOGIN_ATTEMPTS_PER_MINUTE: int = 8
    MAX_OTP_ATTEMPTS_PER_MINUTE: int = 6
    MAX_PUBLIC_VERIFY_PER_MINUTE: int = 30
    RATE_LIMIT_STORAGE_URI: str = Field(default="memory://")

    ENCRYPTION_MASTER_KEY: str = Field(default="")
    ALLOW_LEGACY_EVIDENCE_DECRYPTION: bool = False
    
    PUBLIC_CERTIFICATE_SHOW_STUDENT_NAME: bool = False
    PUBLIC_CERTIFICATE_SHOW_STUDENT_ID: bool = False
    PUBLIC_CERTIFICATE_PDF_SHOW_STUDENT_ID: bool = False
    DATA_EXPORT_INCLUDE_SENSITIVE_BY_DEFAULT: bool = False

    # Part 4: signed certificate ledger. Production should use Ed25519 keys.
    # Development can use HMAC fallback through SECRET_KEY for local demos.
    CERTIFICATE_SIGNING_KEY_ID: str = Field(default="typetrace-local-v1")
    CERTIFICATE_SIGNING_PRIVATE_KEY: str = Field(default="")
    CERTIFICATE_SIGNING_PUBLIC_KEY: str = Field(default="")
    CERTIFICATE_SIGNING_HMAC_SECRET: str = Field(default="")
    CERTIFICATE_ALLOW_HMAC_FALLBACK: bool = True
    ALLOW_MODEL_RELOAD: bool = False

    @field_validator(
        "ENVIRONMENT",
        "LOG_LEVEL",
        "SECRET_KEY",
        "ALLOWED_ORIGINS",
        "CERTIFICATE_SIGNING_KEY_ID",
        "CERTIFICATE_SIGNING_PRIVATE_KEY",
        "CERTIFICATE_SIGNING_PUBLIC_KEY",
        "CERTIFICATE_SIGNING_HMAC_SECRET",
        "ENCRYPTION_MASTER_KEY",
        "RATE_LIMIT_STORAGE_URI",
    )
    @classmethod
    def strip_string_fields(cls, value: str) -> str:
        return value.strip()

    @field_validator("ACCESS_TOKEN_EXPIRE_MINUTES")
    @classmethod
    def validate_access_token_expiry(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("ACCESS_TOKEN_EXPIRE_MINUTES must be positive.")

        if value > 60 * 24 * 7:
            raise ValueError(
                "ACCESS_TOKEN_EXPIRE_MINUTES must not exceed 7 days."
            )

        return value

    @field_validator("RESET_TOKEN_EXPIRE_MINUTES")
    @classmethod
    def validate_reset_token_expiry(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("RESET_TOKEN_EXPIRE_MINUTES must be positive.")

        if value > 60:
            raise ValueError(
                "RESET_TOKEN_EXPIRE_MINUTES should not exceed 60 minutes."
            )

        return value

    @field_validator(
        "MAX_LOGIN_ATTEMPTS_PER_MINUTE",
        "MAX_OTP_ATTEMPTS_PER_MINUTE",
        "MAX_PUBLIC_VERIFY_PER_MINUTE",
    )
    @classmethod
    def validate_rate_limits(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("Rate limits must be positive integers.")
        return value

    @model_validator(mode="after")
    def validate_production_security(self):
        if self.is_production:
            if not self.SECRET_KEY or len(self.SECRET_KEY) < 32:
                raise ValueError(
                    "Production SECRET_KEY must be at least 32 characters."
                )

            weak_values = {
                "replace-this-with-a-long-random-secret-key",
                "secret",
                "changeme",
                "development",
            }

            if self.SECRET_KEY.lower() in weak_values:
                raise ValueError(
                    "Production SECRET_KEY must not use a placeholder value."
                )

            if not self.ENCRYPTION_MASTER_KEY:
                raise ValueError(
                    "Production ENCRYPTION_MASTER_KEY must be configured."
                )

            if self.RATE_LIMIT_STORAGE_URI.lower() == "memory://":
                raise ValueError(
                    "Production RATE_LIMIT_STORAGE_URI must use shared storage "
                    "such as Redis."
                )

            if "*" in self.cors_origins:
                raise ValueError("Production CORS must not allow wildcard origins.")

            if not self.ALLOWED_ORIGINS.strip():
                raise ValueError("Production ALLOWED_ORIGINS must be configured.")

            if (
                not self.CERTIFICATE_SIGNING_PRIVATE_KEY
                and not self.CERTIFICATE_ALLOW_HMAC_FALLBACK
            ):
                raise ValueError(
                    "Production certificate signing requires CERTIFICATE_SIGNING_PRIVATE_KEY "
                    "or explicit HMAC fallback."
                )

        return self

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

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT.lower() == "development"

    @property
    def api_docs_enabled(self) -> bool:
        return self.ENABLE_API_DOCS and not self.is_production

    @property
    def hsts_header_value(self) -> str:
        return (
            f"max-age={self.HSTS_MAX_AGE_SECONDS}; "
            "includeSubDomains; preload"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
