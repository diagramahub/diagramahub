"""Integration tests for the plan repository queries."""

import pytest

from app.api.v1.subscriptions.plan_repository import PlanRepository
from app.api.v1.subscriptions.schemas import PlanInDB


@pytest.mark.integration
async def test_get_all_active_filters_inactive_plans(test_db) -> None:
    """Regression: ``get_all_active`` must filter with a real Mongo expression."""
    await PlanInDB(name="Free", code="FREE").insert()
    await PlanInDB(name="Legacy", code="LEGACY", is_active=False).insert()

    plans = await PlanRepository().get_all_active()

    assert [p.code for p in plans] == ["FREE"]
