"""
FastAPI routes for folders.
"""
from fastapi import APIRouter, Depends, Query, status
from app.api.v1.users.routes import get_current_user_email
from app.api.v1.users.repository import UserRepository
from app.api.v1.projects.repository import ProjectRepository
from app.api.v1.diagrams.repository import DiagramRepository
from .repository import FolderRepository
from .services import FolderService
from .schemas import FolderCreate, FolderUpdate, FolderResponse, FolderWithDiagramsResponse

router = APIRouter()

# Dependency injection
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
    delete_diagrams: bool = Query(False, description="If True, deletes all diagrams in folder. Otherwise, moves them to root."),
    user_id: str = Depends(get_current_user_id),
    service: FolderService = Depends(get_folder_service)
):
    """Delete a folder. If delete_diagrams is True, deletes all diagrams in folder. Otherwise, moves them to root."""
    return await service.delete_folder(folder_id, user_id, delete_diagrams)
