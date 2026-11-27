"""What the user reads when a chat reply fails (0.9.2): no internal details."""

import pytest

from app.api.v1.ai_providers.clients.base import ProviderError
from app.api.v1.chat_sessions.services import _error_text


@pytest.mark.parametrize("language", ["es", "en"])
def test_internal_errors_never_reach_the_user(language: str) -> None:
    exc = RuntimeError("ServerSelectionTimeoutError: mongodb:27017 collection chat_messages")
    text = _error_text(exc, language)
    assert "mongodb" not in text and "chat_messages" not in text
    assert text == (
        "No se pudo generar la respuesta. Inténtalo de nuevo."
        if language == "es"
        else "The reply couldn't be generated. Please try again."
    )


def test_provider_errors_keep_their_localized_reason() -> None:
    exc = ProviderError(
        "invalid_key", "OpenAI: la llave de API no es válida o no tiene permisos.", 401, "OpenAI"
    )
    assert _error_text(exc, "es") == "OpenAI: la llave de API no es válida o no tiene permisos."
    assert _error_text(exc, "en") == "OpenAI: the API key is invalid or has no permissions."


@pytest.mark.parametrize(
    "exc", [TimeoutError(), ValueError("DeepSeek API streaming request timed out")]
)
def test_timeouts_say_so_without_internal_text(exc: Exception) -> None:
    assert _error_text(exc, "en") == "The AI provider took too long to answer. Please try again."
    assert "DeepSeek API" not in _error_text(exc, "es")
