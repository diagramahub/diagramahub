"""
Abstract interfaces for diagram repository.
Follows the Dependency Inversion Principle (SOLID).
"""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional
from .schemas import DiagramInDB, DiagramCreate, DiagramSearchHit, DiagramSummary, DiagramUpdate


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
    async def get_by_ids(self, diagram_ids: list[str]) -> list[DiagramInDB]:
        """The diagrams that exist among these IDs (invalid IDs are skipped)."""
        pass

    @abstractmethod
    async def get_by_project_id(self, project_id: str) -> list[DiagramInDB]:
        """Get all diagrams for a project."""
        pass

    @abstractmethod
    async def count_by_project_ids(self, project_ids: list[str]) -> int:
        """Number of diagrams across projects (counted in the database)."""
        pass

    @abstractmethod
    async def type_counts_by_project(self, project_ids: list[str]) -> dict[str, dict[str, int]]:
        """``{project_id: {diagram_type: count}}`` computed in the database."""
        pass

    @abstractmethod
    async def get_recent_by_project_ids(
        self, project_ids: list[str], limit: int
    ) -> list[DiagramSummary]:
        """Most recently updated diagrams across projects, newest first (summary fields only)."""
        pass

    @abstractmethod
    async def get_favorites_by_project_ids(
        self, project_ids: list[str], limit: int
    ) -> tuple[list[DiagramSummary], int]:
        """Starred diagrams across projects, most recently updated first, and their count."""
        pass

    @abstractmethod
    async def set_favorite(self, diagram_id: str, favorite: bool) -> None:
        """Star or unstar a diagram without touching ``updated_at``."""
        pass

    @abstractmethod
    async def touched_since(
        self, project_ids: list[str], since: datetime
    ) -> list[tuple[str, datetime, Optional[datetime]]]:
        """``(id, created_at, updated_at)`` of the diagrams created or updated since ``since``."""
        pass

    @abstractmethod
    async def search(
        self,
        project_ids: list[str],
        text: str,
        diagram_type: Optional[str],
        limit: int,
    ) -> list[DiagramSearchHit]:
        """Diagrams of these projects whose title, description or content contains ``text``
        (case-insensitive), optionally of one type, most recently updated first."""
        pass

    @abstractmethod
    async def get_by_folder_id(self, folder_id: str, project_id: str) -> list[DiagramInDB]:
        """Get the diagrams of a folder, scoped to the folder's project."""
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

    @abstractmethod
    async def delete_by_project_id(self, project_id: str) -> int:
        """Delete all diagrams for a project."""
        pass

    @abstractmethod
    async def delete_by_folder_id(self, folder_id: str, project_id: str) -> int:
        """Delete the diagrams of a folder, scoped to the folder's project."""
        pass

    @abstractmethod
    async def clear_folder(self, folder_id: str, project_id: str) -> int:
        """Move the diagrams of a folder to the project root, scoped to the folder's project."""
        pass
