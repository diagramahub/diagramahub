"""
Business logic layer for AI providers.
"""
from typing import Optional
from fastapi import HTTPException, status
from .interfaces import IAIProviderRepository
from .schemas import (
    AIProviderConfig,
    AIProviderType,
    UserAISettingsInDB,
    GenerateDescriptionRequest,
    GenerateDescriptionResponse,
    GenerateDiagramRequest,
    GenerateDiagramResponse,
    ImproveDiagramRequest,
    ImproveDiagramResponse,
    AIProviderResponse,
    UserAISettingsResponse
)
from .clients.factory import AIClientFactory
from .clients.base import BaseAIClient
from app.core.security import mask_api_key


class AIProviderService:
    """Service for AI provider business logic."""

    def __init__(self, repository: IAIProviderRepository):
        self.repository = repository

    async def get_user_settings(self, user_id: str) -> UserAISettingsResponse:
        """
        Get user's AI settings.

        Args:
            user_id: User ID

        Returns:
            User AI settings with masked API keys
        """
        settings = await self.repository.get_user_settings(user_id)
        if not settings:
            # Create default settings if they don't exist
            settings = await self.repository.create_user_settings(user_id)

        # Mask API keys before returning
        masked_providers = []
        for provider in settings.providers:
            provider_dict = provider.model_dump()
            provider_dict["api_key"] = mask_api_key(provider.api_key)
            masked_providers.append(AIProviderResponse(**provider_dict))

        return UserAISettingsResponse(
            user_id=settings.user_id,
            providers=masked_providers,
            auto_generate_on_save=settings.auto_generate_on_save,
            default_provider=settings.default_provider,
            created_at=settings.created_at,
            updated_at=settings.updated_at
        )

    async def add_provider(
        self,
        user_id: str,
        provider_data: AIProviderConfig
    ) -> UserAISettingsResponse:
        """
        Add a new AI provider configuration.

        Validates the API key before saving.

        Args:
            user_id: User ID
            provider_data: Provider configuration

        Returns:
            Updated user settings

        Raises:
            HTTPException: If API key validation fails
        """
        # Validate API key before saving
        try:
            client = AIClientFactory.create_client(
                provider=provider_data.provider,
                api_key=provider_data.api_key,
                model=provider_data.model,
                parameters=provider_data.parameters
            )
            is_valid = await client.validate_api_key()
            if not is_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid API key for {provider_data.provider}"
                )
        except NotImplementedError:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail=f"Provider {provider_data.provider} is not yet supported"
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )

        # Save provider configuration (repository will encrypt the key)
        settings = await self.repository.add_provider(user_id, provider_data)

        # Return settings with masked API keys
        return await self.get_user_settings(user_id)

    async def update_provider(
        self,
        user_id: str,
        provider_index: int,
        provider_data: AIProviderConfig
    ) -> UserAISettingsResponse:
        """
        Update existing provider configuration.

        Args:
            user_id: User ID
            provider_index: Index of provider to update
            provider_data: Updated provider configuration

        Returns:
            Updated user settings

        Raises:
            HTTPException: If provider not found or validation fails
        """
        # If API key is provided, validate it
        if provider_data.api_key:
            try:
                client = AIClientFactory.create_client(
                    provider=provider_data.provider,
                    api_key=provider_data.api_key,
                    model=provider_data.model,
                    parameters=provider_data.parameters
                )
                is_valid = await client.validate_api_key()
                if not is_valid:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid API key for {provider_data.provider}"
                    )
            except NotImplementedError:
                raise HTTPException(
                    status_code=status.HTTP_501_NOT_IMPLEMENTED,
                    detail=f"Provider {provider_data.provider} is not yet supported"
                )

        try:
            settings = await self.repository.update_provider(
                user_id, provider_index, provider_data
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )

        return await self.get_user_settings(user_id)

    async def remove_provider(
        self,
        user_id: str,
        provider_index: int
    ) -> UserAISettingsResponse:
        """
        Remove a provider configuration.

        Args:
            user_id: User ID
            provider_index: Index of provider to remove

        Returns:
            Updated user settings

        Raises:
            HTTPException: If provider not found
        """
        try:
            settings = await self.repository.remove_provider(user_id, provider_index)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )

        return await self.get_user_settings(user_id)

    async def set_default_provider(
        self,
        user_id: str,
        provider: AIProviderType
    ) -> UserAISettingsResponse:
        """
        Set default provider for user.

        Args:
            user_id: User ID
            provider: Provider type

        Returns:
            Updated user settings

        Raises:
            HTTPException: If provider not configured
        """
        try:
            settings = await self.repository.set_default_provider(user_id, provider)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )

        return await self.get_user_settings(user_id)

    async def update_auto_generate(
        self,
        user_id: str,
        auto_generate: bool
    ) -> UserAISettingsResponse:
        """
        Update auto-generate setting.

        Args:
            user_id: User ID
            auto_generate: Whether to auto-generate on save

        Returns:
            Updated user settings
        """
        settings = await self.repository.update_auto_generate(user_id, auto_generate)
        return await self.get_user_settings(user_id)

    async def generate_description(
        self,
        user_id: str,
        request: GenerateDescriptionRequest
    ) -> GenerateDescriptionResponse:
        """
        Generate diagram description using AI.

        Args:
            user_id: User ID
            request: Generation request with diagram code and type

        Returns:
            Generated description

        Raises:
            HTTPException: If no provider configured or generation fails
        """
        # Get active provider configuration
        provider_config = await self.repository.get_active_provider(
            user_id, request.provider
        )

        if not provider_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active AI provider configured. Please add an API key in settings."
            )

        # Create AI client
        try:
            client = AIClientFactory.create_client(
                provider=provider_config.provider,
                api_key=provider_config.api_key,  # Already decrypted by repository
                model=provider_config.model,
                parameters=provider_config.parameters
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        except NotImplementedError:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail=f"Provider {provider_config.provider} is not yet supported"
            )

        # Generate description
        try:
            description = await client.generate_description(
                diagram_code=request.diagram_code,
                diagram_type=request.diagram_type,
                language=request.language
            )

            return GenerateDescriptionResponse(
                description=description,
                provider_used=provider_config.provider,
                model_used=provider_config.model
            )

        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error generating description: {str(e)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Unexpected error: {str(e)}"
            )

    async def test_provider(
        self,
        provider: AIProviderType,
        api_key: str,
        model: str
    ) -> bool:
        """
        Test if API key is valid for a provider.

        Args:
            provider: Provider type
            api_key: API key to test
            model: Model name

        Returns:
            True if valid, False otherwise
        """
        try:
            client = AIClientFactory.create_client(
                provider=provider,
                api_key=api_key,
                model=model,
                parameters={}
            )
            return await client.validate_api_key()
        except NotImplementedError:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail=f"Provider {provider} is not yet supported"
            )
        except Exception:
            return False

    async def generate_diagram(
        self,
        user_id: str,
        request: GenerateDiagramRequest
    ) -> GenerateDiagramResponse:
        """
        Generate diagram code from a description using AI.

        Args:
            user_id: User ID
            request: Generation request with description

        Returns:
            Generated diagram code

        Raises:
            HTTPException: If no provider configured or generation fails
        """
        import time

        # Get active provider configuration
        provider_config = await self.repository.get_active_provider(
            user_id, request.provider
        )

        if not provider_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active AI provider configured. Please add an API key in settings."
            )

        # Create AI client
        try:
            client = AIClientFactory.create_client(
                provider=provider_config.provider,
                api_key=provider_config.api_key,  # Already decrypted by repository
                model=provider_config.model,
                parameters=provider_config.parameters
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        except NotImplementedError:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail=f"Provider {provider_config.provider} is not yet supported"
            )

        # Generate diagram
        try:
            start_time = time.time()
            diagram_code = await client.generate_diagram(
                description=request.description,
                diagram_type=request.diagram_type,
                language=request.language
            )
            generation_time = time.time() - start_time

            return GenerateDiagramResponse(
                diagram_code=diagram_code,
                provider_used=provider_config.provider,
                model_used=provider_config.model,
                generation_time=generation_time
            )

        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error generating diagram: {str(e)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Unexpected error: {str(e)}"
            )

    async def improve_diagram(
        self,
        user_id: str,
        request: ImproveDiagramRequest
    ) -> ImproveDiagramResponse:
        """
        Improve an existing diagram based on user's request using AI.

        Args:
            user_id: User ID
            request: Improvement request with diagram code and improvement request

        Returns:
            Improved diagram code

        Raises:
            HTTPException: If no provider configured or improvement fails
        """
        import time

        # Get active provider configuration
        provider_config = await self.repository.get_active_provider(
            user_id, request.provider
        )

        if not provider_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active AI provider configured. Please add an API key in settings."
            )

        # Create AI client
        try:
            client = AIClientFactory.create_client(
                provider=provider_config.provider,
                api_key=provider_config.api_key,  # Already decrypted by repository
                model=provider_config.model,
                parameters=provider_config.parameters
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        except NotImplementedError:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail=f"Provider {provider_config.provider} is not yet supported"
            )

        # Improve diagram
        try:
            start_time = time.time()
            improved_code = await client.improve_diagram(
                diagram_code=request.diagram_code,
                improvement_request=request.improvement_request,
                diagram_type=request.diagram_type,
                language=request.language
            )
            generation_time = time.time() - start_time

            return ImproveDiagramResponse(
                diagram_code=improved_code,
                original_code=request.diagram_code,
                improvement_applied=request.improvement_request,
                provider_used=provider_config.provider,
                model_used=provider_config.model,
                generation_time=generation_time
            )

        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error improving diagram: {str(e)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Unexpected error: {str(e)}"
            )
