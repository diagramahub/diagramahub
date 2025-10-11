"""
Business logic layer for projects and diagrams.
"""
from fastapi import HTTPException, status
from .interfaces import IProjectRepository, IDiagramRepository
from .repository import FolderRepository, DiagramRepository
from .schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectWithDiagramsResponse,
    DiagramCreate, DiagramUpdate, DiagramResponse,
    FolderCreate, FolderUpdate, FolderResponse, FolderWithDiagramsResponse
)


class ProjectService:
    """Service for project business logic."""

    def __init__(self, repository: IProjectRepository, diagram_repository: IDiagramRepository, folder_repository: FolderRepository = None):
        self.repository = repository
        self.diagram_repository = diagram_repository
        self.folder_repository = folder_repository or FolderRepository()

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
            user_id=project.user_id,
            created_at=project.created_at,
            updated_at=project.updated_at
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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )

        if project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this project"
            )

        return ProjectResponse(
            id=str(project.id),
            name=project.name,
            description=project.description,
            user_id=project.user_id,
            created_at=project.created_at,
            updated_at=project.updated_at
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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )

        if project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this project"
            )

        # Get diagrams without folder
        diagrams_without_folder = await self.diagram_repository.get_without_folder(project_id)
        diagram_responses = [
            DiagramResponse(
                id=str(d.id),
                title=d.title,
                content=d.content,
                description=d.description,
                diagram_type=d.diagram_type,
                project_id=d.project_id,
                folder_id=d.folder_id,
                created_at=d.created_at,
                updated_at=d.updated_at
            )
            for d in diagrams_without_folder
        ]

        # Get folders with their diagrams
        folders = await self.folder_repository.get_by_project_id(project_id)
        folder_responses = []
        for folder in folders:
            folder_diagrams = await self.diagram_repository.get_by_folder_id(str(folder.id))
            folder_diagram_responses = [
                DiagramResponse(
                    id=str(d.id),
                    title=d.title,
                    content=d.content,
                    description=d.description,
                    diagram_type=d.diagram_type,
                    project_id=d.project_id,
                    folder_id=d.folder_id,
                    created_at=d.created_at,
                    updated_at=d.updated_at
                )
                for d in folder_diagrams
            ]
            folder_responses.append(
                FolderWithDiagramsResponse(
                    id=str(folder.id),
                    name=folder.name,
                    color=folder.color,
                    project_id=folder.project_id,
                    created_at=folder.created_at,
                    updated_at=folder.updated_at,
                    diagrams=folder_diagram_responses
                )
            )

        return ProjectWithDiagramsResponse(
            id=str(project.id),
            name=project.name,
            description=project.description,
            user_id=project.user_id,
            created_at=project.created_at,
            updated_at=project.updated_at,
            diagrams=diagram_responses,
            folders=folder_responses
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
        return [
            ProjectResponse(
                id=str(p.id),
                name=p.name,
                description=p.description,
                user_id=p.user_id,
                created_at=p.created_at,
                updated_at=p.updated_at
            )
            for p in projects
        ]

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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )

        if project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this project"
            )

        updated_project = await self.repository.update(project_id, project_data)
        return ProjectResponse(
            id=str(updated_project.id),
            name=updated_project.name,
            description=updated_project.description,
            user_id=updated_project.user_id,
            created_at=updated_project.created_at,
            updated_at=updated_project.updated_at
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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )

        if project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this project"
            )

        # Delete all diagrams first
        diagrams = await self.diagram_repository.get_by_project_id(project_id)
        for diagram in diagrams:
            await self.diagram_repository.delete(str(diagram.id))

        # Delete project
        await self.repository.delete(project_id)

        return {"message": "Project deleted successfully"}


class DiagramService:
    """Service for diagram business logic."""

    def __init__(
        self,
        diagram_repository: IDiagramRepository,
        project_repository: IProjectRepository
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


class FolderService:
    """Service for folder business logic."""

    def __init__(self, folder_repository: FolderRepository, project_repository: IProjectRepository, diagram_repository: IDiagramRepository):
        self.folder_repository = folder_repository
        self.project_repository = project_repository
        self.diagram_repository = diagram_repository

    async def create_folder(self, folder_data: FolderCreate, project_id: str, user_id: str) -> FolderResponse:
        """Create a new folder in a project."""
        # Verify user has access to the project
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

        folder = await self.folder_repository.create(folder_data, project_id)
        return FolderResponse(
            id=str(folder.id),
            name=folder.name,
            color=folder.color,
            project_id=folder.project_id,
            created_at=folder.created_at,
            updated_at=folder.updated_at
        )

    async def get_folder(self, folder_id: str, user_id: str) -> FolderWithDiagramsResponse:
        """Get a folder with its diagrams."""
        folder = await self.folder_repository.get_by_id(folder_id)
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Folder not found"
            )

        # Verify user has access to the project
        project = await self.project_repository.get_by_id(folder.project_id)
        if not project or project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this folder"
            )

        # Get diagrams in folder
        diagrams = await self.diagram_repository.get_by_folder_id(folder_id)
        diagram_responses = [
            DiagramResponse(
                id=str(d.id),
                title=d.title,
                content=d.content,
                description=d.description,
                diagram_type=d.diagram_type,
                project_id=d.project_id,
                folder_id=d.folder_id,
                created_at=d.created_at,
                updated_at=d.updated_at
            )
            for d in diagrams
        ]

        return FolderWithDiagramsResponse(
            id=str(folder.id),
            name=folder.name,
            color=folder.color,
            project_id=folder.project_id,
            created_at=folder.created_at,
            updated_at=folder.updated_at,
            diagrams=diagram_responses
        )

    async def update_folder(self, folder_id: str, folder_data: FolderUpdate, user_id: str) -> FolderResponse:
        """Update a folder."""
        folder = await self.folder_repository.get_by_id(folder_id)
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Folder not found"
            )

        # Verify user has access to the project
        project = await self.project_repository.get_by_id(folder.project_id)
        if not project or project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this folder"
            )

        updated_folder = await self.folder_repository.update(folder_id, folder_data)
        return FolderResponse(
            id=str(updated_folder.id),
            name=updated_folder.name,
            color=updated_folder.color,
            project_id=updated_folder.project_id,
            created_at=updated_folder.created_at,
            updated_at=updated_folder.updated_at
        )

    async def delete_folder(self, folder_id: str, user_id: str) -> dict:
        """Delete a folder and move its diagrams to root."""
        folder = await self.folder_repository.get_by_id(folder_id)
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Folder not found"
            )

        # Verify user has access to the project
        project = await self.project_repository.get_by_id(folder.project_id)
        if not project or project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this folder"
            )

        # Move diagrams to root (set folder_id to None)
        diagrams = await self.diagram_repository.get_by_folder_id(folder_id)
        for diagram in diagrams:
            await self.diagram_repository.update(str(diagram.id), DiagramUpdate(folder_id=None))

        await self.folder_repository.delete(folder_id)
        return {"message": "Folder deleted successfully"}
