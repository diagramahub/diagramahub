"""
FastAPI routes for AI providers.
"""

from typing import Optional

from fastapi import APIRouter, Body, Depends, File, Form, Request, UploadFile, status
from app.api.deps import get_current_user_id
from .repository import AIProviderRepository
from .services import MAX_IMAGE_BYTES, AIProviderService
from .model_catalog import recommended_model
from .schemas import (
    CreateProviderRequest,
    UpdateProviderRequest,
    UserAISettingsResponse,
    GenerateDescriptionRequest,
    GenerateDescriptionResponse,
    GenerateDiagramRequest,
    GenerateDiagramResponse,
    TestProviderRequest,
    TestProviderResponse,
    ImproveDiagramRequest,
    ImproveDiagramResponse,
    AIProviderType,
    AIProviderConfig,
    RefineDescriptionRequest,
    RefineDescriptionResponse,
)
from app.api.v1.users import audit_log

router = APIRouter()


# Dependency injection
def get_ai_provider_service() -> AIProviderService:
    """Get AI provider service instance."""
    return AIProviderService(repository=AIProviderRepository())


# ==================== AI Provider Settings ====================


@router.get("/settings", response_model=UserAISettingsResponse, summary="Get user's AI settings")
async def get_ai_settings(
    user_id: str = Depends(get_current_user_id),
    service: AIProviderService = Depends(get_ai_provider_service),
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
    summary="Add AI provider",
)
async def add_provider(
    request: CreateProviderRequest,
    http_request: Request,
    user_id: str = Depends(get_current_user_id),
    service: AIProviderService = Depends(get_ai_provider_service),
):
    """
    Add a new AI provider configuration.

    The API key will be validated before saving and encrypted in the database.
    """
    provider_config = AIProviderConfig(
        provider=request.provider,
        api_key=request.api_key,
        model=request.model or recommended_model(request.provider.value),
        is_default=request.is_default,
        parameters=request.parameters,
        display_name=request.display_name,
    )

    result = await service.add_provider(user_id, provider_config)
    await audit_log.log_event_for_user_id(
        audit_log.EVENT_AI_PROVIDER_ADDED,
        user_id,
        http_request,
        details=f"provider={request.provider.value}",
    )
    return result


@router.put(
    "/providers/{provider_index}",
    response_model=UserAISettingsResponse,
    summary="Update AI provider",
)
async def update_provider(
    provider_index: int,
    request: UpdateProviderRequest,
    http_request: Request,
    user_id: str = Depends(get_current_user_id),
    service: AIProviderService = Depends(get_ai_provider_service),
):
    """
    Update an existing AI provider configuration.

    Specify the index of the provider to update (0-based). Only the
    provided fields are changed.
    """
    result = await service.update_provider(user_id, provider_index, request)
    # Field names only: never the values (the API key among them).
    changed = sorted(request.model_dump(exclude_unset=True))
    await audit_log.log_event_for_user_id(
        audit_log.EVENT_AI_PROVIDER_UPDATED,
        user_id,
        http_request,
        details=f"index={provider_index} fields={','.join(changed) or '-'}",
    )
    return result


@router.delete(
    "/providers/{provider_index}",
    response_model=UserAISettingsResponse,
    summary="Remove AI provider",
)
async def remove_provider(
    provider_index: int,
    http_request: Request,
    user_id: str = Depends(get_current_user_id),
    service: AIProviderService = Depends(get_ai_provider_service),
):
    """
    Remove an AI provider configuration.

    Specify the index of the provider to remove (0-based).
    """
    result = await service.remove_provider(user_id, provider_index)
    await audit_log.log_event_for_user_id(
        audit_log.EVENT_AI_PROVIDER_REMOVED,
        user_id,
        http_request,
        details=f"index={provider_index}",
    )
    return result


@router.put(
    "/settings/auto-fix",
    response_model=UserAISettingsResponse,
    summary="Turn the automatic fix of generated diagrams on or off",
)
async def set_auto_fix(
    enabled: bool = Body(..., embed=True),
    user_id: str = Depends(get_current_user_id),
    service: AIProviderService = Depends(get_ai_provider_service),
):
    """
    When enabled (default), generated or improved Mermaid/D2 code that doesn't
    render is sent back once to the model with the error to fix it.
    """
    return await service.set_auto_fix(user_id, enabled)


@router.put(
    "/settings/default-provider",
    response_model=UserAISettingsResponse,
    summary="Set default provider",
)
async def set_default_provider(
    provider: AIProviderType = Body(..., embed=True),
    user_id: str = Depends(get_current_user_id),
    service: AIProviderService = Depends(get_ai_provider_service),
):
    """
    Set the default AI provider.

    The provider must already be configured for the user.
    """
    return await service.set_default_provider(user_id, provider)


# ==================== AI Generation ====================


@router.post(
    "/generate-description",
    response_model=GenerateDescriptionResponse,
    summary="Generate diagram description",
)
async def generate_description(
    request: GenerateDescriptionRequest,
    user_id: str = Depends(get_current_user_id),
    service: AIProviderService = Depends(get_ai_provider_service),
):
    """
    Generate a description for a diagram using AI.

    The description will be generated using the specified provider
    or the user's default provider if not specified.
    """
    return await service.generate_description(user_id, request)


@router.post(
    "/refine-description",
    response_model=RefineDescriptionResponse,
    summary="Refine diagram description",
)
async def refine_description(
    request: RefineDescriptionRequest,
    user_id: str = Depends(get_current_user_id),
    service: AIProviderService = Depends(get_ai_provider_service),
):
    """
    Refine an existing diagram description using AI.

    Takes the current description and a refinement instruction,
    and returns an updated description.
    """
    return await service.refine_description(user_id, request)


@router.post(
    "/diagram-from-image",
    response_model=GenerateDiagramResponse,
    summary="Generate diagram code from an image",
)
async def diagram_from_image(
    image: UploadFile = File(..., description="PNG, JPEG or WebP, up to 4 MB"),
    diagram_type: str = Form("mermaid", pattern="^(mermaid|plantuml|d2|dbml)$"),
    language: str = Form("es", pattern="^(es|en)$"),
    instructions: Optional[str] = Form(None, max_length=500),
    provider: Optional[AIProviderType] = Form(None),
    user_id: str = Depends(get_current_user_id),
    service: AIProviderService = Depends(get_ai_provider_service),
):
    """
    Recreate the diagram in an image (whiteboard photo, screenshot, sketch) as code.

    Uses a provider that accepts images (Gemini, OpenAI, Claude); others answer
    422 ``images_not_supported``.
    """
    data = await image.read(MAX_IMAGE_BYTES + 1)
    return await service.generate_diagram_from_image(
        user_id, data, diagram_type, language, instructions, provider
    )


@router.post(
    "/generate-diagram",
    response_model=GenerateDiagramResponse,
    summary="Generate diagram from description",
)
async def generate_diagram(
    request: GenerateDiagramRequest,
    user_id: str = Depends(get_current_user_id),
    service: AIProviderService = Depends(get_ai_provider_service),
):
    """
    Generate diagram code from a natural language description using AI.

    The user provides a description of what they want to diagram,
    and the AI generates the appropriate diagram code (Mermaid or PlantUML).
    """
    return await service.generate_diagram(user_id, request)


@router.post(
    "/improve-diagram", response_model=ImproveDiagramResponse, summary="Improve existing diagram"
)
async def improve_diagram(
    request: ImproveDiagramRequest,
    user_id: str = Depends(get_current_user_id),
    service: AIProviderService = Depends(get_ai_provider_service),
):
    """
    Improve an existing diagram based on user's improvement request.

    The user provides the current diagram code and describes how they want to improve it.
    The AI generates an improved version while maintaining the original structure and logic.
    """
    return await service.improve_diagram(user_id, request)


# ==================== Testing ====================


@router.post(
    "/test-provider", response_model=TestProviderResponse, summary="Test AI provider API key"
)
async def test_provider(
    request: TestProviderRequest,
    user_id: str = Depends(get_current_user_id),
    service: AIProviderService = Depends(get_ai_provider_service),
):
    """
    Test if an API key is valid for a provider without saving it.

    Useful for validating keys before adding them to settings. Requires an
    authenticated user, so the endpoint can't be used anonymously to probe keys.
    """
    return await service.test_provider(
        provider=request.provider,
        api_key=request.api_key,
        model=request.model or recommended_model(request.provider.value),
    )
