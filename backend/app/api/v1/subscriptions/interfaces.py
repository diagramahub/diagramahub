"""
Repository interfaces for subscription system.
"""
from abc import ABC, abstractmethod
from typing import Optional
from .schemas import (
    PlanInDB, PlanCreate, PlanUpdate,
    SubscriptionInDB, SubscriptionCreate
)


class IPlanRepository(ABC):
    """Interface for plan repository."""
    
    @abstractmethod
    async def create(self, plan_data: PlanCreate) -> PlanInDB:
        """Create a new plan."""
        pass
    
    @abstractmethod
    async def get_by_id(self, plan_id: str) -> Optional[PlanInDB]:
        """Get plan by ID."""
        pass
    
    @abstractmethod
    async def get_by_name(self, name: str) -> Optional[PlanInDB]:
        """Get plan by name."""
        pass
    
    @abstractmethod
    async def get_all_active(self) -> list[PlanInDB]:
        """Get all active plans."""
        pass
    
    @abstractmethod
    async def get_all(self) -> list[PlanInDB]:
        """Get all plans (including inactive)."""
        pass
    
    @abstractmethod
    async def update(self, plan_id: str, plan_data: PlanUpdate) -> Optional[PlanInDB]:
        """Update a plan."""
        pass
    
    @abstractmethod
    async def deactivate(self, plan_id: str) -> Optional[PlanInDB]:
        """Deactivate a plan (soft delete)."""
        pass
    
    @abstractmethod
    async def count_active_subscriptions(self, plan_id: str) -> int:
        """Count active subscriptions for a plan."""
        pass


class ISubscriptionRepository(ABC):
    """Interface for subscription repository."""
    
    @abstractmethod
    async def create(self, subscription_data: SubscriptionCreate) -> SubscriptionInDB:
        """Create a new subscription."""
        pass
    
    @abstractmethod
    async def get_by_id(self, subscription_id: str) -> Optional[SubscriptionInDB]:
        """Get subscription by ID."""
        pass
    
    @abstractmethod
    async def get_active_by_user(self, user_id: str) -> Optional[SubscriptionInDB]:
        """Get active subscription for a user."""
        pass
    
    @abstractmethod
    async def get_by_stripe_id(self, stripe_subscription_id: str) -> Optional[SubscriptionInDB]:
        """Get subscription by Stripe subscription ID."""
        pass
    
    @abstractmethod
    async def update_status(
        self, 
        subscription_id: str, 
        status: str
    ) -> Optional[SubscriptionInDB]:
        """Update subscription status."""
        pass
    
    @abstractmethod
    async def update(
        self, 
        subscription_id: str, 
        update_data: dict
    ) -> Optional[SubscriptionInDB]:
        """Update subscription with arbitrary data."""
        pass
    
    @abstractmethod
    async def count_by_plan(self, plan_id: str, status: str = "active") -> int:
        """Count subscriptions by plan and status."""
        pass
