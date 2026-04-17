"""
Main FastAPI application entry point.
"""
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
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager for startup and shutdown events.

    Handles MongoDB connection initialization and cleanup.
    """
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
        ],
    )

    yield

    # Shutdown: Close MongoDB connection
    client.close()


# Create FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
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
