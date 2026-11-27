"""
Business logic layer for diagrams.
"""

import json
import re
from typing import Optional

from fastapi import HTTPException, status
from .interfaces import IDiagramRepository
from .schemas import (
    DiagramCreate,
    DiagramMove,
    DiagramUpdate,
    DiagramResponse,
    DiagramDuplicate,
    DiagramSearchHit,
    DiagramSearchResult,
    DiagramListEntry,
    FavoriteDiagrams,
    FavoriteState,
    MAX_DIAGRAM_CODE_LENGTH,
    RenderDiagramRequest,
    code_too_long,
    diagram_to_response,
)
from .config_utils import MermaidConfigEmbedder, MermaidConfigParser
from .kroki_client import KrokiClient
from .rate_limiter import render_rate_limiter
from ..activity.interfaces import IActivityRepository
from ..activity.services import record_activity
from ..diagram_files.interfaces import IDiagramFileRepository
from ..diagram_files.schemas import FileScope
from ..diagram_files.services import copy_referenced_files, delete_diagram_files
from ..folders.interfaces import IFolderRepository
from ..projects.interfaces import IProjectRepository
from ..shared_links.interfaces import ISharedLinkRepository

SNIPPET_RADIUS = 60
_FREEHAND_TEXT = re.compile(r'"text"\s*:\s*"((?:[^"\\]|\\.)*)"')


def _snippet(text: str, needle: str) -> str:
    """Up to ~120 characters of ``text`` around the first match of ``needle``."""
    flat = " ".join(text.split())
    at = flat.lower().find(needle.lower())
    if at < 0:
        return ""
    start = max(0, at - SNIPPET_RADIUS)
    end = min(len(flat), at + len(needle) + SNIPPET_RADIUS)
    return ("…" if start else "") + flat[start:end] + ("…" if end < len(flat) else "")


def _json_string(raw: str) -> str:
    """Decode the body of a JSON string literal; '' if it is malformed."""
    try:
        value = json.loads(f'"{raw}"')
    except ValueError:
        return ""
    return value if isinstance(value, str) else ""


def _locate_match(hit: DiagramSearchHit, needle: str) -> tuple[str, str]:
    """Where ``needle`` matched (title, description or content) and a snippet.

    For sketches the snippet comes from the texts on the canvas, not its JSON.
    """
    lowered = needle.lower()
    if lowered in hit.title.lower():
        return "title", ""
    if hit.description and lowered in hit.description.lower():
        return "description", _snippet(hit.description, needle)
    content = hit.content
    if hit.diagram_type == "freehand":
        content = " · ".join(t for t in map(_json_string, _FREEHAND_TEXT.findall(content)) if t)
    return "content", _snippet(content, needle)


def _reject_long_code(content: Optional[str], diagram_type: Optional[str]) -> None:
    """422 when a text diagram's code is over the size cap (``diagram_too_large``)."""
    if code_too_long(content, diagram_type):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"error": "diagram_too_large", "limit": MAX_DIAGRAM_CODE_LENGTH},
        )


class DiagramService:
    """Service for diagram business logic."""

    def __init__(
        self,
        diagram_repository: IDiagramRepository,
        project_repository: IProjectRepository,
        config_embedder: MermaidConfigEmbedder = None,
        config_parser: MermaidConfigParser = None,
        shared_link_repository: Optional[ISharedLinkRepository] = None,
        folder_repository: Optional[IFolderRepository] = None,
        activity_repository: Optional[IActivityRepository] = None,
        diagram_file_repository: Optional[IDiagramFileRepository] = None,
    ):
        """
        Initialize the diagram service.

        Args:
            diagram_repository: Diagram repository
            project_repository: Project repository
            config_embedder: Mermaid config embedder
            config_parser: Mermaid config parser
            shared_link_repository: Shared link repository
            folder_repository: Folder repository (validates ``folder_id``)
            activity_repository: Where the diagrams worked on are noted (dashboard heatmap)
            diagram_file_repository: Images of freehand diagrams (copied on duplicate,
                deleted with the diagram)
        """
        self.diagram_repository = diagram_repository
        self.project_repository = project_repository
        self.config_embedder = config_embedder or MermaidConfigEmbedder()
        self.config_parser = config_parser or MermaidConfigParser()
        self.shared_link_repository = shared_link_repository
        self.folder_repository = folder_repository
        self.activity_repository = activity_repository
        self.diagram_file_repository = diagram_file_repository

    async def _ensure_folder_in_project(self, folder_id: Optional[str], project_id: str) -> None:
        """Reject a ``folder_id`` that is not a folder of ``project_id``.

        Without this check a user could file a diagram under another user's
        folder id, and it would show up in that user's tree and folder export.
        A folder of another project is reported as not found (no existence leak).

        Raises:
            HTTPException: 404 when the folder doesn't exist in this project
        """
        if not folder_id:
            return
        if self.folder_repository is None:
            raise RuntimeError("DiagramService needs a folder repository to validate folder_id")
        folder = await self.folder_repository.get_by_id(folder_id)
        if not folder or folder.project_id != project_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    async def get_recent_diagrams(self, user_id: str, limit: int = 4) -> list[dict]:
        """
        Get the most recently updated diagrams for a user.

        Args:
            user_id: ID of the requesting user
            limit: Maximum number of diagrams to return

        Returns:
            List of recent diagrams with project context, ordered by
            updated_at descending
        """
        projects = await self.project_repository.get_by_user_id(user_id)
        project_map = {str(p.id): {"name": p.name, "emoji": p.emoji} for p in projects}

        # One sorted + limited query with a summary projection, instead of loading
        # every diagram (with its full content) of every project and sorting here.
        recent = await self.diagram_repository.get_recent_by_project_ids(list(project_map), limit)

        return [
            {
                "id": str(d.id),
                "title": d.title,
                "diagram_type": d.diagram_type,
                "project_id": d.project_id,
                "project_name": project_map.get(d.project_id, {}).get("name", ""),
                "project_emoji": project_map.get(d.project_id, {}).get("emoji", "📁"),
                "updated_at": (d.updated_at or d.created_at).isoformat(),
            }
            for d in recent
        ]

    async def get_favorite_diagrams(self, user_id: str, limit: int = 10) -> FavoriteDiagrams:
        """
        The user's starred diagrams, most recently edited first.

        Args:
            user_id: ID of the requesting user
            limit: Maximum number of diagrams to return

        Returns:
            Up to ``limit`` favorites with their project, and how many there are
        """
        projects = await self.project_repository.get_by_user_id(user_id)
        project_map = {str(p.id): p for p in projects}
        favorites, total = await self.diagram_repository.get_favorites_by_project_ids(
            list(project_map), limit
        )
        items = []
        for d in favorites:
            project = project_map.get(d.project_id)
            items.append(
                DiagramListEntry(
                    id=str(d.id),
                    title=d.title,
                    diagram_type=d.diagram_type,
                    project_id=d.project_id,
                    project_name=project.name if project else "",
                    project_emoji=(project.emoji if project else None) or "📁",
                    updated_at=d.updated_at or d.created_at,
                )
            )
        return FavoriteDiagrams(items=items, total=total)

    async def set_favorite(self, diagram_id: str, user_id: str, favorite: bool) -> FavoriteState:
        """
        Star or unstar one of the user's diagrams (doesn't change when it was edited).

        Raises:
            HTTPException: If diagram not found or user doesn't have access
        """
        diagram = await self.diagram_repository.get_by_id(diagram_id)
        if not diagram:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagram not found")
        project = await self.project_repository.get_by_id(diagram.project_id)
        if not project or project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this diagram",
            )
        if diagram.is_favorite != favorite:
            await self.diagram_repository.set_favorite(diagram_id, favorite)
        return FavoriteState(id=diagram_id, is_favorite=favorite)

    async def search_diagrams(
        self,
        user_id: str,
        text: str,
        project_id: Optional[str] = None,
        diagram_type: Optional[str] = None,
        limit: int = 30,
    ) -> list[DiagramSearchResult]:
        """
        Search the user's diagrams by title, description and content.

        Args:
            user_id: ID of the requesting user
            text: Text to find (matched literally, case-insensitive)
            project_id: Limit the search to this project (must be the user's)
            diagram_type: Limit the search to one diagram type
            limit: Maximum number of results

        Returns:
            Matches, most recently updated first, each with where the text was
            found and a snippet around it

        Raises:
            HTTPException 404: If ``project_id`` is not one of the user's projects
        """
        projects = await self.project_repository.get_by_user_id(user_id)
        project_map = {str(p.id): p for p in projects}
        if project_id is not None:
            if project_id not in project_map:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
                )
            scope = [project_id]
        else:
            scope = list(project_map)

        hits = await self.diagram_repository.search(scope, text, diagram_type, limit)
        results = []
        for hit in hits:
            matched_in, snippet = _locate_match(hit, text)
            project = project_map.get(hit.project_id)
            results.append(
                DiagramSearchResult(
                    id=str(hit.id),
                    title=hit.title,
                    diagram_type=hit.diagram_type,
                    project_id=hit.project_id,
                    project_name=project.name if project else "",
                    project_emoji=(project.emoji if project else None) or "📁",
                    folder_id=hit.folder_id,
                    matched_in=matched_in,
                    snippet=snippet,
                    updated_at=hit.updated_at or hit.created_at,
                )
            )
        return results

    def validate_render_request(self, request: RenderDiagramRequest, client_ip: str) -> str:
        """
        Validate a render request against rate limits and supported diagram types.

        Args:
            request: Render request data
            client_ip: IP address of the requesting client

        Returns:
            The diagram source to render

        Raises:
            HTTPException: If the client is rate limited or the diagram type is unsupported
        """
        allowed, retry_after = render_rate_limiter.is_allowed(client_ip)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "Demasiadas solicitudes de renderizado desde esta dirección. "
                    f"Intente de nuevo en {retry_after} segundos."
                ),
                headers={"Retry-After": str(retry_after)},
            )

        # Validate diagram_type against supported types
        if request.diagram_type not in KrokiClient.SUPPORTED_DIAGRAM_TYPES:
            supported = ", ".join(sorted(KrokiClient.SUPPORTED_DIAGRAM_TYPES))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Tipo de diagrama '{request.diagram_type}' no soportado. "
                    f"Tipos soportados: {supported}"
                ),
            )

        return request.source

    async def create_diagram(
        self, diagram_data: DiagramCreate, project_id: str, user_id: str
    ) -> DiagramResponse:
        """
        Create a new diagram in a project.

        Args:
            diagram_data: Diagram creation data
            project_id: Project ID
            user_id: ID of the requesting user

        Returns:
            Created diagram

        Raises:
            HTTPException: If project not found or user doesn't have access
        """
        _reject_long_code(diagram_data.content, diagram_data.diagram_type)
        # Verify project exists and user has access
        project = await self.project_repository.get_by_id(project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

        if project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this project",
            )

        await self._ensure_folder_in_project(diagram_data.folder_id, project_id)

        # For Mermaid diagrams, config is in content (init block)
        # Frontend handles embedding config in content, backend just stores it
        # No need to parse or manipulate the content here

        diagram = await self.diagram_repository.create(diagram_data, project_id)
        await record_activity(self.activity_repository, user_id, [str(diagram.id)])
        return DiagramResponse(**diagram_to_response(diagram))

    async def get_diagram(self, diagram_id: str, user_id: str) -> DiagramResponse:
        """
        Get a diagram by ID.

        Args:
            diagram_id: Diagram ID
            user_id: ID of the requesting user

        Returns:
            Diagram data

        Raises:
            HTTPException: If diagram not found or user doesn't have access
        """
        diagram = await self.diagram_repository.get_by_id(diagram_id)
        if not diagram:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagram not found")

        # Verify user has access to the project
        project = await self.project_repository.get_by_id(diagram.project_id)
        if not project or project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this diagram",
            )

        # For Mermaid diagrams, config is in content (init block), not in config object
        # Just return the diagram as-is, frontend will parse the init block

        return DiagramResponse(**diagram_to_response(diagram))

    async def update_diagram(
        self, diagram_id: str, diagram_data: DiagramUpdate, user_id: str
    ) -> DiagramResponse:
        """
        Update a diagram.

        Args:
            diagram_id: Diagram ID
            diagram_data: Update data
            user_id: ID of the requesting user

        Returns:
            Updated diagram

        Raises:
            HTTPException: If diagram not found or user doesn't have access
        """
        diagram = await self.diagram_repository.get_by_id(diagram_id)
        if not diagram:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagram not found")

        # Verify user has access to the project
        project = await self.project_repository.get_by_id(diagram.project_id)
        if not project or project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this diagram",
            )
        if diagram_data.content is not None:
            _reject_long_code(
                diagram_data.content, diagram_data.diagram_type or diagram.diagram_type
            )

        await self._ensure_folder_in_project(diagram_data.folder_id, diagram.project_id)

        # For Mermaid diagrams, config is in content (init block)
        # Frontend handles embedding config in content, backend just stores it
        # No need to parse or manipulate the content here

        updated_diagram = await self.diagram_repository.update(diagram_id, diagram_data)
        # Only real edits count as activity (the editor also saves the viewport).
        if updated_diagram.updated_at != diagram.updated_at:
            await record_activity(self.activity_repository, user_id, [diagram_id])
        return DiagramResponse(**diagram_to_response(updated_diagram))

    async def move_diagram(
        self, diagram_id: str, move_data: DiagramMove, user_id: str
    ) -> DiagramResponse:
        """Move a diagram to another project owned by the current user."""
        diagram = await self.diagram_repository.get_by_id(diagram_id)
        if not diagram:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Diagram not found",
            )

        source_project = await self.project_repository.get_by_id(diagram.project_id)
        if not source_project or source_project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this diagram",
            )

        target_project = await self.project_repository.get_by_id(move_data.target_project_id)
        if not target_project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target project not found",
            )

        if target_project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to the target project",
            )

        updated_diagram = await self.diagram_repository.move(
            diagram_id, move_data.target_project_id
        )
        return DiagramResponse(**diagram_to_response(updated_diagram))

    async def duplicate_diagram(
        self, diagram_id: str, duplicate_data: DiagramDuplicate, user_id: str
    ) -> DiagramResponse:
        """Duplicate a diagram into the same project and folder with a new title.

        Args:
            diagram_id: ID of the source diagram
            duplicate_data: New title for the copy
            user_id: ID of the requesting user

        Returns:
            The duplicated diagram

        Raises:
            HTTPException: If diagram not found or user doesn't have access
        """
        diagram = await self.diagram_repository.get_by_id(diagram_id)
        if not diagram:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Diagram not found",
            )

        project = await self.project_repository.get_by_id(diagram.project_id)
        if not project or project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this diagram",
            )

        duplicated = await self.diagram_repository.duplicate(diagram, duplicate_data.title)
        await copy_referenced_files(
            self.diagram_file_repository,
            FileScope.DIAGRAM,
            diagram_id,
            FileScope.DIAGRAM,
            str(duplicated.id),
            user_id,
            duplicated.content,
        )
        await record_activity(self.activity_repository, user_id, [str(duplicated.id)])
        return DiagramResponse(**diagram_to_response(duplicated))

    async def delete_diagram(self, diagram_id: str, user_id: str) -> dict:
        """
        Delete a diagram.

        Args:
            diagram_id: Diagram ID
            user_id: ID of the requesting user

        Returns:
            Success message

        Raises:
            HTTPException: If diagram not found or user doesn't have access
        """
        diagram = await self.diagram_repository.get_by_id(diagram_id)
        if not diagram:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagram not found")

        # Verify user has access to the project
        project = await self.project_repository.get_by_id(diagram.project_id)
        if not project or project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this diagram",
            )

        # Revoke any active shared links for this diagram before deleting
        if self.shared_link_repository:
            active_link = await self.shared_link_repository.get_active_by_diagram(diagram_id)
            if active_link:
                await self.shared_link_repository.revoke(str(active_link.id))

        await self.diagram_repository.delete(diagram_id)
        await delete_diagram_files(self.diagram_file_repository, [diagram_id])
        return {"message": "Diagram deleted successfully"}

    def _is_mermaid_diagram(self, diagram_type: str) -> bool:
        """
        Check if diagram type is a Mermaid diagram.

        Args:
            diagram_type: Type of diagram

        Returns:
            True if it's a Mermaid diagram type
        """
        # Only Mermaid subtypes are listed here. Server-rendered types like
        # "d2", "plantuml", and other Kroki-supported types are intentionally
        # excluded — they are rendered via the Kroki service, not client-side.
        mermaid_types = [
            "mermaid",
            "flowchart",
            "sequence",
            "class",
            "state",
            "er",
            "gantt",
            "pie",
            "journey",
            "gitgraph",
        ]
        return diagram_type.lower() in mermaid_types
