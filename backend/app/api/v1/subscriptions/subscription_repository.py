"""
Subscription repository implementation.
"""
from datetime import datetime
from typing import Optional
from beanie import PydanticObjectId

from .interfaces import ISubscriptionRepository
from .schemas import SubscriptionInDB, SubscriptionCreate


class SubscriptionRepository(ISubscriptionRepository):
    """MongoDB implementation of subscription repository using Beanie."""
    
    async def create(self, subscription_data: SubscriptionCreate) -> SubscriptionInDB:
        """Create a new subscription."""
        subscription = SubscriptionInDB(
            user_id=subscription_data.user_id,
            plan_id=subscription_data.plan_id,
            status="active",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        await subscription.insert()
        return subscription
    
    async def get_by_id(self, subscription_id: str) -> Optional[SubscriptionInDB]:
        """Get subscription by ID."""
        try:
            return await SubscriptionInDB.get(PydanticObjectId(subscription_id))
        except Exception:
            return None
    
    async def get_active_by_user(self, user_id: str) -> Optional[SubscriptionInDB]:
        """Get active subscription for a user."""
        return await SubscriptionInDB.find_one(
            SubscriptionInDB.user_id == user_id,
            SubscriptionInDB.status == "active"
        )
    
    async def get_by_stripe_id(self, stripe_subscription_id: str) -> Optional[SubscriptionInDB]:
        """Get subscription by Stripe subscription ID."""
        return await SubscriptionInDB.find_one(
            SubscriptionInDB.stripe_subscription_id == stripe_subscription_id
        )
    
    async def update_status(
        self, 
        subscription_id: str, 
        status: str
    ) -> Optional[SubscriptionInDB]:
        """Update subscription status."""
        subscription = await self.get_by_id(subscription_id)
        if not subscription:
            return None
        
        await subscription.set({
            "status": status,
            "updated_at": datetime.utcnow()
        })
        
        return subscription
    
    async def update(
        self, 
        subscription_id: str, 
        update_data: dict
    ) -> Optional[SubscriptionInDB]:
        """Update subscription with arbitrary data."""
        subscription = await self.get_by_id(subscription_id)
        if not subscription:
            return None
        
        update_data["updated_at"] = datetime.utcnow()
        await subscription.set(update_data)
        
        return subscription
    
    async def count_by_plan(self, plan_id: str, status: str = "active") -> int:
        """Count subscriptions by plan and status."""
        count = await SubscriptionInDB.find(
            SubscriptionInDB.plan_id == plan_id,
            SubscriptionInDB.status == status
        ).count()
        return count
