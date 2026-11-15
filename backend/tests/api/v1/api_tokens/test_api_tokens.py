"""
Personal API tokens: creation, use, scopes, allowed endpoints and revocation.
"""

from datetime import timedelta

import pytest
from beanie import PydanticObjectId
from httpx import AsyncClient

from app.api.v1.api_tokens.schemas import ApiTokenInDB
from app.api.v1.users.audit_log import AuditLogEntry
from app.core.clock import utcnow

pytestmark = pytest.mark.integration


async def _create_token(client: AsyncClient, **body) -> dict:
    payload = {"name": "CI", "scope": "read", "expires_in_days": 30}
    payload.update(body)
    response = await client.post("/api/v1/api-tokens", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_token_is_shown_once_and_stored_hashed(authenticated_client: AsyncClient) -> None:
    created = await _create_token(authenticated_client)

    assert created["token"].startswith("dh_pat_")
    assert created["token_hint"].endswith("…")
    listed = (await authenticated_client.get("/api/v1/api-tokens")).json()
    assert [t["id"] for t in listed] == [created["id"]]
    assert "token" not in listed[0]
    stored = await ApiTokenInDB.find_one()
    assert stored is not None and created["token"] not in stored.model_dump_json()


async def test_read_token_lists_projects_but_cannot_write(
    authenticated_client: AsyncClient,
) -> None:
    await authenticated_client.post("/api/v1/projects", json={"name": "Visible", "emoji": "📁"})
    token = (await _create_token(authenticated_client))["token"]
    session = authenticated_client.headers.pop("Authorization")

    try:
        projects = await authenticated_client.get("/api/v1/projects", headers=_bearer(token))
        create = await authenticated_client.post(
            "/api/v1/projects", json={"name": "Nope", "emoji": "📁"}, headers=_bearer(token)
        )
    finally:
        authenticated_client.headers["Authorization"] = session

    assert projects.status_code == 200
    assert [p["name"] for p in projects.json()] == ["Visible"]
    assert create.status_code == 403


async def test_write_token_can_create(authenticated_client: AsyncClient) -> None:
    token = (await _create_token(authenticated_client, scope="write"))["token"]
    session = authenticated_client.headers.pop("Authorization")

    try:
        response = await authenticated_client.post(
            "/api/v1/projects", json={"name": "From CI", "emoji": "🤖"}, headers=_bearer(token)
        )
    finally:
        authenticated_client.headers["Authorization"] = session

    assert response.status_code == 201


@pytest.mark.parametrize(
    "method, path",
    [
        ("GET", "/api/v1/users/me"),
        ("GET", "/api/v1/api-tokens"),
        ("GET", "/api/v1/ai/settings"),
    ],
)
async def test_token_cannot_reach_account_or_token_endpoints(
    authenticated_client: AsyncClient, method: str, path: str
) -> None:
    token = (await _create_token(authenticated_client, scope="write"))["token"]
    session = authenticated_client.headers.pop("Authorization")

    try:
        response = await authenticated_client.request(method, path, headers=_bearer(token))
    finally:
        authenticated_client.headers["Authorization"] = session

    assert response.status_code == 403


async def test_revoked_and_expired_tokens_are_rejected(
    authenticated_client: AsyncClient,
) -> None:
    revoked = await _create_token(authenticated_client)
    expired = await _create_token(authenticated_client)
    await ApiTokenInDB.find_one(ApiTokenInDB.id == PydanticObjectId(expired["id"])).update(
        {"$set": {"expires_at": utcnow() - timedelta(minutes=1)}}
    )
    assert (
        await authenticated_client.delete(f"/api/v1/api-tokens/{revoked['id']}")
    ).status_code == 200
    session = authenticated_client.headers.pop("Authorization")

    try:
        statuses = [
            (
                await authenticated_client.get("/api/v1/projects", headers=_bearer(t["token"]))
            ).status_code
            for t in (revoked, expired)
        ]
    finally:
        authenticated_client.headers["Authorization"] = session

    assert statuses == [401, 401]


async def test_token_creation_and_revocation_are_audited(
    authenticated_client: AsyncClient, registered_user: dict
) -> None:
    created = await _create_token(authenticated_client, scope="write", expires_in_days=None)
    await authenticated_client.delete(f"/api/v1/api-tokens/{created['id']}")

    events = {e.event: e for e in await AuditLogEntry.find().to_list()}

    assert events["api_token_created"].user_email == registered_user["email"]
    assert "scope=write" in (events["api_token_created"].details or "")
    assert "expires=never" in (events["api_token_created"].details or "")
    assert events["api_token_revoked"].details == f"id={created['id']}"


async def test_another_users_token_cannot_be_revoked(authenticated_client: AsyncClient) -> None:
    response = await authenticated_client.delete("/api/v1/api-tokens/" + "0" * 24)

    assert response.status_code == 404


async def test_invalid_expiration_is_rejected(authenticated_client: AsyncClient) -> None:
    response = await authenticated_client.post(
        "/api/v1/api-tokens", json={"name": "x", "scope": "read", "expires_in_days": 7}
    )

    assert response.status_code == 422


async def test_last_used_is_recorded(authenticated_client: AsyncClient) -> None:
    token = (await _create_token(authenticated_client))["token"]
    session = authenticated_client.headers.pop("Authorization")
    try:
        await authenticated_client.get("/api/v1/projects", headers=_bearer(token))
    finally:
        authenticated_client.headers["Authorization"] = session

    [listed] = (await authenticated_client.get("/api/v1/api-tokens")).json()

    assert listed["last_used_at"] is not None
