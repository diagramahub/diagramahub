"""Unit tests for BaseAIClient.complete_chat() across providers (no network)."""

from types import SimpleNamespace
from typing import Any

import pytest

from app.api.v1.ai_providers.clients.claude_client import ClaudeClient
from app.api.v1.ai_providers.clients.deepseek_client import DeepSeekClient
from app.api.v1.ai_providers.clients.gemini_client import GeminiClient
from app.api.v1.ai_providers.clients.minimax_client import MinimaxClient
from app.api.v1.ai_providers.clients.openai_client import OpenAIClient
from app.api.v1.chat_sessions.services import ChatSessionService

SYSTEM = "Diagram:\ngraph TD\n  A-->B\n<<<DIAGRAMA>>>"
HISTORY = [
    {"role": "user", "content": "Add a node C", "id": "m1"},
    {"role": "assistant", "content": "Done", "id": "m2"},
    {"role": "user", "content": "Now make it red", "id": "m3"},
]
NATIVE_TURNS = [{"role": m["role"], "content": m["content"]} for m in HISTORY]


def _capture(client: Any, method: str) -> list[dict[str, Any]]:
    """Replace a client's low-level request method with a recorder."""
    calls: list[dict[str, Any]] = []

    async def fake(messages: list[dict], **kwargs: Any) -> str:
        calls.append({"messages": messages, **kwargs})
        return "ok"

    setattr(client, method, fake)
    return calls


@pytest.mark.unit
@pytest.mark.parametrize(
    ("client_cls", "method"),
    [
        (OpenAIClient, "_chat_completion"),
        (DeepSeekClient, "_make_request"),
        (MinimaxClient, "_make_request"),
    ],
)
async def test_openai_style_providers_get_system_plus_native_turns(
    client_cls: Any, method: str
) -> None:
    """Chat-completions providers receive a system message followed by real turns."""
    client = client_cls(api_key="test-key")
    calls = _capture(client, method)

    assert await client.complete_chat(SYSTEM, HISTORY, language="es") == "ok"

    assert calls[0]["messages"] == [{"role": "system", "content": SYSTEM}, *NATIVE_TURNS]


@pytest.mark.unit
async def test_claude_gets_top_level_system_and_native_turns() -> None:
    """Claude receives the system prompt in its top-level field and real turns."""
    client = ClaudeClient(api_key="test-key")
    calls = _capture(client, "_messages_request")

    await client.complete_chat(SYSTEM, HISTORY, language="es")

    assert calls[0]["messages"] == NATIVE_TURNS
    assert calls[0]["system"] == SYSTEM


@pytest.mark.unit
async def test_gemini_default_flattens_turns_and_keeps_system_instruction() -> None:
    """Gemini uses the base flattening (as in 0.6.2) plus its system_instruction."""
    client = GeminiClient(api_key="test-key", model="gemini-test")
    recorded: list[dict[str, Any]] = []

    async def generate_content(**kwargs: Any) -> SimpleNamespace:
        recorded.append(kwargs)
        return SimpleNamespace(text="ok")

    client.client = SimpleNamespace(
        aio=SimpleNamespace(models=SimpleNamespace(generate_content=generate_content))
    )

    await client.complete_chat(SYSTEM, HISTORY, language="en")

    assert recorded[0]["config"].system_instruction == SYSTEM
    assert recorded[0]["contents"] == (
        "User: Add a node C\nAssistant: Done\nUser: Now make it red\nAssistant:"
    )


@pytest.mark.unit
async def test_chat_dispatch_uses_complete_chat_with_full_history() -> None:
    """The chat service hands the raw history to complete_chat (no pre-flattening)."""
    client = OpenAIClient(api_key="test-key")
    calls = _capture(client, "_chat_completion")

    await ChatSessionService._call_ai_client(client, SYSTEM, HISTORY, language="es")

    assert calls[0]["messages"] == [{"role": "system", "content": SYSTEM}, *NATIVE_TURNS]
