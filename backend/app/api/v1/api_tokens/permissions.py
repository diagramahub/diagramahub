"""
Permissions of API keys: an access level per area, and which area and level
each endpoint needs.

An endpoint a key may call must match one of ``RULES`` (first match wins);
anything else (account, security, keys, admin, AI chat, ...) always needs a
signed-in session. ``write`` includes ``read``.
"""

import re
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class ApiKeyArea(str, Enum):
    """What a key can reach."""

    PROJECTS = "projects"  # projects and folders
    DIAGRAMS = "diagrams"  # diagrams: code, description, move, duplicate, import
    SHARING = "sharing"  # shared links: create, change, revoke
    COMMUNITY = "community"  # publish, settings, remove; browse, star, comment, fork
    AI = "ai"  # fix / convert with the user's own AI providers (spends their quota)


class AccessLevel(str, Enum):
    NONE = "none"
    READ = "read"
    WRITE = "write"


# Levels an area can have (AI has no read-only use).
AREA_LEVELS: dict[ApiKeyArea, tuple[AccessLevel, ...]] = {
    ApiKeyArea.PROJECTS: (AccessLevel.NONE, AccessLevel.READ, AccessLevel.WRITE),
    ApiKeyArea.DIAGRAMS: (AccessLevel.NONE, AccessLevel.READ, AccessLevel.WRITE),
    ApiKeyArea.SHARING: (AccessLevel.NONE, AccessLevel.READ, AccessLevel.WRITE),
    ApiKeyArea.COMMUNITY: (AccessLevel.NONE, AccessLevel.READ, AccessLevel.WRITE),
    ApiKeyArea.AI: (AccessLevel.NONE, AccessLevel.WRITE),
}

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})

Permissions = dict[ApiKeyArea, AccessLevel]


@dataclass(frozen=True)
class Rule:
    """Endpoints matching ``pattern`` need ``level`` (by HTTP method when None) on ``areas``.

    ``areas`` empty means a key may never call them.
    """

    pattern: re.Pattern[str]
    areas: tuple[ApiKeyArea, ...]
    level: Optional[AccessLevel] = None


def _rule(pattern: str, *areas: ApiKeyArea, level: Optional[AccessLevel] = None) -> Rule:
    return Rule(re.compile(pattern), tuple(areas), level)


A = ApiKeyArea
RULES: tuple[Rule, ...] = (
    # Never with a key: moderation.
    _rule(r"^/community/admin(/|$)"),
    # A fork creates a diagram in the user's project.
    _rule(r"^/community/diagrams/[^/]+/fork$", A.COMMUNITY, A.DIAGRAMS, level=AccessLevel.WRITE),
    _rule(r"^/community(/|$)", A.COMMUNITY),
    # AI with the user's providers.
    _rule(r"^/diagrams/convert$", A.AI, level=AccessLevel.WRITE),
    _rule(r"^/diagrams/[^/]+/fix$", A.AI, level=AccessLevel.WRITE),
    # Rendering doesn't change anything.
    _rule(r"^/diagrams/render$", A.DIAGRAMS, level=AccessLevel.READ),
    _rule(r"^/shared-links(/|$)", A.SHARING),
    _rule(r"^/projects/[^/]+/diagrams$", A.DIAGRAMS),
    # Importing creates folders and diagrams.
    _rule(r"^/projects/[^/]+/import$", A.PROJECTS, A.DIAGRAMS, level=AccessLevel.WRITE),
    _rule(r"^/diagrams(/|$)", A.DIAGRAMS),
    _rule(r"^/(projects|folders)(/|$)", A.PROJECTS),
)


def required_access(
    method: str, api_path: str
) -> Optional[tuple[tuple[ApiKeyArea, ...], AccessLevel]]:
    """Areas and level an endpoint needs; None when keys can't call it at all."""
    for rule in RULES:
        if rule.pattern.match(api_path):
            if not rule.areas:
                return None
            level = rule.level or (
                AccessLevel.READ if method.upper() in SAFE_METHODS else AccessLevel.WRITE
            )
            return rule.areas, level
    return None


def grants(granted: AccessLevel, needed: AccessLevel) -> bool:
    """Whether a granted level covers the needed one (write includes read)."""
    order = {AccessLevel.NONE: 0, AccessLevel.READ: 1, AccessLevel.WRITE: 2}
    return order[granted] >= order[needed]


def legacy_permissions(scope: Optional[str]) -> Permissions:
    """Permissions of a key created with the old global read/write scope (no AI)."""
    level = AccessLevel.WRITE if scope == "write" else AccessLevel.READ
    return {area: (AccessLevel.NONE if area == A.AI else level) for area in ApiKeyArea}
