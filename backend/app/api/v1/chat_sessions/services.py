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
    ImprovementStatus,
    ChatSessionResponse,
    ChatMessageResponse,
    ChatSessionWithMessagesResponse,
)
from ..ai_providers.services import AIProviderService
from ..ai_providers.schemas import AIProviderType
from ..ai_providers.clients.factory import AIClientFactory

from ..diagrams.syntax_validator import SyntaxValidator

logger = logging.getLogger(__name__)

# --- Auto-retry constants ---
MAX_RETRIES = 2

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
    "minimax-01": 1000000,
    "abab6.5s-chat": 32000,
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
        )

        await self._maybe_auto_title(session, content)

        try:
            # Build context: persistent summary + last few messages + current diagram
            # Strategy: always use session.summary (if exists) + last 4 messages
            RECENT_WINDOW = 4
            all_recent = await self.message_repo.get_recent_messages(session_id_str, limit=RECENT_WINDOW)
            history = self._build_message_history(all_recent, session.summary)
            print(f"📋 CONTEXT: {len(all_recent)} recent msgs, session summary: {'YES (' + str(len(session.summary)) + ' chars)' if session.summary else 'NO'}")

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

            # === DEBUG: Input to AI ===
            print(f"\n{'='*60}")
            print(f"📨 USER MESSAGE: {content}")
            print(f"📋 CONTEXT: diagram_type={diagram_type}, language={language}")
            print(f"📋 HISTORY ({len(history)} messages):")
            for i, msg in enumerate(history):
                role_icon = "👤" if msg["role"] == "user" else "🤖"
                text_preview = msg["content"][:120] + "..." if len(msg["content"]) > 120 else msg["content"]
                print(f"   {role_icon} [{i}] {text_preview}")
            print(f"📋 SYSTEM PROMPT length: {len(system_prompt)} chars")
            print(f"📋 DIAGRAM CODE in system prompt: {len(diagram_code)} chars")
            print(f"{'='*60}")
            # === END DEBUG ===

            start = time.time()

            # Call AI with unified system prompt + conversation history
            ai_text = await self._call_ai_client(
                client, system_prompt, history, language
            )

            generation_time = time.time() - start

            # === DEBUG LOGS ===
            print(f"\n{'='*60}")
            print(f"🤖 AI RESPONSE DEBUG")
            print(f"{'='*60}")
            print(f"📊 History messages sent: {len(history)}")
            print(f"📝 AI response length: {len(ai_text)} chars")
            print(f"⏱️  Generation time: {generation_time:.2f}s")
            print(f"🔍 Contains <<<DIAGRAM>>>: {self.DIAGRAM_START in ai_text}")
            print(f"🔍 Contains <<<END_DIAGRAM>>>: {self.DIAGRAM_END in ai_text}")
            print(f"🔍 Contains ```code block: {'```' in ai_text}")
            print(f"🔍 Contains @startuml: {'@startuml' in ai_text}")
            print(f"📄 First 500 chars of response:")
            print(ai_text[:500])
            print(f"\n📄 Last 300 chars of response:")
            print(ai_text[-300:] if len(ai_text) > 300 else ai_text)
            print(f"{'='*60}\n")
            # === END DEBUG LOGS ===

            # Parse response: check for diagram code
            improved_code = None
            display_text = ai_text
            improvement_status = None

            if self.DIAGRAM_START in ai_text and self.DIAGRAM_END in ai_text:
                start_idx = ai_text.index(self.DIAGRAM_START) + len(self.DIAGRAM_START)
                end_idx = ai_text.index(self.DIAGRAM_END)
                raw_code = ai_text[start_idx:end_idx].strip()
                improved_code = clean_code_response(raw_code)
            elif self.DIAGRAM_START in ai_text:
                # Fallback: DIAGRAM_START present but END marker missing (truncated response)
                start_idx = ai_text.index(self.DIAGRAM_START) + len(self.DIAGRAM_START)
                raw_code = ai_text[start_idx:].strip()
                improved_code = clean_code_response(raw_code)
            else:
                # Fallback: AI didn't use delimiters but may have included a code block
                import re
                # Try closed code block first
                code_block_match = re.search(
                    r'```(?:' + re.escape(diagram_type) + r'|mermaid|plantuml|d2|dbml)?\s*\n(.*?)```',
                    ai_text,
                    re.DOTALL
                )
                if code_block_match:
                    raw_code = code_block_match.group(1).strip()
                    if raw_code and len(raw_code) > 20:
                        improved_code = clean_code_response(raw_code)
                
                # If no closed code block, try unclosed (truncated response)
                if not improved_code:
                    unclosed_match = re.search(
                        r'```(?:' + re.escape(diagram_type) + r'|mermaid|plantuml|d2|dbml)?\s*\n(.+)',
                        ai_text,
                        re.DOTALL
                    )
                    if unclosed_match:
                        raw_code = unclosed_match.group(1).strip()
                        # Remove trailing ``` if partially present
                        raw_code = re.sub(r'`{1,2}$', '', raw_code).strip()
                        if raw_code and len(raw_code) > 20:
                            improved_code = clean_code_response(raw_code)

                # Fallback 3: detect raw diagram code without any wrappers
                if not improved_code:
                    if diagram_type == 'plantuml' or diagram_type == 'uml':
                        # PlantUML: detect @startuml...@enduml
                        puml_match = re.search(r'(@startuml\b.*?@enduml\b)', ai_text, re.DOTALL)
                        if puml_match:
                            improved_code = puml_match.group(1).strip()
                    elif diagram_type == 'mermaid':
                        # Mermaid: detect common diagram type keywords at start of a line
                        mermaid_match = re.search(
                            r'^((?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey|gitGraph)\b.+)',
                            ai_text,
                            re.MULTILINE | re.DOTALL
                        )
                        if mermaid_match:
                            raw_code = mermaid_match.group(1).strip()
                            if len(raw_code) > 30:
                                improved_code = raw_code
                    elif diagram_type == 'dbml':
                        # DBML: detect Table keyword followed by content
                        dbml_match = re.search(r'(Table\s+\w+\s*\{.+)', ai_text, re.DOTALL)
                        if dbml_match:
                            raw_code = dbml_match.group(1).strip()
                            if len(raw_code) > 30:
                                improved_code = raw_code

            if improved_code:
                print(f"✅ DIAGRAM CODE EXTRACTED ({len(improved_code)} chars)")
                print(f"   First 200 chars: {improved_code[:200]}")

                # Auto-retry: validate syntax and retry if invalid
                # Skip retry for PlantUML and DBML — their validators give false positives
                # with skinparam blocks and complex syntax. Let Kroki be the final validator.
                skip_retry = diagram_type in ('plantuml', 'uml', 'dbml')
                retries = 0
                while improved_code and retries < MAX_RETRIES and not skip_retry:
                    validation = await SyntaxValidator.validate(
                        improved_code, diagram_type
                    )
                    if validation.is_valid:
                        print(f"✅ Syntax validation PASSED")
                        break

                    retries += 1
                    print(f"⚠️  RETRY {retries}/{MAX_RETRIES}: Syntax validation failed: {validation.error_message}")
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
                    if self.DIAGRAM_START in ai_text and self.DIAGRAM_END in ai_text:
                        start_idx = ai_text.index(self.DIAGRAM_START) + len(
                            self.DIAGRAM_START
                        )
                        end_idx = ai_text.index(self.DIAGRAM_END)
                        raw_code = ai_text[start_idx:end_idx].strip()
                        improved_code = clean_code_response(raw_code)
                    elif self.DIAGRAM_START in ai_text:
                        # Fallback: truncated retry response
                        start_idx = ai_text.index(self.DIAGRAM_START) + len(
                            self.DIAGRAM_START
                        )
                        raw_code = ai_text[start_idx:].strip()
                        improved_code = clean_code_response(raw_code)
                    else:
                        # Retry response has no diagram code; stop retrying
                        improved_code = None
                        break

                explanation_end = len(ai_text)
                # Extract display text: combine text BEFORE and AFTER the diagram block
                before_text = ''
                after_text = ''
                
                if self.DIAGRAM_START in ai_text:
                    before_text = ai_text[:ai_text.index(self.DIAGRAM_START)].strip()
                
                if self.DIAGRAM_END in ai_text:
                    end_marker_pos = ai_text.index(self.DIAGRAM_END) + len(self.DIAGRAM_END)
                    after_text = ai_text[end_marker_pos:].strip()
                
                # Combine both parts
                parts = [p for p in [before_text, after_text] if p]
                if parts:
                    display_text = '\n\n'.join(parts)
                elif self.DIAGRAM_START in ai_text and not self.DIAGRAM_END in ai_text:
                    # Truncated: only text before DIAGRAM_START
                    display_text = before_text if before_text else (
                        "Diagrama modificado según tu solicitud."
                        if language == "es"
                        else "Diagram modified as requested."
                    )
                else:
                    # Code block fallback: text before the code block
                    code_block_pos = ai_text.find('```')
                    if code_block_pos > 0:
                        display_text = ai_text[:code_block_pos].strip()
                    if not display_text or display_text == ai_text:
                        display_text = (
                            "Diagrama modificado según tu solicitud."
                            if language == "es"
                            else "Diagram modified as requested."
                        )
                improvement_status = ImprovementStatus.PENDING

            # === DEBUG: Final state ===
            print(f"\n{'='*40}")
            print(f"📦 FINAL MESSAGE STATE:")
            print(f"   improved_code: {'YES (' + str(len(improved_code)) + ' chars)' if improved_code else 'NO (text-only response)'}")
            print(f"   display_text: {display_text[:150]}...")
            print(f"   improvement_status: {improvement_status}")
            print(f"{'='*40}\n")
            # === END DEBUG ===

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
                print(f"📝 SUMMARY UPDATED ({len(new_summary)} chars)")
            except Exception as e:
                logger.warning(f"Failed to update session summary: {e}")

            # Update last_provider and last_model on the session
            try:
                session_doc = await self.session_repo.get_session_by_id(session_id_str)
                if session_doc:
                    session_doc.last_provider = provider_config.provider.value
                    session_doc.last_model = actual_model
                    await session_doc.save()
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
    #  AI client dispatch helper (used by send_message + retries)
    # ------------------------------------------------------------------ #

    @staticmethod
    async def _call_ai_client(
        client,
        system_prompt: str,
        history: list[dict],
        language: str = "es",
    ) -> str:
        """Dispatch an AI request to the appropriate client method.

        Encapsulates the client-specific call pattern so it can be reused
        for the initial request and for syntax-validation retries.
        """
        import json as _json

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
            full_prompt = "\n".join(conversation_parts)
            print(f"\n🔧 RAW PAYLOAD TO LLM (Gemini):")
            print(f"   Total prompt length: {len(full_prompt)} chars")
            print(f"   System prompt: {len(system_prompt)} chars")
            print(f"   History messages: {len(history)}")
            return await client._generate(full_prompt)
        elif hasattr(client, '_chat_completion'):
            # OpenAI
            api_messages = [{"role": "system", "content": system_prompt}]
            for msg in history:
                api_messages.append({"role": msg["role"], "content": msg["content"]})
            print(f"\n🔧 RAW PAYLOAD TO LLM (OpenAI):")
            print(f"   Messages count: {len(api_messages)}")
            for i, m in enumerate(api_messages):
                content_preview = m['content'][:200] + '...' if len(m['content']) > 200 else m['content']
                print(f"   [{i}] {m['role']}: {content_preview}")
            return await client._chat_completion(api_messages)
        elif hasattr(client, '_make_request'):
            # DeepSeek / Minimax
            api_messages = [{"role": "system", "content": system_prompt}]
            for msg in history:
                api_messages.append({"role": msg["role"], "content": msg["content"]})
            print(f"\n🔧 RAW PAYLOAD TO LLM (DeepSeek/Minimax):")
            print(f"   Messages count: {len(api_messages)}")
            for i, m in enumerate(api_messages):
                content_preview = m['content'][:200] + '...' if len(m['content']) > 200 else m['content']
                print(f"   [{i}] {m['role']}: {content_preview}")
            return await client._make_request(api_messages)
        elif hasattr(client, '_messages_request'):
            # Claude
            api_messages = []
            for msg in history:
                api_messages.append({"role": msg["role"], "content": msg["content"]})
            print(f"\n🔧 RAW PAYLOAD TO LLM (Claude):")
            print(f"   System: {len(system_prompt)} chars")
            print(f"   Messages count: {len(api_messages)}")
            for i, m in enumerate(api_messages):
                content_preview = m['content'][:200] + '...' if len(m['content']) > 200 else m['content']
                print(f"   [{i}] {m['role']}: {content_preview}")
            return await client._messages_request(
                api_messages, system=system_prompt
            )
        else:
            raise ValueError(f"Unsupported client: {type(client).__name__}")

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

        Structure:
        1. Summary as context (if exists)
        2. Recent messages as conversation history (excluding the last user message)
        3. Last user message marked as "[Nueva petición]" for clarity
        
        This helps the AI distinguish between historical context and the current request.
        """
        history: list[dict] = []
        
        if summary:
            history.append({
                "role": "assistant",
                "content": (
                    f"[Contexto de la conversación]\n{summary}\n\n"
                    "IMPORTANTE: El diagrama actual ya refleja todos los cambios anteriores. "
                    "Si el usuario pide modificaciones, genera el código COMPLETO entre <<<DIAGRAM>>> y <<<END_DIAGRAM>>>."
                )
            })
        
        # Filter out error messages
        valid_messages = [m for m in messages if m.role != MessageRole.ERROR]
        
        if not valid_messages:
            return history
        
        # Check if last message is from user (the new request)
        last_msg = valid_messages[-1]
        context_messages = valid_messages[:-1] if last_msg.role == MessageRole.USER else valid_messages
        
        # Add context messages (historical)
        for m in context_messages:
            role = "user" if m.role == MessageRole.USER else "assistant"
            history.append({"role": role, "content": m.content})
        
        # Add the last user message with a clear marker
        if last_msg.role == MessageRole.USER:
            history.append({
                "role": "user",
                "content": f"[Nueva petición del usuario]:\n{last_msg.content}"
            })
        
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
                lines = combined.split('\n')
                # Remove oldest lines until within limit
                while len('\n'.join(lines)) > MAX_SUMMARY_LENGTH and len(lines) > 4:
                    lines.pop(0)
                combined = '\n'.join(lines)
            
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
