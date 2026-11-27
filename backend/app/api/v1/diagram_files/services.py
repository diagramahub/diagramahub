"""
Business logic for the files (images) of freehand diagrams.

- Only the owner of a diagram uploads or reads its files; anyone else gets a
  404, as if the diagram didn't exist.
- The type comes from the bytes (PNG, JPEG, WebP, GIF), never from the client.
- A file's id is the SHA-256 of its bytes: uploading the same image twice keeps
  one copy.
- A diagram keeps at most ``max_per_diagram`` files. When an upload would go
  over it, the files its stored scene no longer mentions are dropped first
  (only those older than :data:`GC_GRACE_PERIOD`, so an image just placed on
  the canvas and not saved yet is never lost).

The module-level helpers (:func:`copy_referenced_files`,
:func:`delete_diagram_files`) let other services (diagrams, projects, folders,
community, account deletion) keep the files in step with their diagrams; like
``record_activity``, they accept ``None`` for services built without storage.
"""

import hashlib
import logging
import re
from datetime import timedelta
from typing import Iterable, Optional

from fastapi import HTTPException, status

from app.api.v1.diagrams.interfaces import IDiagramRepository
from app.api.v1.diagrams.schemas import DiagramInDB
from app.api.v1.projects.interfaces import IProjectRepository
from app.core.clock import utcnow
from app.core.log_safety import log_safe

from .interfaces import IDiagramFileRepository
from .schemas import (
    DiagramFileInDB,
    DiagramFileResponse,
    FileScope,
    is_valid_file_id,
)

logger = logging.getLogger(__name__)

#: Diagram types whose scenes can hold images.
FILE_DIAGRAM_TYPES = frozenset({"freehand"})

#: An unreferenced file younger than this is kept by the cleanup: the editor
#: uploads an image before it saves the scene that mentions it.
GC_GRACE_PERIOD = timedelta(hours=1)


def sniff_image_type(data: bytes) -> Optional[str]:
    """MIME type from the file's magic bytes (PNG, JPEG, WebP, GIF), or None.

    The declared Content-Type of an upload is never trusted; SVG (text that can
    carry scripts) is never recognised.
    """
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    return None


FILE_TOO_LARGE = "file_too_large"
UNSUPPORTED_FILE_TYPE = "unsupported_file_type"


def check_image(data: bytes, max_bytes: int) -> tuple[Optional[str], Optional[str]]:
    """Whether ``data`` may be stored as a diagram image (uploads and imports alike).

    Returns:
        ``(mime_type, None)`` when it may, else ``(None, error)`` with
        :data:`FILE_TOO_LARGE` or :data:`UNSUPPORTED_FILE_TYPE`.
    """
    if len(data) > max_bytes:
        return None, FILE_TOO_LARGE
    mime_type = sniff_image_type(data)
    if mime_type is None:
        return None, UNSUPPORTED_FILE_TYPE
    return mime_type, None


def file_id_of(data: bytes) -> str:
    """A file's id: the SHA-256 of its bytes (64 lowercase hex characters)."""
    return hashlib.sha256(data).hexdigest()


_FILE_ID_IN_TEXT = re.compile(r"(?<![0-9a-f])[0-9a-f]{64}(?![0-9a-f])")


def candidate_file_ids(content: Optional[str]) -> list[str]:
    """Every distinct file-id-shaped string in ``content`` (64 lowercase hex), in order."""
    return list(dict.fromkeys(_FILE_ID_IN_TEXT.findall(content or "")))


def referenced_file_ids(content: Optional[str], file_ids: Iterable[str]) -> list[str]:
    """The ``file_ids`` that ``content`` mentions (a plain substring check)."""
    text = content or ""
    return [file_id for file_id in file_ids if file_id in text]


async def copy_referenced_files(
    repository: Optional[IDiagramFileRepository],
    source_scope: FileScope,
    source_id: str,
    target_scope: FileScope,
    target_id: str,
    owner_id: str,
    content: Optional[str],
) -> None:
    """Copy into the target scope the source's files that ``content`` mentions.

    Used when a diagram is duplicated, forked or published. Never fails the
    caller: the copy (diagram, fork, publication) already exists, so an error
    is logged and its images are simply missing.
    """
    if repository is None or not content:
        return
    try:
        stored = await repository.list_meta(source_scope, source_id)
        file_ids = referenced_file_ids(content, (f.file_id for f in stored))
        await repository.copy(source_scope, source_id, target_scope, target_id, owner_id, file_ids)
    except Exception:
        logger.exception(
            "Could not copy diagram files from %s=%s to %s=%s",
            source_scope.value,
            log_safe(source_id),
            target_scope.value,
            log_safe(target_id),
        )


async def delete_diagram_files(
    repository: Optional[IDiagramFileRepository], diagram_ids: list[str]
) -> None:
    """Delete the files of these diagrams (they were, or are being, deleted)."""
    if repository is None or not diagram_ids:
        return
    await repository.delete_scopes(FileScope.DIAGRAM, diagram_ids)


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")


class DiagramFileService:
    """Upload and read the images of a user's freehand diagrams."""

    def __init__(
        self,
        file_repository: IDiagramFileRepository,
        diagram_repository: IDiagramRepository,
        project_repository: IProjectRepository,
        max_bytes: int,
        max_per_diagram: int,
    ):
        """
        Args:
            file_repository: Where the files are stored
            diagram_repository: Diagrams (ownership and their stored scene)
            project_repository: Projects (a diagram belongs to its project's user)
            max_bytes: Largest accepted file
            max_per_diagram: Most files one diagram keeps
        """
        self.file_repository = file_repository
        self.diagram_repository = diagram_repository
        self.project_repository = project_repository
        self.max_bytes = max_bytes
        self.max_per_diagram = max_per_diagram

    async def _owned_diagram(self, diagram_id: str, user_id: str) -> DiagramInDB:
        """The user's diagram; 404 when it doesn't exist or belongs to someone else."""
        diagram = await self.diagram_repository.get_by_id(diagram_id)
        if diagram is not None:
            project = await self.project_repository.get_by_id(diagram.project_id)
            if project is not None and project.user_id == user_id:
                return diagram
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagram not found")

    async def upload(
        self, diagram_id: str, user_id: str, data: bytes
    ) -> tuple[DiagramFileResponse, bool]:
        """Store an image of one of the user's freehand diagrams.

        Returns:
            The file and whether it was stored now (False: it already was).

        Raises:
            HTTPException 404: The diagram doesn't exist or isn't the user's
            HTTPException 413: ``file_too_large``
            HTTPException 415: ``unsupported_file_type`` (not PNG, JPEG, WebP or GIF)
            HTTPException 422: ``diagram_type_not_supported`` (not a freehand diagram)
            HTTPException 409: ``diagram_files_limit`` (the diagram has too many files)
        """
        diagram = await self._owned_diagram(diagram_id, user_id)
        if diagram.diagram_type not in FILE_DIAGRAM_TYPES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={"error": "diagram_type_not_supported"},
            )
        mime_type, error = check_image(data, self.max_bytes)
        if error == FILE_TOO_LARGE:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail={"error": FILE_TOO_LARGE, "limit": self.max_bytes},
            )
        if mime_type is None:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail={"error": UNSUPPORTED_FILE_TYPE},
            )

        file_id = file_id_of(data)
        existing = await self.file_repository.get_meta(FileScope.DIAGRAM, diagram_id, file_id)
        if existing is not None:
            return self._response(file_id, existing.mime_type, existing.size), False

        await self._make_room(diagram)
        stored, created = await self.file_repository.create(
            DiagramFileInDB(
                scope=FileScope.DIAGRAM,
                scope_id=diagram_id,
                owner_id=user_id,
                file_id=file_id,
                mime_type=mime_type,
                size=len(data),
                data=data,
            )
        )
        return self._response(file_id, stored.mime_type, stored.size), created

    async def _make_room(self, diagram: DiagramInDB) -> None:
        """Make room for one more file, dropping the ones the scene no longer uses.

        Raises:
            HTTPException 409: ``diagram_files_limit`` when the diagram is still full
        """
        diagram_id = str(diagram.id)
        if await self.file_repository.count(FileScope.DIAGRAM, diagram_id) < self.max_per_diagram:
            return
        stored = await self.file_repository.list_meta(FileScope.DIAGRAM, diagram_id)
        in_use = set(referenced_file_ids(diagram.content, (f.file_id for f in stored)))
        unused = [f.file_id for f in stored if f.file_id not in in_use]
        removed = await self.file_repository.delete_files(
            FileScope.DIAGRAM, diagram_id, unused, created_before=utcnow() - GC_GRACE_PERIOD
        )
        if removed:
            logger.info("Collected %d unused file(s) of diagram %s", removed, log_safe(diagram_id))
        if len(stored) - removed >= self.max_per_diagram:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": "diagram_files_limit", "limit": self.max_per_diagram},
            )

    async def get_for_owner(self, diagram_id: str, user_id: str, file_id: str) -> DiagramFileInDB:
        """A file of one of the user's diagrams.

        Raises:
            HTTPException 404: Malformed id, the diagram isn't the user's, or no such file
        """
        if not is_valid_file_id(file_id):
            raise _not_found()
        await self._owned_diagram(diagram_id, user_id)
        return await self.get_in_scope(FileScope.DIAGRAM, diagram_id, file_id)

    async def get_in_scope(self, scope: FileScope, scope_id: str, file_id: str) -> DiagramFileInDB:
        """A file of a scope whose access the caller already checked.

        Raises:
            HTTPException 404: Malformed id or no such file
        """
        if not is_valid_file_id(file_id):
            raise _not_found()
        file = await self.file_repository.get(scope, scope_id, file_id)
        if file is None:
            raise _not_found()
        return file

    @staticmethod
    def _response(file_id: str, mime_type: str, size: int) -> DiagramFileResponse:
        return DiagramFileResponse(file_id=file_id, mime_type=mime_type, size=size)
