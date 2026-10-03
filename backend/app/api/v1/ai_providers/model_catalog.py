"""
AI model catalog: the single source of truth for which models exist, which
are offered in the UI, their context windows and the parameters they accept.

Loaded from ``model_catalog.json`` next to this file. The frontend's model
picker (``frontend/src/types/ai.ts``) must list exactly the ``listed`` models;
a Vitest test compares both files. Models a user saved earlier and that are no
longer listed stay here (unlisted) so they keep working with correct limits.
"""

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Optional

_CATALOG_FILE = Path(__file__).with_name("model_catalog.json")

# Context window assumed for a model the catalog doesn't know (conservative:
# a smaller value only compacts chat history earlier, it never overflows).
DEFAULT_CONTEXT_WINDOW = 64000


@dataclass(frozen=True)
class ModelInfo:
    """What the app needs to know about one model."""

    provider: str
    id: str
    context_window: int
    listed: bool = False
    recommended: bool = False
    # Some models reject `temperature` (e.g. Claude 5.x answers 400 "deprecated")
    supports_temperature: bool = True


@lru_cache(maxsize=1)
def _models() -> dict[str, ModelInfo]:
    raw = json.loads(_CATALOG_FILE.read_text(encoding="utf-8"))
    return {
        entry["id"]: ModelInfo(
            provider=entry["provider"],
            id=entry["id"],
            context_window=int(entry["context_window"]),
            listed=bool(entry.get("listed", False)),
            recommended=bool(entry.get("recommended", False)),
            supports_temperature=bool(entry.get("supports_temperature", True)),
        )
        for entry in raw["models"]
    }


def get_model(model_id: Optional[str]) -> Optional[ModelInfo]:
    """The catalog entry for ``model_id`` (None if unknown)."""
    return _models().get(model_id or "")


def all_models() -> list[ModelInfo]:
    """Every catalog entry, listed or not."""
    return list(_models().values())


def context_window(model_id: Optional[str]) -> int:
    """Context window of a model, or a conservative default for unknown ones."""
    info = get_model(model_id)
    return info.context_window if info else DEFAULT_CONTEXT_WINDOW


def supports_temperature(model_id: Optional[str]) -> bool:
    """Whether the model accepts ``temperature`` (unknown models: assume yes)."""
    info = get_model(model_id)
    return info.supports_temperature if info else True


def recommended_model(provider: str) -> str:
    """The model new configurations of ``provider`` use by default."""
    for info in _models().values():
        if info.provider == provider and info.recommended:
            return info.id
    raise KeyError(f"No recommended model for provider {provider!r}")
