"""
User repository interface following Dependency Inversion Principle.
"""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional

from app.api.v1.users.schemas import UserCreate, UserInDB, UserUpdate


class IUserRepository(ABC):
    """Interface for user repository operations."""

    @abstractmethod
    async def create(self, user_data: UserCreate) -> UserInDB:
        """Create a new user."""
        pass

    @abstractmethod
    async def get_by_email(self, email: str) -> Optional[UserInDB]:
        """Get user by email."""
        pass

    @abstractmethod
    async def get_by_id(self, user_id: str) -> Optional[UserInDB]:
        """Get user by ID."""
        pass

    @abstractmethod
    async def update(self, user_id: str, user_data: UserUpdate) -> Optional[UserInDB]:
        """Update user information."""
        pass

    @abstractmethod
    async def count_users(self) -> int:
        """Count total number of users in database."""
        pass

    @abstractmethod
    async def update_profile(self, user_id: str, user_data: UserUpdate) -> Optional[UserInDB]:
        """Update user profile (full_name, profile_picture)."""
        pass

    @abstractmethod
    async def update_password(self, user_id: str, hashed_password: str) -> bool:
        """Update user password."""
        pass

    @abstractmethod
    async def save_reset_token(self, email: str, token: str, expires_at: float) -> bool:
        """Save password reset token."""
        pass

    @abstractmethod
    async def verify_reset_token(self, email: str, token: str) -> bool:
        """Verify password reset token."""
        pass

    @abstractmethod
    async def clear_reset_token(self, email: str) -> bool:
        """Clear password reset token."""
        pass

    @abstractmethod
    async def update_last_login(self, user_id: str, last_login_at: datetime | None = None) -> bool:
        """Update the user's last successful login timestamp."""
        pass

    @abstractmethod
    async def count_admins(self) -> int:
        """Count the number of admin users in the database."""
        pass

    @abstractmethod
    async def delete_by_id(self, user_id: str) -> bool:
        """Delete a user document by ID. Returns True on success."""
        pass

    @abstractmethod
    async def list_all(self) -> list[UserInDB]:
        """Return all users (used by admin and migration tooling)."""
        pass
