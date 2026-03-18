"""
FastAPI routes for prompt history.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query, status

from app.api.v1.users.routes import get_current_user_email
from app.api.v1.users.repository import UserRepository
from .repository import PromptHistoryRepository
from .services import PromptHistoryService
from .schemas import (
    PromptHistoryCreate,
    PromptHistoryResponse,
    PaginatedPromptHistoryResponse,
)

router = APIRouter(prefix="/prompt-history", tags=["prompt-history"])


# Dependency injection

def get_prompt_history_service() -> PromptHistoryService:
    """Get prompt history service instance."""
    return PromptHistoryService(repository=PromptHistoryRepository())


async def get_current_user_id(
    current_user_email: str = Depends(get_current_user_email),
) -> str:
    """Get current user ID from email."""
    user_repo = UserRepository()
    user = await user_repo.get_by_email(current_user_email)
    return str(user.id)


@router.get("", response_model=PaginatedPromptHistoryResponse)
async def list_prompt_history(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    diagram_id: Optional[str] = Query(default=None),
    user_id: str = Depends(get_current_user_id),
    service: PromptHistoryService = Depends(get_prompt_history_service),
):
    """List paginated prompt history for the authenticated user."""
    return await service.list_prompts(user_id, page, page_size, search, diagram_id)


@router.post("", response_model=PromptHistoryResponse, status_code=status.HTTP_201_CREATED)
async def save_prompt(
    body: PromptHistoryCreate,
    user_id: str = Depends(get_current_user_id),
    service: PromptHistoryService = Depends(get_prompt_history_service),
):
    """Save a prompt to the user's history."""
    return await service.save_prompt(user_id, body.prompt_text, body.operation_type, body.diagram_id)


@router.delete("/{entry_id}")
async def delete_prompt_history_entry(
    entry_id: str,
    user_id: str = Depends(get_current_user_id),
    service: PromptHistoryService = Depends(get_prompt_history_service),
):
    """Delete a prompt history entry."""
    return await service.delete_prompt(entry_id, user_id)
