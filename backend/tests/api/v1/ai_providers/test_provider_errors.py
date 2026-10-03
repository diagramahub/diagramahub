"""Provider errors are classified (0.8.1 F5) and the connection test is real (F6)."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.api.v1.ai_providers.clients.base import ProviderError, provider_error
from app.api.v1.ai_providers.clients.openai_client import OpenAIClient


@pytest.mark.parametrize(
    ("status", "body", "code"),
    [
        (429, '{"error":{"type":"insufficient_quota","code":"credit_balance_exhausted"}}', "no_credits"),  # OpenAI
        (402, '{"error":{"message":"Insufficient Balance"}}', "no_credits"),  # DeepSeek
        (402, "insufficient balance (1008)", "no_credits"),  # MiniMax
        (400, '{"error":{"message":"Your credit balance is too low to access the Anthropic API."}}', "no_credits"),
        (429, '{"error":{"message":"Rate limit reached for requests"}}', "rate_limited"),
        (401, '{"error":{"code":"invalid_api_key"}}', "invalid_key"),
        (404, '{"error":{"code":"model_not_found"}}', "model_unavailable"),
        (400, '{"error":{"message":"Model Not Exist","type":"invalid_request_error"}}', "model_unavailable"),  # DeepSeek
        (500, "upstream failure", "provider_error"),
    ],
)
def test_provider_errors_are_classified(status: int, body: str, code: str) -> None:
    error = provider_error("OpenAI", status, body)
    assert isinstance(error, ProviderError) and isinstance(error, ValueError)
    assert error.code == code


def test_no_credits_is_not_reported_as_a_rate_limit() -> None:
    message = str(provider_error("OpenAI", 429, '{"error":{"type":"insufficient_quota"}}'))
    assert "créditos" in message and "límite de solicitudes" not in message


@pytest.mark.integration
async def test_test_provider_reports_no_credits_for_a_key_that_lists_models(authenticated_client: AsyncClient) -> None:
    """The old check only listed models, so a key without credits was "valid"."""
    no_credit = provider_error("OpenAI", 429, '{"error":{"type":"insufficient_quota"}}')
    with patch.object(OpenAIClient, "_chat_completion", AsyncMock(side_effect=no_credit)), patch.object(
        OpenAIClient, "validate_api_key", AsyncMock(return_value=True)
    ):
        response = await authenticated_client.post(
            "/api/v1/ai/test-provider", json={"provider": "openai", "api_key": "sk-test-1234567890", "model": "gpt-5.4-mini"}
        )

    body = response.json()
    assert response.status_code == 200
    assert body["valid"] is False and body["error_code"] == "no_credits"
