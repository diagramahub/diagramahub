"""
Business logic layer for folders.
"""

from fastapi import HTTPException, status
from .interfaces import IFolderRepository
from ..projects.interfaces import IProjectRepository
from ..diagrams.interfaces import IDiagramRepository
from ..diagrams.schemas import diagram_to_response
from .schemas import FolderCreate, FolderUpdate, FolderResponse, FolderWithDiagramsResponse


class FolderService:
    """Service for folder business logic."""

    def __init__(
        self,
        folder_repository: IFolderRepository,
        project_repository: IProjectRepository,
        diagram_repository: IDiagramRepository,
    ):
        """
        Initialize the folder service.

        Args:
            folder_repository: Folder repository
            project_repository: Project repository
            diagram_repository: Diagram repository
        """
        self.folder_repository = folder_repository
        self.project_repository = project_repository
        self.diagram_repository = diagram_repository

    async def create_folder(
        self, folder_data: FolderCreate, project_id: str, user_id: str
    ) -> FolderResponse:
        """
        Create a new folder in a project.

        Args:
            folder_data: Folder creation data
            project_id: Project ID
            user_id: ID of the requesting user

        Returns:
            Created folder

        Raises:
            HTTPException: If project not found or user doesn't have access
        """
        # Verify user has access to the project
        project = await self.project_repository.get_by_id(project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

        if project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this project",
            )

        folder = await self.folder_repository.create(folder_data, project_id)
        return FolderResponse(
            id=str(folder.id),
            name=folder.name,
            color=folder.color,
            project_id=folder.project_id,
            created_at=folder.created_at,
            updated_at=folder.updated_at,
        )

    async def get_folder(self, folder_id: str, user_id: str) -> FolderWithDiagramsResponse:
        """
        Get a folder with its diagrams.

        Args:
            folder_id: Folder ID
            user_id: ID of the requesting user

        Returns:
            Folder data with its diagrams

        Raises:
            HTTPException: If folder not found or user doesn't have access
        """
        folder = await self.folder_repository.get_by_id(folder_id)
        if not folder:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

        # Verify user has access to the project
        project = await self.project_repository.get_by_id(folder.project_id)
        if not project or project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="You don't have access to this folder"
            )

        # Get diagrams in folder
        diagrams = await self.diagram_repository.get_by_folder_id(folder_id, folder.project_id)
        diagram_responses = [diagram_to_response(d) for d in diagrams]

        return FolderWithDiagramsResponse(
            id=str(folder.id),
            name=folder.name,
            color=folder.color,
            project_id=folder.project_id,
            created_at=folder.created_at,
            updated_at=folder.updated_at,
            diagrams=diagram_responses,
        )

    async def update_folder(
        self, folder_id: str, folder_data: FolderUpdate, user_id: str
    ) -> FolderResponse:
        """
        Update a folder.

        Args:
            folder_id: Folder ID
            folder_data: Update data
            user_id: ID of the requesting user

        Returns:
            Updated folder

        Raises:
            HTTPException: If folder not found or user doesn't have access
        """
        folder = await self.folder_repository.get_by_id(folder_id)
        if not folder:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

        # Verify user has access to the project
        project = await self.project_repository.get_by_id(folder.project_id)
        if not project or project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="You don't have access to this folder"
            )

        updated_folder = await self.folder_repository.update(folder_id, folder_data)
        return FolderResponse(
            id=str(updated_folder.id),
            name=updated_folder.name,
            color=updated_folder.color,
            project_id=updated_folder.project_id,
            created_at=updated_folder.created_at,
            updated_at=updated_folder.updated_at,
        )

    async def delete_folder(
        self, folder_id: str, user_id: str, delete_diagrams: bool = False
    ) -> dict:
        """
        Delete a folder.

        If delete_diagrams is True, deletes all its diagrams. Otherwise, moves
        them to the project root.

        Args:
            folder_id: Folder ID
            user_id: ID of the requesting user
            delete_diagrams: If True, delete the folder's diagrams instead of
                moving them to root

        Returns:
            Success message

        Raises:
            HTTPException: If folder not found or user doesn't have access
        """
        folder = await self.folder_repository.get_by_id(folder_id)
        if not folder:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

        # Verify user has access to the project
        project = await self.project_repository.get_by_id(folder.project_id)
        if not project or project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="You don't have access to this folder"
            )

        # Get diagrams in folder
        diagrams = await self.diagram_repository.get_by_folder_id(folder_id, folder.project_id)

        if delete_diagrams:
            # Delete all diagrams in the folder
            await self.diagram_repository.delete_by_folder_id(folder_id, folder.project_id)
        else:
            # Move diagrams to root (set folder_id to None)
            await self.diagram_repository.clear_folder(folder_id, folder.project_id)

        await self.folder_repository.delete(folder_id)

        message = "Folder deleted successfully"
        if delete_diagrams and len(diagrams) > 0:
            message = f"Folder and {len(diagrams)} diagram(s) deleted successfully"

        return {"message": message}
