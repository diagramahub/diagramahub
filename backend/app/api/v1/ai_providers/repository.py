"""
MongoDB repository implementation for AI providers using Beanie.
"""
from typing import Optional
from datetime import datetime
from beanie import PydanticObjectId
from .interfaces import IAIProviderRepository
from .schemas import (
    AIProviderConfig,
    UserAISettingsInDB,
    AIProviderType
)
from app.core.security import encrypt_api_key, decrypt_api_key


class AIProviderRepository(IAIProviderRepository):
    """MongoDB implementation of AI provider repository using Beanie."""

    async def get_user_settings(self, user_id: str) -> Optional[UserAISettingsInDB]:
        """Get user's AI settings."""
        settings = await UserAISettingsInDB.find_one(
            UserAISettingsInDB.user_id == user_id
        )
        return settings

    async def create_user_settings(self, user_id: str) -> UserAISettingsInDB:
        """Create default AI settings for user."""
        settings = UserAISettingsInDB(
            user_id=user_id,
            providers=[],
            auto_generate_on_save=False,
            default_provider=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        await settings.insert()
        return settings

    async def add_provider(
        self,
        user_id: str,
        provider_data: AIProviderConfig
    ) -> UserAISettingsInDB:
        """Add a new AI provider configuration."""
        # Get or create user settings
        settings = await self.get_user_settings(user_id)
        if not settings:
            settings = await self.create_user_settings(user_id)

        # Encrypt API key before storing
        encrypted_key = encrypt_api_key(provider_data.api_key)
        provider_data.api_key = encrypted_key

        # Add provider to list
        settings.providers.append(provider_data)

        # If this is the first provider or marked as default, set it as default
        if len(settings.providers) == 1 or provider_data.is_default:
            settings.default_provider = provider_data.provider
            # Unset other defaults
            for p in settings.providers[:-1]:
                p.is_default = False
            settings.providers[-1].is_default = True

        settings.updated_at = datetime.utcnow()
        await settings.save()

        return settings

    async def update_provider(
        self,
        user_id: str,
        provider_index: int,
        provider_data: AIProviderConfig
    ) -> UserAISettingsInDB:
        """Update existing provider configuration."""
        settings = await self.get_user_settings(user_id)
        if not settings or provider_index >= len(settings.providers):
            raise ValueError("Provider not found")

        # Encrypt new API key if provided
        if provider_data.api_key:
            encrypted_key = encrypt_api_key(provider_data.api_key)
            provider_data.api_key = encrypted_key

        # Update provider
        settings.providers[provider_index] = provider_data

        # Update default if needed
        if provider_data.is_default:
            settings.default_provider = provider_data.provider
            # Unset other defaults
            for i, p in enumerate(settings.providers):
                if i != provider_index:
                    p.is_default = False

        settings.updated_at = datetime.utcnow()
        await settings.save()

        return settings

    async def remove_provider(
        self,
        user_id: str,
        provider_index: int
    ) -> UserAISettingsInDB:
        """Remove a provider configuration."""
        settings = await self.get_user_settings(user_id)
        if not settings or provider_index >= len(settings.providers):
            raise ValueError("Provider not found")

        removed_provider = settings.providers.pop(provider_index)

        # If removed provider was default, set new default
        if removed_provider.is_default and len(settings.providers) > 0:
            settings.providers[0].is_default = True
            settings.default_provider = settings.providers[0].provider
        elif len(settings.providers) == 0:
            settings.default_provider = None

        settings.updated_at = datetime.utcnow()
        await settings.save()

        return settings

    async def set_default_provider(
        self,
        user_id: str,
        provider: AIProviderType
    ) -> UserAISettingsInDB:
        """Set default provider for user."""
        settings = await self.get_user_settings(user_id)
        if not settings:
            raise ValueError("User settings not found")

        # Find and set the provider as default
        found = False
        for p in settings.providers:
            if p.provider == provider:
                p.is_default = True
                found = True
            else:
                p.is_default = False

        if not found:
            raise ValueError(f"Provider {provider} not configured for user")

        settings.default_provider = provider
        settings.updated_at = datetime.utcnow()
        await settings.save()

        return settings

    async def update_auto_generate(
        self,
        user_id: str,
        auto_generate: bool
    ) -> UserAISettingsInDB:
        """Update auto-generate setting."""
        settings = await self.get_user_settings(user_id)
        if not settings:
            settings = await self.create_user_settings(user_id)

        settings.auto_generate_on_save = auto_generate
        settings.updated_at = datetime.utcnow()
        await settings.save()

        return settings

    async def get_active_provider(
        self,
        user_id: str,
        provider_type: Optional[AIProviderType] = None
    ) -> Optional[AIProviderConfig]:
        """
        Get active provider configuration.

        Returns provider with decrypted API key.
        """
        settings = await self.get_user_settings(user_id)
        if not settings or not settings.providers:
            return None

        # Find the requested provider or use default
        target_provider = provider_type or settings.default_provider
        if not target_provider:
            return None

        for provider in settings.providers:
            if provider.provider == target_provider and provider.is_active:
                # Decrypt API key before returning
                decrypted_provider = provider.model_copy()
                decrypted_provider.api_key = decrypt_api_key(provider.api_key)
                return decrypted_provider

        return None
