"""Integration tests for the shared links repository queries."""

import pytest

from app.api.v1.shared_links.repository import SharedLinkRepository
from app.api.v1.shared_links.schemas import SharedLinkInDB


@pytest.mark.integration
async def test_get_active_by_diagram_returns_only_active_link(test_db) -> None:
    """Regression: the ``is_active`` filter must be a real Mongo expression.

    A bare ``SharedLinkInDB.is_active`` argument raised
    ``TypeError: 'ExpressionField' object is not callable`` on every call.
    """
    await SharedLinkInDB(
        diagram_id="d1", user_id="u1", token="inactive-token", access_type="public", is_active=False
    ).insert()
    await SharedLinkInDB(
        diagram_id="d1", user_id="u1", token="active-token", access_type="public"
    ).insert()

    link = await SharedLinkRepository().get_active_by_diagram("d1")

    assert link is not None
    assert link.token == "active-token"


@pytest.mark.integration
async def test_get_active_by_diagram_returns_none_without_active_link(test_db) -> None:
    """A diagram whose only link was deactivated has no active link."""
    await SharedLinkInDB(
        diagram_id="d2", user_id="u1", token="old-token", access_type="public", is_active=False
    ).insert()

    assert await SharedLinkRepository().get_active_by_diagram("d2") is None
