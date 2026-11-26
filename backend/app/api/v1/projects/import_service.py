"""
Project import: previews (dry run) and executes an ``ImportPlan`` built by
the pure parsers in ``import_parsers.py``.

Guarantees:

* The plan limit is checked **before** anything is created: an import that
  would exceed the plan's diagram quota is rejected as a whole.
* No partial writes: if creating a diagram or folder fails midway, what was
  created in this request is deleted again (standalone MongoDB has no
  multi-document transactions).
* Images of sketches in a Diagramahub export are stored for the new diagrams
  (the parser already checked them like an upload).
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

from fastapi import HTTPException, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.rate_limit import SlidingWindowRateLimiter
from ..diagram_files.interfaces import IDiagramFileRepository
from ..diagram_files.schemas import DiagramFileInDB, FileScope
from ..diagram_files.services import delete_diagram_files
from ..diagrams.interfaces import IDiagramRepository
from ..diagrams.schemas import DiagramCreate, code_too_long
from ..folders.interfaces import IFolderRepository
from ..folders.schemas import FolderCreate
from ..subscriptions.constants import RESOURCE_TYPE_DIAGRAM
from ..subscriptions.exceptions import ResourceLimitError
from ..subscriptions.usage_limiter import UsageLimiter
from .export_builders import unique_name
from .import_parsers import (
    MAX_TITLE_LENGTH,
    ImportDiagram,
    ImportError_,
    ImportLimits,
    ImportPlan,
    ImportSkipped,
    plan_upload,
    upload_footprint,
)
from .interfaces import IProjectRepository

logger = logging.getLogger(__name__)

import_rate_limiter = SlidingWindowRateLimiter(max_requests=20, window_seconds=60)
# The import dialog previews on every file change, so the dry run gets its own,
# more generous ceiling; it parses everything, so it can't be unlimited either.
import_preview_rate_limiter = SlidingWindowRateLimiter(max_requests=60, window_seconds=60)


def _skip_long_code(plan: ImportPlan) -> None:
    """Diagrams over the code size cap are reported as skipped (``too_large``), not created."""

    def keep(diagram: ImportDiagram) -> bool:
        if code_too_long(diagram.content, diagram.diagram_type):
            plan.skipped.append(ImportSkipped(diagram.source, "too_large"))
            return False
        return True

    plan.root_diagrams = [d for d in plan.root_diagrams if keep(d)]
    for folder in plan.folders:
        folder.diagrams = [d for d in folder.diagrams if keep(d)]


def _check_rate_limit(limiter: SlidingWindowRateLimiter, user_id: str) -> None:
    """Raise 429 (with Retry-After) when the user exceeded the limiter's ceiling."""
    allowed, retry_after = limiter.is_allowed(user_id)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many imports. Please wait a moment and try again.",
            headers={"Retry-After": str(retry_after)},
        )


@dataclass
class UploadedFile:
    """An uploaded file as the service sees it (no framework types)."""

    filename: str
    data: bytes


class ImportDiagramPreview(BaseModel):
    """One diagram of the preview."""

    title: str
    diagram_type: str
    folder: Optional[str]
    source: str
    has_description: bool
    warnings: list[str] = []
    # Images restored with the sketch (from a Diagramahub export)
    image_count: int = 0


class ImportSkippedPreview(BaseModel):
    """One skipped entry of the preview."""

    source: str
    reason: str


class ImportPreview(BaseModel):
    """What an import would do (``dry_run``) or did."""

    diagram_count: int
    folder_count: int
    folders: list[str]
    diagrams: list[ImportDiagramPreview]
    skipped: list[ImportSkippedPreview]
    # Plan quota: None = unlimited
    current_usage: int
    limit: Optional[int]
    allowed: bool
    target_folder: Optional[str] = None


class ImportResult(ImportPreview):
    """Outcome of an executed import."""

    created_diagram_ids: list[str] = []
    created_folder_ids: list[str] = []


@dataclass
class _Created:
    diagram_ids: list[str] = field(default_factory=list)
    folder_ids: list[str] = field(default_factory=list)


class ProjectImportService:
    """Plans and executes imports into a project."""

    def __init__(
        self,
        project_repository: IProjectRepository,
        folder_repository: IFolderRepository,
        diagram_repository: IDiagramRepository,
        usage_limiter: UsageLimiter,
        diagram_file_repository: Optional[IDiagramFileRepository] = None,
    ):
        """
        Args:
            project_repository: Projects (ownership)
            folder_repository: Folders (created or reused by name)
            diagram_repository: Where the diagrams are created
            usage_limiter: Plan quota
            diagram_file_repository: Where sketch images are stored (None: dropped)
        """
        self.project_repository = project_repository
        self.folder_repository = folder_repository
        self.diagram_repository = diagram_repository
        self.usage_limiter = usage_limiter
        self.diagram_file_repository = diagram_file_repository
        self.limits = ImportLimits(
            max_files=settings.MAX_IMPORT_FILES,
            max_total_bytes=settings.MAX_IMPORT_UNCOMPRESSED_BYTES,
            max_file_bytes=settings.MAX_REQUEST_BODY_BYTES,
            max_image_bytes=settings.DIAGRAM_FILE_MAX_BYTES,
            max_images_per_diagram=settings.DIAGRAM_FILES_MAX_PER_DIAGRAM,
        )

    async def _authorize(self, project_id: str, user_id: str, folder_id: Optional[str]):
        project = await self.project_repository.get_by_id(project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        if project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this project",
            )
        folder = None
        if folder_id:
            folder = await self.folder_repository.get_by_id(folder_id)
            if not folder or folder.project_id != str(project.id):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found"
                )
        return project, folder

    def build_plan(self, uploads: list[UploadedFile], into_folder: bool) -> ImportPlan:
        """Parse every upload into one plan (400 on an unreadable archive)."""
        if not uploads:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files uploaded")
        total = sum(len(u.data) for u in uploads)
        if total > settings.MAX_IMPORT_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Upload too large",
            )
        # The archive limits apply to the whole request, not to each archive:
        # many small ZIPs must not add up to more than one big one may hold.
        files_seen, bytes_seen = 0, 0
        for upload in uploads:
            entries, size = upload_footprint(upload.filename, upload.data)
            files_seen += entries
            bytes_seen += size
            reason = None
            if files_seen > self.limits.max_files:
                reason = "too_many_files"
            elif bytes_seen > self.limits.max_total_bytes:
                reason = "too_large_uncompressed"
            if reason:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"error": "invalid_upload", "file": upload.filename, "reason": reason},
                )
        plan = ImportPlan()
        for upload in uploads:
            try:
                plan.merge(plan_upload(upload.filename, upload.data, self.limits))
            except ImportError_ as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"error": "invalid_upload", "file": upload.filename, "reason": str(exc)},
                ) from exc
        if into_folder:
            # One level of folders only: an archive imported into a folder is flattened.
            plan.flatten_into_root()
        _skip_long_code(plan)
        return plan

    async def _quota(self, user_id: str, new_diagrams: int) -> tuple[int, Optional[int], bool]:
        check = await self.usage_limiter.check_diagram_limit(user_id)
        current = int(check["current_usage"])
        limit = check["limit"]
        allowed = limit is None or limit == -1 or current + new_diagrams <= limit
        return current, (None if limit in (None, -1) else int(limit)), allowed

    @staticmethod
    def _preview(
        plan: ImportPlan,
        current: int,
        limit: Optional[int],
        allowed: bool,
        target_folder: Optional[str],
    ) -> ImportPreview:
        diagrams = [
            ImportDiagramPreview(
                title=d.title,
                diagram_type=d.diagram_type,
                folder=None,
                source=d.source,
                has_description=bool(d.description),
                warnings=d.warnings,
                image_count=len(d.files),
            )
            for d in plan.root_diagrams
        ] + [
            ImportDiagramPreview(
                title=d.title,
                diagram_type=d.diagram_type,
                folder=f.name,
                source=d.source,
                has_description=bool(d.description),
                warnings=d.warnings,
                image_count=len(d.files),
            )
            for f in plan.folders
            for d in f.diagrams
        ]
        return ImportPreview(
            diagram_count=plan.diagram_count,
            folder_count=len(plan.folders),
            folders=[f.name for f in plan.folders],
            diagrams=diagrams,
            skipped=[ImportSkippedPreview(source=s.source, reason=s.reason) for s in plan.skipped],
            current_usage=current,
            limit=limit,
            allowed=allowed,
            target_folder=target_folder,
        )

    async def preview(
        self, project_id: str, user_id: str, uploads: list[UploadedFile], folder_id: Optional[str]
    ) -> ImportPreview:
        """Dry run: what would be created, and whether the plan quota allows it."""
        _check_rate_limit(import_preview_rate_limiter, user_id)
        _, folder = await self._authorize(project_id, user_id, folder_id)
        plan = self.build_plan(uploads, into_folder=folder is not None)
        current, limit, allowed = await self._quota(user_id, plan.diagram_count)
        return self._preview(plan, current, limit, allowed, folder.name if folder else None)

    async def execute(
        self, project_id: str, user_id: str, uploads: list[UploadedFile], folder_id: Optional[str]
    ) -> ImportResult:
        """Create folders and diagrams; all or nothing."""
        _check_rate_limit(import_rate_limiter, user_id)
        project, folder = await self._authorize(project_id, user_id, folder_id)
        plan = self.build_plan(uploads, into_folder=folder is not None)
        if plan.diagram_count == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "nothing_to_import",
                    "skipped": [s.__dict__ for s in plan.skipped],
                },
            )
        current, limit, allowed = await self._quota(user_id, plan.diagram_count)
        if not allowed:
            raise ResourceLimitError(
                resource_type=RESOURCE_TYPE_DIAGRAM,
                current=current + plan.diagram_count,
                limit=limit or 0,
            )

        created = _Created()
        try:
            # Folders match by name case-insensitively: an existing one is reused,
            # and "Docs" + "docs" in the same upload become a single folder.
            existing = {
                f.name.lower(): str(f.id)
                for f in await self.folder_repository.get_by_project_id(str(project.id))
            }
            folder_ids: dict[str, str] = {}
            for plan_folder in plan.folders:
                key = plan_folder.name.lower()
                fid = existing.get(key)
                if fid is None:
                    new_folder = await self.folder_repository.create(
                        FolderCreate(name=plan_folder.name, color=plan_folder.color or "#3B82F6"),
                        str(project.id),
                    )
                    fid = str(new_folder.id)
                    created.folder_ids.append(fid)
                    existing[key] = fid
                folder_ids[key] = fid

            # Titles already used in each destination: imported ones get "(2)", "(3)"…
            taken: dict[Optional[str], set[str]] = {}

            async def taken_in(target: Optional[str]) -> set[str]:
                if target not in taken:
                    if target is None:
                        current = await self.diagram_repository.get_without_folder(str(project.id))
                    else:
                        current = await self.diagram_repository.get_by_folder_id(
                            target, str(project.id)
                        )
                    taken[target] = {d.title.lower() for d in current}
                return taken[target]

            async def create(diagram, target: Optional[str]) -> None:
                title = unique_name(diagram.title, await taken_in(target), MAX_TITLE_LENGTH)
                new_diagram = await self.diagram_repository.create(
                    DiagramCreate(
                        title=title,
                        content=diagram.content,
                        description=(diagram.description or "")[:50000],
                        diagram_type=diagram.diagram_type,
                        folder_id=target,
                    ),
                    str(project.id),
                )
                created.diagram_ids.append(str(new_diagram.id))
                await self._store_files(diagram, str(new_diagram.id), user_id)

            for diagram in plan.root_diagrams:
                await create(diagram, str(folder.id) if folder else None)
            for plan_folder in plan.folders:
                for diagram in plan_folder.diagrams:
                    await create(diagram, folder_ids[plan_folder.name.lower()])
        except HTTPException:
            await self._rollback(created)
            raise
        except Exception as exc:  # noqa: BLE001 - any failure midway must undo the partial import
            rolled_back = await self._rollback(created)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"error": "import_failed", "rolled_back": rolled_back},
            ) from exc
        except BaseException:
            # Cancellation (client disconnect, worker timeout) is not an Exception:
            # still undo the partial import before letting it propagate.
            await self._rollback(created)
            raise

        preview = self._preview(
            plan, current + plan.diagram_count, limit, True, folder.name if folder else None
        )
        return ImportResult(
            **preview.model_dump(),
            created_diagram_ids=created.diagram_ids,
            created_folder_ids=created.folder_ids,
        )

    async def _store_files(self, diagram: ImportDiagram, diagram_id: str, user_id: str) -> None:
        """Store a new sketch's images (checked by the parser) under its id."""
        if self.diagram_file_repository is None:
            return
        for file in diagram.files:
            await self.diagram_file_repository.create(
                DiagramFileInDB(
                    scope=FileScope.DIAGRAM,
                    scope_id=diagram_id,
                    owner_id=user_id,
                    file_id=file.file_id,
                    mime_type=file.mime_type,
                    size=len(file.data),
                    data=file.data,
                )
            )

    async def _rollback(self, created: _Created) -> bool:
        """Remove what this request created; True only if everything was removed.

        Keeps going after a failed delete (and logs it) so as little as
        possible is left behind.
        """
        complete = True
        for diagram_id in created.diagram_ids:
            try:
                await self.diagram_repository.delete(diagram_id)
            except Exception:  # noqa: BLE001 - keep rolling back the rest
                complete = False
                logger.exception("Import rollback: could not delete diagram %s", diagram_id)
        try:
            await delete_diagram_files(self.diagram_file_repository, created.diagram_ids)
        except Exception:  # noqa: BLE001
            complete = False
            logger.exception("Import rollback: could not delete the imported images")
        for folder_id in created.folder_ids:
            try:
                await self.folder_repository.delete(folder_id)
            except Exception:  # noqa: BLE001
                complete = False
                logger.exception("Import rollback: could not delete folder %s", folder_id)
        return complete
