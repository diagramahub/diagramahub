"""
FastAPI routes for projects and diagrams.
"""
from fastapi import APIRouter, Depends, status
from app.api.v1.users.routes import get_current_user_email
from app.api.v1.users.repository import UserRepository
from .repository import ProjectRepository, DiagramRepository, FolderRepository
from .services import ProjectService, DiagramService, FolderService
from .schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectWithDiagramsResponse,
    DiagramCreate, DiagramUpdate, DiagramResponse,
    FolderCreate, FolderUpdate, FolderResponse, FolderWithDiagramsResponse
)

router = APIRouter()

# Dependency injection
def get_project_service() -> ProjectService:
    """Get project service instance."""
    return ProjectService(
        repository=ProjectRepository(),
        diagram_repository=DiagramRepository(),
        folder_repository=FolderRepository()
    )

def get_diagram_service() -> DiagramService:
    """Get diagram service instance."""
    return DiagramService(
        diagram_repository=DiagramRepository(),
        project_repository=ProjectRepository()
    )

def get_folder_service() -> FolderService:
    """Get folder service instance."""
    return FolderService(
        folder_repository=FolderRepository(),
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
    service: ProjectService = Depends(get_project_service)
):
    """Create a new project."""
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


# ============ Folder Endpoints ============

@router.post("/projects/{project_id}/folders", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    project_id: str,
    folder_data: FolderCreate,
    user_id: str = Depends(get_current_user_id),
    service: FolderService = Depends(get_folder_service)
):
    """Create a new folder in a project."""
    return await service.create_folder(folder_data, project_id, user_id)


@router.get("/folders/{folder_id}", response_model=FolderWithDiagramsResponse)
async def get_folder(
    folder_id: str,
    user_id: str = Depends(get_current_user_id),
    service: FolderService = Depends(get_folder_service)
):
    """Get a folder with its diagrams."""
    return await service.get_folder(folder_id, user_id)


@router.put("/folders/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: str,
    folder_data: FolderUpdate,
    user_id: str = Depends(get_current_user_id),
    service: FolderService = Depends(get_folder_service)
):
    """Update a folder."""
    return await service.update_folder(folder_id, folder_data, user_id)


@router.delete("/folders/{folder_id}")
async def delete_folder(
    folder_id: str,
    user_id: str = Depends(get_current_user_id),
    service: FolderService = Depends(get_folder_service)
):
    """Delete a folder and move its diagrams to root."""
    return await service.delete_folder(folder_id, user_id)
