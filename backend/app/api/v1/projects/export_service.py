"""
Project/folder export: loads the tree (with permission checks) and delegates
the rendering to the pure builders in ``export_builders.py``.
"""

from dataclasses import dataclass
from typing import Literal, Optional

from fastapi import HTTPException, status

from app.core.rate_limit import SlidingWindowRateLimiter
from ..diagrams.interfaces import IDiagramRepository
from ..diagrams.schemas import DiagramInDB
from ..folders.interfaces import IFolderRepository
from .export_builders import (
    ExportDiagram,
    ExportFolder,
    ExportTree,
    MarkdownVariant,
    build_markdown,
    build_zip,
    download_filename,
    estimate_tokens,
)
from .interfaces import IProjectRepository

ExportFormat = Literal["zip", "markdown"]

# Exports read every diagram of a project and build an archive: cheap enough
# for normal use, expensive enough to deserve a per-user ceiling.
export_rate_limiter = SlidingWindowRateLimiter(max_requests=30, window_seconds=60)
# The export dialog asks for a summary on every option change, so it gets its
# own (more generous) ceiling instead of eating into the download budget.
export_summary_rate_limiter = SlidingWindowRateLimiter(max_requests=60, window_seconds=60)


def _check_rate_limit(limiter: SlidingWindowRateLimiter, user_id: str) -> None:
    """Raise 429 (with Retry-After) when the user exceeded the limiter's ceiling."""
    allowed, retry_after = limiter.is_allowed(user_id)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many exports. Please wait a moment and try again.",
            headers={"Retry-After": str(retry_after)},
        )


@dataclass
class ExportSummary:
    """What the export dialog shows before downloading."""

    diagram_count: int
    folder_count: int
    size_bytes: int
    # ZIP summaries are measured without compression: size_bytes is an upper bound.
    size_is_upper_bound: bool
    estimated_tokens: Optional[int]  # only for the Markdown "ai" variant
    filename: str


@dataclass
class ExportResult:
    """A rendered export ready to be sent as a download."""

    content: bytes
    media_type: str
    filename: str


def _to_export_diagram(diagram: DiagramInDB) -> ExportDiagram:
    return ExportDiagram(
        id=str(diagram.id),
        title=diagram.title,
        diagram_type=diagram.diagram_type,
        content=diagram.content or "",
        description=diagram.description,
        created_at=diagram.created_at,
        updated_at=diagram.updated_at or diagram.created_at,
    )


class ProjectExportService:
    """Builds ZIP / Markdown exports of a project or one of its folders."""

    def __init__(
        self,
        project_repository: IProjectRepository,
        folder_repository: IFolderRepository,
        diagram_repository: IDiagramRepository,
    ):
        self.project_repository = project_repository
        self.folder_repository = folder_repository
        self.diagram_repository = diagram_repository

    async def load_tree(
        self, project_id: str, user_id: str, folder_id: Optional[str] = None
    ) -> ExportTree:
        """
        Load the export tree for the whole project or for one folder.

        Raises:
            HTTPException 404: project (or folder) not found
            HTTPException 403: the project belongs to another user
        """
        project = await self.project_repository.get_by_id(project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        if project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this project",
            )

        tree = ExportTree(
            project_id=str(project.id),
            project_name=project.name,
            project_emoji=project.emoji,
            project_description=project.description,
        )

        if folder_id:
            folder = await self.folder_repository.get_by_id(folder_id)
            # A folder of another project is reported as not found: it isn't in this one.
            if not folder or folder.project_id != str(project.id):
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
            diagrams = await self.diagram_repository.get_by_folder_id(str(folder.id), str(project.id))
            tree.scope_folder_name = folder.name
            tree.folders = [
                ExportFolder(
                    id=str(folder.id),
                    name=folder.name,
                    color=folder.color,
                    diagrams=[_to_export_diagram(d) for d in diagrams],
                )
            ]
            return tree

        root = await self.diagram_repository.get_without_folder(str(project.id))
        tree.root_diagrams = [_to_export_diagram(d) for d in root]
        for folder in await self.folder_repository.get_by_project_id(str(project.id)):
            diagrams = await self.diagram_repository.get_by_folder_id(str(folder.id), str(project.id))
            tree.folders.append(
                ExportFolder(
                    id=str(folder.id),
                    name=folder.name,
                    color=folder.color,
                    diagrams=[_to_export_diagram(d) for d in diagrams],
                )
            )
        return tree

    @staticmethod
    def render(
        tree: ExportTree,
        fmt: ExportFormat,
        variant: MarkdownVariant = "ai",
        include_descriptions: bool = True,
    ) -> ExportResult:
        """Render a loaded tree in the requested format."""
        if fmt == "zip":
            return ExportResult(
                content=build_zip(tree, include_descriptions=include_descriptions),
                media_type="application/zip",
                filename=download_filename(tree, "zip"),
            )
        document = build_markdown(tree, variant=variant, include_descriptions=include_descriptions)
        return ExportResult(
            content=document.encode("utf-8"),
            media_type="text/markdown; charset=utf-8",
            filename=download_filename(tree, "markdown"),
        )

    async def summarize(
        self,
        project_id: str,
        user_id: str,
        fmt: ExportFormat,
        variant: MarkdownVariant = "ai",
        include_descriptions: bool = True,
        folder_id: Optional[str] = None,
    ) -> ExportSummary:
        """Counts, size and (for the AI variant) token estimate, without downloading.

        Rate limited like the download, and a ZIP is never compressed here: its
        entries are stored as-is, so the size is an upper bound of the download.
        """
        _check_rate_limit(export_summary_rate_limiter, user_id)
        tree = await self.load_tree(project_id, user_id, folder_id)
        if fmt == "zip":
            size = len(build_zip(tree, include_descriptions=include_descriptions, compress=False))
            return ExportSummary(
                diagram_count=tree.diagram_count,
                folder_count=len(tree.folders),
                size_bytes=size,
                size_is_upper_bound=True,
                estimated_tokens=None,
                filename=download_filename(tree, "zip"),
            )
        document = build_markdown(tree, variant=variant, include_descriptions=include_descriptions)
        return ExportSummary(
            diagram_count=tree.diagram_count,
            folder_count=len(tree.folders),
            size_bytes=len(document.encode("utf-8")),
            size_is_upper_bound=False,
            estimated_tokens=estimate_tokens(document) if variant == "ai" else None,
            filename=download_filename(tree, "markdown"),
        )

    async def export(
        self,
        project_id: str,
        user_id: str,
        fmt: ExportFormat,
        variant: MarkdownVariant = "ai",
        include_descriptions: bool = True,
        folder_id: Optional[str] = None,
    ) -> ExportResult:
        """Build the download, enforcing the per-user rate limit."""
        _check_rate_limit(export_rate_limiter, user_id)
        tree = await self.load_tree(project_id, user_id, folder_id)
        return self.render(tree, fmt, variant, include_descriptions)
