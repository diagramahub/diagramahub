"""
Abstract interfaces for chat session and message repositories.
Follows the Dependency Inversion Principle (SOLID).
"""
from abc import ABC, abstractmethod
from typing import Optional

from .schemas import ChatSessionInDB, ChatMessageInDB


class IChatSessionRepository(ABC):
    """Abstract interface for chat session data access."""

    @abstractmethod
    async def create_session(
        self, user_id: str, diagram_id: str, title: str
    ) -> ChatSessionInDB:
        """Create a new chat session."""
        pass

    @abstractmethod
    async def get_sessions_by_diagram(
        self, user_id: str, diagram_id: str
    ) -> list[ChatSessionInDB]:
        """Get all sessions for a diagram, ordered by updated_at descending."""
        pass

    @abstractmethod
    async def get_session_by_id(
        self, session_id: str
    ) -> Optional[ChatSessionInDB]:
        """Get a chat session by its ID."""
        pass

    @abstractmethod
    async def update_session_title(
        self, session_id: str, title: str
    ) -> ChatSessionInDB:
        """Update the title of a chat session."""
        pass

    @abstractmethod
    async def update_session_status(
        self, session_id: str, status: str
    ) -> ChatSessionInDB:
        """Update the status of a chat session."""
        pass

    @abstractmethod
    async def delete_session(self, session_id: str) -> bool:
        """Delete a chat session by its ID."""
        pass


class IChatMessageRepository(ABC):
    """Abstract interface for chat message data access."""

    @abstractmethod
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
        """Create a new chat message."""
        pass

    @abstractmethod
    async def get_messages_by_session(
        self, session_id: str, limit: int = 50, skip: int = 0
    ) -> list[ChatMessageInDB]:
        """Get messages for a session, ordered by created_at ascending."""
        pass

    @abstractmethod
    async def get_recent_messages(
        self, session_id: str, limit: int = 20
    ) -> list[ChatMessageInDB]:
        """Get the most recent N messages for a session (for conversation context)."""
        pass

    @abstractmethod
    async def delete_message(self, message_id: str) -> bool:
        """Delete a single message by its ID."""
        pass

    @abstractmethod
    async def delete_messages_by_session(self, session_id: str) -> int:
        """Delete all messages belonging to a session. Returns count deleted."""
        pass

    @abstractmethod
    async def update_message_status(
        self, message_id: str, status: str
    ) -> ChatMessageInDB:
        """Update the improvement status of a message."""
        pass

    @abstractmethod
    async def count_messages_by_session(self, session_id: str) -> int:
        """Count the number of messages in a session."""
        pass
