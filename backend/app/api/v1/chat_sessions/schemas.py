"""
Pydantic models and Beanie documents for chat sessions module.
"""
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from beanie import Document
from pydantic import BaseModel, Field


class MessageRole(str, Enum):
    """Role of a chat message sender."""
    USER = "user"
    ASSISTANT = "assistant"
    ERROR = "error"


class ImprovementStatus(str, Enum):
    """Status of a diagram improvement suggestion."""
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class ChatPresetAction(str, Enum):
    """Predefined AI chat actions."""
    EXPLAIN = "explain"
    IMPROVE_UI = "improve_ui"
    IMPROVE_PROCESS = "improve_process"
    FIX = "fix"


class ChatSessionInDB(Document):
    """Chat session document stored in MongoDB."""
    user_id: str
    diagram_id: str
    title: str
    status: str = "active"
    parent_session_id: Optional[str] = None
    summary: Optional[str] = None
    last_provider: Optional[str] = None
    last_model: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "chat_sessions"
        indexes = [
            [("user_id", 1), ("diagram_id", 1), ("updated_at", -1)]
        ]


class ChatMessageInDB(Document):
    """Chat message document stored in MongoDB."""
    session_id: str
    role: MessageRole
    content: str
    improved_code: Optional[str] = None
    improvement_status: Optional[ImprovementStatus] = None
    provider_used: Optional[str] = None
    model_used: Optional[str] = None
    generation_time: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "chat_messages"
        indexes = [
            [("session_id", 1), ("created_at", 1)]
        ]


# --- Request Schemas ---

class CreateChatSessionRequest(BaseModel):
    """Request model for creating a new chat session."""
    diagram_id: str
    title: Optional[str] = None


class SendMessageRequest(BaseModel):
    """Request model for sending a message in a chat session."""
    content: str = Field(..., min_length=1, max_length=5000)
    diagram_code: str
    diagram_type: str
    provider: Optional[str] = None
    model: Optional[str] = None
    language: str = "es"
    preset_action: Optional[ChatPresetAction] = None


class UpdateMessageStatusRequest(BaseModel):
    """Request model for updating improvement status of a message."""
    status: ImprovementStatus


class UpdateSessionModelRequest(BaseModel):
    """Request model for updating the AI model used in a session."""
    provider: str
    model: str


# --- Response Schemas ---

class ChatSessionResponse(BaseModel):
    """Response model for a chat session."""
    id: str
    diagram_id: str
    title: str
    status: str
    parent_session_id: Optional[str] = None
    last_provider: Optional[str] = None
    last_model: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    class Config:
        from_attributes = True


class ChatMessageResponse(BaseModel):
    """Response model for a chat message."""
    id: str
    session_id: str
    role: MessageRole
    content: str
    improved_code: Optional[str] = None
    improvement_status: Optional[ImprovementStatus] = None
    provider_used: Optional[str] = None
    model_used: Optional[str] = None
    generation_time: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChatSessionWithMessagesResponse(BaseModel):
    """Response model for a chat session with its messages."""
    session: ChatSessionResponse
    messages: list[ChatMessageResponse]
