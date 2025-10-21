"""
Abstract interfaces for AI providers repository.
"""
from abc import ABC, abstractmethod
from typing import Optional, List
from .schemas import (
    AIProviderConfig,
    UserAISettingsInDB,
    CreateProviderRequest,
    UpdateProviderRequest,
    AIProviderType
)


class IAIProviderRepository(ABC):
    """Abstract interface for AI provider data access."""

    @abstractmethod
    async def get_user_settings(self, user_id: str) -> Optional[UserAISettingsInDB]:
        """
        Get user's AI settings.

        Args:
            user_id: User ID

        Returns:
            User AI settings or None if not found
        """
        pass

    @abstractmethod
    async def create_user_settings(self, user_id: str) -> UserAISettingsInDB:
        """
        Create default AI settings for user.

        Args:
            user_id: User ID

        Returns:
            Created user AI settings
        """
        pass

    @abstractmethod
    async def add_provider(
        self,
        user_id: str,
        provider_data: AIProviderConfig
    ) -> UserAISettingsInDB:
        """
        Add a new AI provider configuration.

        Args:
            user_id: User ID
            provider_data: Provider configuration

        Returns:
            Updated user AI settings
        """
        pass

    @abstractmethod
    async def update_provider(
        self,
        user_id: str,
        provider_index: int,
        provider_data: AIProviderConfig
    ) -> UserAISettingsInDB:
        """
        Update existing provider configuration.

        Args:
            user_id: User ID
            provider_index: Index of provider in list
            provider_data: Updated provider configuration

        Returns:
            Updated user AI settings
        """
        pass

    @abstractmethod
    async def remove_provider(
        self,
        user_id: str,
        provider_index: int
    ) -> UserAISettingsInDB:
        """
        Remove a provider configuration.

        Args:
            user_id: User ID
            provider_index: Index of provider to remove

        Returns:
            Updated user AI settings
        """
        pass

    @abstractmethod
    async def set_default_provider(
        self,
        user_id: str,
        provider: AIProviderType
    ) -> UserAISettingsInDB:
        """
        Set default provider for user.

        Args:
            user_id: User ID
            provider: Provider type to set as default

        Returns:
            Updated user AI settings
        """
        pass

    @abstractmethod
    async def update_auto_generate(
        self,
        user_id: str,
        auto_generate: bool
    ) -> UserAISettingsInDB:
        """
        Update auto-generate setting.

        Args:
            user_id: User ID
            auto_generate: Auto-generate on save flag

        Returns:
            Updated user AI settings
        """
        pass

    @abstractmethod
    async def get_active_provider(
        self,
        user_id: str,
        provider_type: Optional[AIProviderType] = None
    ) -> Optional[AIProviderConfig]:
        """
        Get active provider configuration.

        Args:
            user_id: User ID
            provider_type: Specific provider type (uses default if None)

        Returns:
            Provider configuration or None
        """
        pass
