"""
FastAPI routes for AI providers.
"""
from fastapi import APIRouter, Depends, status, Body
from app.api.v1.users.routes import get_current_user_email
from app.api.v1.users.repository import UserRepository
from .repository import AIProviderRepository
from .services import AIProviderService
from .schemas import (
    CreateProviderRequest,
    UpdateProviderRequest,
    UserAISettingsResponse,
    GenerateDescriptionRequest,
    GenerateDescriptionResponse,
    GenerateDiagramRequest,
    GenerateDiagramResponse,
    ImproveDiagramRequest,
    ImproveDiagramResponse,
    TestProviderRequest,
    TestProviderResponse,
    AIProviderType,
    AIProviderConfig
)

router = APIRouter()


# Dependency injection
def get_ai_provider_service() -> AIProviderService:
    """Get AI provider service instance."""
    return AIProviderService(repository=AIProviderRepository())


async def get_current_user_id(
    current_user_email: str = Depends(get_current_user_email)
) -> str:
    """Get current user ID from email."""
    user_repo = UserRepository()
    user = await user_repo.get_by_email(current_user_email)
    return str(user.id)


# ==================== AI Provider Settings ====================

@router.get(
    "/settings",
    response_model=UserAISettingsResponse,
    summary="Get user's AI settings"
)
async def get_ai_settings(
    user_id: str = Depends(get_current_user_id),
    service: AIProviderService = Depends(get_ai_provider_service)
):
    """
    Get user's AI provider settings.

    Returns all configured providers with masked API keys.
    """
    return await service.get_user_settings(user_id)


@router.post(
    "/providers",
    response_model=UserAISettingsResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add AI provider"
)
async def add_provider(
    request: CreateProviderRequest,
    user_id: str = Depends(get_current_user_id),
    service: AIProviderService = Depends(get_ai_provider_service)
):
    """
    Add a new AI provider configuration.

    The API key will be validated before saving and encrypted in the database.
    """
    provider_config = AIProviderConfig(
        provider=request.provider,
        api_key=request.api_key,
        model=request.model,
        is_default=request.is_default,
        parameters=request.parameters,
        display_name=request.display_name
    )

    return await service.add_provider(user_id, provider_config)


@router.put(
    "/providers/{provider_index}",
    response_model=UserAISettingsResponse,
    summary="Update AI provider"
)
async def update_provider(
    provider_index: int,
    request: UpdateProviderRequest,
    user_id: str = Depends(get_current_user_id),
    service: AIProviderService = Depends(get_ai_provider_service)
):
    """
    Update an existing AI provider configuration.

    Specify the index of the provider to update (0-based).
    """
    # Get current settings to build the updated config
    settings = await service.get_user_settings(user_id)
    if provider_index >= len(settings.providers):
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider at index {provider_index} not found"
        )

    current_provider = settings.providers[provider_index]

    # Build updated config (only update provided fields)
    updated_config = AIProviderConfig(
        provider=current_provider.provider,
        api_key=request.api_key if request.api_key else current_provider.api_key,
        model=request.model if request.model else current_provider.model,
        is_active=request.is_active if request.is_active is not None else current_provider.is_active,
        is_default=request.is_default if request.is_default is not None else current_provider.is_default,
        parameters=request.parameters if request.parameters is not None else current_provider.parameters,
        display_name=request.display_name if request.display_name is not None else current_provider.display_name
    )

    return await service.update_provider(user_id, provider_index, updated_config)


@router.delete(
    "/providers/{provider_index}",
    response_model=UserAISettingsResponse,
    summary="Remove AI provider"
)
async def remove_provider(
    provider_index: int,
    user_id: str = Depends(get_current_user_id),
    service: AIProviderService = Depends(get_ai_provider_service)
):
    """
    Remove an AI provider configuration.

    Specify the index of the provider to remove (0-based).
    """
    return await service.remove_provider(user_id, provider_index)


@router.put(
    "/settings/default-provider",
    response_model=UserAISettingsResponse,
    summary="Set default provider"
)
async def set_default_provider(
    provider: AIProviderType = Body(..., embed=True),
    user_id: str = Depends(get_current_user_id),
    service: AIProviderService = Depends(get_ai_provider_service)
):
    """
    Set the default AI provider.

    The provider must already be configured for the user.
    """
    return await service.set_default_provider(user_id, provider)


@router.put(
    "/settings/auto-generate",
    response_model=UserAISettingsResponse,
    summary="Update auto-generate setting"
)
async def update_auto_generate(
    auto_generate: bool = Body(..., embed=True),
    user_id: str = Depends(get_current_user_id),
    service: AIProviderService = Depends(get_ai_provider_service)
):
    """
    Enable or disable auto-generating descriptions on diagram save.
    """
    return await service.update_auto_generate(user_id, auto_generate)


# ==================== AI Generation ====================

@router.post(
    "/generate-description",
    response_model=GenerateDescriptionResponse,
    summary="Generate diagram description"
)
async def generate_description(
    request: GenerateDescriptionRequest,
    user_id: str = Depends(get_current_user_id),
    service: AIProviderService = Depends(get_ai_provider_service)
):
    """
    Generate a description for a diagram using AI.

    The description will be generated using the specified provider
    or the user's default provider if not specified.
    """
    return await service.generate_description(user_id, request)


@router.post(
    "/generate-diagram",
    response_model=GenerateDiagramResponse,
    summary="Generate diagram from description"
)
async def generate_diagram(
    request: GenerateDiagramRequest,
    user_id: str = Depends(get_current_user_id),
    service: AIProviderService = Depends(get_ai_provider_service)
):
    """
    Generate diagram code from a natural language description using AI.

    The user provides a description of what they want to diagram,
    and the AI generates the appropriate diagram code (Mermaid or PlantUML).
    """
    return await service.generate_diagram(user_id, request)


@router.post(
    "/improve-diagram",
    response_model=ImproveDiagramResponse,
    summary="Improve existing diagram"
)
async def improve_diagram(
    request: ImproveDiagramRequest,
    user_id: str = Depends(get_current_user_id),
    service: AIProviderService = Depends(get_ai_provider_service)
):
    """
    Improve an existing diagram based on user's improvement request.

    The user provides the current diagram code and describes how they want to improve it.
    The AI generates an improved version while maintaining the original structure and logic.
    """
    return await service.improve_diagram(user_id, request)


# ==================== Testing ====================

@router.post(
    "/test-provider",
    response_model=TestProviderResponse,
    summary="Test AI provider API key"
)
async def test_provider(
    request: TestProviderRequest,
    service: AIProviderService = Depends(get_ai_provider_service)
):
    """
    Test if an API key is valid for a provider without saving it.

    Useful for validating keys before adding them to settings.
    """
    try:
        is_valid = await service.test_provider(
            provider=request.provider,
            api_key=request.api_key,
            model=request.model
        )

        if is_valid:
            return TestProviderResponse(
                valid=True,
                message="API key is valid",
                provider_name=request.provider.value
            )
        else:
            return TestProviderResponse(
                valid=False,
                message="API key is invalid or has no permissions",
                provider_name=request.provider.value
            )

    except Exception as e:
        return TestProviderResponse(
            valid=False,
            message=f"Error testing provider: {str(e)}",
            provider_name=request.provider.value
        )
