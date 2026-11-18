"""
Abstract interfaces for the activity repository.
Follows the Dependency Inversion Principle (SOLID).
"""

from abc import ABC, abstractmethod
from datetime import datetime


class IActivityRepository(ABC):
    """Where the hours a user worked on each diagram are kept."""

    @abstractmethod
    async def record(self, user_id: str, diagram_id: str, at: datetime) -> None:
        """Note that the user worked on the diagram at ``at`` (naive UTC)."""

    @abstractmethod
    async def since(self, user_id: str, start: datetime) -> list[tuple[str, datetime]]:
        """``(diagram_id, hour)`` pairs of the user from ``start`` on (naive UTC)."""

    @abstractmethod
    async def delete_by_user_id(self, user_id: str) -> int:
        """Forget the user's activity (account deletion)."""
