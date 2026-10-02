"""
Core configuration module for Diagramahub backend.
Manages environment variables and application settings.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Project Info
    PROJECT_NAME: str = "Diagramahub"
    VERSION: str = "0.8.0"
    API_V1_PREFIX: str = "/api/v1"

    # Global request body limit (bytes). Generous on purpose: freehand
    # drawings are stored as JSON and can legitimately reach a few MB.
    MAX_REQUEST_BODY_BYTES: int = 5 * 1024 * 1024
    # Project import uploads (ZIP or loose files) get a larger budget than the
    # global body limit, plus caps on what an archive may expand to.
    MAX_IMPORT_UPLOAD_BYTES: int = 20 * 1024 * 1024
    MAX_IMPORT_FILES: int = 500
    MAX_IMPORT_UNCOMPRESSED_BYTES: int = 50 * 1024 * 1024

    # MongoDB
    MONGO_URI: str = "mongodb://mongodb:27017"
    DATABASE_NAME: str = "diagramahub"

    # Security
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    AI_ENCRYPTION_KEY: str | None = None  # For encrypting AI provider API keys

    # CORS - use FRONTEND_URL as default origin, override with comma-separated URLs
    BACKEND_CORS_ORIGINS: str = ""

    @property
    def cors_origins(self) -> list[str]:
        """Parse CORS origins from comma-separated string. Falls back to FRONTEND_URL."""
        v = self.BACKEND_CORS_ORIGINS.strip()
        if not v:
            return [self.FRONTEND_URL]
        return [origin.strip() for origin in v.split(",") if origin.strip()]

    # Frontend URL (for Stripe redirects)
    FRONTEND_URL: str = "http://localhost:5173"

    # Kroki (server-side diagram rendering)
    KROKI_URL: str = "http://kroki:8000"

    # App environment
    APP_ENV: str = "production"

    # Sentry (optional)
    SENTRY_DSN: str | None = None
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1
    SENTRY_ENABLE_LOGS: bool = True

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=True
    )


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
