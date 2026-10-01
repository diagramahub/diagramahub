"""
Business logic layer for diagrams.
"""

from typing import Optional

from fastapi import HTTPException, status
from .interfaces import IDiagramRepository
from .schemas import (
    DiagramCreate,
    DiagramMove,
    DiagramUpdate,
    DiagramResponse,
    DiagramDuplicate,
    RenderDiagramRequest,
)
from .config_utils import MermaidConfigEmbedder, MermaidConfigParser
from .kroki_client import KrokiClient
from .rate_limiter import render_rate_limiter
from ..projects.interfaces import IProjectRepository
from ..shared_links.interfaces import ISharedLinkRepository


class DiagramService:
    """Service for diagram business logic."""

    def __init__(
        self,
        diagram_repository: IDiagramRepository,
        project_repository: IProjectRepository,
        config_embedder: MermaidConfigEmbedder = None,
        config_parser: MermaidConfigParser = None,
        shared_link_repository: Optional[ISharedLinkRepository] = None,
    ):
        """
        Initialize the diagram service.

        Args:
            diagram_repository: Diagram repository
            project_repository: Project repository
            config_embedder: Mermaid config embedder
            config_parser: Mermaid config parser
            shared_link_repository: Shared link repository
        """
        self.diagram_repository = diagram_repository
        self.project_repository = project_repository
        self.config_embedder = config_embedder or MermaidConfigEmbedder()
        self.config_parser = config_parser or MermaidConfigParser()
        self.shared_link_repository = shared_link_repository

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
        recent = await self.diagram_repository.get_recent_by_project_ids(
            list(project_map), limit
        )

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
        # Verify project exists and user has access
        project = await self.project_repository.get_by_id(project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

        if project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this project",
            )

        # For Mermaid diagrams, config is in content (init block)
        # Frontend handles embedding config in content, backend just stores it
        # No need to parse or manipulate the content here

        diagram = await self.diagram_repository.create(diagram_data, project_id)
        return DiagramResponse(
            id=str(diagram.id),
            title=diagram.title,
            content=diagram.content,
            description=diagram.description,
            diagram_type=diagram.diagram_type,
            config=diagram.config,
            user_preferences=diagram.user_preferences,
            project_id=diagram.project_id,
            folder_id=diagram.folder_id,
            viewport_zoom=diagram.viewport_zoom,
            viewport_x=diagram.viewport_x,
            viewport_y=diagram.viewport_y,
            created_at=diagram.created_at,
            updated_at=diagram.updated_at,
        )

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

        return DiagramResponse(
            id=str(diagram.id),
            title=diagram.title,
            content=diagram.content,
            description=diagram.description,
            diagram_type=diagram.diagram_type,
            config=diagram.config,
            user_preferences=diagram.user_preferences,
            project_id=diagram.project_id,
            folder_id=diagram.folder_id,
            viewport_zoom=diagram.viewport_zoom,
            viewport_x=diagram.viewport_x,
            viewport_y=diagram.viewport_y,
            created_at=diagram.created_at,
            updated_at=diagram.updated_at,
        )

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

        # For Mermaid diagrams, config is in content (init block)
        # Frontend handles embedding config in content, backend just stores it
        # No need to parse or manipulate the content here

        updated_diagram = await self.diagram_repository.update(diagram_id, diagram_data)
        return DiagramResponse(
            id=str(updated_diagram.id),
            title=updated_diagram.title,
            content=updated_diagram.content,
            description=updated_diagram.description,
            diagram_type=updated_diagram.diagram_type,
            config=updated_diagram.config,
            user_preferences=updated_diagram.user_preferences,
            project_id=updated_diagram.project_id,
            folder_id=updated_diagram.folder_id,
            viewport_zoom=updated_diagram.viewport_zoom,
            viewport_x=updated_diagram.viewport_x,
            viewport_y=updated_diagram.viewport_y,
            created_at=updated_diagram.created_at,
            updated_at=updated_diagram.updated_at,
        )

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
        return DiagramResponse(
            id=str(updated_diagram.id),
            title=updated_diagram.title,
            content=updated_diagram.content,
            description=updated_diagram.description,
            diagram_type=updated_diagram.diagram_type,
            config=updated_diagram.config,
            user_preferences=updated_diagram.user_preferences,
            project_id=updated_diagram.project_id,
            folder_id=updated_diagram.folder_id,
            viewport_zoom=updated_diagram.viewport_zoom,
            viewport_x=updated_diagram.viewport_x,
            viewport_y=updated_diagram.viewport_y,
            created_at=updated_diagram.created_at,
            updated_at=updated_diagram.updated_at,
        )

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
        return DiagramResponse(
            id=str(duplicated.id),
            title=duplicated.title,
            content=duplicated.content,
            description=duplicated.description,
            diagram_type=duplicated.diagram_type,
            config=duplicated.config,
            user_preferences=duplicated.user_preferences,
            project_id=duplicated.project_id,
            folder_id=duplicated.folder_id,
            viewport_zoom=duplicated.viewport_zoom,
            viewport_x=duplicated.viewport_x,
            viewport_y=duplicated.viewport_y,
            created_at=duplicated.created_at,
            updated_at=duplicated.updated_at,
        )

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
