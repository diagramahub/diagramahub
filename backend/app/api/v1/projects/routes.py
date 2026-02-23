"""
FastAPI routes for projects.
"""
from fastapi import APIRouter, Depends, status
from app.api.v1.users.routes import get_current_user_email
from app.api.v1.users.repository import UserRepository
from app.api.v1.diagrams.repository import DiagramRepository
from app.api.v1.folders.repository import FolderRepository
from app.api.v1.subscriptions.usage_limiter import UsageLimiter
from app.api.v1.subscriptions.subscription_repository import SubscriptionRepository
from app.api.v1.subscriptions.plan_repository import PlanRepository
from .repository import ProjectRepository
from .services import ProjectService
from .schemas import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectWithDiagramsResponse

router = APIRouter()

# Dependency injection
def get_project_service() -> ProjectService:
    """Get project service instance."""
    return ProjectService(
        repository=ProjectRepository(),
        diagram_repository=DiagramRepository(),
        folder_repository=FolderRepository()
    )

def get_usage_limiter() -> UsageLimiter:
    """Get usage limiter instance."""
    return UsageLimiter(
        subscription_repository=SubscriptionRepository(),
        plan_repository=PlanRepository(),
        project_repository=ProjectRepository(),
        diagram_repository=DiagramRepository()
    )

async def get_current_user_id(current_user_email: str = Depends(get_current_user_email)) -> str:
    """Get current user ID from email."""
    user_repo = UserRepository()
    user = await user_repo.get_by_email(current_user_email)
    return str(user.id)


# ============ Project Endpoints ============

@router.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    user_id: str = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service),
    usage_limiter: UsageLimiter = Depends(get_usage_limiter)
):
    """Create a new project."""
    # Validar límite de proyectos
    await usage_limiter.enforce_project_limit(user_id)
    
    return await service.create_project(project_data, user_id)


@router.get("/projects", response_model=list[ProjectResponse])
async def get_user_projects(
    user_id: str = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service)
):
    """Get all projects for the current user."""
    return await service.get_user_projects(user_id)


@router.get("/projects/{project_id}", response_model=ProjectWithDiagramsResponse)
async def get_project(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service)
):
    """Get a project with all its diagrams."""
    return await service.get_project_with_diagrams(project_id, user_id)


@router.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_data: ProjectUpdate,
    user_id: str = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service)
):
    """Update a project."""
    return await service.update_project(project_id, project_data, user_id)


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service)
):
    """Delete a project and all its diagrams."""
    return await service.delete_project(project_id, user_id)
