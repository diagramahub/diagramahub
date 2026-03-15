"""
Core configuration module for Diagramahub backend.
Manages environment variables and application settings.
"""
import json
from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Project Info
    PROJECT_NAME: str = "Diagramahub"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"

    # MongoDB
    MONGO_URI: str = "mongodb://mongodb:27017"
    DATABASE_NAME: str = "diagramahub"

    # Security
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    AI_ENCRYPTION_KEY: str | None = None  # For encrypting AI provider API keys

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            # Try JSON array first: '["https://example.com"]'
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except (json.JSONDecodeError, ValueError):
                pass
            # Fallback: comma-separated string
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # Frontend URL (for Stripe redirects)
    FRONTEND_URL: str = "http://localhost:5173"

    # App environment
    APP_ENV: str = "production"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
