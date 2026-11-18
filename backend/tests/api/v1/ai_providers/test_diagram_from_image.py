"""
Diagram from image: upload validation, provider support and what each API receives.
"""

import base64
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from httpx import AsyncClient

from app.api.v1.ai_providers.clients.claude_client import ClaudeClient
from app.api.v1.ai_providers.clients.deepseek_client import DeepSeekClient
from app.api.v1.ai_providers.clients.gemini_client import GeminiClient
from app.api.v1.ai_providers.clients.openai_client import OpenAIClient
from app.api.v1.ai_providers.repository import AIProviderRepository
from app.api.v1.ai_providers.schemas import AIProviderType
from app.api.v1.ai_providers.services import (
    MAX_IMAGE_BYTES,
    AIProviderService,
    sniff_image_type,
)

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
WEBP = b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"\x00" * 64
REPLY = "Here it is:\n```mermaid\ngraph TD\n  Start-->End\n```"


def _provider(kind: AIProviderType) -> SimpleNamespace:
    return SimpleNamespace(provider=kind, api_key="k-test", model="m", parameters={})


async def _upload(
    client: AsyncClient,
    fake_client: object,
    kind: AIProviderType = AIProviderType.OPENAI,
    data: bytes = PNG,
    filename: str = "board.png",
    **form: str,
):
    with (
        patch.object(
            AIProviderRepository, "get_active_provider", AsyncMock(return_value=_provider(kind))
        ),
        patch(
            "app.api.v1.ai_providers.services.AIClientFactory.create_client",
            return_value=fake_client,
        ),
    ):
        return await client.post(
            "/api/v1/ai/diagram-from-image",
            files={"image": (filename, data, "image/png")},
            data={"diagram_type": "mermaid", "language": "es", **form},
        )


@pytest.mark.unit
@pytest.mark.parametrize(
    "data, expected",
    [(PNG, "image/png"), (JPEG, "image/jpeg"), (WEBP, "image/webp"), (b"GIF89a....", None)],
)
def test_image_type_comes_from_the_bytes(data: bytes, expected: str | None) -> None:
    assert sniff_image_type(data) == expected


@pytest.mark.integration
async def test_openai_receives_the_image_as_a_data_url(
    authenticated_client: AsyncClient,
) -> None:
    client = OpenAIClient("k-test", "gpt-test", {})
    sent: dict = {}

    async def fake_chat(messages, response_format=None, max_tokens=None):  # noqa: ANN001, ANN202
        sent["messages"], sent["max_tokens"] = messages, max_tokens
        return REPLY

    with patch.object(client, "_chat_completion", fake_chat):
        response = await _upload(authenticated_client, client, instructions="Use LR")

    assert response.status_code == 200, response.text
    assert response.json()["diagram_code"] == "graph TD\n  Start-->End"
    user = sent["messages"][1]["content"]
    assert user[0]["type"] == "text" and "Use LR" in user[0]["text"]
    assert user[1]["image_url"]["url"] == "data:image/png;base64," + base64.b64encode(PNG).decode()
    assert sent["max_tokens"] == 8192
    assert "MERMAID RULES" in sent["messages"][0]["content"]


@pytest.mark.integration
async def test_claude_receives_a_base64_image_block(authenticated_client: AsyncClient) -> None:
    client = ClaudeClient("k-test", "claude-test", {})
    sent: dict = {}

    async def fake_request(
        messages, system=None, temperature=None, max_tokens=None
    ):  # noqa: ANN001, ANN202
        sent["messages"], sent["system"] = messages, system
        return REPLY

    with patch.object(client, "_messages_request", fake_request):
        response = await _upload(authenticated_client, client, AIProviderType.CLAUDE, data=JPEG)

    assert response.status_code == 200, response.text
    image_block = sent["messages"][0]["content"][0]
    assert image_block["source"]["media_type"] == "image/jpeg"
    assert image_block["source"]["data"] == base64.b64encode(JPEG).decode()
    assert "MERMAID RULES" in sent["system"]


@pytest.mark.integration
async def test_gemini_receives_an_inline_part(authenticated_client: AsyncClient) -> None:
    client = GeminiClient("k-test", "gemini-test", {})
    sent: dict = {}

    async def fake_generate(
        contents, temperature=None, max_tokens=None, system_instruction=None
    ):  # noqa: ANN001, ANN202
        sent["contents"] = contents
        return REPLY

    with patch.object(client, "_generate", fake_generate):
        response = await _upload(authenticated_client, client, AIProviderType.GEMINI, data=WEBP)

    assert response.status_code == 200, response.text
    part, text = sent["contents"]
    assert part.inline_data.mime_type == "image/webp" and part.inline_data.data == WEBP
    assert "Recreate the diagram" in text


@pytest.mark.integration
async def test_providers_without_image_input_answer_422(
    authenticated_client: AsyncClient,
) -> None:
    client = DeepSeekClient("k-test", "deepseek-test", {})

    response = await _upload(authenticated_client, client, AIProviderType.DEEPSEEK)

    assert response.status_code == 422
    assert response.json()["detail"] == {
        "error": "images_not_supported",
        "provider": "deepseek",
        "model": "m",
    }


@pytest.mark.integration
async def test_a_file_that_is_not_an_image_is_rejected(authenticated_client: AsyncClient) -> None:
    response = await _upload(
        authenticated_client, OpenAIClient("k", "m", {}), data=b"%PDF-1.7 not an image"
    )

    assert response.status_code == 400
    assert response.json()["detail"] == {"error": "invalid_image"}


@pytest.mark.unit
async def test_an_image_over_the_limit_is_rejected() -> None:
    repository = MagicMock(get_active_provider=AsyncMock())
    service = AIProviderService(repository=repository)

    with pytest.raises(HTTPException) as caught:
        await service.generate_diagram_from_image("u1", PNG + b"\x00" * MAX_IMAGE_BYTES, "mermaid")

    assert caught.value.status_code == 400
    assert caught.value.detail == {"error": "image_too_large"}
    repository.get_active_provider.assert_not_awaited()


@pytest.mark.integration
async def test_unsupported_diagram_type_is_rejected(authenticated_client: AsyncClient) -> None:
    response = await _upload(
        authenticated_client, OpenAIClient("k", "m", {}), diagram_type="freehand"
    )

    assert response.status_code == 422


@pytest.mark.integration
async def test_the_model_picked_in_the_chat_is_the_one_used(
    authenticated_client: AsyncClient,
) -> None:
    fake = MagicMock(supports_images=True)
    fake.generate_diagram_from_image = AsyncMock(return_value="graph TD\n  A-->B")

    with (
        patch(
            "app.api.v1.ai_providers.services.AIClientFactory.create_client", return_value=fake
        ) as create,
        patch.object(
            AIProviderRepository,
            "get_active_provider",
            AsyncMock(return_value=_provider(AIProviderType.OPENAI)),
        ),
    ):
        response = await authenticated_client.post(
            "/api/v1/ai/diagram-from-image",
            files={"image": ("board.png", PNG, "image/png")},
            data={"diagram_type": "mermaid", "language": "es", "model": "gpt-5.4-mini"},
        )

    assert response.status_code == 200, response.text
    assert create.call_args.kwargs["model"] == "gpt-5.4-mini"
    assert response.json()["model_used"] == "gpt-5.4-mini"


@pytest.mark.integration
async def test_a_model_without_image_input_is_refused_before_calling_it(
    authenticated_client: AsyncClient,
) -> None:
    fake = MagicMock(supports_images=True)
    fake.generate_diagram_from_image = AsyncMock()

    # The catalog knows deepseek-flash and marks it without image input.
    response = await _upload(authenticated_client, fake, model="deepseek-flash")

    assert response.status_code == 422
    assert response.json()["detail"] == {
        "error": "images_not_supported",
        "provider": "openai",
        "model": "deepseek-flash",
    }
    fake.generate_diagram_from_image.assert_not_called()


@pytest.mark.unit
def test_image_support_comes_from_the_catalog_or_the_provider() -> None:
    from app.api.v1.ai_providers.model_catalog import all_models, supports_images

    readers = {m.provider for m in all_models() if m.supports_images}

    assert readers == {"gemini", "openai", "claude"}
    assert supports_images("deepseek-flash", provider_reads_images=True) is False
    assert supports_images("some-new-model", provider_reads_images=True) is True
    assert supports_images("some-new-model", provider_reads_images=False) is False
