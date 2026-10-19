"""Chat sessions are private to their owner (0.8.4).

Every ``/chat-sessions/{id}`` endpoint requires a session token, and a session
owned by someone else answers 404 like a missing one. Message endpoints also
check that the message belongs to the session in the URL.
"""

import pytest
from faker import Faker
from httpx import AsyncClient

from app.api.v1.chat_sessions.repository import ChatMessageRepository
from app.api.v1.chat_sessions.schemas import ChatMessageInDB, ChatSessionInDB, ImprovementStatus
from tests.utils.security import generate_test_password

pytestmark = pytest.mark.integration

fake = Faker()
BASE = "/api/v1/chat-sessions"


async def _login(client: AsyncClient) -> dict:
    """Register a new user and return its Authorization header."""
    data = {
        "email": fake.unique.email(),
        "password": generate_test_password(),
        "full_name": fake.name(),
    }
    assert (await client.post("/api/v1/users/register", json=data)).status_code == 201
    login = await client.post(
        "/api/v1/users/login", json={"email": data["email"], "password": data["password"]}
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


async def _session(client: AsyncClient, headers: dict) -> str:
    """Create a chat session for the user behind ``headers`` and return its id."""
    response = await client.post(BASE, json={"diagram_id": "d1"}, headers=headers)
    assert response.status_code == 201
    return response.json()["id"]


async def _pending_message(session_id: str) -> str:
    """Store an assistant message with a pending improvement and return its id."""
    msg = await ChatMessageRepository().create_message(
        session_id=session_id,
        role="assistant",
        content="Listo",
        improved_code="flowchart TD\n  A --> B",
        improvement_status=ImprovementStatus.PENDING,
    )
    return str(msg.id)


def _endpoints(session_id: str, message_id: str) -> list[tuple[str, str, dict | None]]:
    """Every per-session endpoint as (method, url, json body)."""
    return [
        ("GET", f"{BASE}/{session_id}", None),
        ("PUT", f"{BASE}/{session_id}", {"title": "Nuevo"}),
        ("PUT", f"{BASE}/{session_id}/model", {"provider": "openai", "model": "gpt-5.4-mini"}),
        ("PUT", f"{BASE}/{session_id}/messages/{message_id}/status", {"status": "accepted"}),
        ("DELETE", f"{BASE}/{session_id}/messages/{message_id}", None),
        ("DELETE", f"{BASE}/{session_id}", None),
    ]


async def test_session_endpoints_require_a_token(client: AsyncClient) -> None:
    owner = await _login(client)
    session_id = await _session(client, owner)
    message_id = await _pending_message(session_id)

    for method, url, body in _endpoints(session_id, message_id):
        response = await client.request(method, url, json=body)
        assert response.status_code == 401, (method, url)

    assert await ChatSessionInDB.get(session_id) is not None
    assert await ChatMessageInDB.get(message_id) is not None


async def test_another_users_session_is_not_found(client: AsyncClient) -> None:
    owner = await _login(client)
    intruder = await _login(client)
    session_id = await _session(client, owner)
    message_id = await _pending_message(session_id)

    for method, url, body in _endpoints(session_id, message_id):
        response = await client.request(method, url, json=body, headers=intruder)
        assert response.status_code == 404, (method, url)

    session = await ChatSessionInDB.get(session_id)
    assert session is not None and session.title != "Nuevo" and session.last_model is None
    msg = await ChatMessageInDB.get(message_id)
    assert msg is not None and msg.improvement_status == ImprovementStatus.PENDING


async def test_sending_a_message_to_another_users_session_is_not_found(client: AsyncClient) -> None:
    owner = await _login(client)
    intruder = await _login(client)
    session_id = await _session(client, owner)
    body = {"content": "Hola", "diagram_code": "flowchart TD", "diagram_type": "mermaid"}

    response = await client.post(f"{BASE}/{session_id}/messages", json=body, headers=intruder)
    assert response.status_code == 404

    stream = await client.post(f"{BASE}/{session_id}/messages/stream", json=body, headers=intruder)
    assert '"type": "error"' in stream.text or '"type":"error"' in stream.text
    assert await ChatMessageRepository().count_messages_by_session(session_id) == 0


async def test_a_message_from_another_session_is_not_found(client: AsyncClient) -> None:
    owner = await _login(client)
    session_a = await _session(client, owner)
    session_b = await _session(client, owner)
    message_in_b = await _pending_message(session_b)

    status_url = f"{BASE}/{session_a}/messages/{message_in_b}/status"
    assert (
        await client.put(status_url, json={"status": "accepted"}, headers=owner)
    ).status_code == 404
    delete_url = f"{BASE}/{session_a}/messages/{message_in_b}"
    assert (await client.delete(delete_url, headers=owner)).status_code == 404
    assert await ChatMessageInDB.get(message_in_b) is not None


async def test_the_owner_can_use_every_endpoint(client: AsyncClient) -> None:
    owner = await _login(client)
    session_id = await _session(client, owner)
    message_id = await _pending_message(session_id)

    responses = [
        await client.request(method, url, json=body, headers=owner)
        for method, url, body in _endpoints(session_id, message_id)
    ]

    assert [r.status_code for r in responses] == [200] * 6
    assert responses[1].json()["title"] == "Nuevo"
    assert responses[3].json()["improvement_status"] == "accepted"
    assert await ChatSessionInDB.get(session_id) is None


async def test_testing_a_provider_key_requires_a_token(client: AsyncClient) -> None:
    body = {"provider": "openai", "api_key": "sk-test-1234567890", "model": "gpt-5.4-mini"}
    assert (await client.post("/api/v1/ai/test-provider", json=body)).status_code == 401
