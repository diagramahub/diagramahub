"""
Business logic layer for projects.
"""

from fastapi import HTTPException, status
from .interfaces import IProjectRepository
from ..diagrams.interfaces import IDiagramRepository
from ..diagrams.schemas import diagram_to_response
from ..folders.interfaces import IFolderRepository
from .schemas import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectWithDiagramsResponse


class ProjectService:
    """Service for project business logic."""

    def __init__(
        self,
        repository: IProjectRepository,
        diagram_repository: IDiagramRepository,
        folder_repository: IFolderRepository,
    ):
        """
        Initialize the project service.

        Args:
            repository: Project repository
            diagram_repository: Diagram repository
            folder_repository: Folder repository
        """
        self.repository = repository
        self.diagram_repository = diagram_repository
        self.folder_repository = folder_repository

    async def create_project(self, project_data: ProjectCreate, user_id: str) -> ProjectResponse:
        """
        Create a new project for a user.

        Args:
            project_data: Project creation data
            user_id: ID of the user creating the project

        Returns:
            Created project
        """
        project = await self.repository.create(project_data, user_id)
        return ProjectResponse(
            id=str(project.id),
            name=project.name,
            description=project.description,
            emoji=project.emoji,
            user_id=project.user_id,
            diagram_count=0,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )

    async def get_project(self, project_id: str, user_id: str) -> ProjectResponse:
        """
        Get a project by ID.

        Args:
            project_id: Project ID
            user_id: ID of the requesting user

        Returns:
            Project data

        Raises:
            HTTPException: If project not found or user doesn't have access
        """
        project = await self.repository.get_by_id(project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

        if project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this project",
            )

        # Count diagrams for this project
        diagrams = await self.diagram_repository.get_by_project_id(project_id)
        diagram_count = len(diagrams)

        return ProjectResponse(
            id=str(project.id),
            name=project.name,
            description=project.description,
            emoji=project.emoji,
            user_id=project.user_id,
            diagram_count=diagram_count,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )

    async def get_project_with_diagrams(
        self, project_id: str, user_id: str
    ) -> ProjectWithDiagramsResponse:
        """
        Get a project with all its diagrams.

        Args:
            project_id: Project ID
            user_id: ID of the requesting user

        Returns:
            Project data with diagrams

        Raises:
            HTTPException: If project not found or user doesn't have access
        """
        project = await self.repository.get_by_id(project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

        if project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this project",
            )

        # Get diagrams without folder
        diagrams_without_folder = await self.diagram_repository.get_without_folder(project_id)
        diagram_responses = [diagram_to_response(d) for d in diagrams_without_folder]

        # Get folders with their diagrams
        folders = await self.folder_repository.get_by_project_id(project_id)
        folder_responses = []
        for folder in folders:
            folder_diagrams = await self.diagram_repository.get_by_folder_id(
                str(folder.id), project_id
            )
            folder_diagram_responses = [diagram_to_response(d) for d in folder_diagrams]
            folder_responses.append(
                {
                    "id": str(folder.id),
                    "name": folder.name,
                    "color": folder.color,
                    "project_id": folder.project_id,
                    "created_at": folder.created_at,
                    "updated_at": folder.updated_at,
                    "diagrams": folder_diagram_responses,
                }
            )

        return ProjectWithDiagramsResponse(
            id=str(project.id),
            name=project.name,
            description=project.description,
            emoji=project.emoji,
            user_id=project.user_id,
            created_at=project.created_at,
            updated_at=project.updated_at,
            diagrams=diagram_responses,
            folders=folder_responses,
        )

    async def get_user_projects(self, user_id: str) -> list[ProjectResponse]:
        """
        Get all projects for a user.

        Args:
            user_id: User ID

        Returns:
            List of projects
        """
        projects = await self.repository.get_by_user_id(user_id)
        project_responses = []

        for p in projects:
            # Count diagrams for this project
            diagrams = await self.diagram_repository.get_by_project_id(str(p.id))
            diagram_count = len(diagrams)

            # Count by diagram type
            type_counts: dict = {}
            for d in diagrams:
                dt = d.diagram_type or "mermaid"
                type_counts[dt] = type_counts.get(dt, 0) + 1

            project_responses.append(
                ProjectResponse(
                    id=str(p.id),
                    name=p.name,
                    description=p.description,
                    emoji=p.emoji,
                    user_id=p.user_id,
                    diagram_count=diagram_count,
                    diagram_type_counts=type_counts,
                    created_at=p.created_at,
                    updated_at=p.updated_at,
                )
            )

        return project_responses

    async def update_project(
        self, project_id: str, project_data: ProjectUpdate, user_id: str
    ) -> ProjectResponse:
        """
        Update a project.

        Args:
            project_id: Project ID
            project_data: Update data
            user_id: ID of the requesting user

        Returns:
            Updated project

        Raises:
            HTTPException: If project not found or user doesn't have access
        """
        project = await self.repository.get_by_id(project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

        if project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this project",
            )

        updated_project = await self.repository.update(project_id, project_data)

        # Count diagrams for this project
        diagrams = await self.diagram_repository.get_by_project_id(project_id)
        diagram_count = len(diagrams)

        return ProjectResponse(
            id=str(updated_project.id),
            name=updated_project.name,
            description=updated_project.description,
            emoji=updated_project.emoji,
            user_id=updated_project.user_id,
            diagram_count=diagram_count,
            created_at=updated_project.created_at,
            updated_at=updated_project.updated_at,
        )

    async def delete_project(self, project_id: str, user_id: str) -> dict:
        """
        Delete a project and all its diagrams.

        Args:
            project_id: Project ID
            user_id: ID of the requesting user

        Returns:
            Success message

        Raises:
            HTTPException: If project not found or user doesn't have access
        """
        project = await self.repository.get_by_id(project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

        if project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this project",
            )

        # Delete all diagrams first
        await self.diagram_repository.delete_by_project_id(project_id)

        # Delete all folders
        await self.folder_repository.delete_by_project_id(project_id)

        # Delete project
        await self.repository.delete(project_id)

        return {"message": "Project deleted successfully"}
