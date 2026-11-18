"""
Syntax of the newer Mermaid diagram types (mindmap, Venn, Wardley, …) for the AI prompts.

Models know the classic types well but invent the syntax of the newer ones
(and never use the flowchart's newer features: animated edges, step-by-step
animation, BPMN shapes), so the prompts carry a short reference: when to use
each type or feature, the rules that prevent the usual mistakes and one example. The data lives in
``mermaid_reference.json``; a frontend test parses every example with the
bundled mermaid, so the reference can't drift from the parser.
"""

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Optional

from ..diagrams.mermaid_types import mermaid_diagram_keyword

_DATA = Path(__file__).with_name("mermaid_reference.json")

# Header spellings Mermaid accepts for the same type as a reference entry.
_ALIASES = {
    "requirement": "requirementDiagram",
    "C4Container": "C4Context",
    "C4Component": "C4Context",
    "C4Dynamic": "C4Context",
    "C4Deployment": "C4Context",
}


@dataclass(frozen=True)
class MermaidTypeSyntax:
    """How to write one diagram type."""

    keyword: str
    use_for: str
    rules: tuple[str, ...]
    example: str


@dataclass(frozen=True)
class MermaidFeatureSyntax:
    """How to use a feature inside some diagram types (e.g. animated flowchart edges)."""

    name: str
    applies_to: tuple[str, ...]
    use_for: str
    rules: tuple[str, ...]
    example: str


@lru_cache(maxsize=1)
def _data() -> dict:
    return json.loads(_DATA.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def mermaid_feature_syntaxes() -> tuple[MermaidFeatureSyntax, ...]:
    """Every feature in the reference, in reference order."""
    return tuple(
        MermaidFeatureSyntax(
            name=entry["name"],
            applies_to=tuple(entry["applies_to"]),
            use_for=entry["use_for"],
            rules=tuple(entry["rules"]),
            example=entry["example"].strip("\n"),
        )
        for entry in _data().get("features", [])
    )


@lru_cache(maxsize=1)
def mermaid_type_syntaxes() -> dict[str, MermaidTypeSyntax]:
    """Every type in the reference, by header keyword (in reference order)."""
    data = _data()
    return {
        entry["keyword"]: MermaidTypeSyntax(
            keyword=entry["keyword"],
            use_for=entry["use_for"],
            rules=tuple(entry["rules"]),
            example=entry["example"].strip("\n"),
        )
        for entry in data["types"]
    }


def syntax_for_keyword(keyword: Optional[str]) -> Optional[MermaidTypeSyntax]:
    """The reference entry for a header keyword, with or without ``-beta``."""
    if not keyword:
        return None
    syntaxes = mermaid_type_syntaxes()
    keyword = _ALIASES.get(keyword, keyword)
    base = keyword.removesuffix("-beta")
    for candidate in (keyword, base, f"{base}-beta"):
        if candidate in syntaxes:
            return syntaxes[candidate]
    return None


def format_type_syntax(syntax: MermaidTypeSyntax | MermaidFeatureSyntax) -> str:
    """One type or feature as prompt text: purpose, rules and example."""
    title = syntax.keyword if isinstance(syntax, MermaidTypeSyntax) else syntax.name
    rules = "\n".join(f"- {rule}" for rule in syntax.rules)
    return f"### {title}: {syntax.use_for}\n{rules}\nExample:\n```mermaid\n{syntax.example}\n```"


def _features_section(features: tuple[MermaidFeatureSyntax, ...]) -> str:
    sections = "\n\n".join(format_type_syntax(f) for f in features)
    return (
        "FLOWCHART EXTRAS (verified against the parser). Use them when the request asks for "
        "motion (animated or moving arrows, a step-by-step walkthrough) or BPMN; follow the "
        f"rules exactly.\n\n{sections}"
    )


@lru_cache(maxsize=1)
def other_mermaid_types_reference() -> str:
    """Section for generating/chatting: every newer type with its syntax."""
    sections = "\n\n".join(format_type_syntax(s) for s in mermaid_type_syntaxes().values())
    features = mermaid_feature_syntaxes()
    extras = f"\n\n{_features_section(features)}" if features else ""
    return (
        "OTHER MERMAID DIAGRAM TYPES (verified against the parser; valid in addition to the "
        "types above). When the request fits one of them, use it and follow its rules and "
        "example exactly: never invent keywords or mix syntax between types.\n\n"
        f"{sections}{extras}"
    )


def type_reference_for_code(code: str) -> str:
    """The syntax of the code's diagram type, or the features it can use (else "")."""
    keyword = mermaid_diagram_keyword(code)
    syntax = syntax_for_keyword(keyword)
    if syntax is not None:
        return (
            "SYNTAX OF THIS DIAGRAM TYPE (verified against the parser):\n"
            f"{format_type_syntax(syntax)}"
        )
    features = tuple(f for f in mermaid_feature_syntaxes() if keyword in f.applies_to)
    return _features_section(features) if features else ""
