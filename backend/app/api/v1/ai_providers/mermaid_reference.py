"""
Syntax of the newer Mermaid diagram types (mindmap, Venn, Wardley, …) for the AI prompts.

Models know the classic types well but invent the syntax of the newer ones, so
the prompts carry a short reference: when to use each type, the rules that
prevent the usual mistakes and one example. The data lives in
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


@lru_cache(maxsize=1)
def mermaid_type_syntaxes() -> dict[str, MermaidTypeSyntax]:
    """Every type in the reference, by header keyword (in reference order)."""
    data = json.loads(_DATA.read_text(encoding="utf-8"))
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


def format_type_syntax(syntax: MermaidTypeSyntax) -> str:
    """One type as prompt text: purpose, rules and example."""
    rules = "\n".join(f"- {rule}" for rule in syntax.rules)
    return (
        f"### {syntax.keyword}: {syntax.use_for}\n{rules}\nExample:\n"
        f"```mermaid\n{syntax.example}\n```"
    )


@lru_cache(maxsize=1)
def other_mermaid_types_reference() -> str:
    """Section for generating/chatting: every newer type with its syntax."""
    sections = "\n\n".join(format_type_syntax(s) for s in mermaid_type_syntaxes().values())
    return (
        "OTHER MERMAID DIAGRAM TYPES (verified against the parser; valid in addition to the "
        "types above). When the request fits one of them, use it and follow its rules and "
        "example exactly: never invent keywords or mix syntax between types.\n\n"
        f"{sections}"
    )


def type_reference_for_code(code: str) -> str:
    """The syntax of the code's own diagram type, when the reference has it (else "")."""
    syntax = syntax_for_keyword(mermaid_diagram_keyword(code))
    if syntax is None:
        return ""
    return (
        f"SYNTAX OF THIS DIAGRAM TYPE (verified against the parser):\n{format_type_syntax(syntax)}"
    )
