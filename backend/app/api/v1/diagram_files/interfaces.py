"""
Abstract interface for the storage of diagram files.
Follows the Dependency Inversion Principle (SOLID).
"""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional

from .schemas import DiagramFileInDB, DiagramFileMeta, FileScope


class IDiagramFileRepository(ABC):
    """Abstract interface for diagram file data access."""

    @abstractmethod
    async def get(self, scope: FileScope, scope_id: str, file_id: str) -> Optional[DiagramFileInDB]:
        """A file of a scope, with its bytes (None when missing)."""

    @abstractmethod
    async def get_meta(
        self, scope: FileScope, scope_id: str, file_id: str
    ) -> Optional[DiagramFileMeta]:
        """A file of a scope without its bytes (None when missing)."""

    @abstractmethod
    async def create(self, file: DiagramFileInDB) -> tuple[DiagramFileMeta, bool]:
        """Store a file; when it already exists in its scope, keep it.

        Returns:
            The stored file's metadata and whether it was created now.
        """

    @abstractmethod
    async def get_many(
        self, scope: FileScope, scope_id: str, file_ids: list[str]
    ) -> list[DiagramFileInDB]:
        """These files of a scope, with their bytes (missing ones are left out)."""

    @abstractmethod
    async def list_meta(self, scope: FileScope, scope_id: str) -> list[DiagramFileMeta]:
        """Every file of a scope, without bytes."""

    @abstractmethod
    async def count(self, scope: FileScope, scope_id: str) -> int:
        """How many files a scope has."""

    @abstractmethod
    async def copy(
        self,
        source_scope: FileScope,
        source_id: str,
        target_scope: FileScope,
        target_id: str,
        owner_id: str,
        file_ids: list[str],
    ) -> None:
        """Copy these files of one scope into another (those already there are kept)."""

    @abstractmethod
    async def delete_files(
        self,
        scope: FileScope,
        scope_id: str,
        file_ids: list[str],
        created_before: Optional[datetime] = None,
    ) -> int:
        """Delete some files of a scope (only those stored before ``created_before``,
        when given); returns how many were deleted."""

    @abstractmethod
    async def delete_scopes(self, scope: FileScope, scope_ids: list[str]) -> int:
        """Delete every file of these scopes; returns how many were deleted."""

    @abstractmethod
    async def delete_by_owner(self, owner_id: str) -> int:
        """Delete every file a user owns (account deletion)."""
