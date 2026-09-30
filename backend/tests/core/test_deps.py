"""Tests for the shared current-user dependencies in ``app.api.deps``."""

import pytest
from fastapi import HTTPException

from app.api.deps import get_current_user_id


@pytest.mark.integration
async def test_get_current_user_id_rejects_unknown_user_with_401(test_db) -> None:
    """A valid token for a deleted account must yield 401, not a 500 AttributeError."""
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user_id("deleted-user@example.com")

    assert exc_info.value.status_code == 401
