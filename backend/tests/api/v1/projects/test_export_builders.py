"""Unit tests for the pure export builders (no database)."""

import io
import json
import zipfile
from datetime import datetime

import pytest

from app.api.v1.projects.export_builders import (
    ExportDiagram,
    ExportFolder,
    ExportTree,
    build_markdown,
    build_zip,
    download_filename,
    estimate_tokens,
    freehand_texts,
    sanitize_filename,
    unique_name,
)

AT = datetime(2026, 10, 1, 12, 0, 0)


def _diagram(title: str, dtype: str = "mermaid", content: str = "graph TD\n  A-->B", description=None) -> ExportDiagram:
    return ExportDiagram(
        id=f"id-{title}", title=title, diagram_type=dtype, content=content,
        description=description, created_at=AT, updated_at=AT,
    )


def _tree(**overrides) -> ExportTree:
    base = dict(
        project_id="p1", project_name="Mi proyecto", project_emoji="📁",
        project_description="Sistema de pagos",
        root_diagrams=[_diagram("Borrador", description="Un borrador")],
        folders=[
            ExportFolder(id="f1", name="Arquitectura", color="#8B5CF6", diagrams=[
                _diagram("Flujo de login", description="Login con MFA"),
                _diagram("Pagos", "plantuml", "@startuml\nA->B\n@enduml"),
            ]),
            ExportFolder(id="f2", name="Vacía", color=None, diagrams=[]),
        ],
        exported_at=AT,
    )
    base.update(overrides)
    return ExportTree(**base)


# ---------------------------------------------------------------- names


@pytest.mark.unit
@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Flujo de login", "Flujo de login"),
        ("a/b\\c:d*e?f\"g<h>i|j", "abcdefghij"),
        ("../../etc/passwd", "etcpasswd"),
        ("  .hidden.  ", "hidden"),
        ("", "untitled"),
        ("///", "untitled"),
        ("CON", "CON_"),
        ("lpt1.mmd", "lpt1.mmd_"),
        ("x" * 300, "x" * 100),
        ("Título con ñ y émojis 🎨", "Título con ñ y émojis 🎨"),
    ],
)
def test_sanitize_filename(raw: str, expected: str) -> None:
    assert sanitize_filename(raw) == expected


@pytest.mark.unit
def test_unique_name_suffixes_case_insensitively() -> None:
    taken: set[str] = set()
    assert unique_name("Pagos", taken) == "Pagos"
    assert unique_name("pagos", taken) == "pagos (2)"
    assert unique_name("PAGOS", taken) == "PAGOS (3)"
    assert unique_name("Otro", taken) == "Otro"


# ---------------------------------------------------------------- freehand


@pytest.mark.unit
def test_freehand_texts_extracts_labels_in_order_and_ignores_garbage() -> None:
    content = json.dumps({"version": 1, "elements": [
        {"type": "rectangle", "text": " Inicio "}, {"type": "arrow"},
        {"type": "text", "text": "Fin"}, {"type": "text", "text": "   "}, "junk",
    ]})
    assert freehand_texts(content) == ["Inicio", "Fin"]
    assert freehand_texts("not json") == []
    assert freehand_texts("[]") == []


# ---------------------------------------------------------------- markdown


@pytest.mark.unit
def test_markdown_ai_variant_has_preamble_index_paths_metadata_and_tokens() -> None:
    md = build_markdown(_tree(), variant="ai")

    assert md.startswith("# Project: Mi proyecto\n")
    assert "> Exported from Diagramahub on 2026-10-01" in md
    assert "fenced code block whose language tag" in md  # preamble for the model
    assert "**Project description:** Sistema de pagos" in md
    assert "- **Arquitectura/**" in md and "  - Pagos (PlantUML) — `/Arquitectura/`" in md
    assert "- Type: Mermaid · Path: /Arquitectura/ · Updated: 2026-10-01" in md
    assert "```mermaid\ngraph TD\n  A-->B\n```" in md
    assert "```plantuml\n@startuml\nA->B\n@enduml\n```" in md
    assert "**Description**\n\nLogin con MFA" in md
    assert "## Folder: Vacía\n\n_(empty folder)_" in md
    assert md.rstrip().endswith("tokens._")


@pytest.mark.unit
def test_markdown_standard_variant_is_a_plain_document() -> None:
    md = build_markdown(_tree(), variant="standard")

    assert md.startswith("# Project: Mi proyecto\n\nSistema de pagos\n")
    assert "Exported from Diagramahub" not in md
    assert "fenced code block whose language tag" not in md
    assert "- Type:" not in md and "tokens._" not in md
    assert "  - Pagos (PlantUML)\n" in md  # index without paths
    assert "```plantuml" in md and "**Description**\n\nLogin con MFA" in md


@pytest.mark.unit
def test_markdown_without_descriptions_and_with_freehand() -> None:
    sketch = _diagram("Boceto", "freehand", json.dumps({"elements": [{"text": "Caja A"}]}), description="desc")
    md = build_markdown(_tree(root_diagrams=[sketch], folders=[]), variant="ai", include_descriptions=False)

    assert "**Description**" not in md and "Project description" not in md
    assert "freehand sketch" in md and "- Caja A" in md and "```" not in md
    assert "## Root" not in md  # no folders -> root diagrams are top-level sections


@pytest.mark.unit
def test_markdown_scoped_to_folder_titles_the_folder() -> None:
    folder = ExportFolder(id="f1", name="Arquitectura", color=None, diagrams=[_diagram("X")])
    md = build_markdown(_tree(root_diagrams=[], folders=[folder], scope_folder_name="Arquitectura"), variant="ai")
    assert md.startswith("# Folder: Arquitectura\n")
    assert "project: Mi proyecto" in md


@pytest.mark.unit
def test_estimate_tokens() -> None:
    assert estimate_tokens("") == 0
    assert estimate_tokens("abcd" * 100) == 100


# ---------------------------------------------------------------- zip


def _entries(data: bytes) -> dict[str, bytes]:
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        return {info.filename: archive.read(info) for info in archive.infolist()}


@pytest.mark.unit
def test_zip_layout_manifest_and_descriptions() -> None:
    entries = _entries(build_zip(_tree()))

    assert set(entries) == {
        "Mi proyecto/README.md",
        "Mi proyecto/manifest.json",
        "Mi proyecto/Borrador.mmd",
        "Mi proyecto/Borrador.md",
        "Mi proyecto/Arquitectura/",
        "Mi proyecto/Arquitectura/Flujo de login.mmd",
        "Mi proyecto/Arquitectura/Flujo de login.md",
        "Mi proyecto/Arquitectura/Pagos.puml",
        "Mi proyecto/Vacía/",
    }
    assert entries["Mi proyecto/Arquitectura/Pagos.puml"] == b"@startuml\nA->B\n@enduml"
    assert entries["Mi proyecto/Arquitectura/Flujo de login.md"].decode() == "# Flujo de login\n\nLogin con MFA\n"

    manifest = json.loads(entries["Mi proyecto/manifest.json"])
    assert manifest["format"] == "diagramahub-export" and manifest["format_version"] == 1
    assert manifest["project"] == {"id": "p1", "name": "Mi proyecto", "emoji": "📁", "description": "Sistema de pagos"}
    assert [f["path"] for f in manifest["folders"]] == ["Arquitectura", "Vacía"]
    assert manifest["folders"][0]["color"] == "#8B5CF6"
    pagos = next(d for d in manifest["diagrams"] if d["title"] == "Pagos")
    assert pagos == {
        "id": "id-Pagos", "title": "Pagos", "type": "plantuml", "path": "Arquitectura/Pagos.puml",
        "folder": "Arquitectura", "folder_id": "f1",
        "created_at": AT.isoformat(), "updated_at": AT.isoformat(),
    }
    readme = entries["Mi proyecto/README.md"].decode()
    assert "| `Arquitectura/Pagos.puml` | Pagos | PlantUML | 2026-10-01 |" in readme


@pytest.mark.unit
def test_zip_without_descriptions_has_no_md_siblings() -> None:
    entries = _entries(build_zip(_tree(), include_descriptions=False))
    assert not any(name.endswith("/Borrador.md") or name.endswith("login.md") for name in entries)
    manifest = json.loads(entries["Mi proyecto/manifest.json"])
    assert all("description_path" not in d for d in manifest["diagrams"])


@pytest.mark.unit
def test_zip_sanitizes_names_and_resolves_collisions() -> None:
    folder = ExportFolder(id="f1", name="../Ops: prod", color=None, diagrams=[
        _diagram("Pagos"), _diagram("pagos"), _diagram("Pagos", "d2", "a -> b"),
        _diagram("a/b?c", "dbml", "Table t {}"), _diagram("Boceto", "freehand", "{}"),
    ])
    entries = _entries(build_zip(_tree(root_diagrams=[], folders=[folder])))
    names = sorted(n for n in entries if n.count("/") == 2 and not n.endswith("/"))
    assert names == [
        "Mi proyecto/Ops prod/Boceto.freehand.json",
        "Mi proyecto/Ops prod/Pagos (3).d2",
        "Mi proyecto/Ops prod/Pagos.mmd",
        "Mi proyecto/Ops prod/abc.dbml",
        "Mi proyecto/Ops prod/pagos (2).mmd",
    ]
    assert not any(".." in n or n.startswith("/") for n in entries)


@pytest.mark.unit
def test_download_filename() -> None:
    assert download_filename(_tree(), "zip") == "Mi proyecto-20261001.zip"
    assert download_filename(_tree(scope_folder_name="Ops/prod"), "markdown") == "Opsprod-20261001.md"
