"""
Business logic layer for chat sessions.
Orchestrates session/message CRUD, AI interactions, context compaction, and title generation.
"""
import time
import logging
from typing import Optional

from fastapi import HTTPException, status

from .interfaces import IChatSessionRepository, IChatMessageRepository
from .schemas import (
    ChatSessionInDB,
    ChatMessageInDB,
    MessageRole,
    MessageMode,
    ImprovementStatus,
    ChatSessionResponse,
    ChatMessageResponse,
    ChatSessionWithMessagesResponse,
)
from ..ai_providers.services import AIProviderService
from ..ai_providers.schemas import AIProviderType
from ..ai_providers.clients.factory import AIClientFactory

logger = logging.getLogger(__name__)

# --- Context compaction constants ---
CHARS_PER_TOKEN = 4
CONTEXT_THRESHOLD = 0.80

MODEL_TOKEN_LIMITS = {
    "gpt-4o": 128000,
    "gpt-4o-mini": 128000,
    "gpt-5.4": 128000,
    "gpt-5.4-mini": 128000,
    "gpt-5.4-nano": 128000,
    "gpt-4.1": 128000,
    "gpt-4.1-mini": 128000,
    "gpt-4.1-nano": 128000,
    "claude-sonnet-4-6": 1000000,
    "claude-haiku-4-5-20251001": 200000,
    "gemini-2.5-flash": 1000000,
    "gemini-2.5-pro": 1000000,
    "gemini-2.0-flash": 1000000,
    "gemini-1.5-pro": 1000000,
    "deepseek-chat": 64000,
    "deepseek-coder": 64000,
}

DEFAULT_TOKEN_LIMIT = 64000


class ChatSessionService:
    """Service for chat session business logic."""

    def __init__(
        self,
        session_repo: IChatSessionRepository,
        message_repo: IChatMessageRepository,
        ai_service: AIProviderService,
    ):
        self.session_repo = session_repo
        self.message_repo = message_repo
        self.ai_service = ai_service

    # ------------------------------------------------------------------ #
    #  Task 5.1 – Core CRUD operations
    # ------------------------------------------------------------------ #

    async def create_session(
        self, user_id: str, diagram_id: str, title: Optional[str] = None
    ) -> ChatSessionResponse:
        """Create a new chat session associated with a diagram."""
        session = await self.session_repo.create_session(
            user_id=user_id,
            diagram_id=diagram_id,
            title=title or "Nueva sesión",
        )
        return self._session_to_response(session, message_count=0)

    async def get_sessions_by_diagram(
        self, user_id: str, diagram_id: str
    ) -> list[ChatSessionResponse]:
        """List all sessions for a diagram, most-recent first."""
        sessions = await self.session_repo.get_sessions_by_diagram(user_id, diagram_id)
        result: list[ChatSessionResponse] = []
        for s in sessions:
            count = await self.message_repo.count_messages_by_session(str(s.id))
            result.append(self._session_to_response(s, message_count=count))
        return result

    async def get_session_with_messages(
        self, session_id: str
    ) -> ChatSessionWithMessagesResponse:
        """Get a session together with all its messages."""
        session = await self.session_repo.get_session_by_id(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sesión no encontrada",
            )
        messages = await self.message_repo.get_messages_by_session(session_id)
        count = len(messages)
        return ChatSessionWithMessagesResponse(
            session=self._session_to_response(session, message_count=count),
            messages=[self._message_to_response(m) for m in messages],
        )

    async def update_session_title(
        self, session_id: str, title: str
    ) -> ChatSessionResponse:
        """Update the title of a chat session."""
        try:
            session = await self.session_repo.update_session_title(session_id, title)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sesión no encontrada",
            )
        count = await self.message_repo.count_messages_by_session(session_id)
        return self._session_to_response(session, message_count=count)

    async def delete_session(self, session_id: str) -> dict:
        """Delete a session and cascade-delete all its messages."""
        deleted_messages = await self.message_repo.delete_messages_by_session(session_id)
        deleted = await self.session_repo.delete_session(session_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sesión no encontrada",
            )
        return {
            "message": "Sesión eliminada",
            "deleted_messages": deleted_messages,
        }

    async def update_session_model(
        self, session_id: str, provider: str, model: str
    ) -> ChatSessionResponse:
        """Update the last used provider and model for a session."""
        session = await self.session_repo.get_session_by_id(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sesión no encontrada",
            )
        session.last_provider = provider
        session.last_model = model
        await session.save()
        count = await self.message_repo.count_messages_by_session(session_id)
        return self._session_to_response(session, message_count=count)

    # ------------------------------------------------------------------ #
    #  Unified chat message handler
    # ------------------------------------------------------------------ #

    DIAGRAM_START = "<<<DIAGRAM>>>"
    DIAGRAM_END = "<<<END_DIAGRAM>>>"

    async def send_message(
        self,
        session_id: str,
        user_id: str,
        content: str,
        diagram_code: str,
        diagram_type: str,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        language: str = "es",
    ) -> ChatMessageResponse:
        """Send a message in a chat session.

        Uses a unified prompt that automatically detects user intent:
        - Questions/analysis → text response
        - Modification requests → text + diagram code (<<<DIAGRAM>>>...<<<END_DIAGRAM>>>)
        """
        from app.api.v1.ai_providers.prompts import (
            build_unified_chat_prompt,
            clean_code_response,
        )

        session = await self.session_repo.get_session_by_id(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sesión no encontrada",
            )
        if session.status == "finalized":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pueden enviar mensajes a una sesión finalizada",
            )

        session_id_str = str(session.id)

        # Save user message
        await self.message_repo.create_message(
            session_id=session_id_str,
            role=MessageRole.USER,
            content=content,
            mode=MessageMode.AUTO,
        )

        await self._maybe_auto_title(session, content)

        try:
            # Build context from recent messages
            recent = await self.message_repo.get_recent_messages(session_id_str, limit=20)
            history = self._build_message_history(recent, session.summary)

            # Get provider config
            provider_type = AIProviderType(provider) if provider else None
            provider_config = await self.ai_service.repository.get_active_provider(
                user_id, provider_type
            )
            if not provider_config:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No hay proveedor de IA configurado.",
                )

            actual_model = model or provider_config.model
            client = AIClientFactory.create_client(
                provider=provider_config.provider,
                api_key=provider_config.api_key,
                model=actual_model,
                parameters=provider_config.parameters,
            )

            # Context compaction check
            compacted_session = await self._maybe_compact_context(
                session=session,
                user_id=user_id,
                history=history,
                diagram_code=diagram_code,
                model=actual_model,
                client=client,
                language=language,
            )
            if compacted_session is not None:
                new_sid = str(compacted_session.id)
                await self.message_repo.create_message(
                    session_id=new_sid,
                    role=MessageRole.USER,
                    content=content,
                    mode=MessageMode.AUTO,
                )
                recent_new = await self.message_repo.get_recent_messages(new_sid, limit=20)
                history = self._build_message_history(
                    recent_new, compacted_session.summary
                )
                session = compacted_session
                session_id_str = new_sid

            # Build unified system prompt
            system_prompt = build_unified_chat_prompt(
                diagram_code, diagram_type, language
            )

            start = time.time()

            # Call AI with unified system prompt + conversation history
            if hasattr(client, '_generate'):
                # Gemini: concatenate system + history into single prompt
                conversation_parts = [system_prompt, ""]
                for msg in history:
                    role_label = (
                        "Usuario" if msg["role"] == "user" else "Asistente"
                    )
                    if language != "es":
                        role_label = (
                            "User" if msg["role"] == "user" else "Assistant"
                        )
                    conversation_parts.append(
                        f"{role_label}: {msg['content']}"
                    )
                role_suffix = "Asistente:" if language == "es" else "Assistant:"
                conversation_parts.append(role_suffix)
                ai_text = await client._generate("\n".join(conversation_parts))
            elif hasattr(client, '_chat_completion'):
                # OpenAI
                api_messages = [{"role": "system", "content": system_prompt}]
                for msg in history:
                    api_messages.append({"role": msg["role"], "content": msg["content"]})
                ai_text = await client._chat_completion(api_messages)
            elif hasattr(client, '_make_request'):
                # DeepSeek
                api_messages = [{"role": "system", "content": system_prompt}]
                for msg in history:
                    api_messages.append({"role": msg["role"], "content": msg["content"]})
                ai_text = await client._make_request(api_messages)
            elif hasattr(client, '_messages_request'):
                # Claude
                api_messages = []
                for msg in history:
                    api_messages.append({"role": msg["role"], "content": msg["content"]})
                ai_text = await client._messages_request(
                    api_messages, system=system_prompt
                )
            else:
                raise ValueError(f"Unsupported client: {type(client).__name__}")

            generation_time = time.time() - start

            # Parse response: check for diagram code
            improved_code = None
            display_text = ai_text
            improvement_status = None

            if self.DIAGRAM_START in ai_text and self.DIAGRAM_END in ai_text:
                start_idx = ai_text.index(self.DIAGRAM_START) + len(self.DIAGRAM_START)
                end_idx = ai_text.index(self.DIAGRAM_END)
                raw_code = ai_text[start_idx:end_idx].strip()
                improved_code = clean_code_response(raw_code)

                explanation_end = ai_text.index(self.DIAGRAM_START)
                display_text = ai_text[:explanation_end].strip()
                if not display_text:
                    display_text = (
                        "Diagrama modificado según tu solicitud."
                        if language == "es"
                        else "Diagram modified as requested."
                    )
                improvement_status = ImprovementStatus.PENDING

            ai_msg = await self.message_repo.create_message(
                session_id=session_id_str,
                role=MessageRole.ASSISTANT,
                content=display_text,
                mode=MessageMode.AUTO,
                improved_code=improved_code,
                improvement_status=improvement_status,
                provider_used=provider_config.provider.value,
                model_used=actual_model,
                generation_time=generation_time,
            )

            await self.session_repo.update_session_status(session_id_str, session.status)

            return self._message_to_response(ai_msg)

    # ------------------------------------------------------------------ #
    #  Task 5.4 – Context compaction logic
    # ------------------------------------------------------------------ #

    def _estimate_tokens(self, history: list[dict], diagram_code: str) -> int:
        """Estimate the number of tokens for the full context payload."""
        total_chars = len(diagram_code)
        for msg in history:
            total_chars += len(msg.get("content", ""))
        # Add a rough estimate for system prompt overhead
        total_chars += 500
        return total_chars // CHARS_PER_TOKEN

    def _get_model_token_limit(self, model: str) -> int:
        """Return the token limit for a model, falling back to a safe default."""
        return MODEL_TOKEN_LIMITS.get(model, DEFAULT_TOKEN_LIMIT)

    async def _maybe_compact_context(
        self,
        session: ChatSessionInDB,
        user_id: str,
        history: list[dict],
        diagram_code: str,
        model: str,
        client,
        language: str,
    ) -> Optional[ChatSessionInDB]:
        """Check if context exceeds threshold and compact if needed.

        Returns the newly created session if compaction happened, else None.
        """
        estimated = self._estimate_tokens(history, diagram_code)
        limit = self._get_model_token_limit(model)
        threshold = int(limit * CONTEXT_THRESHOLD)

        if estimated < threshold:
            return None

        logger.info(
            "Context compaction triggered: ~%d tokens vs threshold %d for model %s",
            estimated, threshold, model,
        )

        # Generate summary of the current conversation
        summary = await client.summarize_conversation(messages=history, language=language)

        # Finalize current session
        session_id = str(session.id)
        await self.session_repo.update_session_status(session_id, "finalized")

        # Create new session linked to the old one
        new_session = await self.session_repo.create_session(
            user_id=user_id,
            diagram_id=session.diagram_id,
            title=session.title,
        )
        # Persist parent link and summary directly on the document
        new_session.parent_session_id = session_id
        new_session.summary = summary
        await new_session.save()

        return new_session

    # ------------------------------------------------------------------ #
    #  Task 5.5 – update_message_status (accept / reject)
    # ------------------------------------------------------------------ #

    async def update_message_status(
        self, message_id: str, new_status: ImprovementStatus
    ) -> ChatMessageResponse:
        """Accept or reject a diagram improvement.

        Validates that the message has improved_code and is currently pending.
        """
        try:
            from beanie import PydanticObjectId
            msg = await ChatMessageInDB.get(PydanticObjectId(message_id))
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mensaje no encontrado",
            )
        if not msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mensaje no encontrado",
            )

        if not msg.improved_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El mensaje no contiene código mejorado",
            )
        if msg.improvement_status != ImprovementStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El mensaje ya fue {msg.improvement_status}",
            )

        updated = await self.message_repo.update_message_status(message_id, new_status)
        return self._message_to_response(updated)

    # ------------------------------------------------------------------ #
    #  Task 5.6 – Auto-generate session title
    # ------------------------------------------------------------------ #

    async def _maybe_auto_title(
        self, session: ChatSessionInDB, content: str
    ) -> None:
        """On the first message of a session, derive the title from the content."""
        session_id = str(session.id)
        count = await self.message_repo.count_messages_by_session(session_id)
        # count == 1 means the user message we just saved is the first one
        if count == 1 and session.title == "Nueva sesión":
            title = self._derive_title(content)
            await self.session_repo.update_session_title(session_id, title)
            session.title = title

    @staticmethod
    def _derive_title(content: str, max_length: int = 50) -> str:
        """Derive a short title from message content, truncated to ~50 chars."""
        # Take first line, strip whitespace
        first_line = content.strip().split("\n")[0].strip()
        if len(first_line) <= max_length:
            return first_line
        # Truncate at word boundary
        truncated = first_line[:max_length].rsplit(" ", 1)[0]
        return truncated + "…"

    # ------------------------------------------------------------------ #
    #  Helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _build_message_history(
        messages: list[ChatMessageInDB],
        summary: Optional[str] = None,
    ) -> list[dict]:
        """Convert DB messages to the dict format expected by AI clients.

        If the session has a summary (from compaction), prepend it as a system-like
        assistant message so the AI has prior context.
        Skips error messages from context.
        """
        history: list[dict] = []
        if summary:
            history.append({"role": "assistant", "content": f"[Resumen de conversación anterior]\n{summary}"})
        for m in messages:
            if m.role == MessageRole.ERROR:
                continue  # skip error messages from context
            role = "user" if m.role == MessageRole.USER else "assistant"
            history.append({"role": role, "content": m.content})
        return history

    @staticmethod
    def _session_to_response(
        session: ChatSessionInDB, message_count: int = 0
    ) -> ChatSessionResponse:
        return ChatSessionResponse(
            id=str(session.id),
            diagram_id=session.diagram_id,
            title=session.title,
            status=session.status,
            parent_session_id=session.parent_session_id,
            last_provider=session.last_provider,
            last_model=session.last_model,
            created_at=session.created_at,
            updated_at=session.updated_at,
            message_count=message_count,
        )

    @staticmethod
    def _message_to_response(msg: ChatMessageInDB) -> ChatMessageResponse:
        return ChatMessageResponse(
            id=str(msg.id),
            session_id=msg.session_id,
            role=msg.role,
            content=msg.content,
            mode=msg.mode,
            improved_code=msg.improved_code,
            improvement_status=msg.improvement_status,
            provider_used=msg.provider_used,
            model_used=msg.model_used,
            generation_time=msg.generation_time,
            created_at=msg.created_at,
        )
