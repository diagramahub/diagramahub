"""
Main FastAPI application entry point.
"""
import logging
from contextlib import asynccontextmanager

from beanie import init_beanie
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from app.api.v1.users.routes import router as users_router
from app.api.v1.users.schemas import UserInDB
from app.api.v1.projects.routes import router as projects_router
from app.api.v1.projects.schemas import ProjectInDB
from app.api.v1.diagrams.routes import router as diagrams_router
from app.api.v1.diagrams.schemas import DiagramInDB
from app.api.v1.prompt_history.routes import router as prompt_history_router
from app.api.v1.prompt_history.schemas import PromptHistoryInDB
from app.api.v1.folders.routes import router as folders_router
from app.api.v1.folders.schemas import FolderInDB
from app.api.v1.ai_providers.routes import router as ai_providers_router
from app.api.v1.ai_providers.schemas import UserAISettingsInDB
from app.api.v1.chat_sessions.routes import router as chat_sessions_router
from app.api.v1.chat_sessions.schemas import ChatSessionInDB, ChatMessageInDB
from app.api.v1.subscriptions.routes import router as subscriptions_router
from app.api.v1.subscriptions.webhook_routes import router as webhooks_router
from app.api.v1.subscriptions.schemas import (
    PlanInDB, SubscriptionInDB, StripeConfigInDB, WebhookEventInDB
)
from app.api.v1.shared_links.schemas import SharedLinkInDB, AccessLogInDB
from app.api.v1.shared_links.routes import router as shared_links_router
from app.api.v1.shared_links.public_routes import router as shared_links_public_router
from app.api.v1.integrations.routes import router as integrations_router
from app.api.v1.integrations.schemas import VendorConfigInDB
from app.api.v1.mfa.routes import router as mfa_router
from app.api.v1.oauth.routes import router as oauth_router
from app.api.v1.oauth.schemas import OAuthStateToken
from app.api.v1.users.audit_log import AuditLogEntry
from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Sentry event sanitization (before_send callback)
# ---------------------------------------------------------------------------

# Headers and body parameter names that must be masked before sending to Sentry
_SENSITIVE_HEADERS = {"authorization", "cookie"}
_SENSITIVE_BODY_PARAMS = {"api_key", "password", "token", "secret", "jwt"}
_MASK = "[Filtered]"


def sanitize_sentry_event(event: dict, hint: dict) -> dict | None:
    """Sanitize a Sentry event by removing/masking sensitive data.

    Removes sensitive headers (Authorization, Cookie) and body parameters
    (api_key, password, token, secret, jwt) from the event before it is
    sent to Sentry.

    Returns ``None`` when sanitization fails so that unsanitized data is
    never transmitted.
    """
    try:
        request_data = event.get("request")
        if request_data and isinstance(request_data, dict):
            # Sanitize headers
            headers = request_data.get("headers")
            if headers and isinstance(headers, dict):
                for header_name in list(headers.keys()):
                    if header_name.lower() in _SENSITIVE_HEADERS:
                        headers[header_name] = _MASK

            # Sanitize body / data params
            data = request_data.get("data")
            if data and isinstance(data, dict):
                for param_name in list(data.keys()):
                    if param_name.lower() in _SENSITIVE_BODY_PARAMS:
                        data[param_name] = _MASK

            # Sanitize query string params
            query_string = request_data.get("query_string")
            if query_string and isinstance(query_string, str):
                import urllib.parse

                parsed = urllib.parse.parse_qs(query_string)
                sanitized_parts: list[str] = []
                for key, values in parsed.items():
                    if key.lower() in _SENSITIVE_BODY_PARAMS:
                        sanitized_parts.append(f"{key}={_MASK}")
                    else:
                        for val in values:
                            sanitized_parts.append(f"{key}={val}")
                request_data["query_string"] = "&".join(sanitized_parts)

        return event
    except Exception:
        # If sanitization fails, discard the event to avoid leaking data
        logger.warning("Sentry event sanitization failed; discarding event")
        return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager for startup and shutdown events.

    Handles Sentry initialization (when configured) and MongoDB connection.
    """
    # Startup: Initialize Sentry (conditional — only when DSN is configured)
    if settings.SENTRY_DSN:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.APP_ENV,
            release=settings.VERSION,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            integrations=[FastApiIntegration()],
            before_send=sanitize_sentry_event,
        )
        logger.info("Sentry initialized (environment=%s)", settings.APP_ENV)

    # Startup: Initialize MongoDB connection
    client = AsyncIOMotorClient(settings.MONGO_URI)
    database = client[settings.DATABASE_NAME]

    # Initialize Beanie with document models
    await init_beanie(
        database=database,
        document_models=[
            UserInDB, 
            ProjectInDB, 
            DiagramInDB, 
            FolderInDB, 
            UserAISettingsInDB,
            PlanInDB,
            SubscriptionInDB,
            StripeConfigInDB,
            WebhookEventInDB,
            PromptHistoryInDB,
            ChatSessionInDB,
            ChatMessageInDB,
            SharedLinkInDB,
            AccessLogInDB,
            VendorConfigInDB,
            AuditLogEntry,
            OAuthStateToken,
        ],
    )

    yield

    # Shutdown: Close MongoDB connection
    client.close()


# ---------------------------------------------------------------------------
# Point 6: Disable Swagger/OpenAPI docs in production (OWASP A05)
# ---------------------------------------------------------------------------
_is_production = settings.APP_ENV == "production"

# Create FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    openapi_url=None if _is_production else "/openapi.json",
)


# ---------------------------------------------------------------------------
# Security Headers Middleware (OWASP A05)
# ---------------------------------------------------------------------------

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to every response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Cache-Control"] = "no-store"
        if settings.APP_ENV == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )
        return response


app.add_middleware(SecurityHeadersMiddleware)

# ---------------------------------------------------------------------------
# Point 5: Hide stack traces in production (OWASP A04)
# ---------------------------------------------------------------------------
if _is_production:
    import logging as _logging
    from fastapi.responses import JSONResponse

    _err_logger = _logging.getLogger("uvicorn.error")

    @app.exception_handler(Exception)
    async def _production_exception_handler(request: Request, exc: Exception):
        _err_logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(users_router, prefix=settings.API_V1_PREFIX)
app.include_router(projects_router, prefix=settings.API_V1_PREFIX)
app.include_router(diagrams_router, prefix=settings.API_V1_PREFIX)
app.include_router(folders_router, prefix=settings.API_V1_PREFIX)
app.include_router(ai_providers_router, prefix=f"{settings.API_V1_PREFIX}/ai", tags=["AI Providers"])
app.include_router(subscriptions_router, prefix=settings.API_V1_PREFIX, tags=["Subscriptions"])
app.include_router(webhooks_router, prefix=settings.API_V1_PREFIX, tags=["Webhooks"])
app.include_router(prompt_history_router, prefix=settings.API_V1_PREFIX)
app.include_router(chat_sessions_router, prefix=settings.API_V1_PREFIX)
app.include_router(shared_links_router, prefix=settings.API_V1_PREFIX, tags=["Shared Links"])
app.include_router(shared_links_public_router, prefix=settings.API_V1_PREFIX, tags=["Shared Links (Public)"])
app.include_router(integrations_router, prefix=settings.API_V1_PREFIX, tags=["Integrations (Admin)"])
app.include_router(mfa_router, prefix=settings.API_V1_PREFIX, tags=["MFA"])
app.include_router(oauth_router, prefix=settings.API_V1_PREFIX, tags=["OAuth"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "version": settings.VERSION,
        "environment": settings.APP_ENV,
        "status": "running",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}
