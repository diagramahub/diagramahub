"""Settings show each AI key masked from the key itself, never the ciphertext."""

import pytest
from httpx import AsyncClient

from app.api.v1.ai_providers.schemas import AIProviderConfig, UserAISettingsInDB
from app.core.security import encrypt_api_key, mask_stored_api_key

FAKE_KEY = "AIzaFakeKeyForTests0000xyz"


@pytest.mark.unit
def test_stored_key_is_masked_from_its_plain_text() -> None:
    assert mask_stored_api_key(encrypt_api_key(FAKE_KEY)) == "AIza...xyz"
    assert mask_stored_api_key("not-a-fernet-token-at-all") == "***"


@pytest.mark.integration
async def test_settings_list_the_key_masked(authenticated_client: AsyncClient) -> None:
    me = (await authenticated_client.get("/api/v1/users/me")).json()
    await UserAISettingsInDB(
        user_id=me["id"],
        providers=[
            AIProviderConfig(
                provider="gemini", api_key=encrypt_api_key(FAKE_KEY), model="gemini-3.8-flash"
            )
        ],
    ).insert()

    body = (await authenticated_client.get("/api/v1/ai/settings")).json()

    assert body["providers"][0]["api_key"] == "AIza...xyz"
    assert FAKE_KEY not in str(body)
