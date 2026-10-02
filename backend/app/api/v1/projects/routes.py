"""
FastAPI routes for projects.
"""

from typing import Literal, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile, status
from app.api.deps import get_current_user_id
from app.api.v1.users.repository import UserRepository
from app.api.v1.diagrams.repository import DiagramRepository
from app.api.v1.folders.repository import FolderRepository
from app.api.v1.subscriptions.usage_limiter import UsageLimiter
from app.api.v1.subscriptions.subscription_repository import SubscriptionRepository
from app.api.v1.subscriptions.plan_repository import PlanRepository
from .repository import ProjectRepository
from .services import ProjectService
from .export_service import ExportSummary, ProjectExportService
from .import_service import ImportPreview, ImportResult, ProjectImportService, UploadedFile
from .schemas import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectWithDiagramsResponse

router = APIRouter()


# Dependency injection
def get_project_service() -> ProjectService:
    """Get project service instance."""
    return ProjectService(
        repository=ProjectRepository(),
        diagram_repository=DiagramRepository(),
        folder_repository=FolderRepository(),
    )


def get_export_service() -> ProjectExportService:
    """Get project export service instance."""
    return ProjectExportService(
        project_repository=ProjectRepository(),
        folder_repository=FolderRepository(),
        diagram_repository=DiagramRepository(),
    )


def get_import_service() -> ProjectImportService:
    """Get project import service instance."""
    return ProjectImportService(
        project_repository=ProjectRepository(),
        folder_repository=FolderRepository(),
        diagram_repository=DiagramRepository(),
        usage_limiter=get_usage_limiter(),
    )


def get_usage_limiter() -> UsageLimiter:
    """Get usage limiter instance."""
    return UsageLimiter(
        subscription_repository=SubscriptionRepository(),
        plan_repository=PlanRepository(),
        project_repository=ProjectRepository(),
        diagram_repository=DiagramRepository(),
        user_repository=UserRepository(),
    )


# ============ Project Endpoints ============


@router.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    user_id: str = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service),
    usage_limiter: UsageLimiter = Depends(get_usage_limiter),
):
    """Create a new project."""
    # Validar límite de proyectos
    await usage_limiter.enforce_project_limit(user_id)

    return await service.create_project(project_data, user_id)


@router.get("/projects", response_model=list[ProjectResponse])
async def get_user_projects(
    user_id: str = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service),
):
    """Get all projects for the current user."""
    return await service.get_user_projects(user_id)


@router.get("/projects/{project_id}/export/summary", response_model=ExportSummary)
async def get_project_export_summary(
    project_id: str,
    format: Literal["zip", "markdown"] = Query("zip"),
    variant: Literal["ai", "standard"] = Query("ai"),
    descriptions: bool = Query(True),
    folder_id: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    service: ProjectExportService = Depends(get_export_service),
):
    """What an export would contain (counts, size, token estimate) before downloading."""
    return await service.summarize(
        project_id, user_id, format, variant, descriptions, folder_id
    )


@router.get("/projects/{project_id}/export")
async def export_project(
    project_id: str,
    format: Literal["zip", "markdown"] = Query("zip"),
    variant: Literal["ai", "standard"] = Query("ai"),
    descriptions: bool = Query(True),
    folder_id: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    service: ProjectExportService = Depends(get_export_service),
) -> Response:
    """
    Download the whole project (or one folder, with ``folder_id``) as a ZIP of
    source files or as a single Markdown document (``variant=ai|standard``).
    """
    result = await service.export(
        project_id, user_id, format, variant, descriptions, folder_id
    )
    ascii_name = result.filename.encode("ascii", "ignore").decode() or "export"
    return Response(
        content=result.content,
        media_type=result.media_type,
        headers={
            # RFC 6266: ASCII fallback plus the UTF-8 name for browsers that read it.
            "Content-Disposition": (
                f'attachment; filename="{ascii_name}"; '
                f"filename*=UTF-8''{quote(result.filename)}"
            ),
            "Cache-Control": "no-store",
        },
    )


@router.post("/projects/{project_id}/import", response_model=ImportResult | ImportPreview)
async def import_into_project(
    project_id: str,
    files: list[UploadFile] = File(..., description="Diagram files, Markdown, .excalidraw or ZIP archives"),
    folder_id: Optional[str] = Form(None),
    dry_run: bool = Query(False, description="Preview only: nothing is created"),
    user_id: str = Depends(get_current_user_id),
    service: ProjectImportService = Depends(get_import_service),
):
    """
    Import diagrams into the project root or into ``folder_id``.

    Accepts loose files (.mmd/.puml/.d2/.dbml/.freehand.json/.excalidraw/.md),
    Diagramahub export archives (restores folders and colours) or any ZIP
    (folders from its paths). With ``dry_run=true`` returns the preview only.
    """
    uploads = [UploadedFile(filename=f.filename or "file", data=await f.read()) for f in files]
    if dry_run:
        return await service.preview(project_id, user_id, uploads, folder_id or None)
    return await service.execute(project_id, user_id, uploads, folder_id or None)


@router.get("/projects/{project_id}", response_model=ProjectWithDiagramsResponse)
async def get_project(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service),
):
    """Get a project with all its diagrams."""
    return await service.get_project_with_diagrams(project_id, user_id)


@router.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_data: ProjectUpdate,
    user_id: str = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service),
):
    """Update a project."""
    return await service.update_project(project_id, project_data, user_id)


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service),
):
    """Delete a project and all its diagrams."""
    return await service.delete_project(project_id, user_id)
