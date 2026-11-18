"""
API keys: creation, per-area permissions, allowed endpoints and revocation.
"""

from datetime import timedelta

import pytest
from beanie import PydanticObjectId
from httpx import AsyncClient

from app.api.v1.api_tokens.permissions import AccessLevel, ApiKeyArea, required_access
from app.api.v1.api_tokens.schemas import ApiTokenInDB
from app.api.v1.users.audit_log import AuditLogEntry
from app.core.clock import utcnow

pytestmark = pytest.mark.integration

READ_ALL = {"projects": "read", "diagrams": "read", "sharing": "read", "community": "read"}
WRITE_ALL = {
    "projects": "write",
    "diagrams": "write",
    "sharing": "write",
    "community": "write",
    "ai": "write",
}


async def _create_token(client: AsyncClient, permissions: dict | None = None, **body) -> dict:
    payload = {"name": "CI", "permissions": permissions or READ_ALL, "expires_in_days": 30}
    payload.update(body)
    response = await client.post("/api/v1/api-tokens", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


class KeyClient:
    """Calls the API with a key instead of the session."""

    def __init__(self, client: AsyncClient, token: str):
        self.client = client
        self.headers = {"Authorization": f"Bearer {token}"}

    async def __aenter__(self) -> "KeyClient":
        self.session = self.client.headers.pop("Authorization")
        return self

    async def __aexit__(self, *_exc) -> None:
        self.client.headers["Authorization"] = self.session

    async def request(self, method: str, path: str, **kwargs):
        return await self.client.request(method, "/api/v1" + path, headers=self.headers, **kwargs)


async def _diagram(client: AsyncClient) -> tuple[str, str]:
    project = (await client.post("/api/v1/projects", json={"name": "Mine", "emoji": "📁"})).json()
    diagram = await client.post(
        f"/api/v1/projects/{project['id']}/diagrams",
        json={"title": "Flow", "content": "graph TD\n  A-->B", "diagram_type": "mermaid"},
    )
    return project["id"], diagram.json()["id"]


# --------------------------------------------------------------------------- #
#  Endpoint -> area and level
# --------------------------------------------------------------------------- #


P, D, S, C, AI = (
    ApiKeyArea.PROJECTS,
    ApiKeyArea.DIAGRAMS,
    ApiKeyArea.SHARING,
    ApiKeyArea.COMMUNITY,
    ApiKeyArea.AI,
)
R, W = AccessLevel.READ, AccessLevel.WRITE


@pytest.mark.parametrize(
    "method, path, expected",
    [
        ("GET", "/projects", {P: R}),
        ("POST", "/projects/p1/folders", {P: W}),
        ("PUT", "/folders/f1", {P: W}),
        ("POST", "/projects/p1/diagrams", {D: W}),
        ("GET", "/projects/p1/diagrams", {D: R}),
        ("POST", "/projects/p1/import", {P: W, D: W}),
        ("PUT", "/diagrams/d1", {D: W}),
        ("POST", "/diagrams/render", {D: R}),
        ("GET", "/diagrams/favorites", {D: R}),
        ("PUT", "/diagrams/d1/favorite", {D: W}),
        ("GET", "/activity/heatmap", {D: R}),
        ("GET", "/community/me/impact", {C: R}),
        # Fixing returns the diagram's code: it also needs to read diagrams.
        ("POST", "/diagrams/d1/fix", {AI: W, D: R}),
        ("POST", "/diagrams/convert", {AI: W}),
        # A new link exposes the diagram; changing or revoking one doesn't.
        ("POST", "/shared-links", {S: W, D: R}),
        ("GET", "/shared-links/diagram/d1", {S: R}),
        ("DELETE", "/shared-links/l1", {S: W}),
        ("GET", "/community/my-published", {C: R}),
        ("GET", "/community/diagrams", {C: R}),
        # Publishing makes the code public.
        ("POST", "/community/diagrams", {C: W, D: R}),
        ("PUT", "/community/diagrams/x", {C: W}),
        ("POST", "/community/diagrams/x/fork", {C: W, D: W}),
        ("PUT", "/community/admin/diagrams/x", None),
        ("GET", "/users/me", None),
        ("GET", "/api-tokens", None),
        ("POST", "/ai/chat", None),
        ("GET", "/projectsx", None),
    ],
)
def test_required_access(method: str, path: str, expected) -> None:
    assert required_access(method, path) == expected


# --------------------------------------------------------------------------- #
#  Keys
# --------------------------------------------------------------------------- #


async def test_token_is_shown_once_and_stored_hashed(authenticated_client: AsyncClient) -> None:
    created = await _create_token(authenticated_client, {"diagrams": "read"})

    assert created["token"].startswith("dh_pat_")
    assert created["token_hint"].endswith("…")
    assert created["permissions"] == {
        "projects": "none",
        "diagrams": "read",
        "sharing": "none",
        "community": "none",
        "ai": "none",
    }
    listed = (await authenticated_client.get("/api/v1/api-tokens")).json()
    assert [t["id"] for t in listed] == [created["id"]]
    assert "token" not in listed[0]
    stored = await ApiTokenInDB.find_one()
    assert stored is not None and created["token"] not in stored.model_dump_json()


@pytest.mark.parametrize(
    "permissions",
    [
        {},
        {"projects": "none"},
        {"ai": "read"},
        {"billing": "read"},
        {"projects": "admin"},
    ],
)
async def test_invalid_permissions_are_rejected(
    authenticated_client: AsyncClient, permissions: dict
) -> None:
    response = await authenticated_client.post(
        "/api/v1/api-tokens", json={"name": "x", "permissions": permissions}
    )

    assert response.status_code == 422


async def test_read_access_reads_but_cannot_write(authenticated_client: AsyncClient) -> None:
    await authenticated_client.post("/api/v1/projects", json={"name": "Visible", "emoji": "📁"})
    token = (await _create_token(authenticated_client, {"projects": "read"}))["token"]

    async with KeyClient(authenticated_client, token) as key:
        projects = await key.request("GET", "/projects")
        create = await key.request("POST", "/projects", json={"name": "Nope", "emoji": "📁"})

    assert projects.status_code == 200
    assert [p["name"] for p in projects.json()] == ["Visible"]
    assert create.status_code == 403
    assert create.json()["detail"]["needs"] == {"projects": "write"}


async def test_each_area_is_independent(authenticated_client: AsyncClient) -> None:
    _, diagram_id = await _diagram(authenticated_client)
    token = (await _create_token(authenticated_client, {"diagrams": "write"}))["token"]

    async with KeyClient(authenticated_client, token) as key:
        edited = await key.request(
            "PUT", f"/diagrams/{diagram_id}", json={"description": "From CI"}
        )
        projects = await key.request("GET", "/projects")
        share = await key.request("POST", "/shared-links", json={"diagram_id": diagram_id})

    assert edited.status_code == 200 and edited.json()["description"] == "From CI"
    assert projects.status_code == 403
    assert share.status_code == 403
    assert share.json()["detail"]["needs"] == {"sharing": "write"}


async def test_sharing_access_shares_and_unshares(authenticated_client: AsyncClient) -> None:
    _, diagram_id = await _diagram(authenticated_client)
    perms = {"sharing": "write", "diagrams": "read"}
    token = (await _create_token(authenticated_client, perms))["token"]

    async with KeyClient(authenticated_client, token) as key:
        created = await key.request("POST", "/shared-links", json={"diagram_id": diagram_id})
        found = await key.request("GET", f"/shared-links/diagram/{diagram_id}")
        revoked = await key.request("DELETE", f"/shared-links/{created.json()['id']}")

    assert created.status_code == 201, created.text
    assert found.json()["id"] == created.json()["id"]
    assert revoked.status_code in (200, 204)


async def test_community_access_publishes_and_unpublishes(
    authenticated_client: AsyncClient,
) -> None:
    _, diagram_id = await _diagram(authenticated_client)
    reader = (await _create_token(authenticated_client, {"community": "read"}))["token"]
    perms = {"community": "write", "diagrams": "read"}
    writer = (await _create_token(authenticated_client, perms))["token"]
    body = {"diagram_id": diagram_id, "category": "architecture", "tags": ["ci"]}

    async with KeyClient(authenticated_client, reader) as key:
        denied = await key.request("POST", "/community/diagrams", json=body)
    async with KeyClient(authenticated_client, writer) as key:
        published = await key.request("POST", "/community/diagrams", json=body)
        mine = await key.request("GET", "/community/my-published")
        removed = await key.request("DELETE", f"/community/diagrams/{published.json()['id']}")

    assert denied.status_code == 403
    assert published.status_code == 201, published.text
    assert [p["diagram_id"] for p in mine.json()] == [diagram_id]
    assert removed.status_code == 204


async def test_fork_needs_community_and_diagrams(authenticated_client: AsyncClient) -> None:
    project_id, diagram_id = await _diagram(authenticated_client)
    pub = (
        await authenticated_client.post(
            "/api/v1/community/diagrams",
            json={"diagram_id": diagram_id, "category": "architecture"},
        )
    ).json()
    community_only = (await _create_token(authenticated_client, {"community": "write"}))["token"]
    both = (await _create_token(authenticated_client, {"community": "write", "diagrams": "write"}))[
        "token"
    ]
    body = {"project_id": project_id}

    async with KeyClient(authenticated_client, community_only) as key:
        denied = await key.request("POST", f"/community/diagrams/{pub['id']}/fork", json=body)
    async with KeyClient(authenticated_client, both) as key:
        forked = await key.request("POST", f"/community/diagrams/{pub['id']}/fork", json=body)

    assert denied.status_code == 403
    assert denied.json()["detail"]["needs"] == {"diagrams": "write"}
    assert forked.status_code == 201, forked.text


async def test_ai_needs_its_own_permission(authenticated_client: AsyncClient) -> None:
    _, diagram_id = await _diagram(authenticated_client)
    everything_but_ai = {**WRITE_ALL, "ai": "none"}
    token = (await _create_token(authenticated_client, everything_but_ai))["token"]

    async with KeyClient(authenticated_client, token) as key:
        response = await key.request(
            "POST", f"/diagrams/{diagram_id}/fix", json={"error_context": "x"}
        )

    assert response.status_code == 403
    assert response.json()["detail"]["needs"] == {"ai": "write"}


async def test_exposing_a_diagrams_code_needs_to_read_diagrams(
    authenticated_client: AsyncClient,
) -> None:
    """AI fix, publishing and sharing hand out the code: no way around diagrams:read."""
    _, diagram_id = await _diagram(authenticated_client)
    no_diagrams = {**WRITE_ALL, "ai": "write", "diagrams": "none"}
    token = (await _create_token(authenticated_client, no_diagrams))["token"]

    async with KeyClient(authenticated_client, token) as key:
        fix = await key.request("POST", f"/diagrams/{diagram_id}/fix", json={"language": "es"})
        publish = await key.request(
            "POST", "/community/diagrams", json={"diagram_id": diagram_id, "category": "uml"}
        )
        share = await key.request("POST", "/shared-links", json={"diagram_id": diagram_id})
        browse = await key.request("GET", "/community/diagrams")

    for denied in (fix, publish, share):
        assert denied.status_code == 403
        assert denied.json()["detail"]["needs"] == {"diagrams": "read"}
    assert "read access to diagrams" in fix.json()["detail"]["message"]
    assert browse.status_code == 200


@pytest.mark.parametrize(
    "method, path",
    [
        ("GET", "/users/me"),
        ("GET", "/api-tokens"),
        ("GET", "/ai/settings"),
        ("GET", "/community/admin/reports"),
    ],
)
async def test_key_cannot_reach_account_keys_ai_settings_or_admin(
    authenticated_client: AsyncClient, method: str, path: str
) -> None:
    token = (await _create_token(authenticated_client, WRITE_ALL))["token"]

    async with KeyClient(authenticated_client, token) as key:
        response = await key.request(method, path)

    assert response.status_code == 403


async def test_keys_with_the_old_global_scope_still_work(
    authenticated_client: AsyncClient,
) -> None:
    created = await _create_token(authenticated_client, {"projects": "read"})
    # As stored before per-area permissions: a global "write" scope.
    await ApiTokenInDB.find_one(ApiTokenInDB.id == PydanticObjectId(created["id"])).update(
        {"$set": {"scope": "write", "permissions": {}}}
    )
    [listed] = (await authenticated_client.get("/api/v1/api-tokens")).json()

    async with KeyClient(authenticated_client, created["token"]) as key:
        create = await key.request("POST", "/projects", json={"name": "Old key", "emoji": "🗝️"})

    assert listed["permissions"] == {**WRITE_ALL, "ai": "none"}
    assert create.status_code == 201


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

    statuses = []
    for t in (revoked, expired):
        async with KeyClient(authenticated_client, t["token"]) as key:
            statuses.append((await key.request("GET", "/projects")).status_code)

    assert statuses == [401, 401]


async def test_token_creation_and_revocation_are_audited(
    authenticated_client: AsyncClient, registered_user: dict
) -> None:
    created = await _create_token(
        authenticated_client, {"projects": "read", "diagrams": "write"}, expires_in_days=None
    )
    await authenticated_client.delete(f"/api/v1/api-tokens/{created['id']}")

    events = {e.event: e for e in await AuditLogEntry.find().to_list()}

    assert events["api_token_created"].user_email == registered_user["email"]
    details = events["api_token_created"].details or ""
    assert "permissions=projects:read,diagrams:write" in details
    assert "expires=never" in details
    assert events["api_token_revoked"].details == f"id={created['id']}"


async def test_another_users_token_cannot_be_revoked(authenticated_client: AsyncClient) -> None:
    response = await authenticated_client.delete("/api/v1/api-tokens/" + "0" * 24)

    assert response.status_code == 404


async def test_invalid_expiration_is_rejected(authenticated_client: AsyncClient) -> None:
    response = await authenticated_client.post(
        "/api/v1/api-tokens",
        json={"name": "x", "permissions": READ_ALL, "expires_in_days": 7},
    )

    assert response.status_code == 422


async def test_last_used_is_recorded(authenticated_client: AsyncClient) -> None:
    token = (await _create_token(authenticated_client))["token"]
    async with KeyClient(authenticated_client, token) as key:
        await key.request("GET", "/projects")

    [listed] = (await authenticated_client.get("/api/v1/api-tokens")).json()

    assert listed["last_used_at"] is not None
