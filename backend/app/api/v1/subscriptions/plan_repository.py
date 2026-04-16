"""
Plan repository implementation.
"""
from datetime import datetime
from typing import Optional
from beanie import PydanticObjectId

from .interfaces import IPlanRepository
from .schemas import PlanInDB, PlanCreate, PlanUpdate, SubscriptionInDB


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
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
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
        plans = await PlanInDB.find(PlanInDB.is_active == True).to_list()
        return plans
    
    async def get_all(self) -> list[PlanInDB]:
        """Get all plans (including inactive)."""
        plans = await PlanInDB.find_all().to_list()
        return plans
    
    async def update(self, plan_id: str, plan_data: PlanUpdate) -> Optional[PlanInDB]:
        """Update a plan."""
        plan = await self.get_by_id(plan_id)
        if not plan:
            return None
        
        update_data = plan_data.model_dump(exclude_unset=True)
        # price_usd is managed via prices dict, not persisted directly
        update_data.pop("price_usd", None)
        if update_data:
            update_data["updated_at"] = datetime.utcnow()
            await plan.set(update_data)
        
        return plan
    
    async def deactivate(self, plan_id: str) -> Optional[PlanInDB]:
        """Deactivate a plan (soft delete)."""
        plan = await self.get_by_id(plan_id)
        if not plan:
            return None
        
        await plan.set({
            "is_active": False,
            "updated_at": datetime.utcnow()
        })
        
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
            SubscriptionInDB.plan_id == plan_id,
            SubscriptionInDB.status == "active"
        ).count()
        return count
