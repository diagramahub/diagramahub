"""Unit tests for GeminiClient.complete() prompt handling (no network)."""

from types import SimpleNamespace
from typing import Any

import pytest

from app.api.v1.ai_providers.clients.gemini_client import GeminiClient
from app.api.v1.chat_sessions.services import ChatSessionService


class _FakeModels:
    """Stands in for ``client.aio.models`` and records each call."""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def generate_content(self, **kwargs: Any) -> SimpleNamespace:
        self.calls.append(kwargs)
        return SimpleNamespace(text="  ok  ")


def _client_with_fake_models() -> tuple[GeminiClient, _FakeModels]:
    """Build a GeminiClient whose SDK calls are captured instead of sent."""
    client = GeminiClient(api_key="test-key", model="gemini-test")
    models = _FakeModels()
    client.client = SimpleNamespace(aio=SimpleNamespace(models=models))
    return client, models


@pytest.mark.unit
async def test_complete_sends_system_prompt_as_system_instruction() -> None:
    """Regression: complete() used to drop the system prompt entirely."""
    client, models = _client_with_fake_models()

    result = await client.complete("SYSTEM: current diagram + markers", "User: make it blue")

    assert result == "ok"
    call = models.calls[0]
    assert call["contents"] == "User: make it blue"
    assert call["config"].system_instruction == "SYSTEM: current diagram + markers"


@pytest.mark.unit
async def test_complete_without_system_prompt_sets_no_instruction() -> None:
    """An empty system prompt is not sent as an (empty) instruction."""
    client, models = _client_with_fake_models()

    await client.complete("", "Just the prompt")

    assert models.calls[0]["config"].system_instruction is None


@pytest.mark.unit
async def test_chat_dispatch_reaches_gemini_with_diagram_context() -> None:
    """The non-streaming chat path must deliver the diagram/instructions to Gemini."""
    client, models = _client_with_fake_models()
    history = [
        {"role": "user", "content": "Add a node C"},
        {"role": "assistant", "content": "Done"},
        {"role": "user", "content": "Now make it red"},
    ]

    await ChatSessionService._call_ai_client(
        client, "Diagram:\ngraph TD\n  A-->B\n<<<DIAGRAMA>>>", history, language="es"
    )

    call = models.calls[0]
    assert "graph TD" in call["config"].system_instruction
    assert "<<<DIAGRAMA>>>" in call["config"].system_instruction
    assert "Usuario: Now make it red" in call["contents"]
