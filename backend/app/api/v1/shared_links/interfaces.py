"""
Abstract interfaces for shared link repository.
Follows the Dependency Inversion Principle (SOLID).
"""
from abc import ABC, abstractmethod
from typing import Optional

from .schemas import (
    SharedLinkInDB,
    SharedLinkCreate,
    SharedLinkUpdate,
    AccessLogCreate,
    AccessLogInDB,
)


class ISharedLinkRepository(ABC):
    """Abstract interface for shared link data access."""

    @abstractmethod
    async def create(self, link_data: SharedLinkCreate) -> SharedLinkInDB:
        """Create a new shared link."""
        pass

    @abstractmethod
    async def get_by_token(self, token: str) -> Optional[SharedLinkInDB]:
        """Get shared link by token."""
        pass

    @abstractmethod
    async def get_active_by_diagram(self, diagram_id: str) -> Optional[SharedLinkInDB]:
        """Get the active shared link for a diagram."""
        pass

    @abstractmethod
    async def update(self, link_id: str, update_data: SharedLinkUpdate) -> Optional[SharedLinkInDB]:
        """Update shared link configuration."""
        pass

    @abstractmethod
    async def revoke(self, link_id: str) -> bool:
        """Revoke (deactivate) a shared link."""
        pass

    @abstractmethod
    async def log_access(self, log_data: AccessLogCreate) -> AccessLogInDB:
        """Log an access attempt to a shared link."""
        pass

    @abstractmethod
    async def count_failed_attempts(self, ip_hash: str, token: str, minutes: int) -> int:
        """Count failed access attempts by IP hash and token within a time window."""
        pass
