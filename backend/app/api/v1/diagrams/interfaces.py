"""
Abstract interfaces for diagram repository.
Follows the Dependency Inversion Principle (SOLID).
"""
from abc import ABC, abstractmethod
from typing import Optional
from .schemas import DiagramInDB, DiagramCreate, DiagramUpdate


class IDiagramRepository(ABC):
    """Abstract interface for diagram data access."""

    @abstractmethod
    async def create(self, diagram_data: DiagramCreate, project_id: str) -> DiagramInDB:
        """Create a new diagram."""
        pass

    @abstractmethod
    async def duplicate(self, source: DiagramInDB, new_title: str) -> DiagramInDB:
        """Duplicate a diagram into the same project and folder with a new title."""
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
    async def get_by_folder_id(self, folder_id: str) -> list[DiagramInDB]:
        """Get all diagrams for a folder."""
        pass

    @abstractmethod
    async def get_without_folder(self, project_id: str) -> list[DiagramInDB]:
        """Get all diagrams without a folder for a project."""
        pass

    @abstractmethod
    async def move(self, diagram_id: str, target_project_id: str) -> Optional[DiagramInDB]:
        """Move a diagram to another project and remove its folder assignment."""
        pass

    @abstractmethod
    async def update(self, diagram_id: str, diagram_data: DiagramUpdate) -> Optional[DiagramInDB]:
        """Update diagram."""
        pass

    @abstractmethod
    async def delete(self, diagram_id: str) -> bool:
        """Delete diagram."""
        pass
