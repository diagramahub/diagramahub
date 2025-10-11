"""
Main FastAPI application entry point.
"""
from contextlib import asynccontextmanager

from beanie import init_beanie
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from app.api.v1.users.routes import router as users_router
from app.api.v1.users.schemas import UserInDB
from app.api.v1.projects.routes import router as projects_router
from app.api.v1.projects.schemas import ProjectInDB, DiagramInDB, FolderInDB
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
        document_models=[UserInDB, ProjectInDB, DiagramInDB, FolderInDB],
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

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(users_router, prefix=settings.API_V1_PREFIX)
app.include_router(projects_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
async def root():
    """Root endpoint for health check."""
    return {
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "version": settings.VERSION,
        "status": "running",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
