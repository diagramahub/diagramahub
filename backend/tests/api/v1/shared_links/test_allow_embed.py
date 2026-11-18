"""
Embedding is opt-in per shared link and visible to the public embed page.
"""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.integration


async def _diagram_id(client: AsyncClient) -> str:
    project = (await client.post("/api/v1/projects", json={"name": "Embed", "emoji": "🧩"})).json()
    diagram = await client.post(
        f"/api/v1/projects/{project['id']}/diagrams",
        json={"title": "Flow", "content": "graph TD\n  A-->B", "diagram_type": "mermaid"},
    )
    return diagram.json()["id"]


async def test_embedding_is_off_by_default(authenticated_client: AsyncClient) -> None:
    diagram_id = await _diagram_id(authenticated_client)

    link = (
        await authenticated_client.post("/api/v1/shared-links", json={"diagram_id": diagram_id})
    ).json()
    info = (await authenticated_client.get(f"/api/v1/shared/{link['token']}/info")).json()

    assert link["allow_embed"] is False
    assert info["allow_embed"] is False


async def test_owner_can_turn_embedding_on_and_off(authenticated_client: AsyncClient) -> None:
    diagram_id = await _diagram_id(authenticated_client)
    link = (
        await authenticated_client.post(
            "/api/v1/shared-links", json={"diagram_id": diagram_id, "allow_embed": True}
        )
    ).json()
    token = link["token"]

    assert link["allow_embed"] is True
    assert (await authenticated_client.get(f"/api/v1/shared/{token}/info")).json()["allow_embed"]
    diagram = (await authenticated_client.get(f"/api/v1/shared/{token}/diagram")).json()
    assert diagram["allow_embed"] is True

    updated = await authenticated_client.put(
        f"/api/v1/shared-links/{link['id']}", json={"allow_embed": False}
    )

    assert updated.json()["allow_embed"] is False
    info = (await authenticated_client.get(f"/api/v1/shared/{token}/info")).json()
    assert info["allow_embed"] is False


async def test_other_settings_keep_the_embed_choice(authenticated_client: AsyncClient) -> None:
    diagram_id = await _diagram_id(authenticated_client)
    link = (
        await authenticated_client.post(
            "/api/v1/shared-links", json={"diagram_id": diagram_id, "allow_embed": True}
        )
    ).json()

    updated = await authenticated_client.put(
        f"/api/v1/shared-links/{link['id']}", json={"allow_copy_code": True}
    )

    assert updated.json()["allow_embed"] is True
