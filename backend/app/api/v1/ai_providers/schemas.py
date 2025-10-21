"""
Pydantic schemas for AI providers module.
"""
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from beanie import Document


class AIProviderType(str, Enum):
    """Types of AI providers supported."""
    GEMINI = "gemini"          # ✅ Implemented
    OPENAI = "openai"          # 🔜 Future
    CLAUDE = "claude"          # 🔜 Future
    DEEPSEEK = "deepseek"      # 🔜 Future


class AIProviderConfig(BaseModel):
    """Generic configuration for any AI provider."""
    provider: AIProviderType
    api_key: str  # Will be encrypted in DB
    model: str = Field(..., description="Model name (e.g., 'gemini-1.5-flash', 'gpt-4')")
    is_active: bool = True
    is_default: bool = False

    # Extensible parameters per provider
    parameters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Provider-specific parameters (temperature, max_tokens, etc.)"
    )

    # Optional metadata
    display_name: Optional[str] = Field(None, description="User-friendly name for this config")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UserAISettingsInDB(Document):
    """User AI settings stored in MongoDB."""
    user_id: str
    providers: List[AIProviderConfig] = []
    auto_generate_on_save: bool = False
    default_provider: Optional[AIProviderType] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "user_ai_settings"
        indexes = ["user_id"]


class CreateProviderRequest(BaseModel):
    """Request to create a new AI provider configuration."""
    provider: AIProviderType
    api_key: str = Field(..., min_length=10, description="API key from the provider")
    model: str = Field(default="gemini-1.5-flash", description="Model to use")
    display_name: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    is_default: bool = False


class UpdateProviderRequest(BaseModel):
    """Request to update an existing AI provider configuration."""
    api_key: Optional[str] = Field(None, min_length=10)
    model: Optional[str] = None
    display_name: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None


class ProviderResponse(BaseModel):
    """Response with provider information (API key masked)."""
    id: str
    provider: AIProviderType
    model: str
    display_name: Optional[str]
    is_active: bool
    is_default: bool
    api_key_masked: str = Field(..., description="Masked API key (e.g., 'sk-...xyz')")
    parameters: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TestProviderRequest(BaseModel):
    """Request to test an API key before saving."""
    provider: AIProviderType
    api_key: str
    model: str = Field(default="gemini-1.5-flash")


class TestProviderResponse(BaseModel):
    """Response from testing a provider."""
    valid: bool
    message: str
    provider_name: Optional[str] = None


class GenerateDescriptionRequest(BaseModel):
    """Request to generate a diagram description."""
    diagram_code: str = Field(..., description="Diagram source code")
    diagram_type: str = Field(..., description="Type of diagram (flowchart, sequence, etc.)")
    provider: Optional[AIProviderType] = Field(
        None,
        description="Provider to use (uses default if not specified)"
    )
    language: str = Field(default="es", description="Language for description (es, en)")
    regenerate: bool = Field(
        default=False,
        description="Force regeneration even if description exists"
    )


class GenerateDescriptionResponse(BaseModel):
    """Response with generated description."""
    description: str
    provider_used: AIProviderType
    model_used: str
    tokens_used: Optional[int] = None
    generation_time: Optional[float] = None  # Seconds


class AISettingsResponse(BaseModel):
    """Response with user's AI settings."""
    providers: List[ProviderResponse]
    auto_generate_on_save: bool
    default_provider: Optional[AIProviderType]
    has_active_provider: bool


class UpdateAISettingsRequest(BaseModel):
    """Request to update global AI settings."""
    auto_generate_on_save: Optional[bool] = None
    default_provider: Optional[AIProviderType] = None


class AIProviderResponse(BaseModel):
    """Response model for AI provider configuration (with masked API key)."""
    provider: AIProviderType
    api_key: str  # Masked
    model: str
    is_active: bool
    is_default: bool
    parameters: Dict[str, Any]
    display_name: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserAISettingsResponse(BaseModel):
    """Response model for user AI settings."""
    user_id: str
    providers: List[AIProviderResponse]
    auto_generate_on_save: bool
    default_provider: Optional[AIProviderType]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GenerateDiagramRequest(BaseModel):
    """Request to generate a diagram from a description."""
    description: str = Field(..., min_length=10, description="Description of what to diagram")
    diagram_type: str = Field(default="mermaid", description="Type of diagram (mermaid, plantuml)")
    provider: Optional[AIProviderType] = Field(
        None,
        description="Provider to use (uses default if not specified)"
    )
    language: str = Field(default="es", description="Language for the diagram (es, en)")


class GenerateDiagramResponse(BaseModel):
    """Response with generated diagram code."""
    diagram_code: str
    provider_used: AIProviderType
    model_used: str
    generation_time: Optional[float] = None  # Seconds


class ImproveDiagramRequest(BaseModel):
    """Request to improve an existing diagram."""
    diagram_code: str = Field(..., description="Current diagram code")
    improvement_request: str = Field(..., min_length=5, description="What to improve")
    diagram_type: str = Field(..., description="Type of diagram (mermaid, plantuml)")
    provider: Optional[AIProviderType] = Field(
        None,
        description="Provider to use (uses default if not specified)"
    )
    language: str = Field(default="es", description="Language (es, en)")


class ImproveDiagramResponse(BaseModel):
    """Response with improved diagram code."""
    diagram_code: str
    original_code: str
    improvement_applied: str
    provider_used: AIProviderType
    model_used: str
    generation_time: Optional[float] = None  # Seconds
