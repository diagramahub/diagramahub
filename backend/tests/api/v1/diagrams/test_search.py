"""
Search across the user's diagrams: title, description and content.
"""

import json

import pytest
from httpx import AsyncClient

from app.api.v1.diagrams.schemas import DiagramSearchHit
from app.api.v1.diagrams.services import _locate_match, _snippet

pytestmark = pytest.mark.integration


async def _project(client: AsyncClient, name: str = "Search") -> str:
    return (await client.post("/api/v1/projects", json={"name": name, "emoji": "🔎"})).json()["id"]


async def _diagram(client: AsyncClient, project_id: str, **fields) -> str:
    body = {"title": "Untitled", "content": "graph TD\n  A-->B", "diagram_type": "mermaid"}
    body.update(fields)
    response = await client.post(f"/api/v1/projects/{project_id}/diagrams", json=body)
    assert response.status_code == 201, response.text
    return response.json()["id"]


async def _search(client: AsyncClient, **params) -> list[dict]:
    response = await client.get("/api/v1/diagrams/search", params=params)
    assert response.status_code == 200, response.text
    return response.json()


async def test_finds_text_in_the_content(authenticated_client: AsyncClient) -> None:
    pid = await _project(authenticated_client)
    did = await _diagram(
        authenticated_client, pid, title="Checkout", content="graph TD\n  Cart-->PaymentGateway"
    )
    await _diagram(authenticated_client, pid, title="Other")

    [hit] = await _search(authenticated_client, q="paymentgate")

    assert hit["id"] == did
    assert hit["matched_in"] == "content"
    assert "PaymentGateway" in hit["snippet"]
    assert hit["project_name"] == "Search"


async def test_title_and_description_matches(authenticated_client: AsyncClient) -> None:
    pid = await _project(authenticated_client)
    await _diagram(authenticated_client, pid, title="Login flow")
    await _diagram(
        authenticated_client, pid, title="Signup", description="Explains the login retry"
    )

    hits = {h["title"]: h for h in await _search(authenticated_client, q="login")}

    assert hits["Login flow"]["matched_in"] == "title"
    assert hits["Login flow"]["snippet"] == ""
    assert hits["Signup"]["matched_in"] == "description"
    assert "login retry" in hits["Signup"]["snippet"]


async def test_filters_by_type_and_project(authenticated_client: AsyncClient) -> None:
    p1 = await _project(authenticated_client, "One")
    p2 = await _project(authenticated_client, "Two")
    await _diagram(authenticated_client, p1, title="Orders mermaid")
    await _diagram(
        authenticated_client,
        p1,
        title="Orders d2",
        diagram_type="d2",
        content="orders -> billing",
    )
    await _diagram(authenticated_client, p2, title="Orders elsewhere")

    by_type = await _search(authenticated_client, q="orders", type="d2")
    by_project = await _search(authenticated_client, q="orders", project_id=p2)

    assert [h["title"] for h in by_type] == ["Orders d2"]
    assert [h["title"] for h in by_project] == ["Orders elsewhere"]


async def test_text_is_matched_literally(authenticated_client: AsyncClient) -> None:
    pid = await _project(authenticated_client)
    await _diagram(authenticated_client, pid, title="Plain", content="graph TD\n  A-->B")
    await _diagram(authenticated_client, pid, title="Dots", content="graph TD\n  a.*b-->c")

    hits = await _search(authenticated_client, q=".*")

    assert [h["title"] for h in hits] == ["Dots"]


async def test_another_users_project_is_not_searchable(
    authenticated_client: AsyncClient,
) -> None:
    response = await authenticated_client.get(
        "/api/v1/diagrams/search", params={"q": "abc", "project_id": "0" * 24}
    )

    assert response.status_code == 404


async def test_query_must_have_two_characters(authenticated_client: AsyncClient) -> None:
    response = await authenticated_client.get("/api/v1/diagrams/search", params={"q": "a"})

    assert response.status_code == 422


@pytest.mark.unit
def test_snippet_is_cut_around_the_match() -> None:
    text = "x" * 200 + " needle " + "y" * 200

    snippet = _snippet(text, "NEEDLE")

    assert snippet.startswith("…") and snippet.endswith("…")
    assert "needle" in snippet
    assert len(snippet) < 140


@pytest.mark.unit
def test_sketch_snippets_come_from_canvas_texts() -> None:
    content = json.dumps(
        {"version": 1, "elements": [{"type": "text", "text": 'Payment "service"'}]}
    )
    hit = DiagramSearchHit.model_validate(
        {
            "_id": "0" * 24,
            "title": "Sketch",
            "content": content,
            "diagram_type": "freehand",
            "project_id": "p",
            "created_at": "2026-01-01T00:00:00",
        }
    )

    matched_in, snippet = _locate_match(hit, "service")

    assert matched_in == "content"
    assert snippet == 'Payment "service"'
