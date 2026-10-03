"""Automatic fix of generated diagrams: per-user setting (0.8.1 G1)."""

import pytest
from httpx import AsyncClient


@pytest.mark.integration
async def test_auto_fix_is_on_by_default_and_can_be_turned_off(authenticated_client: AsyncClient) -> None:
    initial = (await authenticated_client.get("/api/v1/ai/settings")).json()
    off = await authenticated_client.put("/api/v1/ai/settings/auto-fix", json={"enabled": False})
    again = (await authenticated_client.get("/api/v1/ai/settings")).json()
    on = await authenticated_client.put("/api/v1/ai/settings/auto-fix", json={"enabled": True})

    assert initial["auto_fix_generated"] is True
    assert off.status_code == 200 and off.json()["auto_fix_generated"] is False
    assert again["auto_fix_generated"] is False
    assert on.json()["auto_fix_generated"] is True


@pytest.mark.integration
async def test_auto_fix_setting_requires_authentication(client: AsyncClient) -> None:
    response = await client.put("/api/v1/ai/settings/auto-fix", json={"enabled": False})
    assert response.status_code in (401, 403)
