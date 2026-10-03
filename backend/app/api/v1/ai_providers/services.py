"""
Business logic layer for AI providers.
"""

from typing import Optional
from fastapi import HTTPException, status
from .interfaces import IAIProviderRepository
from .schemas import (
    AIProviderConfig,
    AIProviderType,
    GenerateDescriptionRequest,
    GenerateDescriptionResponse,
    RefineDescriptionRequest,
    RefineDescriptionResponse,
    GenerateDiagramRequest,
    GenerateDiagramResponse,
    ImproveDiagramRequest,
    ImproveDiagramResponse,
    AIProviderResponse,
    UserAISettingsResponse,
    UpdateProviderRequest,
    TestProviderResponse,
)
from .clients.base import EmptyResponseError, TruncatedResponseError
from .clients.factory import AIClientFactory
from .clients.base import BaseAIClient
from app.core.security import mask_api_key


import re


def _strip_think_tags(text: str) -> str:
    """Remove <think>...</think> chain-of-thought tags from AI responses (DeepSeek, MiniMax)."""
    text = re.sub(r"<think>.*?</think>\s*", "", text, flags=re.DOTALL)
    # Handle unclosed <think> tag (truncated response)
    if "<think>" in text:
        text = text[: text.index("<think>")].strip()
    return text.strip()


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
            updated_at=settings.updated_at,
        )

    async def add_provider(
        self, user_id: str, provider_data: AIProviderConfig
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
        # Ensure API key is provided for new providers
        if not provider_data.api_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="API key is required when adding a new provider",
            )

        # Validate API key before saving
        try:
            client = AIClientFactory.create_client(
                provider=provider_data.provider,
                api_key=provider_data.api_key,
                model=provider_data.model,
                parameters=provider_data.parameters,
            )
            is_valid = await client.validate_api_key()
            if not is_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid API key for {provider_data.provider}",
                )
        except NotImplementedError:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail=f"Provider {provider_data.provider} is not yet supported",
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

        # Save provider configuration (repository will encrypt the key)
        await self.repository.add_provider(user_id, provider_data)

        # Return settings with masked API keys
        return await self.get_user_settings(user_id)

    async def update_provider(
        self, user_id: str, provider_index: int, request: UpdateProviderRequest
    ) -> UserAISettingsResponse:
        """
        Update existing provider configuration.

        Only the fields present in the request are applied; omitted fields
        keep their current value. A missing API key keeps the current one
        without re-validating it.

        Args:
            user_id: User ID
            provider_index: Index of provider to update (0-based)
            request: Partial update request

        Returns:
            Updated user settings

        Raises:
            HTTPException: If provider not found or validation fails
        """
        # Get current settings to merge the partial update
        settings = await self.repository.get_user_settings(user_id)
        if not settings or provider_index >= len(settings.providers):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Provider at index {provider_index} not found",
            )

        current_provider = settings.providers[provider_index]

        # Build merged config (only update provided fields)
        # IMPORTANT: Don't include api_key if not provided to avoid validation of masked key
        provider_data = AIProviderConfig(
            provider=current_provider.provider,
            api_key=request.api_key if request.api_key else None,  # None means keep current
            model=request.model if request.model else current_provider.model,
            is_active=(
                request.is_active if request.is_active is not None else current_provider.is_active
            ),
            is_default=(
                request.is_default
                if request.is_default is not None
                else current_provider.is_default
            ),
            parameters=(
                request.parameters
                if request.parameters is not None
                else current_provider.parameters
            ),
            display_name=(
                request.display_name
                if request.display_name is not None
                else current_provider.display_name
            ),
        )

        # If API key is None, keep the current one (don't validate)
        if provider_data.api_key is None:
            provider_data.api_key = current_provider.api_key
        else:
            # New API key provided, validate it
            try:
                client = AIClientFactory.create_client(
                    provider=provider_data.provider,
                    api_key=provider_data.api_key,
                    model=provider_data.model,
                    parameters=provider_data.parameters,
                )
                is_valid = await client.validate_api_key()
                if not is_valid:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid API key for {provider_data.provider}",
                    )
            except NotImplementedError:
                raise HTTPException(
                    status_code=status.HTTP_501_NOT_IMPLEMENTED,
                    detail=f"Provider {provider_data.provider} is not yet supported",
                )

        try:
            settings = await self.repository.update_provider(user_id, provider_index, provider_data)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

        return await self.get_user_settings(user_id)

    async def remove_provider(self, user_id: str, provider_index: int) -> UserAISettingsResponse:
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
            await self.repository.remove_provider(user_id, provider_index)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

        return await self.get_user_settings(user_id)

    async def set_default_provider(
        self, user_id: str, provider: AIProviderType
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
            await self.repository.set_default_provider(user_id, provider)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

        return await self.get_user_settings(user_id)

    async def get_active_provider_config(
        self, user_id: str, provider_type: Optional[AIProviderType] = None
    ) -> Optional[AIProviderConfig]:
        """
        Get the active provider configuration for a user.

        Public API used by other modules to resolve the active provider
        without reaching into the repository directly.

        Args:
            user_id: User ID
            provider_type: Specific provider type (uses default if None)

        Returns:
            Provider configuration or None if not configured
        """
        return await self.repository.get_active_provider(user_id, provider_type)

    async def generate_description(
        self, user_id: str, request: GenerateDescriptionRequest
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
        provider_config = await self.repository.get_active_provider(user_id, request.provider)

        if not provider_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active AI provider configured. Please add an API key in settings.",
            )

        # Create AI client
        try:
            client = AIClientFactory.create_client(
                provider=provider_config.provider,
                api_key=provider_config.api_key,  # Already decrypted by repository
                model=provider_config.model,
                parameters=provider_config.parameters,
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except NotImplementedError:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail=f"Provider {provider_config.provider} is not yet supported",
            )

        # Generate description
        try:
            description = await client.generate_description(
                diagram_code=request.diagram_code,
                diagram_type=request.diagram_type,
                language=request.language,
            )

            # Strip <think>...</think> tags (chain-of-thought from DeepSeek/MiniMax)
            description = _strip_think_tags(description)

            return GenerateDescriptionResponse(
                description=description,
                provider_used=provider_config.provider,
                model_used=provider_config.model,
            )

        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error generating description: {str(e)}",
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Unexpected error: {str(e)}",
            )

    async def refine_description(
        self, user_id: str, request: RefineDescriptionRequest
    ) -> RefineDescriptionResponse:
        """Refine an existing diagram description using AI."""
        import time

        provider_config = await self.repository.get_active_provider(user_id, request.provider)
        if not provider_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active AI provider configured.",
            )

        try:
            client = AIClientFactory.create_client(
                provider=provider_config.provider,
                api_key=provider_config.api_key,
                model=provider_config.model,
                parameters=provider_config.parameters,
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

        from .prompts import build_refine_description_prompt, clean_ai_code_response

        prompt = build_refine_description_prompt(
            diagram_code=request.diagram_code,
            diagram_type=request.diagram_type,
            current_description=request.current_description,
            refinement_request=request.refinement_request,
            language=request.language,
        )

        start = time.time()
        try:
            description = clean_ai_code_response(await self._call_with_prompt(client, prompt))
            elapsed = time.time() - start

            return RefineDescriptionResponse(
                description=description,
                provider_used=provider_config.provider,
                model_used=provider_config.model,
                generation_time=round(elapsed, 2),
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error refining description: {str(e)}",
            )

    async def _call_with_prompt(self, client: BaseAIClient, prompt: str) -> str:
        """Call the AI client with a raw prompt string."""
        from .prompts import DESCRIPTION_SYSTEM_PROMPT

        return await client.complete(
            system_prompt=DESCRIPTION_SYSTEM_PROMPT,
            user_prompt=prompt,
        )

    async def test_provider(
        self, provider: AIProviderType, api_key: str, model: str
    ) -> TestProviderResponse:
        """
        Test if API key is valid for a provider and shape the response.

        Args:
            provider: Provider type
            api_key: API key to test
            model: Model name

        Returns:
            Test result with validity and message

        Raises:
            HTTPException: If the provider is not yet supported
        """
        try:
            client = AIClientFactory.create_client(
                provider=provider, api_key=api_key, model=model, parameters={}
            )
            is_valid = await client.validate_api_key()
        except NotImplementedError:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail=f"Provider {provider} is not yet supported",
            )
        except HTTPException:
            # Never swallow HTTP errors raised during validation.
            raise
        except Exception:
            is_valid = False

        if is_valid:
            return TestProviderResponse(
                valid=True, message="API key is valid", provider_name=provider.value
            )
        return TestProviderResponse(
            valid=False,
            message="API key is invalid or has no permissions",
            provider_name=provider.value,
        )

    async def generate_diagram(
        self, user_id: str, request: GenerateDiagramRequest
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
        provider_config = await self.repository.get_active_provider(user_id, request.provider)

        if not provider_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active AI provider configured. Please add an API key in settings.",
            )

        # Create AI client
        try:
            client = AIClientFactory.create_client(
                provider=provider_config.provider,
                api_key=provider_config.api_key,  # Already decrypted by repository
                model=provider_config.model,
                parameters=provider_config.parameters,
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except NotImplementedError:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail=f"Provider {provider_config.provider} is not yet supported",
            )

        # Generate diagram
        try:
            start_time = time.time()
            diagram_code = await client.generate_diagram(
                description=request.description,
                diagram_type=request.diagram_type,
                language=request.language,
            )
            generation_time = time.time() - start_time

            return GenerateDiagramResponse(
                diagram_code=diagram_code,
                provider_used=provider_config.provider,
                model_used=provider_config.model,
                generation_time=generation_time,
            )

        except TruncatedResponseError:
            # The code hit the output limit: incomplete code would not render
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error": "response_truncated"},
            )
        except EmptyResponseError:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"error": "empty_response"},
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error generating diagram: {str(e)}",
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Unexpected error: {str(e)}",
            )

    async def improve_diagram(
        self, user_id: str, request: ImproveDiagramRequest
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
        provider_config = await self.repository.get_active_provider(user_id, request.provider)

        if not provider_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active AI provider configured. Please add an API key in settings.",
            )

        # Create AI client
        try:
            client = AIClientFactory.create_client(
                provider=provider_config.provider,
                api_key=provider_config.api_key,  # Already decrypted by repository
                model=provider_config.model,
                parameters=provider_config.parameters,
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except NotImplementedError:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail=f"Provider {provider_config.provider} is not yet supported",
            )

        # Improve diagram
        try:
            start_time = time.time()
            improved_code = await client.improve_diagram(
                diagram_code=request.diagram_code,
                improvement_request=request.improvement_request,
                diagram_type=request.diagram_type,
                language=request.language,
            )
            generation_time = time.time() - start_time

            return ImproveDiagramResponse(
                diagram_code=improved_code,
                original_code=request.diagram_code,
                improvement_applied=request.improvement_request,
                provider_used=provider_config.provider,
                model_used=provider_config.model,
                generation_time=generation_time,
            )

        except TruncatedResponseError:
            # The code hit the output limit: incomplete code would not render
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error": "response_truncated"},
            )
        except EmptyResponseError:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"error": "empty_response"},
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error improving diagram: {str(e)}",
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Unexpected error: {str(e)}",
            )
