"""
Abstract interfaces for project repository.
Follows the Dependency Inversion Principle (SOLID).
"""
from abc import ABC, abstractmethod
from typing import Optional
from .schemas import ProjectInDB, ProjectCreate, ProjectUpdate, DiagramInDB, DiagramCreate, DiagramUpdate


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


class IDiagramRepository(ABC):
    """Abstract interface for diagram data access."""

    @abstractmethod
    async def create(self, diagram_data: DiagramCreate, project_id: str) -> DiagramInDB:
        """Create a new diagram."""
        pass

    @abstractmethod
    async def get_by_id(self, diagram_id: str) -> Optional[DiagramInDB]:
        """Get diagram by ID."""
        pass

    @abstractmethod
    async def get_by_project_id(self, project_id: str) -> list[DiagramInDB]:
        """Get all diagrams for a project."""
        pass

    @abstractmethod
    async def update(self, diagram_id: str, diagram_data: DiagramUpdate) -> Optional[DiagramInDB]:
        """Update diagram."""
        pass

    @abstractmethod
    async def delete(self, diagram_id: str) -> bool:
        """Delete diagram."""
        pass
