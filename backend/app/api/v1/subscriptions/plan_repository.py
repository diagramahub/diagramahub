"""
Plan repository implementation.
"""

from typing import Optional, Union
from beanie import PydanticObjectId

from .interfaces import IPlanRepository
from .schemas import PlanInDB, PlanCreate, PlanUpdate, SubscriptionInDB
from app.core.clock import utcnow


class PlanRepository(IPlanRepository):
    """MongoDB implementation of plan repository using Beanie."""

    async def create(self, plan_data: PlanCreate) -> PlanInDB:
        """Create a new plan."""
        plan = PlanInDB(
            name=plan_data.name,
            code=plan_data.code,
            description=plan_data.description,
            max_projects=plan_data.max_projects,
            max_diagrams=plan_data.max_diagrams,
            is_active=True,
            created_at=utcnow(),
            updated_at=utcnow(),
        )
        await plan.insert()
        return plan

    async def get_by_id(self, plan_id: str) -> Optional[PlanInDB]:
        """Get plan by ID."""
        try:
            return await PlanInDB.get(PydanticObjectId(plan_id))
        except Exception:
            return None

    async def get_by_name(self, name: str) -> Optional[PlanInDB]:
        """Get plan by name."""
        return await PlanInDB.find_one(PlanInDB.name == name)

    async def get_by_code(self, code: str) -> Optional[PlanInDB]:
        """Get plan by code."""
        return await PlanInDB.find_one(PlanInDB.code == code)

    async def get_all_active(self) -> list[PlanInDB]:
        """Get all active plans."""
        # ``== True`` is required by beanie's query DSL (see shared_links repository).
        plans = await PlanInDB.find(PlanInDB.is_active == True).to_list()  # noqa: E712
        return plans

    async def get_all(self) -> list[PlanInDB]:
        """Get all plans (including inactive)."""
        plans = await PlanInDB.find_all().to_list()
        return plans

    async def update(self, plan_id: str, plan_data: Union[PlanUpdate, dict]) -> Optional[PlanInDB]:
        """Update a plan (PlanUpdate schema or partial field dict)."""
        plan = await self.get_by_id(plan_id)
        if not plan:
            return None

        if isinstance(plan_data, PlanUpdate):
            update_data = plan_data.model_dump(exclude_unset=True)
            # price_usd is managed via prices dict, not persisted directly
            update_data.pop("price_usd", None)
        else:
            update_data = plan_data

        if update_data:
            update_data["updated_at"] = utcnow()
            await plan.set(update_data)

        return plan

    async def deactivate(self, plan_id: str) -> Optional[PlanInDB]:
        """Deactivate a plan (soft delete)."""
        plan = await self.get_by_id(plan_id)
        if not plan:
            return None

        await plan.set({"is_active": False, "updated_at": utcnow()})

        return plan

    async def delete(self, plan_id: str) -> bool:
        """Hard delete a plan from the database."""
        plan = await self.get_by_id(plan_id)
        if not plan:
            return False
        await plan.delete()
        return True

    async def count_active_subscriptions(self, plan_id: str) -> int:
        """Count active subscriptions for a plan."""
        count = await SubscriptionInDB.find(
            SubscriptionInDB.plan_id == plan_id, SubscriptionInDB.status == "active"
        ).count()
        return count
