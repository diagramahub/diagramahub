"""
Fixing and converting are code requests: they get the code output budget, and a
reply cut at the limit (reasoning models can spend it all thinking) fails with a
clear error instead of an unparseable one.
"""

import json

import pytest

from app.api.v1.ai_providers.clients.base import CODE_MAX_TOKENS, TruncatedResponseError
from app.api.v1.ai_providers.clients.claude_client import ClaudeClient
from app.api.v1.ai_providers.clients.deepseek_client import DeepSeekClient
from app.api.v1.ai_providers.clients.gemini_client import GeminiClient
from app.api.v1.ai_providers.clients.minimax_client import MinimaxClient
from app.api.v1.ai_providers.clients.openai_client import OpenAIClient
from app.api.v1.diagrams.conversion_service import DiagramConversionService

FIXED = json.dumps(
    {"corrected_code": "graph TD\n  A-->B", "explanation": "x", "changes_summary": "x"}
)

# Each client and the method that sends its requests.
CLIENTS = [
    (DeepSeekClient, "_make_request"),
    (MinimaxClient, "_make_request"),
    (OpenAIClient, "_chat_completion"),
    (ClaudeClient, "_messages_request"),
    (GeminiClient, "_generate"),
]


def _client(cls, method: str, truncated: bool, reply: str, seen: dict):
    client = cls(api_key="test-key", model=None, parameters={"max_output_tokens": 2048})

    async def fake(*args, **kwargs):
        seen.update(kwargs)
        client.last_truncated = truncated
        return reply

    setattr(client, method, fake)
    return client


@pytest.mark.unit
@pytest.mark.parametrize("cls, method", CLIENTS, ids=[c.__name__ for c, _ in CLIENTS])
async def test_fix_gets_the_code_budget(cls, method) -> None:
    seen: dict = {}
    client = _client(cls, method, truncated=False, reply=FIXED, seen=seen)

    result = await client.fix_diagram("graph TD\n  A-->", "mermaid")

    assert seen["max_tokens"] == CODE_MAX_TOKENS
    assert result["corrected_code"] == "graph TD\n  A-->B"


@pytest.mark.unit
@pytest.mark.parametrize("cls, method", CLIENTS, ids=[c.__name__ for c, _ in CLIENTS])
async def test_fix_cut_at_the_limit_says_so(cls, method) -> None:
    client = _client(cls, method, truncated=True, reply="", seen={})

    with pytest.raises(ValueError, match="output limit"):
        await client.fix_diagram("graph TD\n  A-->", "mermaid")


class _FakeClient:
    def __init__(self, truncated: bool) -> None:
        self.truncated = truncated
        self.last_truncated = True  # stale value from an earlier call
        self.max_tokens = None

    async def complete(self, system_prompt, user_prompt, *, max_tokens=None, temperature=None):
        self.max_tokens = max_tokens
        self.last_truncated = self.truncated
        return "flowchart LR\n  A --> B"

    raise_if_truncated = DeepSeekClient.raise_if_truncated


@pytest.mark.unit
async def test_convert_gets_the_code_budget() -> None:
    client = _FakeClient(truncated=False)

    reply = await DiagramConversionService._call_with_prompt(None, client, "prompt")  # type: ignore[arg-type]

    assert client.max_tokens == CODE_MAX_TOKENS
    assert reply.startswith("flowchart")


@pytest.mark.unit
async def test_convert_cut_at_the_limit_says_so() -> None:
    with pytest.raises(TruncatedResponseError):
        await DiagramConversionService._call_with_prompt(None, _FakeClient(truncated=True), "p")  # type: ignore[arg-type]


@pytest.mark.unit
@pytest.mark.parametrize("diagram_type", ["mermaid", "plantuml", "d2", "dbml"])
@pytest.mark.parametrize("language, text", [("es", "sin cambios"), ("en", "unchanged")])
def test_fix_prompt_lets_valid_code_come_back(diagram_type: str, language: str, text: str) -> None:
    """Without this, reasoning models search for an error until the output limit."""
    from app.api.v1.ai_providers.prompts import build_fix_prompt

    assert text in build_fix_prompt("x", diagram_type, None, language)
