"""
Pure builders for the project/folder export feature.

Everything here is side-effect free: it takes an already-loaded ``ExportTree``
and produces bytes/strings. Loading the tree (database access, permission
checks) lives in ``export_service.py`` so these builders stay trivially
testable.

Two output formats:

* **ZIP** — one folder per project folder, one source file per diagram with
  the extension of its type, an optional ``.md`` sibling with the description,
  plus ``README.md`` (index) and ``manifest.json`` (enough metadata to import
  the archive back, folders and colours included).
* **Markdown** — a single ``.md`` document. The ``ai`` variant adds a preamble
  that explains the file to a language model, a path index, per-diagram
  metadata and a token estimate; the ``standard`` variant is a plain document.
"""

from __future__ import annotations

import io
import json
import re
import zipfile
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal, Optional

EXPORT_FORMAT_VERSION = 1
MANIFEST_FILENAME = "manifest.json"
README_FILENAME = "README.md"

MarkdownVariant = Literal["ai", "standard"]

# Rough estimate used for the "will it fit in the model's context" hint.
CHARS_PER_TOKEN = 4

# Diagram type -> source file extension inside the ZIP.
_EXTENSIONS = {
    "mermaid": ".mmd",
    "plantuml": ".puml",
    "d2": ".d2",
    "dbml": ".dbml",
    "freehand": ".freehand.json",
}

# Diagram type -> fenced code block language identifier.
_FENCE_LANGUAGES = {
    "mermaid": "mermaid",
    "plantuml": "plantuml",
    "d2": "d2",
    "dbml": "dbml",
}

_TYPE_LABELS = {
    "mermaid": "Mermaid",
    "plantuml": "PlantUML",
    "d2": "D2",
    "dbml": "DBML",
    "freehand": "Freehand sketch",
}

# Windows reserved device names (case-insensitive, with or without extension).
_RESERVED_NAMES = {
    "CON",
    "PRN",
    "AUX",
    "NUL",
    *(f"COM{i}" for i in range(1, 10)),
    *(f"LPT{i}" for i in range(1, 10)),
}
_UNSAFE_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
_MAX_NAME_LENGTH = 100


@dataclass
class ExportDiagram:
    """A diagram as needed by the builders (no database types)."""

    id: str
    title: str
    diagram_type: str
    content: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime


@dataclass
class ExportFolder:
    """A folder with its diagrams."""

    id: str
    name: str
    color: Optional[str]
    diagrams: list[ExportDiagram] = field(default_factory=list)


@dataclass
class ExportTree:
    """What gets exported: a whole project, or a single folder of it."""

    project_id: str
    project_name: str
    project_emoji: Optional[str]
    project_description: Optional[str]
    root_diagrams: list[ExportDiagram] = field(default_factory=list)
    folders: list[ExportFolder] = field(default_factory=list)
    exported_at: datetime = field(default_factory=datetime.utcnow)
    # Set when the export is scoped to one folder (the tree then holds only it).
    scope_folder_name: Optional[str] = None

    @property
    def diagram_count(self) -> int:
        """Total diagrams in the tree."""
        return len(self.root_diagrams) + sum(len(f.diagrams) for f in self.folders)

    @property
    def title(self) -> str:
        """Human title: the folder name when scoped, else the project name."""
        return self.scope_folder_name or self.project_name


# --------------------------------------------------------------------------- #
#  Names
# --------------------------------------------------------------------------- #


def sanitize_filename(name: str, fallback: str = "untitled") -> str:
    """Make ``name`` safe as a file or folder name on every operating system.

    Removes path separators and characters Windows rejects, control
    characters, leading/trailing dots and spaces (hidden files, ``..``), caps
    the length and avoids reserved device names.
    """
    cleaned = _UNSAFE_CHARS.sub("", name or "")
    cleaned = cleaned.replace("..", ".")
    cleaned = cleaned.strip(" .")
    cleaned = re.sub(r"\s+", " ", cleaned)[:_MAX_NAME_LENGTH].rstrip(" .")
    if not cleaned:
        return fallback
    if cleaned.split(".")[0].upper() in _RESERVED_NAMES:
        return f"{cleaned}_"
    return cleaned


def unique_name(name: str, taken: set[str]) -> str:
    """Return ``name`` or ``name (2)``, ``name (3)``… so it is not in ``taken``.

    Comparison is case-insensitive because macOS/Windows file systems are.
    The chosen name is added to ``taken``.
    """
    candidate = name
    counter = 2
    while candidate.lower() in taken:
        candidate = f"{name} ({counter})"
        counter += 1
    taken.add(candidate.lower())
    return candidate


def extension_for(diagram_type: str) -> str:
    """Source file extension for a diagram type (``.txt`` when unknown)."""
    return _EXTENSIONS.get(diagram_type, ".txt")


def fence_language(diagram_type: str) -> str:
    """Fenced code block language for a diagram type."""
    return _FENCE_LANGUAGES.get(diagram_type, "text")


def type_label(diagram_type: str) -> str:
    """Human label for a diagram type."""
    return _TYPE_LABELS.get(diagram_type, diagram_type)


# --------------------------------------------------------------------------- #
#  Freehand helpers
# --------------------------------------------------------------------------- #


def freehand_texts(content: str) -> list[str]:
    """Texts (shape labels and text boxes) of a freehand sketch, in order.

    A sketch is stored as JSON; it has no textual diagram source, so the
    Markdown export lists what can be read from it. Invalid JSON yields [].
    """
    try:
        data = json.loads(content or "")
    except (TypeError, ValueError):
        return []
    elements = data.get("elements") if isinstance(data, dict) else None
    if not isinstance(elements, list):
        return []
    texts: list[str] = []
    for element in elements:
        if not isinstance(element, dict):
            continue
        text = element.get("text")
        if isinstance(text, str) and text.strip():
            texts.append(text.strip())
    return texts


# --------------------------------------------------------------------------- #
#  Markdown
# --------------------------------------------------------------------------- #


def estimate_tokens(text: str) -> int:
    """Rough token count (≈4 characters per token)."""
    return max(1, len(text) // CHARS_PER_TOKEN) if text else 0


def _text(value: Optional[str]) -> str:
    """Stripped text, or "" when missing/blank (keeps mypy's narrowing simple)."""
    return value.strip() if value and value.strip() else ""


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")


def _diagram_section(
    diagram: ExportDiagram,
    path: str,
    variant: MarkdownVariant,
    include_descriptions: bool,
    heading_level: int,
) -> list[str]:
    """Markdown lines for one diagram."""
    hashes = "#" * heading_level
    lines = [f"{hashes} {diagram.title}", ""]

    if variant == "ai":
        lines.append(
            f"- Type: {type_label(diagram.diagram_type)} · Path: {path} · "
            f"Updated: {_iso(diagram.updated_at)}"
        )
        lines.append("")

    description = _text(diagram.description) if include_descriptions else ""
    if description:
        lines.append("**Description**")
        lines.append("")
        lines.append(description)
        lines.append("")

    if diagram.diagram_type == "freehand":
        texts = freehand_texts(diagram.content)
        if variant == "ai":
            lines.append(
                "_This is a freehand sketch (drawn on a canvas, no textual source). "
                "The texts found in it are listed below._"
            )
        else:
            lines.append("_Freehand sketch. Texts found in it:_")
        lines.append("")
        if texts:
            lines.extend(f"- {text}" for text in texts)
        else:
            lines.append("- (no text)")
        lines.append("")
    else:
        lines.append(f"```{fence_language(diagram.diagram_type)}")
        lines.append(diagram.content.rstrip("\n"))
        lines.append("```")
        lines.append("")
    return lines


def build_markdown(
    tree: ExportTree,
    variant: MarkdownVariant = "ai",
    include_descriptions: bool = True,
) -> str:
    """Render the tree as a single Markdown document."""
    lines: list[str] = []
    title_prefix = "Folder" if tree.scope_folder_name else "Project"
    lines.append(f"# {title_prefix}: {tree.title}")
    lines.append("")
    project_description = _text(tree.project_description) if include_descriptions else ""

    if variant == "ai":
        lines.append(
            f"> Exported from Diagramahub on {_iso(tree.exported_at)}"
            + (f" · project: {tree.project_name}" if tree.scope_folder_name else "")
            + f" · {len(tree.folders)} folders · {tree.diagram_count} diagrams"
        )
        lines.append(">")
        lines.append(
            "> This file bundles every diagram of the export as text. Each diagram is a "
            "section with its type, its location (path), an optional description written "
            "by the author, and its source in a fenced code block whose language tag "
            "(`mermaid`, `plantuml`, `d2`, `dbml`) tells you how to read it. Freehand "
            "sketches have no source: only their texts are listed. Diagrams in the same "
            "folder are related; use descriptions and titles to understand the system."
        )
        lines.append("")
        if project_description:
            lines.append(f"**Project description:** {project_description}")
            lines.append("")
    elif project_description and not tree.scope_folder_name:
        lines.append(project_description)
        lines.append("")

    # Index
    lines.append("## Index")
    lines.append("")
    for diagram in tree.root_diagrams:
        label = f"{diagram.title} ({type_label(diagram.diagram_type)})"
        lines.append(f"- {label}" + (" — `/`" if variant == "ai" else ""))
    for folder in tree.folders:
        lines.append(f"- **{folder.name}/**")
        for diagram in folder.diagrams:
            label = f"{diagram.title} ({type_label(diagram.diagram_type)})"
            lines.append(f"  - {label}" + (f" — `/{folder.name}/`" if variant == "ai" else ""))
    lines.append("")

    # Root diagrams
    if tree.root_diagrams:
        if tree.folders:
            lines.append("## Root")
            lines.append("")
        for diagram in tree.root_diagrams:
            lines.extend(
                _diagram_section(
                    diagram, "/", variant, include_descriptions, 3 if tree.folders else 2
                )
            )

    # Folders
    for folder in tree.folders:
        lines.append(f"## Folder: {folder.name}")
        lines.append("")
        if not folder.diagrams:
            lines.append("_(empty folder)_")
            lines.append("")
        for diagram in folder.diagrams:
            lines.extend(
                _diagram_section(diagram, f"/{folder.name}/", variant, include_descriptions, 3)
            )

    document = "\n".join(lines).rstrip("\n") + "\n"

    if variant == "ai":
        document += f"\n---\n_Approximate size: {len(document.encode('utf-8'))} bytes, ~{estimate_tokens(document)} tokens._\n"
    return document


# --------------------------------------------------------------------------- #
#  ZIP
# --------------------------------------------------------------------------- #


def _description_markdown(diagram: ExportDiagram) -> str:
    return f"# {diagram.title}\n\n{(diagram.description or '').strip()}\n"


def _readme(tree: ExportTree, layout: list[tuple[str, ExportDiagram]]) -> str:
    """Index of the archive (``path`` -> diagram), human readable."""
    lines = [f"# {tree.title}", ""]
    if tree.scope_folder_name:
        lines.append(f"Folder `{tree.scope_folder_name}` of project **{tree.project_name}**.")
    lines.append(
        f"Exported from Diagramahub on {_iso(tree.exported_at)} · "
        f"{len(tree.folders)} folders · {tree.diagram_count} diagrams."
    )
    lines.append("")
    lines.append(
        "Each diagram is a source file named after its type "
        "(`.mmd` Mermaid, `.puml` PlantUML, `.d2` D2, `.dbml` DBML, "
        "`.freehand.json` sketch). A `.md` file with the same name holds its "
        f"description. `{MANIFEST_FILENAME}` lets Diagramahub import this archive back."
    )
    lines.append("")
    lines.append("| File | Diagram | Type | Updated |")
    lines.append("|---|---|---|---|")
    for path, diagram in layout:
        lines.append(
            f"| `{path}` | {diagram.title} | {type_label(diagram.diagram_type)} | {_iso(diagram.updated_at)} |"
        )
    return "\n".join(lines) + "\n"


def build_zip(tree: ExportTree, include_descriptions: bool = True, compress: bool = True) -> bytes:
    """Render the tree as a ZIP archive (bytes).

    ``compress=False`` stores the entries without deflating them: the export
    summary uses it to measure an upper bound of the download size without
    paying the compression cost.
    """
    root = sanitize_filename(tree.title, fallback="project")
    buffer = io.BytesIO()
    layout: list[tuple[str, ExportDiagram]] = []  # (path inside root, diagram)
    manifest_folders: list[dict] = []
    manifest_diagrams: list[dict] = []

    def place(diagrams: list[ExportDiagram], folder_path: str, folder_id: Optional[str]) -> None:
        taken: set[str] = set()
        for diagram in diagrams:
            base = unique_name(sanitize_filename(diagram.title, fallback="diagram"), taken)
            filename = f"{base}{extension_for(diagram.diagram_type)}"
            path = f"{folder_path}{filename}"
            layout.append((path, diagram))
            entry = {
                "id": diagram.id,
                "title": diagram.title,
                "type": diagram.diagram_type,
                "path": path,
                "folder": folder_path.rstrip("/") or None,
                "folder_id": folder_id,
                "created_at": diagram.created_at.isoformat(),
                "updated_at": diagram.updated_at.isoformat(),
            }
            if include_descriptions and _text(diagram.description):
                entry["description_path"] = f"{folder_path}{base}.md"
            manifest_diagrams.append(entry)

    place(tree.root_diagrams, "", None)
    taken_folders: set[str] = set()
    for folder in tree.folders:
        folder_name = unique_name(sanitize_filename(folder.name, fallback="folder"), taken_folders)
        manifest_folders.append(
            {"id": folder.id, "name": folder.name, "color": folder.color, "path": folder_name}
        )
        place(folder.diagrams, f"{folder_name}/", folder.id)

    manifest = {
        "format": "diagramahub-export",
        "format_version": EXPORT_FORMAT_VERSION,
        "exported_at": tree.exported_at.isoformat(),
        "project": {
            "id": tree.project_id,
            "name": tree.project_name,
            "emoji": tree.project_emoji,
            "description": tree.project_description,
        },
        "scope": {"folder": tree.scope_folder_name} if tree.scope_folder_name else {"folder": None},
        "folders": manifest_folders,
        "diagrams": manifest_diagrams,
    }

    compression = zipfile.ZIP_DEFLATED if compress else zipfile.ZIP_STORED
    with zipfile.ZipFile(buffer, "w", compression=compression) as archive:
        archive.writestr(f"{root}/{README_FILENAME}", _readme(tree, layout))
        archive.writestr(
            f"{root}/{MANIFEST_FILENAME}", json.dumps(manifest, ensure_ascii=False, indent=2)
        )
        # Empty folders still appear in the archive.
        for folder_entry in manifest_folders:
            archive.writestr(zipfile.ZipInfo(f"{root}/{folder_entry['path']}/"), b"")
        for entry, (path, diagram) in zip(manifest_diagrams, layout):
            archive.writestr(f"{root}/{path}", diagram.content or "")
            if "description_path" in entry:
                archive.writestr(
                    f"{root}/{entry['description_path']}", _description_markdown(diagram)
                )

    return buffer.getvalue()


def download_filename(tree: ExportTree, fmt: Literal["zip", "markdown"]) -> str:
    """File name for the browser download, safe for the Content-Disposition header."""
    base = sanitize_filename(tree.title, fallback="export")
    stamp = tree.exported_at.strftime("%Y%m%d")
    return f"{base}-{stamp}.{'zip' if fmt == 'zip' else 'md'}"
