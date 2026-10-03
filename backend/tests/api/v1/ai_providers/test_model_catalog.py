"""AI model catalog (0.8.1 F2/F4) and the Claude temperature handling."""

import json
from unittest.mock import AsyncMock, patch

import pytest

from app.api.v1.ai_providers import model_catalog
from app.api.v1.ai_providers.clients.claude_client import ClaudeClient
from app.api.v1.ai_providers.clients.factory import AIClientFactory
from app.api.v1.ai_providers.schemas import AIProviderType

PROVIDERS = [p.value for p in AIProviderType]


def test_every_provider_has_exactly_one_recommended_listed_model() -> None:
    for provider in PROVIDERS:
        recommended = [m for m in model_catalog.all_models() if m.provider == provider and m.recommended]
        assert len(recommended) == 1, provider
        assert recommended[0].listed, provider


def test_catalog_ids_are_unique_and_context_windows_positive() -> None:
    raw = json.loads(model_catalog._CATALOG_FILE.read_text(encoding="utf-8"))["models"]
    ids = [m["id"] for m in raw]
    assert len(ids) == len(set(ids))
    assert all(m["context_window"] > 0 and m["provider"] in PROVIDERS for m in raw)


def test_unknown_models_get_safe_defaults() -> None:
    assert model_catalog.context_window("some-future-model") == model_catalog.DEFAULT_CONTEXT_WINDOW
    assert model_catalog.supports_temperature("some-future-model") is True
    assert model_catalog.context_window("MiniMax-M2.7") == 204800  # was 1M by mistake


def test_clients_default_to_the_recommended_model() -> None:
    for provider in PROVIDERS:
        client = AIClientFactory.create_client(
            provider=AIProviderType(provider), api_key="test-key-123", model=None, parameters={}
        )
        assert client.model == model_catalog.recommended_model(provider)


class _Response:
    def __init__(self, status: int, body: dict):
        self.status_code = status
        self._body = body
        self.text = json.dumps(body)

    def json(self) -> dict:
        return self._body


OK = _Response(200, {"content": [{"type": "text", "text": "OK"}]})


@pytest.mark.parametrize(("model", "expects_temperature"), [("claude-sonnet-5-5", False), ("claude-haiku-4-5-20251001", True)])
async def test_claude_sends_temperature_only_when_the_model_accepts_it(model: str, expects_temperature: bool) -> None:
    post = AsyncMock(return_value=OK)
    with patch("httpx.AsyncClient.post", post):
        assert await ClaudeClient("k" * 20, model).complete("system", "hi") == "OK"
    payload = post.call_args.kwargs["json"]
    assert ("temperature" in payload) is expects_temperature


async def test_claude_retries_without_temperature_when_an_unknown_model_rejects_it() -> None:
    rejected = _Response(400, {"type": "error", "error": {"message": "`temperature` is deprecated for this model."}})
    post = AsyncMock(side_effect=[rejected, OK])
    with patch("httpx.AsyncClient.post", post):
        assert await ClaudeClient("k" * 20, "claude-future-9").complete("system", "hi") == "OK"
    first, second = (call.kwargs["json"] for call in post.call_args_list)
    assert "temperature" in first and "temperature" not in second
