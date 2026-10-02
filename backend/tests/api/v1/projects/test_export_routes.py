"""Integration tests for GET /projects/{id}/export and /export/summary."""

import io
import json
import zipfile

import pytest
from httpx import AsyncClient

from app.api.v1.projects.export_service import export_rate_limiter, export_summary_rate_limiter


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    export_rate_limiter.reset()
    export_summary_rate_limiter.reset()
    yield
    export_rate_limiter.reset()
    export_summary_rate_limiter.reset()


async def _seed(client: AsyncClient) -> dict:
    """A project with a root diagram, a folder with two diagrams and an empty folder."""
    project = (await client.post(
        "/api/v1/projects", json={"name": "Proyecto Export", "emoji": "📦", "description": "Pagos"}
    )).json()
    pid = project["id"]
    arch = (await client.post(f"/api/v1/projects/{pid}/folders", json={"name": "Arquitectura", "color": "#8B5CF6"})).json()
    await client.post(f"/api/v1/projects/{pid}/folders", json={"name": "Vacía", "color": "#10B981"})
    mk = lambda **kw: client.post(f"/api/v1/projects/{pid}/diagrams", json=kw)  # noqa: E731
    assert (await mk(title="Borrador", content="graph LR\n  X-->Y", diagram_type="mermaid", description="Un borrador")).status_code == 201
    assert (await mk(title="Flujo de login", content="graph TD\n  A-->B", diagram_type="mermaid", folder_id=arch["id"], description="Login con MFA")).status_code == 201
    assert (await mk(title="Pagos", content="@startuml\nA->B\n@enduml", diagram_type="plantuml", folder_id=arch["id"])).status_code == 201
    return {"id": pid, "folder_id": arch["id"]}


def _zip_names(data: bytes) -> set[str]:
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        return set(archive.namelist())


@pytest.mark.integration
async def test_export_zip_whole_project(authenticated_client: AsyncClient) -> None:
    seed = await _seed(authenticated_client)

    response = await authenticated_client.get(f"/api/v1/projects/{seed['id']}/export?format=zip")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert 'filename="Proyecto Export-' in response.headers["content-disposition"]
    assert response.headers["cache-control"] == "no-store"
    names = _zip_names(response.content)
    assert "Proyecto Export/manifest.json" in names
    assert "Proyecto Export/Borrador.mmd" in names and "Proyecto Export/Borrador.md" in names
    assert "Proyecto Export/Arquitectura/Pagos.puml" in names
    assert "Proyecto Export/Arquitectura/Flujo de login.md" in names
    assert "Proyecto Export/Vacía/" in names
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        manifest = json.loads(archive.read("Proyecto Export/manifest.json"))
    assert manifest["project"]["name"] == "Proyecto Export" and len(manifest["diagrams"]) == 3


@pytest.mark.integration
async def test_export_zip_single_folder(authenticated_client: AsyncClient) -> None:
    seed = await _seed(authenticated_client)

    response = await authenticated_client.get(
        f"/api/v1/projects/{seed['id']}/export?format=zip&folder_id={seed['folder_id']}&descriptions=false"
    )

    assert response.status_code == 200
    names = _zip_names(response.content)
    assert "Arquitectura/Arquitectura/Pagos.puml" in names
    assert not any("Borrador" in n or "Vacía" in n or n.endswith(".md") and "README" not in n for n in names)


@pytest.mark.integration
async def test_export_markdown_variants(authenticated_client: AsyncClient) -> None:
    seed = await _seed(authenticated_client)

    ai = await authenticated_client.get(f"/api/v1/projects/{seed['id']}/export?format=markdown&variant=ai")
    standard = await authenticated_client.get(f"/api/v1/projects/{seed['id']}/export?format=markdown&variant=standard")

    assert ai.status_code == standard.status_code == 200
    assert ai.headers["content-type"].startswith("text/markdown")
    assert ai.headers["content-disposition"].endswith(".md")
    assert "Exported from Diagramahub" in ai.text and "- Type: PlantUML" in ai.text and "tokens._" in ai.text
    assert "```plantuml\n@startuml\nA->B\n@enduml\n```" in ai.text
    assert "Exported from Diagramahub" not in standard.text and "- Type:" not in standard.text
    assert "```mermaid\ngraph TD\n  A-->B\n```" in standard.text


@pytest.mark.integration
async def test_export_summary(authenticated_client: AsyncClient) -> None:
    seed = await _seed(authenticated_client)

    md = (await authenticated_client.get(f"/api/v1/projects/{seed['id']}/export/summary?format=markdown&variant=ai")).json()
    zipped = (await authenticated_client.get(f"/api/v1/projects/{seed['id']}/export/summary?format=zip")).json()

    assert md["diagram_count"] == 3 and md["folder_count"] == 2
    assert md["size_bytes"] > 200 and md["estimated_tokens"] == pytest.approx(md["size_bytes"] / 4, rel=0.05)
    assert md["filename"].endswith(".md")
    assert zipped["estimated_tokens"] is None and zipped["filename"].endswith(".zip") and zipped["size_bytes"] > 0
    assert md["size_is_upper_bound"] is False and zipped["size_is_upper_bound"] is True
    # The summary measures the archive uncompressed: never below the real download.
    download = await authenticated_client.get(f"/api/v1/projects/{seed['id']}/export?format=zip")
    assert zipped["size_bytes"] >= len(download.content)


@pytest.mark.integration
async def test_export_summary_is_rate_limited_per_user(authenticated_client: AsyncClient) -> None:
    seed = await _seed(authenticated_client)
    url = f"/api/v1/projects/{seed['id']}/export/summary?format=zip"
    for _ in range(export_summary_rate_limiter.max_requests):
        assert (await authenticated_client.get(url)).status_code == 200

    response = await authenticated_client.get(url)

    assert response.status_code == 429
    assert "retry-after" in response.headers
    # Its own budget: downloads are still available.
    assert (await authenticated_client.get(f"/api/v1/projects/{seed['id']}/export?format=markdown")).status_code == 200


@pytest.mark.integration
async def test_export_rejects_other_users_project_and_foreign_folder(
    authenticated_client: AsyncClient,
) -> None:
    seed = await _seed(authenticated_client)
    # A second user's project
    from tests.utils.security import generate_test_password  # noqa: PLC0415
    other = {"email": "other-export@example.com", "password": generate_test_password(), "full_name": "Other"}
    assert (await authenticated_client.post("/api/v1/users/register", json=other)).status_code == 201
    token = (await authenticated_client.post("/api/v1/users/login", json={"email": other["email"], "password": other["password"]})).json()["access_token"]
    other_headers = {"Authorization": f"Bearer {token}"}
    other_project = (await authenticated_client.post("/api/v1/projects", json={"name": "Ajeno", "emoji": "🚫"}, headers=other_headers)).json()

    forbidden = await authenticated_client.get(f"/api/v1/projects/{other_project['id']}/export")
    assert forbidden.status_code == 403

    missing = await authenticated_client.get("/api/v1/projects/000000000000000000000000/export")
    assert missing.status_code == 404

    # Folder id that belongs to another project
    other_folder = (await authenticated_client.post(
        f"/api/v1/projects/{other_project['id']}/folders", json={"name": "F", "color": "#000000"}, headers=other_headers
    )).json()
    foreign = await authenticated_client.get(f"/api/v1/projects/{seed['id']}/export?folder_id={other_folder['id']}")
    assert foreign.status_code == 404


@pytest.mark.integration
async def test_export_is_rate_limited_per_user(authenticated_client: AsyncClient) -> None:
    seed = await _seed(authenticated_client)
    for _ in range(export_rate_limiter.max_requests):
        assert (await authenticated_client.get(f"/api/v1/projects/{seed['id']}/export?format=markdown")).status_code == 200

    response = await authenticated_client.get(f"/api/v1/projects/{seed['id']}/export?format=markdown")

    assert response.status_code == 429
    assert "retry-after" in response.headers
