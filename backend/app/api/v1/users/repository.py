"""
User repository implementation using Beanie ODM.
"""
import time
from typing import Optional

from app.api.v1.users.interfaces import IUserRepository
from app.api.v1.users.schemas import UserCreate, UserInDB, UserUpdate
from app.core.security import get_password_hash


class UserRepository(IUserRepository):
    """Concrete implementation of user repository using MongoDB."""

    async def create(self, user_data: UserCreate) -> UserInDB:
        """Create a new user in the database."""
        user = UserInDB(
            email=user_data.email,
            hashed_password=get_password_hash(user_data.password),
            full_name=user_data.full_name,
            is_active=user_data.is_active,
        )
        await user.insert()
        return user

    async def get_by_email(self, email: str) -> Optional[UserInDB]:
        """Retrieve user by email address."""
        return await UserInDB.find_one(UserInDB.email == email)

    async def get_by_id(self, user_id: str) -> Optional[UserInDB]:
        """Retrieve user by ID."""
        return await UserInDB.get(user_id)

    async def update(self, user_id: str, user_data: UserUpdate) -> Optional[UserInDB]:
        """Update user information."""
        user = await self.get_by_id(user_id)
        if not user:
            return None

        update_data = user_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)

        await user.save()
        return user

    async def update_password(self, user_id: str, hashed_password: str) -> bool:
        """Update user password."""
        user = await self.get_by_id(user_id)
        if not user:
            return False

        user.hashed_password = hashed_password
        await user.save()
        return True

    async def save_reset_token(self, email: str, token: str, expires_at: float) -> bool:
        """Save password reset token for user."""
        user = await self.get_by_email(email)
        if not user:
            return False

        user.reset_token = token
        user.reset_token_expires = expires_at
        await user.save()
        return True

    async def verify_reset_token(self, email: str, token: str) -> bool:
        """Verify if reset token is valid and not expired."""
        user = await self.get_by_email(email)
        if not user or not user.reset_token or not user.reset_token_expires:
            return False

        if user.reset_token != token:
            return False

        if time.time() > user.reset_token_expires:
            return False

        return True

    async def clear_reset_token(self, email: str) -> bool:
        """Clear password reset token after use."""
        user = await self.get_by_email(email)
        if not user:
            return False

        user.reset_token = None
        user.reset_token_expires = None
        await user.save()
        return True

    async def update_profile(self, user_id: str, user_data: UserUpdate) -> Optional[UserInDB]:
        """Update user profile (full_name, profile_picture)."""
        user = await self.get_by_id(user_id)
        if not user:
            return None

        update_data = user_data.model_dump(exclude_unset=True)
        if update_data:
            for field, value in update_data.items():
                if field != 'email':  # Prevent email updates
                    setattr(user, field, value)
            await user.save()

        return user
