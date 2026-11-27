"""
FastAPI routes for the files (images) of freehand diagrams.

The owner uploads and reads them here; shared links and the community serve
them publicly from their own routers (``/shared/{token}/files/{file_id}``,
``/community/{publication_id}/files/{file_id}``) with :func:`file_response`.
"""

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from fastapi.responses import JSONResponse

from app.api.deps import get_current_user_id
from app.api.v1.diagrams.repository import DiagramRepository
from app.api.v1.projects.repository import ProjectRepository
from app.core.config import settings

from .repository import DiagramFileRepository
from .schemas import DiagramFileInDB, DiagramFileResponse
from .services import DiagramFileService

router = APIRouter(tags=["Diagram files"])

#: Owner reads: the id is the content hash, so a file never changes.
PRIVATE_IMMUTABLE = "private, max-age=31536000, immutable"


def get_diagram_file_repository() -> DiagramFileRepository:
    """Repository dependency (also used by the services that cascade to files)."""
    return DiagramFileRepository()


def get_diagram_file_service() -> DiagramFileService:
    """Service dependency wired to MongoDB and the configured limits."""
    return DiagramFileService(
        file_repository=DiagramFileRepository(),
        diagram_repository=DiagramRepository(),
        project_repository=ProjectRepository(),
        max_bytes=settings.DIAGRAM_FILE_MAX_BYTES,
        max_per_diagram=settings.DIAGRAM_FILES_MAX_PER_DIAGRAM,
    )


def file_response(file: DiagramFileInDB, cache_control: str) -> Response:
    """The raw bytes of a stored image, with headers that keep it an image.

    ``nosniff`` and the stored (byte-detected) type stop a browser from reading
    it as anything else; the sandboxing CSP covers opening it directly.
    """
    return Response(
        content=file.data,
        media_type=file.mime_type,
        headers={
            "Cache-Control": cache_control,
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": "inline",
            "Content-Security-Policy": "default-src 'none'; sandbox",
        },
    )


@router.post(
    "/diagrams/{diagram_id}/files",
    response_model=DiagramFileResponse,
    status_code=status.HTTP_201_CREATED,
    responses={200: {"model": DiagramFileResponse, "description": "Already stored"}},
)
async def upload_diagram_file(
    diagram_id: str,
    file: UploadFile = File(..., description="PNG, JPEG, WebP or GIF image"),
    user_id: str = Depends(get_current_user_id),
    service: DiagramFileService = Depends(get_diagram_file_service),
) -> JSONResponse:
    """Store an image of one of the user's freehand diagrams.

    The id is the SHA-256 of the bytes, computed here: 201 when stored now, 200
    when the diagram already had it.
    """
    # One byte past the limit is enough to know it's too large.
    data = await file.read(settings.DIAGRAM_FILE_MAX_BYTES + 1)
    result, created = await service.upload(diagram_id, user_id, data)
    return JSONResponse(
        content=result.model_dump(),
        status_code=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@router.get(
    "/diagrams/{diagram_id}/files/{file_id}",
    response_class=Response,
    responses={200: {"content": {"image/*": {}}, "description": "The image bytes"}},
)
async def get_diagram_file(
    diagram_id: str,
    file_id: str,
    user_id: str = Depends(get_current_user_id),
    service: DiagramFileService = Depends(get_diagram_file_service),
) -> Response:
    """An image of one of the user's diagrams (404 for anyone else)."""
    file = await service.get_for_owner(diagram_id, user_id, file_id)
    return file_response(file, PRIVATE_IMMUTABLE)
