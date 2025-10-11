"""
FastAPI routes for diagrams.
"""
from fastapi import APIRouter, Depends, status
from app.api.v1.users.routes import get_current_user_email
from app.api.v1.users.repository import UserRepository
from app.api.v1.projects.repository import ProjectRepository
from .repository import DiagramRepository
from .services import DiagramService
from .schemas import DiagramCreate, DiagramUpdate, DiagramResponse

router = APIRouter()

# Dependency injection
def get_diagram_service() -> DiagramService:
    """Get diagram service instance."""
    return DiagramService(
        diagram_repository=DiagramRepository(),
        project_repository=ProjectRepository()
    )

async def get_current_user_id(current_user_email: str = Depends(get_current_user_email)) -> str:
    """Get current user ID from email."""
    user_repo = UserRepository()
    user = await user_repo.get_by_email(current_user_email)
    return str(user.id)


# ============ Diagram Endpoints ============

@router.post("/projects/{project_id}/diagrams", response_model=DiagramResponse, status_code=status.HTTP_201_CREATED)
async def create_diagram(
    project_id: str,
    diagram_data: DiagramCreate,
    user_id: str = Depends(get_current_user_id),
    service: DiagramService = Depends(get_diagram_service)
):
    """Create a new diagram in a project."""
    return await service.create_diagram(diagram_data, project_id, user_id)


@router.get("/diagrams/{diagram_id}", response_model=DiagramResponse)
async def get_diagram(
    diagram_id: str,
    user_id: str = Depends(get_current_user_id),
    service: DiagramService = Depends(get_diagram_service)
):
    """Get a diagram by ID."""
    return await service.get_diagram(diagram_id, user_id)


@router.put("/diagrams/{diagram_id}", response_model=DiagramResponse)
async def update_diagram(
    diagram_id: str,
    diagram_data: DiagramUpdate,
    user_id: str = Depends(get_current_user_id),
    service: DiagramService = Depends(get_diagram_service)
):
    """Update a diagram."""
    return await service.update_diagram(diagram_id, diagram_data, user_id)


@router.delete("/diagrams/{diagram_id}")
async def delete_diagram(
    diagram_id: str,
    user_id: str = Depends(get_current_user_id),
    service: DiagramService = Depends(get_diagram_service)
):
    """Delete a diagram."""
    return await service.delete_diagram(diagram_id, user_id)
