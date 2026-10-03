"""Integration tests for POST /projects/{id}/import."""

import io
import json
import zipfile
from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.api.v1.projects import import_service as import_module
from app.api.v1.projects.import_service import import_preview_rate_limiter, import_rate_limiter


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    import_rate_limiter.reset()
    import_preview_rate_limiter.reset()
    yield
    import_rate_limiter.reset()
    import_preview_rate_limiter.reset()


def _zip(files: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return buffer.getvalue()


async def _project(client: AsyncClient) -> str:
    return (await client.post("/api/v1/projects", json={"name": "Import target", "emoji": "📥"})).json()["id"]


def _files(*items: tuple[str, bytes]):
    return [("files", (name, data, "application/octet-stream")) for name, data in items]


@pytest.mark.integration
async def test_dry_run_previews_without_creating(authenticated_client: AsyncClient) -> None:
    pid = await _project(authenticated_client)
    archive = _zip({"Docs/flow.mmd": "graph TD\n  A-->B", "Docs/photo.png": "x", "root.puml": "@startuml\n@enduml"})

    response = await authenticated_client.post(
        f"/api/v1/projects/{pid}/import?dry_run=true", files=_files(("bundle.zip", archive))
    )

    assert response.status_code == 200
    body = response.json()
    assert body["diagram_count"] == 2 and body["folders"] == ["Docs"] and body["allowed"] is True
    assert {(d["title"], d["folder"]) for d in body["diagrams"]} == {("flow", "Docs"), ("root", None)}
    assert body["skipped"] == [{"source": "Docs/photo.png", "reason": "unsupported_type"}]
    assert "created_diagram_ids" not in body
    project = (await authenticated_client.get(f"/api/v1/projects/{pid}")).json()
    assert project["diagrams"] == [] and project["folders"] == []


@pytest.mark.integration
async def test_import_creates_folders_and_diagrams_and_reuses_existing_folder(
    authenticated_client: AsyncClient,
) -> None:
    pid = await _project(authenticated_client)
    existing = (await authenticated_client.post(f"/api/v1/projects/{pid}/folders", json={"name": "docs", "color": "#000000"})).json()
    archive = _zip({
        "Docs/flow.mmd": "graph TD\n  A-->B", "Docs/flow.md": "# flow\n\nLa descripción",
        "Nueva/er.dbml": "Table t {\n id int\n}", "root.puml": "@startuml\n@enduml",
    })

    response = await authenticated_client.post(f"/api/v1/projects/{pid}/import", files=_files(("bundle.zip", archive)))

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["diagram_count"] == 3 and len(body["created_diagram_ids"]) == 3
    assert len(body["created_folder_ids"]) == 1  # "Docs" reused the existing "docs" folder
    project = (await authenticated_client.get(f"/api/v1/projects/{pid}")).json()
    by_name = {f["name"]: f for f in project["folders"]}
    assert set(by_name) == {"docs", "Nueva"}
    assert by_name["docs"]["id"] == existing["id"]
    [flow] = by_name["docs"]["diagrams"]
    assert flow["title"] == "flow" and flow["description"] == "La descripción" and flow["content"] == "graph TD\n  A-->B"
    assert [d["title"] for d in project["diagrams"]] == ["root"]


@pytest.mark.integration
async def test_import_loose_files_into_a_folder_flattens_archives(authenticated_client: AsyncClient) -> None:
    pid = await _project(authenticated_client)
    folder = (await authenticated_client.post(f"/api/v1/projects/{pid}/folders", json={"name": "Target", "color": "#000000"})).json()
    sketch = json.dumps({"type": "excalidraw", "elements": [{"id": "r", "type": "rectangle", "x": 0, "y": 0, "width": 10, "height": 10}]})

    response = await authenticated_client.post(
        f"/api/v1/projects/{pid}/import",
        data={"folder_id": folder["id"]},
        files=_files(("a.mmd", b"graph TD"), ("draw.excalidraw", sketch.encode()), ("z.zip", _zip({"Sub/b.d2": "a -> b"}))),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["target_folder"] == "Target" and body["folder_count"] == 0 and body["diagram_count"] == 3
    project = (await authenticated_client.get(f"/api/v1/projects/{pid}")).json()
    [target] = project["folders"]
    assert sorted(d["title"] for d in target["diagrams"]) == ["a", "b", "draw"]
    draw = next(d for d in target["diagrams"] if d["title"] == "draw")
    assert draw["diagram_type"] == "freehand" and json.loads(draw["content"])["elements"][0]["type"] == "rectangle"


@pytest.mark.integration
async def test_import_suffixes_titles_already_present_in_the_destination(
    authenticated_client: AsyncClient,
) -> None:
    pid = await _project(authenticated_client)
    files = _files(("Flujo.mmd", b"graph TD\n  A-->B"))

    first = await authenticated_client.post(f"/api/v1/projects/{pid}/import", files=files)
    second = await authenticated_client.post(f"/api/v1/projects/{pid}/import", files=files)

    assert first.status_code == second.status_code == 200
    project = (await authenticated_client.get(f"/api/v1/projects/{pid}")).json()
    assert sorted(d["title"] for d in project["diagrams"]) == ["Flujo", "Flujo (2)"]


@pytest.mark.integration
async def test_import_rejected_entirely_when_over_plan_quota(authenticated_client: AsyncClient) -> None:
    pid = await _project(authenticated_client)
    archive = _zip({"a.mmd": "graph TD", "b.mmd": "graph TD", "c.mmd": "graph TD"})

    async def fake_check(self, user_id):  # noqa: ANN001
        return {"allowed": True, "current_usage": 8, "limit": 10, "plan_name": "FREE"}

    with patch.object(import_module.UsageLimiter, "check_diagram_limit", fake_check):
        preview = await authenticated_client.post(f"/api/v1/projects/{pid}/import?dry_run=true", files=_files(("b.zip", archive)))
        response = await authenticated_client.post(f"/api/v1/projects/{pid}/import", files=_files(("b.zip", archive)))

    assert preview.json()["allowed"] is False and preview.json()["limit"] == 10
    assert response.status_code == 403
    assert response.json()["detail"]["error"] == "resource_limit_exceeded"
    project = (await authenticated_client.get(f"/api/v1/projects/{pid}")).json()
    assert project["diagrams"] == []  # nothing created


@pytest.mark.integration
async def test_import_rolls_back_on_failure(authenticated_client: AsyncClient) -> None:
    pid = await _project(authenticated_client)
    archive = _zip({"F/a.mmd": "graph TD", "F/b.mmd": "graph TD", "F/c.mmd": "graph TD"})
    original = import_module.ProjectImportService.__dict__  # noqa: F841
    from app.api.v1.diagrams.repository import DiagramRepository

    real_create = DiagramRepository.create
    calls = {"n": 0}

    async def flaky_create(self, data, project_id):  # noqa: ANN001
        calls["n"] += 1
        if calls["n"] == 3:
            raise RuntimeError("boom")
        return await real_create(self, data, project_id)

    with patch.object(DiagramRepository, "create", flaky_create):
        response = await authenticated_client.post(f"/api/v1/projects/{pid}/import", files=_files(("b.zip", archive)))

    assert response.status_code == 500
    project = (await authenticated_client.get(f"/api/v1/projects/{pid}")).json()
    assert project["diagrams"] == [] and project["folders"] == []  # folder and 2 diagrams rolled back


@pytest.mark.integration
async def test_import_errors(authenticated_client: AsyncClient) -> None:
    pid = await _project(authenticated_client)
    nothing = await authenticated_client.post(f"/api/v1/projects/{pid}/import", files=_files(("photo.png", b"\x89PNG")))
    assert nothing.status_code == 400 and nothing.json()["detail"]["error"] == "nothing_to_import"

    bad_zip = await authenticated_client.post(f"/api/v1/projects/{pid}/import", files=_files(("x.zip", b"PK\x03\x04junk")))
    assert bad_zip.status_code == 400 and bad_zip.json()["detail"]["reason"] == "invalid_zip"

    missing = await authenticated_client.post("/api/v1/projects/000000000000000000000000/import", files=_files(("a.mmd", b"graph TD")))
    assert missing.status_code == 404

    foreign_folder = await authenticated_client.post(
        f"/api/v1/projects/{pid}/import", data={"folder_id": "000000000000000000000000"}, files=_files(("a.mmd", b"graph TD"))
    )
    assert foreign_folder.status_code == 404


@pytest.mark.integration
async def test_import_upload_budget_is_larger_than_the_global_body_limit(authenticated_client: AsyncClient) -> None:
    """A 6 MB upload passes the import route (20 MB) although other routes cap at 5 MB."""
    pid = await _project(authenticated_client)
    big = b"graph TD\n" + b"  A-->B\n" * 800_000  # ~6.4 MB

    other_route = await authenticated_client.put(f"/api/v1/projects/{pid}", content=big, headers={"Content-Type": "application/json"})
    assert other_route.status_code == 413

    response = await authenticated_client.post(f"/api/v1/projects/{pid}/import?dry_run=true", files=_files(("big.mmd", big)))
    assert response.status_code == 200
    # ...but a single diagram bigger than the per-file cap is skipped, not stored.
    assert response.json()["skipped"] == [{"source": "big.mmd", "reason": "too_large"}]


@pytest.mark.integration
async def test_archive_limits_apply_to_the_whole_request(authenticated_client: AsyncClient) -> None:
    """Many small ZIPs can't add up to more than one archive may expand to."""
    pid = await _project(authenticated_client)
    service = import_module.ProjectImportService
    limits = import_module.ImportLimits(max_files=10, max_total_bytes=3000, max_file_bytes=3000)
    archive = _zip({f"d{i}.mmd": "graph TD\n" + "A-->B\n" * 100 for i in range(3)})  # ~1.8 KB uncompressed

    with patch.object(service, "__init__", _with_limits(service.__init__, limits)):
        one = await authenticated_client.post(f"/api/v1/projects/{pid}/import?dry_run=true", files=_files(("a.zip", archive)))
        two = await authenticated_client.post(
            f"/api/v1/projects/{pid}/import?dry_run=true", files=_files(("a.zip", archive), ("b.zip", archive))
        )
        many = await authenticated_client.post(
            f"/api/v1/projects/{pid}/import", files=_files(*[(f"f{i}.mmd", b"graph TD") for i in range(11)])
        )

    assert one.status_code == 200 and one.json()["diagram_count"] == 3
    assert two.status_code == 400
    assert two.json()["detail"] == {"error": "invalid_upload", "file": "b.zip", "reason": "too_large_uncompressed"}
    assert many.status_code == 400 and many.json()["detail"]["reason"] == "too_many_files"
    assert (await authenticated_client.get(f"/api/v1/projects/{pid}")).json()["diagrams"] == []


@pytest.mark.integration
async def test_preview_is_rate_limited_separately(authenticated_client: AsyncClient) -> None:
    pid = await _project(authenticated_client)
    url = f"/api/v1/projects/{pid}/import?dry_run=true"
    for _ in range(import_preview_rate_limiter.max_requests):
        assert (await authenticated_client.post(url, files=_files(("a.mmd", b"graph TD")))).status_code == 200

    limited = await authenticated_client.post(url, files=_files(("a.mmd", b"graph TD")))
    real = await authenticated_client.post(f"/api/v1/projects/{pid}/import", files=_files(("a.mmd", b"graph TD")))

    assert limited.status_code == 429 and "retry-after" in limited.headers
    assert real.status_code == 200  # importing has its own budget


def _with_limits(original_init, limits):  # noqa: ANN001, ANN202
    def init(self, *args, **kwargs):  # noqa: ANN001, ANN202
        original_init(self, *args, **kwargs)
        self.limits = limits

    return init
