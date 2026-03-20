"""
FastAPI routes for chat sessions.
"""
from fastapi import APIRouter, Depends, Query, status, HTTPException
from pydantic import BaseModel, Field

from app.api.v1.users.routes import get_current_user_email
from app.api.v1.users.repository import UserRepository
from app.api.v1.ai_providers.repository import AIProviderRepository
from app.api.v1.ai_providers.services import AIProviderService
from .repository import ChatSessionRepository, ChatMessageRepository
from .services import ChatSessionService
from .schemas import (
    CreateChatSessionRequest,
    SendMessageRequest,
    UpdateMessageStatusRequest,
    UpdateSessionModelRequest,
    ChatSessionResponse,
    ChatMessageResponse,
    ChatSessionWithMessagesResponse,
)

router = APIRouter(prefix="/chat-sessions", tags=["chat-sessions"])


# --- Inline request schema for title update ---

class UpdateSessionTitleRequest(BaseModel):
    """Request model for updating a chat session title."""
    title: str = Field(..., min_length=1, max_length=200)


# --- Dependency injection ---

def get_chat_session_service() -> ChatSessionService:
    """Get chat session service instance."""
    return ChatSessionService(
        session_repo=ChatSessionRepository(),
        message_repo=ChatMessageRepository(),
        ai_service=AIProviderService(repository=AIProviderRepository()),
    )


async def get_current_user_id(
    current_user_email: str = Depends(get_current_user_email),
) -> str:
    """Get current user ID from email."""
    user_repo = UserRepository()
    user = await user_repo.get_by_email(current_user_email)
    return str(user.id)


# --- Session endpoints ---

@router.post("", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: CreateChatSessionRequest,
    user_id: str = Depends(get_current_user_id),
    service: ChatSessionService = Depends(get_chat_session_service),
):
    """Create a new chat session for a diagram."""
    return await service.create_session(
        user_id=user_id,
        diagram_id=body.diagram_id,
        title=body.title,
    )


@router.get("", response_model=list[ChatSessionResponse])
async def list_sessions(
    diagram_id: str = Query(..., description="Diagram ID to list sessions for"),
    user_id: str = Depends(get_current_user_id),
    service: ChatSessionService = Depends(get_chat_session_service),
):
    """List all chat sessions for a diagram."""
    return await service.get_sessions_by_diagram(user_id=user_id, diagram_id=diagram_id)


@router.get("/{session_id}", response_model=ChatSessionWithMessagesResponse)
async def get_session(
    session_id: str,
    service: ChatSessionService = Depends(get_chat_session_service),
):
    """Get a chat session with all its messages."""
    return await service.get_session_with_messages(session_id)


@router.put("/{session_id}", response_model=ChatSessionResponse)
async def update_session_title(
    session_id: str,
    body: UpdateSessionTitleRequest,
    service: ChatSessionService = Depends(get_chat_session_service),
):
    """Update the title of a chat session."""
    return await service.update_session_title(session_id, body.title)


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    service: ChatSessionService = Depends(get_chat_session_service),
):
    """Delete a chat session and all its messages."""
    return await service.delete_session(session_id)


@router.put("/{session_id}/model", response_model=ChatSessionResponse)
async def update_session_model(
    session_id: str,
    body: UpdateSessionModelRequest,
    service: ChatSessionService = Depends(get_chat_session_service),
):
    """Update the AI provider and model used in a chat session."""
    return await service.update_session_model(session_id, body.provider, body.model)


# --- Message endpoints ---

@router.post(
    "/{session_id}/messages",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    session_id: str,
    body: SendMessageRequest,
    user_id: str = Depends(get_current_user_id),
    service: ChatSessionService = Depends(get_chat_session_service),
):
    """Send a message in a chat session (triggers AI response)."""
    return await service.send_message(
        session_id=session_id,
        user_id=user_id,
        content=body.content,
        mode=body.mode,
        diagram_code=body.diagram_code,
        diagram_type=body.diagram_type,
        provider=body.provider,
        model=body.model,
        language=body.language,
    )


@router.delete("/{session_id}/messages/{message_id}")
async def delete_message(
    session_id: str,
    message_id: str,
    service: ChatSessionService = Depends(get_chat_session_service),
):
    """Delete a single message from a chat session."""
    deleted = await service.message_repo.delete_message(message_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mensaje no encontrado",
        )
    return {"message": "Mensaje eliminado"}


@router.put(
    "/{session_id}/messages/{message_id}/status",
    response_model=ChatMessageResponse,
)
async def update_message_status(
    session_id: str,
    message_id: str,
    body: UpdateMessageStatusRequest,
    service: ChatSessionService = Depends(get_chat_session_service),
):
    """Update the improvement status of a message (accepted/rejected)."""
    return await service.update_message_status(message_id, body.status)
