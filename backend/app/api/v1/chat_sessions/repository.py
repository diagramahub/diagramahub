"""
Concrete implementations of chat session and message repositories.
Follows the same Beanie patterns as prompt_history/repository.py.
"""
from datetime import datetime, timezone
from typing import Optional

from beanie import PydanticObjectId

from .interfaces import IChatSessionRepository, IChatMessageRepository
from .schemas import ChatSessionInDB, ChatMessageInDB


class ChatSessionRepository(IChatSessionRepository):
    """MongoDB implementation of chat session repository using Beanie."""

    async def create_session(
        self, user_id: str, diagram_id: str, title: str
    ) -> ChatSessionInDB:
        """Create a new chat session with status='active' and timestamps."""
        now = datetime.now(timezone.utc)
        session = ChatSessionInDB(
            user_id=user_id,
            diagram_id=diagram_id,
            title=title,
            status="active",
            created_at=now,
            updated_at=now,
        )
        await session.insert()
        return session

    async def get_sessions_by_diagram(
        self, user_id: str, diagram_id: str
    ) -> list[ChatSessionInDB]:
        """Get all sessions for a diagram, ordered by updated_at descending."""
        return (
            await ChatSessionInDB.find(
                {"user_id": user_id, "diagram_id": diagram_id}
            )
            .sort("-updated_at")
            .to_list()
        )

    async def get_session_by_id(
        self, session_id: str
    ) -> Optional[ChatSessionInDB]:
        """Get a chat session by its ID."""
        try:
            return await ChatSessionInDB.get(PydanticObjectId(session_id))
        except Exception:
            return None

    async def update_session_title(
        self, session_id: str, title: str
    ) -> ChatSessionInDB:
        """Update the title of a chat session."""
        session = await self.get_session_by_id(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        session.title = title
        session.updated_at = datetime.now(timezone.utc)
        await session.save()
        return session

    async def update_session_summary(
        self, session_id: str, summary: str
    ) -> ChatSessionInDB:
        """Update the rolling summary of a chat session."""
        session = await self.get_session_by_id(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        session.summary = summary
        session.updated_at = datetime.now(timezone.utc)
        await session.save()
        return session

    async def update_session_status(
        self, session_id: str, status: str
    ) -> ChatSessionInDB:
        """Update the status of a chat session."""
        session = await self.get_session_by_id(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        session.status = status
        session.updated_at = datetime.now(timezone.utc)
        await session.save()
        return session

    async def delete_session(self, session_id: str) -> bool:
        """Delete a chat session by its ID."""
        session = await self.get_session_by_id(session_id)
        if not session:
            return False
        await session.delete()
        return True


class ChatMessageRepository(IChatMessageRepository):
    """MongoDB implementation of chat message repository using Beanie."""

    async def create_message(
        self,
        session_id: str,
        role: str,
        content: str,
        improved_code: Optional[str] = None,
        improvement_status: Optional[str] = None,
        provider_used: Optional[str] = None,
        model_used: Optional[str] = None,
        generation_time: Optional[float] = None,
    ) -> ChatMessageInDB:
        """Create a new chat message with timestamp."""
        message = ChatMessageInDB(
            session_id=session_id,
            role=role,
            content=content,
            improved_code=improved_code,
            improvement_status=improvement_status,
            provider_used=provider_used,
            model_used=model_used,
            generation_time=generation_time,
            created_at=datetime.now(timezone.utc),
        )
        await message.insert()
        return message

    async def get_messages_by_session(
        self, session_id: str, limit: int = 50, skip: int = 0
    ) -> list[ChatMessageInDB]:
        """Get messages for a session, ordered by created_at ascending with pagination."""
        return (
            await ChatMessageInDB.find({"session_id": session_id})
            .sort("+created_at")
            .skip(skip)
            .limit(limit)
            .to_list()
        )

    async def get_recent_messages(
        self, session_id: str, limit: int = 20
    ) -> list[ChatMessageInDB]:
        """Get the most recent N messages for a session (for conversation context).

        Returns messages in chronological order (oldest first among the recent N).
        """
        recent = (
            await ChatMessageInDB.find({"session_id": session_id})
            .sort("-created_at")
            .limit(limit)
            .to_list()
        )
        # Reverse to return in chronological order (oldest first)
        recent.reverse()
        return recent

    async def delete_message(self, message_id: str) -> bool:
        """Delete a single message by its ID."""
        try:
            message = await ChatMessageInDB.get(PydanticObjectId(message_id))
        except Exception:
            return False
        if not message:
            return False
        await message.delete()
        return True

    async def delete_messages_by_session(self, session_id: str) -> int:
        """Delete all messages belonging to a session. Returns count deleted."""
        result = await ChatMessageInDB.find(
            {"session_id": session_id}
        ).delete()
        return result.deleted_count if result else 0

    async def update_message_status(
        self, message_id: str, status: str
    ) -> ChatMessageInDB:
        """Update the improvement status of a message."""
        try:
            message = await ChatMessageInDB.get(PydanticObjectId(message_id))
        except Exception:
            raise ValueError(f"Message {message_id} not found")
        if not message:
            raise ValueError(f"Message {message_id} not found")
        message.improvement_status = status
        await message.save()
        return message

    async def count_messages_by_session(self, session_id: str) -> int:
        """Count the number of messages in a session."""
        return await ChatMessageInDB.find(
            {"session_id": session_id}
        ).count()
