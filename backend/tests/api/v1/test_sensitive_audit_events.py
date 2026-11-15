"""
Audit entries for sensitive actions outside authentication (invariant #7).

Shared links are exercised end to end; the helper used by every route (AI
providers, integrations, plans) is covered for its email/IP resolution and its
never-raise guarantee.
"""

from unittest.mock import patch

import pytest
from beanie import PydanticObjectId
from httpx import AsyncClient

from app.api.v1.users import audit_log
from app.api.v1.users.audit_log import AuditLogEntry

pytestmark = pytest.mark.integration


async def _create_diagram(client: AsyncClient) -> str:
    project = (await client.post("/api/v1/projects", json={"name": "Audit", "emoji": "🔍"})).json()
    diagram = await client.post(
        f"/api/v1/projects/{project['id']}/diagrams",
        json={"title": "Flow", "content": "graph TD\n  A-->B", "diagram_type": "mermaid"},
    )
    assert diagram.status_code == 201
    return diagram.json()["id"]


async def _entries(event: str) -> list[AuditLogEntry]:
    return await AuditLogEntry.find(AuditLogEntry.event == event).to_list()


async def test_shared_link_lifecycle_is_audited(
    authenticated_client: AsyncClient, registered_user: dict
) -> None:
    diagram_id = await _create_diagram(authenticated_client)

    created = await authenticated_client.post(
        "/api/v1/shared-links", json={"diagram_id": diagram_id, "expiration_days": 5}
    )
    assert created.status_code == 201
    link_id = created.json()["id"]

    updated = await authenticated_client.put(
        f"/api/v1/shared-links/{link_id}", json={"allow_copy_code": True}
    )
    assert updated.status_code == 200

    revoked = await authenticated_client.delete(f"/api/v1/shared-links/{link_id}")
    assert revoked.status_code == 200

    [create_entry] = await _entries(audit_log.EVENT_SHARED_LINK_CREATED)
    assert create_entry.user_email == registered_user["email"]
    assert f"diagram={diagram_id}" in (create_entry.details or "")
    assert "access=public" in (create_entry.details or "")

    [update_entry] = await _entries(audit_log.EVENT_SHARED_LINK_UPDATED)
    assert update_entry.details == f"link={link_id} fields=allow_copy_code"

    [revoke_entry] = await _entries(audit_log.EVENT_SHARED_LINK_REVOKED)
    assert revoke_entry.details == f"link={link_id}"


async def test_helper_resolves_the_user_email(
    authenticated_client: AsyncClient, registered_user: dict
) -> None:
    user_id = registered_user["user"]["id"]

    await audit_log.log_event_for_user_id(
        audit_log.EVENT_AI_PROVIDER_ADDED, user_id, details="provider=gemini"
    )

    [entry] = await _entries(audit_log.EVENT_AI_PROVIDER_ADDED)
    assert entry.user_email == registered_user["email"]
    assert entry.user_id == user_id
    assert entry.details == "provider=gemini"


async def test_helper_records_an_unknown_user_instead_of_failing(test_db) -> None:
    missing_id = str(PydanticObjectId())

    await audit_log.log_event_for_user_id(audit_log.EVENT_PLAN_DELETED, missing_id)

    [entry] = await _entries(audit_log.EVENT_PLAN_DELETED)
    assert entry.user_email == f"unknown:{missing_id}"


async def test_helper_never_raises_when_the_insert_fails(test_db) -> None:
    with patch.object(AuditLogEntry, "insert", side_effect=RuntimeError("db down")):
        await audit_log.log_event_for_user_id(
            audit_log.EVENT_INTEGRATION_DELETED, str(PydanticObjectId())
        )
