"""
Business logic layer for diagrams.
"""
from fastapi import HTTPException, status
from .interfaces import IDiagramRepository
from .schemas import DiagramCreate, DiagramUpdate, DiagramResponse


class DiagramService:
    """Service for diagram business logic."""

    def __init__(
        self,
        diagram_repository: IDiagramRepository,
        project_repository
    ):
        self.diagram_repository = diagram_repository
        self.project_repository = project_repository

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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )

        if project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this project"
            )

        diagram = await self.diagram_repository.create(diagram_data, project_id)
        return DiagramResponse(
            id=str(diagram.id),
            title=diagram.title,
            content=diagram.content,
            description=diagram.description,
            diagram_type=diagram.diagram_type,
            project_id=diagram.project_id,
            folder_id=diagram.folder_id,
            viewport_zoom=diagram.viewport_zoom,
            viewport_x=diagram.viewport_x,
            viewport_y=diagram.viewport_y,
            created_at=diagram.created_at,
            updated_at=diagram.updated_at
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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Diagram not found"
            )

        # Verify user has access to the project
        project = await self.project_repository.get_by_id(diagram.project_id)
        if not project or project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this diagram"
            )

        return DiagramResponse(
            id=str(diagram.id),
            title=diagram.title,
            content=diagram.content,
            description=diagram.description,
            diagram_type=diagram.diagram_type,
            project_id=diagram.project_id,
            folder_id=diagram.folder_id,
            viewport_zoom=diagram.viewport_zoom,
            viewport_x=diagram.viewport_x,
            viewport_y=diagram.viewport_y,
            created_at=diagram.created_at,
            updated_at=diagram.updated_at
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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Diagram not found"
            )

        # Verify user has access to the project
        project = await self.project_repository.get_by_id(diagram.project_id)
        if not project or project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this diagram"
            )

        updated_diagram = await self.diagram_repository.update(diagram_id, diagram_data)
        return DiagramResponse(
            id=str(updated_diagram.id),
            title=updated_diagram.title,
            content=updated_diagram.content,
            description=updated_diagram.description,
            diagram_type=updated_diagram.diagram_type,
            project_id=updated_diagram.project_id,
            folder_id=updated_diagram.folder_id,
            viewport_zoom=updated_diagram.viewport_zoom,
            viewport_x=updated_diagram.viewport_x,
            viewport_y=updated_diagram.viewport_y,
            created_at=updated_diagram.created_at,
            updated_at=updated_diagram.updated_at
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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Diagram not found"
            )

        # Verify user has access to the project
        project = await self.project_repository.get_by_id(diagram.project_id)
        if not project or project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this diagram"
            )

        await self.diagram_repository.delete(diagram_id)
        return {"message": "Diagram deleted successfully"}
