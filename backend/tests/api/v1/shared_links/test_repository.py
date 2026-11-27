"""Integration tests for the shared links repository queries."""

import pytest

from app.api.v1.shared_links.repository import SharedLinkRepository
from app.api.v1.shared_links.schemas import SharedLinkInDB
from tests.utils.security import generate_test_token


@pytest.mark.integration
async def test_get_active_by_diagram_returns_only_active_link(test_db) -> None:
    """Regression: the ``is_active`` filter must be a real Mongo expression.

    A bare ``SharedLinkInDB.is_active`` argument raised
    ``TypeError: 'ExpressionField' object is not callable`` on every call.
    """
    active_token = generate_test_token("active")
    await SharedLinkInDB(
        diagram_id="d1",
        user_id="u1",
        token=generate_test_token("inactive"),
        access_type="public",
        is_active=False,
    ).insert()
    await SharedLinkInDB(
        diagram_id="d1", user_id="u1", token=active_token, access_type="public"
    ).insert()

    link = await SharedLinkRepository().get_active_by_diagram("d1")

    assert link is not None
    assert link.token == active_token


@pytest.mark.integration
async def test_get_active_by_diagram_returns_none_without_active_link(test_db) -> None:
    """A diagram whose only link was deactivated has no active link."""
    await SharedLinkInDB(
        diagram_id="d2",
        user_id="u1",
        token=generate_test_token("old"),
        access_type="public",
        is_active=False,
    ).insert()

    assert await SharedLinkRepository().get_active_by_diagram("d2") is None
