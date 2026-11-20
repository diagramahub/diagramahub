"""
Abstract repository for the community portal (Dependency Inversion).
"""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional

from .schemas import (
    CommunityCommentInDB,
    CommunityForkInDB,
    CommunityReportInDB,
    PublishedDiagramInDB,
)


class ICommunityRepository(ABC):
    """Data access for publications, stars, comments and reports."""

    # Publications
    @abstractmethod
    async def create_publication(self, publication: PublishedDiagramInDB) -> PublishedDiagramInDB:
        pass

    @abstractmethod
    async def get_publication(self, publication_id: str) -> Optional[PublishedDiagramInDB]:
        pass

    @abstractmethod
    async def get_by_source(self, source_diagram_id: str) -> Optional[PublishedDiagramInDB]:
        pass

    @abstractmethod
    async def set_fields(self, publication_id: str, fields: dict) -> None:
        """Set only these fields, leaving counters changed meanwhile untouched."""
        pass

    @abstractmethod
    async def delete_publication(self, publication_id: str) -> None:
        """Delete a publication with its stars, comments and reports."""
        pass

    @abstractmethod
    async def search_publications(
        self,
        *,
        text: Optional[str],
        category: Optional[str],
        diagram_type: Optional[str],
        only_ids: Optional[list[str]],
        owner_id: Optional[str],
        featured: bool,
        include_hidden: bool,
        sort: str,
        skip: int,
        limit: int,
    ) -> tuple[list[PublishedDiagramInDB], int]:
        """Matching publications for a page, and the total count."""
        pass

    @abstractmethod
    async def list_by_owner(self, owner_id: str, limit: int) -> list[PublishedDiagramInDB]:
        pass

    @abstractmethod
    async def count_published_since(self, owner_id: str, since: datetime) -> int:
        """Publications of the owner made at or after ``since``."""
        pass

    @abstractmethod
    async def published_sources(self, owner_id: str) -> list[tuple[str, str, bool]]:
        """(source diagram id, publication id, hidden) of every publication of the owner."""
        pass

    @abstractmethod
    async def owner_totals(self, owner_id: str) -> dict[str, int]:
        """Sum of the owner's publications and their counters:
        ``publications``, ``stars``, ``forks``, ``views``, ``comments``."""

    @abstractmethod
    async def count_stars_since(self, publication_ids: list[str], since: datetime) -> int:
        """Stars given to these publications from ``since`` on."""

    @abstractmethod
    async def increment(self, publication_id: str, field: str, amount: int = 1) -> None:
        """Atomically change a counter (stars_count, forks_count, ...)."""
        pass

    # Stars
    @abstractmethod
    async def add_star(self, publication_id: str, user_id: str) -> bool:
        """Star; False when it was already starred."""
        pass

    @abstractmethod
    async def remove_star(self, publication_id: str, user_id: str) -> bool:
        """Unstar; False when it wasn't starred."""
        pass

    @abstractmethod
    async def starred_ids(
        self, user_id: str, publication_ids: Optional[list[str]] = None
    ) -> set[str]:
        """Which of these publications (or all) the user starred."""
        pass

    # Forks
    @abstractmethod
    async def add_fork(self, fork: CommunityForkInDB) -> CommunityForkInDB:
        """Record a fork (the copy's diagram id is unique)."""
        pass

    @abstractmethod
    async def get_fork_by_diagram(self, diagram_id: str) -> Optional[CommunityForkInDB]:
        """The fork a diagram came from, if it is one."""
        pass

    # Comments
    @abstractmethod
    async def add_comment(self, comment: CommunityCommentInDB) -> CommunityCommentInDB:
        pass

    @abstractmethod
    async def get_comment(self, comment_id: str) -> Optional[CommunityCommentInDB]:
        pass

    @abstractmethod
    async def list_comments(self, publication_id: str) -> list[CommunityCommentInDB]:
        """Visible comments, oldest first."""
        pass

    @abstractmethod
    async def delete_comment(self, comment_id: str) -> int:
        """Delete a comment and its replies; returns how many were deleted."""
        pass

    @abstractmethod
    async def set_comment_hidden(self, comment_id: str, hidden: bool) -> None:
        pass

    # Reports
    @abstractmethod
    async def add_report(self, report: CommunityReportInDB) -> bool:
        """Store a report; False when this reporter already reported the target."""
        pass

    @abstractmethod
    async def open_reports(self, limit: int) -> list[CommunityReportInDB]:
        pass

    @abstractmethod
    async def resolve_reports(self, target_type: str, target_id: str) -> None:
        pass

    @abstractmethod
    async def count_open_reports(self, target_type: str, target_id: str) -> int:
        pass

    # Account deletion
    @abstractmethod
    async def delete_user_data(self, user_id: str) -> None:
        """Delete the user's publications (with their data), stars, comments, reports and fork records."""
        pass
