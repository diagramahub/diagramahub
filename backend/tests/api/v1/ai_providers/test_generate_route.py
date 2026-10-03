"""Generate/improve: truncated or empty model replies become clear API errors (0.8.1 G2)."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.api.v1.ai_providers.clients.base import BaseAIClient
from app.api.v1.ai_providers.repository import AIProviderRepository
from app.api.v1.ai_providers.schemas import AIProviderType


class FakeClient(BaseAIClient):
    """A provider whose reply the test controls."""

    def __init__(self, reply: str, truncated: bool = False):
        super().__init__("test-key-123", "fake-model", {})
        self.reply, self.truncated = reply, truncated
        self.calls: list[dict] = []

    async def complete(self, system_prompt, user_prompt, *, max_tokens=None, temperature=None):  # noqa: ANN001, ANN201
        self.calls.append({"system": system_prompt, "user": user_prompt, "max_tokens": max_tokens, "temperature": temperature})
        self.last_truncated = self.truncated
        return self.reply

    async def generate_description(self, *a, **k):  # noqa: ANN002, ANN003, ANN201
        return ""

    # Not used here; present so the abstract base can be instantiated
    fix_diagram = chat_with_context = summarize_conversation = generate_description

    async def validate_api_key(self) -> bool:
        return True

    @property
    def provider_name(self) -> str:
        return "Fake"


def _provider() -> SimpleNamespace:
    return SimpleNamespace(provider=AIProviderType.OPENAI, api_key="k", model="fake-model", parameters={})


async def _generate(client: AsyncClient, fake: FakeClient):  # noqa: ANN202
    with patch.object(AIProviderRepository, "get_active_provider", AsyncMock(return_value=_provider())), patch(
        "app.api.v1.ai_providers.services.AIClientFactory.create_client", return_value=fake
    ):
        return await client.post(
            "/api/v1/ai/generate-diagram",
            json={"description": "Un flujo de inicio de sesión con MFA", "diagram_type": "mermaid", "language": "es"},
        )


@pytest.mark.integration
async def test_generate_returns_the_extracted_code_with_the_code_budget(authenticated_client: AsyncClient) -> None:
    fake = FakeClient("Aquí está:\n```mermaid\ngraph TD\n  A-->B\n```")
    response = await _generate(authenticated_client, fake)

    assert response.status_code == 200
    assert response.json()["diagram_code"] == "graph TD\n  A-->B"
    call = fake.calls[0]
    assert call["max_tokens"] == 8192 and call["temperature"] == 0.2
    assert "MERMAID RULES" in call["system"] and "in Spanish" in call["system"]


@pytest.mark.integration
async def test_truncated_reply_is_a_422_with_its_code(authenticated_client: AsyncClient) -> None:
    response = await _generate(authenticated_client, FakeClient("```mermaid\ngraph TD\n  A-->", truncated=True))

    assert response.status_code == 422
    assert response.json()["detail"] == {"error": "response_truncated"}


@pytest.mark.integration
async def test_empty_reply_is_a_502_with_its_code(authenticated_client: AsyncClient) -> None:
    response = await _generate(authenticated_client, FakeClient("<think>pensando…</think>"))

    assert response.status_code == 502
    assert response.json()["detail"] == {"error": "empty_response"}
