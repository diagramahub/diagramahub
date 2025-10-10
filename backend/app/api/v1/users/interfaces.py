"""
User repository interface following Dependency Inversion Principle.
"""
from abc import ABC, abstractmethod
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
