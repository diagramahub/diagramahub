"""
Abstract interfaces for project repository.
Follows the Dependency Inversion Principle (SOLID).
"""
from abc import ABC, abstractmethod
from typing import Optional
from .schemas import ProjectInDB, ProjectCreate, ProjectUpdate


class IProjectRepository(ABC):
    """Abstract interface for project data access."""

    @abstractmethod
    async def create(self, project_data: ProjectCreate, user_id: str) -> ProjectInDB:
        """Create a new project."""
        pass

    @abstractmethod
    async def get_by_id(self, project_id: str) -> Optional[ProjectInDB]:
        """Get project by ID."""
        pass

    @abstractmethod
    async def get_by_user_id(self, user_id: str) -> list[ProjectInDB]:
        """Get all projects for a user."""
        pass

    @abstractmethod
    async def update(self, project_id: str, project_data: ProjectUpdate) -> Optional[ProjectInDB]:
        """Update project."""
        pass

    @abstractmethod
    async def delete(self, project_id: str) -> bool:
        """Delete project."""
        pass
