"""
Business logic layer for prompt history.
"""
from math import ceil

from fastapi import HTTPException, status

from .interfaces import IPromptHistoryRepository
from .schemas import PromptHistoryResponse, PaginatedPromptHistoryResponse


class PromptHistoryService:
    """Service for prompt history business logic."""

    def __init__(self, repository: IPromptHistoryRepository):
        self.repository = repository

    async def save_prompt(
        self, user_id: str, prompt_text: str, operation_type: str, diagram_id: str | None = None
    ) -> PromptHistoryResponse:
        """
        Save a prompt to the user's history (upsert with deduplication).
        """
        entry = await self.repository.upsert(user_id, prompt_text, operation_type, diagram_id)
        return PromptHistoryResponse(
            id=str(entry.id),
            diagram_id=entry.diagram_id,
            prompt_text=entry.prompt_text,
            operation_type=entry.operation_type,
            created_at=entry.created_at,
            used_at=entry.used_at,
        )

    async def list_prompts(
        self, user_id: str, page: int, page_size: int, search: str | None = None, diagram_id: str | None = None
    ) -> PaginatedPromptHistoryResponse:
        """
        List paginated prompt history for a user with optional search and diagram filter.
        """
        skip = (page - 1) * page_size
        entries = await self.repository.get_by_user(user_id, skip, page_size, search, diagram_id)
        total = await self.repository.count_by_user(user_id, search, diagram_id)
        total_pages = ceil(total / page_size) if page_size > 0 else 0

        items = [
            PromptHistoryResponse(
                id=str(entry.id),
                diagram_id=entry.diagram_id,
                prompt_text=entry.prompt_text,
                operation_type=entry.operation_type,
                created_at=entry.created_at,
                used_at=entry.used_at,
            )
            for entry in entries
        ]

        return PaginatedPromptHistoryResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    async def delete_prompt(self, entry_id: str, user_id: str) -> dict:
        """
        Delete a prompt history entry after verifying ownership.

        Args:
            entry_id: ID of the entry to delete
            user_id: ID of the authenticated user

        Returns:
            Success message dict

        Raises:
            HTTPException 404: If entry not found
            HTTPException 403: If entry belongs to another user
        """
        entry = await self.repository.get_by_id(entry_id)
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Entrada de historial no encontrada",
            )

        if entry.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tiene permisos para esta entrada",
            )

        await self.repository.delete(entry_id)
        return {"message": "Prompt history entry deleted successfully"}
