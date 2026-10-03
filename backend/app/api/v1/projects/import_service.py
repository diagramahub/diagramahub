"""
Project import: previews (dry run) and executes an ``ImportPlan`` built by
the pure parsers in ``import_parsers.py``.

Guarantees:

* The plan limit is checked **before** anything is created: an import that
  would exceed the plan's diagram quota is rejected as a whole.
* No partial writes: if creating a diagram or folder fails midway, what was
  created in this request is deleted again (standalone MongoDB has no
  multi-document transactions).
"""

from dataclasses import dataclass, field
from typing import Optional

from fastapi import HTTPException, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.rate_limit import SlidingWindowRateLimiter
from ..diagrams.interfaces import IDiagramRepository
from ..diagrams.schemas import DiagramCreate
from ..folders.interfaces import IFolderRepository
from ..folders.schemas import FolderCreate
from ..subscriptions.constants import RESOURCE_TYPE_DIAGRAM
from ..subscriptions.exceptions import ResourceLimitError
from ..subscriptions.usage_limiter import UsageLimiter
from .export_builders import unique_name
from .import_parsers import ImportError_, ImportLimits, ImportPlan, plan_upload, upload_footprint
from .interfaces import IProjectRepository

import_rate_limiter = SlidingWindowRateLimiter(max_requests=20, window_seconds=60)
# The import dialog previews on every file change, so the dry run gets its own,
# more generous ceiling; it parses everything, so it can't be unlimited either.
import_preview_rate_limiter = SlidingWindowRateLimiter(max_requests=60, window_seconds=60)


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
    ):
        self.project_repository = project_repository
        self.folder_repository = folder_repository
        self.diagram_repository = diagram_repository
        self.usage_limiter = usage_limiter
        self.limits = ImportLimits(
            max_files=settings.MAX_IMPORT_FILES,
            max_total_bytes=settings.MAX_IMPORT_UNCOMPRESSED_BYTES,
            max_file_bytes=settings.MAX_REQUEST_BODY_BYTES,
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
            # Existing folders with the same name (case-insensitive) are reused.
            existing = {
                f.name.lower(): str(f.id)
                for f in await self.folder_repository.get_by_project_id(str(project.id))
            }
            folder_ids: dict[str, str] = {}
            for plan_folder in plan.folders:
                fid = existing.get(plan_folder.name.lower())
                if fid is None:
                    new_folder = await self.folder_repository.create(
                        FolderCreate(name=plan_folder.name, color=plan_folder.color or "#3B82F6"),
                        str(project.id),
                    )
                    fid = str(new_folder.id)
                    created.folder_ids.append(fid)
                folder_ids[plan_folder.name] = fid

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
                title = unique_name(diagram.title, await taken_in(target))
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

            for diagram in plan.root_diagrams:
                await create(diagram, str(folder.id) if folder else None)
            for plan_folder in plan.folders:
                for diagram in plan_folder.diagrams:
                    await create(diagram, folder_ids[plan_folder.name])
        except HTTPException:
            await self._rollback(created)
            raise
        except Exception as exc:  # noqa: BLE001 - any failure midway must undo the partial import
            await self._rollback(created)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"error": "import_failed", "rolled_back": True},
            ) from exc

        preview = self._preview(
            plan, current + plan.diagram_count, limit, True, folder.name if folder else None
        )
        return ImportResult(
            **preview.model_dump(),
            created_diagram_ids=created.diagram_ids,
            created_folder_ids=created.folder_ids,
        )

    async def _rollback(self, created: _Created) -> None:
        """Best-effort removal of what this request created."""
        for diagram_id in created.diagram_ids:
            try:
                await self.diagram_repository.delete(diagram_id)
            except Exception:  # noqa: BLE001 - keep rolling back the rest
                pass
        for folder_id in created.folder_ids:
            try:
                await self.folder_repository.delete(folder_id)
            except Exception:  # noqa: BLE001
                pass
