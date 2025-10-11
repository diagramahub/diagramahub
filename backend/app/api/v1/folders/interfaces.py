"""
Abstract interfaces for folder repository.
Follows the Dependency Inversion Principle (SOLID).
"""
from abc import ABC, abstractmethod
from typing import Optional
from .schemas import FolderInDB, FolderCreate, FolderUpdate


class IFolderRepository(ABC):
    """Abstract interface for folder data access."""

    @abstractmethod
    async def create(self, folder_data: FolderCreate, project_id: str) -> FolderInDB:
        """Create a new folder."""
        pass

    @abstractmethod
    async def get_by_id(self, folder_id: str) -> Optional[FolderInDB]:
        """Get folder by ID."""
        pass

    @abstractmethod
    async def get_by_project_id(self, project_id: str) -> list[FolderInDB]:
        """Get all folders for a project."""
        pass

    @abstractmethod
    async def update(self, folder_id: str, folder_data: FolderUpdate) -> Optional[FolderInDB]:
        """Update folder."""
        pass

    @abstractmethod
    async def delete(self, folder_id: str) -> bool:
        """Delete folder."""
        pass
