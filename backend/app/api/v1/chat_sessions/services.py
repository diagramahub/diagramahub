"""
Business logic layer for chat sessions.
Orchestrates session/message CRUD, AI interactions, context compaction, and title generation.
"""

import time
import logging
import re
from typing import Optional

from fastapi import HTTPException, status

from .interfaces import IChatSessionRepository, IChatMessageRepository
from .schemas import (
    ChatSessionInDB,
    ChatMessageInDB,
    MessageRole,
    ImprovementStatus,
    ChatPresetAction,
    ChatSessionResponse,
    ChatMessageResponse,
    ChatSessionWithMessagesResponse,
)
from ..ai_providers.services import AIProviderService
from ..ai_providers.schemas import AIProviderType
from ..ai_providers.clients.factory import AIClientFactory

from ..diagrams.syntax_validator import SyntaxValidator
from app.api.v1.ai_providers.model_catalog import context_window as model_context_window

logger = logging.getLogger(__name__)

# Imperative verbs that open a request to create or change the diagram
_LEADING_CODE_VERBS = {
    "agrega",
    "agregar",
    "añade",
    "añadir",
    "crea",
    "crear",
    "genera",
    "generar",
    "haz",
    "dibuja",
    "diseña",
    "modifica",
    "modificar",
    "cambia",
    "cambiar",
    "mejora",
    "mejorar",
    "corrige",
    "corregir",
    "actualiza",
    "actualizar",
    "elimina",
    "eliminar",
    "quita",
    "quitar",
    "renombra",
    "mueve",
    "reorganiza",
    "refactoriza",
    "convierte",
    "add",
    "create",
    "generate",
    "make",
    "draw",
    "design",
    "modify",
    "change",
    "improve",
    "fix",
    "update",
    "remove",
    "delete",
    "rename",
    "move",
    "reorganize",
    "refactor",
    "convert",
}

# --- Auto-retry constants ---
MAX_RETRIES = 2

# --- Context compaction constants ---
CHARS_PER_TOKEN = 4
CONTEXT_THRESHOLD = 0.80


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

    async def get_session_with_messages(self, session_id: str) -> ChatSessionWithMessagesResponse:
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

    async def update_session_title(self, session_id: str, title: str) -> ChatSessionResponse:
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

    async def get_provider_usage_stats(self, user_id: str) -> dict:
        """Aggregate AI provider usage statistics for a user's sessions."""
        sessions = await self.session_repo.get_sessions_by_user(user_id)

        provider_counts: dict = {}
        total_messages = 0

        for session in sessions:
            messages = await self.message_repo.get_recent_messages(str(session.id), limit=100)
            for msg in messages:
                if msg.provider_used:
                    provider_counts[msg.provider_used] = (
                        provider_counts.get(msg.provider_used, 0) + 1
                    )
                    total_messages += 1

        return {
            "provider_counts": provider_counts,
            "total_messages": total_messages,
        }

    async def delete_message(self, message_id: str) -> bool:
        """Delete a single chat message by its ID."""
        return await self.message_repo.delete_message(message_id)

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
        session = await self.session_repo.update_session_model(session)
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
        preset_action: Optional[ChatPresetAction] = None,
    ) -> ChatMessageResponse:
        """Send a message in a chat session.

        Uses a unified prompt that automatically detects user intent:
        - Questions/analysis → text response
        - Modification requests → text + diagram code (<<<DIAGRAM>>>...<<<END_DIAGRAM>>>)
        """
        from app.api.v1.ai_providers.prompts import (
            build_unified_chat_prompt,
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
        )

        await self._maybe_auto_title(session, content)

        try:
            # Build context: persistent summary + last few messages + current diagram
            # Strategy: always use session.summary (if exists) + last 4 messages
            RECENT_WINDOW = 4
            all_recent = await self.message_repo.get_recent_messages(
                session_id_str, limit=RECENT_WINDOW
            )
            history = self._build_message_history(all_recent, session.summary)

            # Get provider config
            provider_type = AIProviderType(provider) if provider else None
            provider_config = await self.ai_service.get_active_provider_config(
                user_id, provider_type
            )
            if not provider_config:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No hay proveedor de IA configurado.",
                )

            actual_model = model or provider_config.model
            # Fallback: if stored model is not in known limits, it may have been retired
            # Use it anyway (the API will reject if truly invalid)
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
                )
                recent_new = await self.message_repo.get_recent_messages(new_sid, limit=20)
                history = self._build_message_history(recent_new, compacted_session.summary)
                session = compacted_session
                session_id_str = new_sid

            # Build unified system prompt
            system_prompt = build_unified_chat_prompt(
                diagram_code,
                diagram_type,
                language,
                preset_action.value if preset_action else None,
            )

            response_mode = self._detect_response_mode(content, preset_action)
            if response_mode == "code":
                self._use_code_budget(client)

            start = time.time()

            # Call AI with unified system prompt + conversation history
            ai_text = await self._call_ai_client(client, system_prompt, history, language)

            generation_time = time.time() - start

            # Strip <think>...</think> tags (chain-of-thought from some models like DeepSeek/MiniMax)
            import re

            # Handle both closed and unclosed think tags
            ai_text = re.sub(r"<think>.*?</think>\s*", "", ai_text, flags=re.DOTALL)
            # If <think> is present but not closed (truncated), remove everything from <think> onwards
            if "<think>" in ai_text:
                ai_text = ai_text[: ai_text.index("<think>")].strip()
            ai_text = ai_text.strip()

            # Normalize diagram markers (AI sometimes translates them)
            ai_text = re.sub(r"<<<DIAGRAMA>>>", "<<<DIAGRAM>>>", ai_text)
            ai_text = re.sub(r"<<<FIN_DIAGRAMA>>>", "<<<END_DIAGRAM>>>", ai_text)
            ai_text = re.sub(r"<<<END_DIAGRAMA>>>", "<<<END_DIAGRAM>>>", ai_text)
            ai_text = re.sub(r"<<<DIAGRAM>>>\s*\n?```\w*\s*\n?", "<<<DIAGRAM>>>\n", ai_text)
            ai_text = re.sub(r"\n?```\s*\n?<<<END_DIAGRAM>>>", "\n<<<END_DIAGRAM>>>", ai_text)

            # Parse response
            improved_code = None
            display_text = ai_text
            improvement_status = None

            code_display = ai_text
            if response_mode == "code":
                improved_code, code_display = self._split_reply(ai_text, diagram_type)
                if client.last_truncated:
                    # Cut at the output limit: half a diagram must not replace the user's
                    improved_code = None
                    display_text = self._truncated_notice(language)
            if improved_code:

                # Auto-retry: validate syntax and retry if invalid
                # Skip retry for PlantUML and DBML — their validators give false positives
                # with skinparam blocks and complex syntax. Let Kroki be the final validator.
                skip_retry = diagram_type in (
                    "plantuml",
                    "uml",
                    "dbml",
                ) or not await self._auto_fix_enabled(user_id)
                retries = 0
                while improved_code and retries < MAX_RETRIES and not skip_retry:
                    validation = await SyntaxValidator.validate(improved_code, diagram_type)
                    if validation.is_valid:
                        break

                    retries += 1
                    logger.warning(
                        "Syntax validation failed (attempt %d/%d): %s",
                        retries,
                        MAX_RETRIES,
                        validation.error_message,
                    )

                    # Build retry context with the error message
                    if language == "es":
                        retry_msg = (
                            f"El código de diagrama que generaste tiene un error de sintaxis: "
                            f"{validation.error_message}. "
                            f"Por favor corrige el error y genera el diagrama completo nuevamente."
                        )
                    else:
                        retry_msg = (
                            f"The diagram code you generated has a syntax error: "
                            f"{validation.error_message}. "
                            f"Please fix the error and generate the complete diagram again."
                        )

                    # Append the error as a user message in the history for retry
                    retry_history = history + [
                        {"role": "assistant", "content": ai_text},
                        {"role": "user", "content": retry_msg},
                    ]

                    retry_start = time.time()
                    ai_text = await self._call_ai_client(
                        client, system_prompt, retry_history, language
                    )
                    generation_time += time.time() - retry_start

                    # Re-parse the retry response
                    improved_code, code_display = self._split_reply(ai_text, diagram_type)
                    if not improved_code:
                        break

                # Text the model wrote around the code (the code itself is shown apart)
                display_text = code_display
                improvement_status = ImprovementStatus.PENDING

            ai_msg = await self.message_repo.create_message(
                session_id=session_id_str,
                role=MessageRole.ASSISTANT,
                content=display_text,
                improved_code=improved_code,
                improvement_status=improvement_status,
                provider_used=provider_config.provider.value,
                model_used=actual_model,
                generation_time=generation_time,
            )

            # Update rolling summary in DB after each interaction
            # This persists context for future messages
            try:
                new_summary = self._build_rolling_summary(
                    existing_summary=session.summary,
                    user_message=content,
                    ai_response=display_text,
                    had_code=improved_code is not None,
                )
                await self.session_repo.update_session_summary(session_id_str, new_summary)
            except Exception as e:
                logger.warning(f"Failed to update session summary: {e}")

            # Update last_provider and last_model on the session
            try:
                await self.session_repo.update_session_last_provider(
                    session_id_str,
                    provider_config.provider.value,
                    actual_model,
                )
            except Exception as e:
                logger.warning(f"Failed to update session provider/model: {e}")

            await self.session_repo.update_session_status(session_id_str, session.status)

            return self._message_to_response(ai_msg)

        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Chat error: %s", exc)
            error_msg = await self.message_repo.create_message(
                session_id=session_id_str,
                role=MessageRole.ERROR,
                content=str(exc),
            )
            return self._message_to_response(error_msg)

    # ------------------------------------------------------------------ #
    #  Streaming chat message handler
    # ------------------------------------------------------------------ #

    async def stream_message(
        self,
        session_id: str,
        user_id: str,
        content: str,
        diagram_code: str,
        diagram_type: str,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        language: str = "es",
        preset_action: Optional[ChatPresetAction] = None,
    ):
        """Stream an AI response as SSE events.

        Mirrors the logic of ``send_message`` but yields formatted SSE event
        strings instead of returning a single response. The frontend consumes
        these via a ``ReadableStream``.

        Yields:
            Formatted SSE event strings (``data: {...}\\n\\n``).
        """
        import re
        from app.api.v1.ai_providers.prompts import (
            build_unified_chat_prompt,
        )
        from .sse_events import token_event, phase_event, done_event, error_event, mode_event

        session = await self.session_repo.get_session_by_id(session_id)
        if not session:
            yield error_event("Sesión no encontrada")
            return
        if session.status == "finalized":
            yield error_event("No se pueden enviar mensajes a una sesión finalizada")
            return

        session_id_str = str(session.id)

        # Save user message
        await self.message_repo.create_message(
            session_id=session_id_str,
            role=MessageRole.USER,
            content=content,
        )

        await self._maybe_auto_title(session, content)

        try:
            # Detect response mode: "code" if user is requesting diagram changes,
            # "text" if asking questions or requesting analysis.
            response_mode = self._detect_response_mode(content, preset_action)
            yield mode_event(response_mode)

            # Emit initial phase
            yield phase_event("Thinking…" if language == "en" else "Pensando…")

            # Build context
            RECENT_WINDOW = 4
            all_recent = await self.message_repo.get_recent_messages(
                session_id_str, limit=RECENT_WINDOW
            )
            history = self._build_message_history(all_recent, session.summary)

            # Get provider config
            provider_type = AIProviderType(provider) if provider else None
            provider_config = await self.ai_service.get_active_provider_config(
                user_id, provider_type
            )
            if not provider_config:
                yield error_event("No hay proveedor de IA configurado.")
                return

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
                )
                recent_new = await self.message_repo.get_recent_messages(new_sid, limit=20)
                history = self._build_message_history(recent_new, compacted_session.summary)
                session = compacted_session
                session_id_str = new_sid

            # Build unified system prompt
            system_prompt = build_unified_chat_prompt(
                diagram_code,
                diagram_type,
                language,
                preset_action.value if preset_action else None,
            )

            response_mode = self._detect_response_mode(content, preset_action)
            if response_mode == "code":
                self._use_code_budget(client)

            start = time.time()
            accumulated_text = ""
            first_token_received = False
            # Think-tag filtering state
            in_think_block = False
            think_buffer = ""
            think_content_parts: list[str] = []

            # Streaming detection: try calling and catch NotImplementedError
            supports_streaming = False
            if hasattr(client, "chat_with_context_stream"):
                try:
                    stream_gen = client.chat_with_context_stream(
                        messages=history,
                        diagram_code=diagram_code,
                        diagram_type=diagram_type,
                        language=language,
                        # The same unified prompt as the non-streaming path: it
                        # explains the <<<DIAGRAM>>> markers and the syntax rules
                        # (the stream used to get a minimal prompt without them).
                        system_prompt=system_prompt,
                    )

                    async for chunk in stream_gen:
                        if not first_token_received:
                            first_token_received = True
                            analyzing_phase = (
                                "Analyzing your diagram…"
                                if language == "en"
                                else "Analizando tu diagrama…"
                            )
                            yield phase_event(analyzing_phase)

                        # --- Think-tag filtering ---
                        # Buffer content to detect and strip <think>...</think>
                        think_buffer += chunk

                        while think_buffer:
                            if in_think_block:
                                # Looking for </think> to end the block
                                end_idx = think_buffer.find("</think>")
                                if end_idx != -1:
                                    # Capture think content
                                    think_content_parts.append(think_buffer[:end_idx])
                                    think_buffer = think_buffer[end_idx + len("</think>") :]
                                    in_think_block = False
                                    # Continue processing remaining buffer
                                else:
                                    # Still inside think block, might be split
                                    # Keep buffer but check for partial </think>
                                    if len(think_buffer) > 8:
                                        # Safe to capture all but last 8 chars
                                        think_content_parts.append(think_buffer[:-8])
                                        think_buffer = think_buffer[-8:]
                                    break
                            else:
                                # Looking for <think> to start a block
                                start_idx = think_buffer.find("<think>")
                                if start_idx != -1:
                                    # Emit content before <think>
                                    before = think_buffer[:start_idx]
                                    if before:
                                        accumulated_text += before
                                        yield token_event(before)
                                    think_buffer = think_buffer[start_idx + len("<think>") :]
                                    in_think_block = True
                                    # Continue processing
                                else:
                                    # No <think> found — check for partial tag
                                    # Keep last 7 chars in buffer (len("<think>") - 1)
                                    if len(think_buffer) > 7:
                                        safe = think_buffer[:-7]
                                        think_buffer = think_buffer[-7:]
                                        accumulated_text += safe
                                        yield token_event(safe)
                                    break

                        # Detect diagram markers for phase update
                        if (
                            self.DIAGRAM_START in accumulated_text
                            and not accumulated_text.endswith(self.DIAGRAM_END)
                        ):
                            generating_phase = (
                                "Generating code…" if language == "en" else "Generando código…"
                            )
                            # Only emit once (check if we already emitted)
                            if accumulated_text.count(
                                self.DIAGRAM_START
                            ) == 1 and accumulated_text.index(self.DIAGRAM_START) == len(
                                accumulated_text
                            ) - len(
                                chunk
                            ) - len(
                                self.DIAGRAM_START
                            ) + len(
                                chunk
                            ):
                                yield phase_event(generating_phase)

                    # Flush remaining buffer after stream ends
                    if think_buffer and not in_think_block:
                        accumulated_text += think_buffer
                        yield token_event(think_buffer)
                    elif think_buffer and in_think_block:
                        # Unclosed think block — capture as think content
                        think_content_parts.append(think_buffer)
                    think_buffer = ""

                except NotImplementedError:
                    # Fallback to non-streaming
                    supports_streaming = False

            if not first_token_received and not supports_streaming:
                # Non-streaming fallback
                ai_text = await self._call_ai_client(client, system_prompt, history, language)
                accumulated_text = ai_text
                yield token_event(ai_text)

            generation_time = time.time() - start
            ai_text = accumulated_text

            # Strip <think>...</think> tags
            ai_text = re.sub(r"<think>.*?</think>\s*", "", ai_text, flags=re.DOTALL)
            if "<think>" in ai_text:
                ai_text = ai_text[: ai_text.index("<think>")].strip()
            ai_text = ai_text.strip()

            # Normalize diagram markers
            ai_text = re.sub(r"<<<DIAGRAMA>>>", "<<<DIAGRAM>>>", ai_text)
            ai_text = re.sub(r"<<<FIN_DIAGRAMA>>>", "<<<END_DIAGRAM>>>", ai_text)
            ai_text = re.sub(r"<<<END_DIAGRAMA>>>", "<<<END_DIAGRAM>>>", ai_text)
            ai_text = re.sub(r"<<<DIAGRAM>>>\s*\n?```\w*\s*\n?", "<<<DIAGRAM>>>\n", ai_text)
            ai_text = re.sub(r"\n?```\s*\n?<<<END_DIAGRAM>>>", "\n<<<END_DIAGRAM>>>", ai_text)

            # Parse response
            improved_code = None
            display_text = ai_text
            improvement_status = None

            code_display = ai_text
            if response_mode == "code":
                improved_code, code_display = self._split_reply(ai_text, diagram_type)
                if client.last_truncated:
                    # Cut at the output limit: half a diagram must not replace the user's
                    improved_code = None
                    display_text = self._truncated_notice(language)
            if improved_code:
                # Auto-retry: validate syntax (skip for plantuml/dbml)
                skip_retry = diagram_type in (
                    "plantuml",
                    "uml",
                    "dbml",
                ) or not await self._auto_fix_enabled(user_id)
                retries = 0
                while improved_code and retries < MAX_RETRIES and not skip_retry:
                    validation = await SyntaxValidator.validate(improved_code, diagram_type)
                    if validation.is_valid:
                        break

                    retries += 1
                    validating_phase = (
                        "Validating syntax…" if language == "en" else "Validando sintaxis…"
                    )
                    yield phase_event(validating_phase)

                    if language == "es":
                        retry_msg = (
                            f"El código de diagrama que generaste tiene un error de sintaxis: "
                            f"{validation.error_message}. "
                            f"Por favor corrige el error y genera el diagrama completo nuevamente."
                        )
                    else:
                        retry_msg = (
                            f"The diagram code you generated has a syntax error: "
                            f"{validation.error_message}. "
                            f"Please fix the error and generate the complete diagram again."
                        )

                    retry_history = history + [
                        {"role": "assistant", "content": ai_text},
                        {"role": "user", "content": retry_msg},
                    ]

                    retry_start = time.time()
                    ai_text = await self._call_ai_client(
                        client, system_prompt, retry_history, language
                    )
                    generation_time += time.time() - retry_start

                    # Re-parse the retry response
                    improved_code, code_display = self._split_reply(ai_text, diagram_type)
                    if not improved_code:
                        break

                if response_mode == "code":
                    # Text the model wrote around the code (the code itself is shown apart)
                    display_text = code_display
                    if not display_text:
                        # No explanation text outside diagram markers.
                        # Use thinking content as explanation if available.
                        thinking_text = "".join(think_content_parts).strip()
                        if thinking_text and len(thinking_text) > 10:
                            summary = thinking_text[:200]
                            for sep in [". ", ".\n", "\n\n"]:
                                last_sep = summary.rfind(sep)
                                if last_sep > 50:
                                    summary = summary[: last_sep + 1]
                                    break
                            display_text = summary.strip()
                        else:
                            display_text = ""
                improvement_status = ImprovementStatus.PENDING

            # Persist the AI message
            ai_msg = await self.message_repo.create_message(
                session_id=session_id_str,
                role=MessageRole.ASSISTANT,
                content=display_text,
                improved_code=improved_code,
                improvement_status=improvement_status,
                provider_used=provider_config.provider.value,
                model_used=actual_model,
                generation_time=generation_time,
            )

            # Update rolling summary
            try:
                new_summary = self._build_rolling_summary(
                    existing_summary=session.summary,
                    user_message=content,
                    ai_response=display_text,
                    had_code=improved_code is not None,
                )
                await self.session_repo.update_session_summary(session_id_str, new_summary)
            except Exception as e:
                logger.warning(f"Failed to update session summary: {e}")

            # Update last_provider and last_model
            try:
                await self.session_repo.update_session_last_provider(
                    session_id_str,
                    provider_config.provider.value,
                    actual_model,
                )
            except Exception as e:
                logger.warning(f"Failed to update session provider/model: {e}")

            # Emit done event
            thinking_text = "".join(think_content_parts).strip() or None
            yield done_event(
                message_id=str(ai_msg.id),
                improved_code=improved_code,
                provider_used=provider_config.provider.value,
                model_used=actual_model,
                generation_time=generation_time,
                thinking_content=thinking_text,
            )

        except HTTPException as exc:
            yield error_event(exc.detail)
        except Exception as exc:
            logger.error("Stream chat error: %s", exc)
            # Save error message to session
            try:
                await self.message_repo.create_message(
                    session_id=session_id_str,
                    role=MessageRole.ERROR,
                    content=str(exc),
                )
            except Exception:
                pass
            yield error_event(str(exc))

    # ------------------------------------------------------------------ #
    #  AI client dispatch helper (used by send_message + retries)
    # ------------------------------------------------------------------ #

    @staticmethod
    async def _call_ai_client(
        client,
        system_prompt: str,
        history: list[dict],
        language: str = "es",
    ) -> str:
        """Dispatch an AI request through the unified public client API.

        Delegates to ``client.complete_chat``: providers with a native chat API
        receive real ``user``/``assistant`` turns, the rest a flattened transcript.
        """
        return await client.complete_chat(system_prompt, history, language)

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
        return model_context_window(model)

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
            estimated,
            threshold,
            model,
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
        # Persist parent link and summary via the repository
        new_session.parent_session_id = session_id
        new_session.summary = summary
        new_session = await self.session_repo.create_child_session(new_session)

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
        msg = await self.message_repo.get_message_by_id(message_id)
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

    async def _maybe_auto_title(self, session: ChatSessionInDB, content: str) -> None:
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

    @staticmethod
    def _use_code_budget(client) -> None:
        """Give a code reply the larger output budget (reasoning models think first)."""
        from app.api.v1.ai_providers.clients.base import CODE_MAX_TOKENS

        client.parameters = {
            **(client.parameters or {}),
            "max_tokens": CODE_MAX_TOKENS,
            "max_output_tokens": CODE_MAX_TOKENS,
        }

    @staticmethod
    def _truncated_notice(language: str) -> str:
        """Chat message shown instead of a diagram cut at the output limit."""
        if language == "en":
            return (
                "The diagram was too large and the reply was cut off, so it wasn't applied. "
                "Ask for a smaller diagram or build it in parts."
            )
        return (
            "El diagrama resultó demasiado grande y la respuesta se cortó, así que no se aplicó. "
            "Pide un diagrama más pequeño o constrúyelo por partes."
        )

    async def _auto_fix_enabled(self, user_id: str) -> bool:
        """The user's "fix generated diagrams automatically" preference (default on)."""
        try:
            settings = await self.ai_service.get_user_settings(user_id)
            return bool(getattr(settings, "auto_fix_generated", True))
        except Exception:  # noqa: BLE001 - a settings hiccup must not break the chat
            return True

    @classmethod
    def _split_reply(cls, ai_text: str, diagram_type: str) -> tuple[Optional[str], str]:
        """Split a model reply into (diagram code, the text around it).

        Accepts what models actually send: the <<<DIAGRAM>>> markers (with or
        without the end marker, also malformed ones), a Markdown code block
        with any language tag (closed or cut off), or bare code for the
        diagram type (PlantUML @startuml…@enduml, Mermaid keywords, DBML
        Table). Returns ``(None, text)`` when there is no code.
        """
        import re

        from app.api.v1.ai_providers.prompts import extract_diagram_code

        def around(before: str, after: str) -> str:
            parts = [p.strip() for p in (before, after) if p and len(p.strip()) > 3]
            return "\n\n".join(parts)

        start = re.search(r"<{2,3}\s*DIAGRAMA?\s*>{1,3}", ai_text, re.IGNORECASE)
        if start:
            rest = ai_text[start.end() :]
            end = re.search(r"<{2,3}\s*/?\s*(?:END|FIN)_DIAGRAMA?\s*>{1,3}", rest, re.IGNORECASE)
            code_part, after = (rest[: end.start()], rest[end.end() :]) if end else (rest, "")
            code = extract_diagram_code(code_part)
            return (code or None), around(ai_text[: start.start()], after)

        fence = re.search(r"```[^\n`]*\n(.*?)(?:```|$)", ai_text, re.DOTALL)
        if fence and len(fence.group(1).strip()) > 20:
            code = extract_diagram_code(fence.group(1))
            return (code or None), around(ai_text[: fence.start()], ai_text[fence.end() :])

        raw_patterns = {
            "plantuml": r"@startuml\b.*?@enduml\b",
            "uml": r"@startuml\b.*?@enduml\b",
            "mermaid": r"^(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|pie|journey|gitGraph|mindmap|timeline)\b.+",
            "dbml": r"^(?:Table|Enum|Project)\s+\S+\s*\{.+",
        }
        pattern = raw_patterns.get(diagram_type)
        if pattern:
            match = re.search(pattern, ai_text, re.MULTILINE | re.DOTALL)
            if match and len(match.group(0).strip()) > 20:
                return match.group(0).strip(), around(ai_text[: match.start()], "")
        return None, ai_text.strip()

    @staticmethod
    def _detect_response_mode(
        content: str,
        preset_action: Optional[ChatPresetAction] = None,
    ) -> str:
        """Detect whether the user's message will produce code or text.

        Returns "code" if the message is a request to create, modify, improve,
        or fix a diagram. Returns "text" if it's a question or analysis request.
        """
        if preset_action == ChatPresetAction.EXPLAIN:
            return "text"
        if preset_action in (
            ChatPresetAction.IMPROVE_UI,
            ChatPresetAction.IMPROVE_PROCESS,
            ChatPresetAction.FIX,
        ):
            return "code"

        lower = content.lower().strip()

        # A request that STARTS with an action verb is a code request even if it
        # contains a question inside ("Crea un flujo de urgencias (¿requiere
        # cirugía? ¿hay camas?)"): checking "?" first sent those to text mode.
        first_word = re.split(r"[\s:,.;!¡]+", lower, maxsplit=1)[0] if lower else ""
        if first_word in _LEADING_CODE_VERBS:
            return "code"

        # Question indicators → text mode
        question_markers = [
            "?",
            "¿",
            "qué es",
            "what is",
            "explain",
            "explica",
            "describe",
            "analiza",
            "analyze",
            "por qué",
            "why",
            "cómo funciona",
            "how does",
            "cuántos",
            "how many",
        ]
        for marker in question_markers:
            if marker in lower:
                return "text"

        # Code generation indicators → code mode
        code_markers = [
            "agrega",
            "añade",
            "add",
            "crea",
            "create",
            "genera",
            "generate",
            "modifica",
            "modify",
            "cambia",
            "change",
            "mejora",
            "improve",
            "corrige",
            "fix",
            "actualiza",
            "update",
            "elimina",
            "remove",
            "delete",
            "quita",
            "renombra",
            "rename",
            "mueve",
            "move",
            "reorganiza",
            "reorganize",
            "refactoriza",
            "refactor",
            "simplifica",
            "simplify",
            "optimiza",
            "optimize",
            "convierte",
            "convert",
            "transforma",
            "transform",
            "haz",
            "make",
            "pon",
            "put",
            "incluye",
            "include",
            "conecta",
            "connect",
            "enlaza",
            "link",
            "separa",
            "separate",
            "divide",
            "split",
            "combina",
            "combine",
            "merge",
            "reemplaza",
            "replace",
            "sustituye",
            "substitute",
        ]
        for marker in code_markers:
            if marker in lower:
                return "code"

        # Default: if it starts with a verb-like word, assume code mode
        # Otherwise assume text (safer default for questions)
        return "text"

    # ------------------------------------------------------------------ #
    #  Helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _build_message_history(
        messages: list[ChatMessageInDB],
        summary: Optional[str] = None,
    ) -> list[dict]:
        """Convert DB messages to the dict format expected by AI clients.

        Structure:
        1. Summary as context (if exists)
        2. Recent messages as conversation history (excluding the last user message)
        3. Last user message marked as "[Nueva petición]" for clarity

        This helps the AI distinguish between historical context and the current request.
        """
        history: list[dict] = []

        if summary:
            history.append(
                {
                    "role": "assistant",
                    "content": (
                        f"[Contexto de la conversación]\n{summary}\n\n"
                        "IMPORTANTE: El diagrama actual ya refleja todos los cambios anteriores. "
                        "Si el usuario pide modificaciones, genera el código COMPLETO entre <<<DIAGRAM>>> y <<<END_DIAGRAM>>>."
                    ),
                }
            )

        # Filter out error messages
        valid_messages = [m for m in messages if m.role != MessageRole.ERROR]

        if not valid_messages:
            return history

        # Check if last message is from user (the new request)
        last_msg = valid_messages[-1]
        context_messages = (
            valid_messages[:-1] if last_msg.role == MessageRole.USER else valid_messages
        )

        # Add context messages (historical)
        for m in context_messages:
            role = "user" if m.role == MessageRole.USER else "assistant"
            history.append({"role": role, "content": m.content})

        # Add the last user message with a clear marker
        if last_msg.role == MessageRole.USER:
            history.append(
                {"role": "user", "content": f"[Nueva petición del usuario]:\n{last_msg.content}"}
            )

        return history

    @staticmethod
    def _build_rolling_summary(
        existing_summary: Optional[str],
        user_message: str,
        ai_response: str,
        had_code: bool,
    ) -> str:
        """Build a rolling summary that accumulates conversation context.

        Keeps the summary concise by:
        - Truncating old summary if too long
        - Adding only key info from the latest exchange
        - Limiting total summary to ~800 chars
        """
        MAX_SUMMARY_LENGTH = 800

        # Summarize the latest exchange
        user_short = user_message[:100] + "..." if len(user_message) > 100 else user_message
        ai_short = ai_response[:120] + "..." if len(ai_response) > 120 else ai_response
        code_note = " (se generó código de diagrama)" if had_code else ""

        new_entry = f"- Usuario pidió: {user_short}\n - IA respondió: {ai_short}{code_note}"

        if existing_summary:
            # Append new entry to existing summary
            combined = f"{existing_summary}\n{new_entry}"

            # If too long, trim from the beginning (keep most recent)
            if len(combined) > MAX_SUMMARY_LENGTH:
                lines = combined.split("\n")
                # Remove oldest lines until within limit
                while len("\n".join(lines)) > MAX_SUMMARY_LENGTH and len(lines) > 4:
                    lines.pop(0)
                combined = "\n".join(lines)

            return combined
        else:
            return new_entry

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
            improved_code=msg.improved_code,
            improvement_status=msg.improvement_status,
            provider_used=msg.provider_used,
            model_used=msg.model_used,
            generation_time=msg.generation_time,
            created_at=msg.created_at,
        )
