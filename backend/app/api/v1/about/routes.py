"""Routes for the About page."""

from fastapi import APIRouter, Depends

from .client import GitHubRepositoryClient
from .schemas import RepositoryStats
from .services import AboutService

router = APIRouter(prefix="/about", tags=["about"])


def get_about_service() -> AboutService:
    """Dependency injection for the About service."""
    return AboutService(GitHubRepositoryClient())


@router.get("/repository", response_model=RepositoryStats)
async def repository_stats(service: AboutService = Depends(get_about_service)) -> RepositoryStats:
    """GitHub stars and forks of the open-source repository (public, cached for an hour)."""
    return await service.repository_stats()
