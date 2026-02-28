"""
Plan service with business logic.
"""
from typing import Optional

from .interfaces import IPlanRepository
from .schemas import PlanCreate, PlanUpdate, PlanResponse, PlanInDB
from .exceptions import (
    ValidationError,
    FreePlanProtectionError,
    DuplicatePlanNameError,
    NotFoundError
)
from .constants import FREE_PLAN_NAME
from .logger import SubscriptionLogger


class PlanService:
    """Servicio para gestión de planes de suscripción."""
    
    def __init__(self, repository: IPlanRepository):
        self.repository = repository
    
    async def create_plan(
        self, 
        plan_data: PlanCreate, 
        admin_user_id: str
    ) -> PlanResponse:
        """
        Crea un nuevo plan de suscripción.
        
        Validaciones:
        - Precio >= 0 (validado por Pydantic)
        - Nombre único
        - max_projects y max_diagrams válidos (>= -1, validado por Pydantic)
        """
        # Verificar nombre único
        existing = await self.repository.get_by_name(plan_data.name)
        if existing:
            raise DuplicatePlanNameError(plan_data.name)
        
        # Crear plan
        plan = await self.repository.create(plan_data)
        
        # Log creation
        SubscriptionLogger.plan_created(
            plan_id=str(plan.id),
            plan_name=plan.name,
            price=plan.price_usd,
            created_by=admin_user_id
        )
        
        # Contar suscripciones activas (será 0 para plan nuevo)
        active_subs = await self.repository.count_active_subscriptions(str(plan.id))
        
        return self._to_response(plan, active_subs)
    
    async def update_plan(
        self, 
        plan_id: str, 
        plan_data: PlanUpdate,
        admin_user_id: str
    ) -> PlanResponse:
        """
        Actualiza un plan existente.
        
        Validaciones:
        - Plan no es FREE (inmutable)
        - Si se cambia el nombre, debe ser único
        """
        # Obtener plan existente
        plan = await self.repository.get_by_id(plan_id)
        if not plan:
            raise NotFoundError("Plan", plan_id)
        
        # Proteger plan FREE
        if plan.is_free or plan.name == FREE_PLAN_NAME:
            raise FreePlanProtectionError()
        
        # Si se cambia el nombre, verificar que sea único
        if plan_data.name and plan_data.name != plan.name:
            existing = await self.repository.get_by_name(plan_data.name)
            if existing:
                raise DuplicatePlanNameError(plan_data.name)
        
        # Actualizar plan
        updated_plan = await self.repository.update(plan_id, plan_data)
        if not updated_plan:
            raise NotFoundError("Plan", plan_id)
        
        # Log update
        changes = plan_data.model_dump(exclude_unset=True)
        SubscriptionLogger.plan_updated(
            plan_id=plan_id,
            plan_name=updated_plan.name,
            updated_by=admin_user_id,
            changes=changes
        )
        
        # Contar suscripciones activas
        active_subs = await self.repository.count_active_subscriptions(plan_id)
        
        return self._to_response(updated_plan, active_subs)
    
    async def deactivate_plan(
        self, 
        plan_id: str,
        admin_user_id: str
    ) -> dict:
        """
        Desactiva un plan (soft delete).
        
        Validaciones:
        - Plan no es FREE
        - Mantiene suscripciones activas
        """
        # Obtener plan existente
        plan = await self.repository.get_by_id(plan_id)
        if not plan:
            raise NotFoundError("Plan", plan_id)
        
        # Proteger plan FREE
        if plan.is_free or plan.name == FREE_PLAN_NAME:
            raise FreePlanProtectionError()
        
        # Desactivar plan
        deactivated_plan = await self.repository.deactivate(plan_id)
        if not deactivated_plan:
            raise NotFoundError("Plan", plan_id)
        
        # Log deactivation
        SubscriptionLogger.plan_deactivated(
            plan_id=plan_id,
            plan_name=deactivated_plan.name,
            deactivated_by=admin_user_id
        )
        
        # Contar suscripciones activas (se mantienen)
        active_subs = await self.repository.count_active_subscriptions(plan_id)
        
        return {
            "message": "Plan deactivated successfully",
            "plan_id": plan_id,
            "active_subscriptions_maintained": active_subs
        }
    
    async def get_active_plans(self) -> list[PlanResponse]:
        """Obtiene todos los planes activos."""
        plans = await self.repository.get_all_active()
        
        # Agregar conteo de suscripciones activas
        responses = []
        for plan in plans:
            active_subs = await self.repository.count_active_subscriptions(str(plan.id))
            responses.append(self._to_response(plan, active_subs))
        
        return responses
    
    async def get_all_plans(self) -> list[PlanResponse]:
        """Obtiene todos los planes (incluyendo inactivos)."""
        plans = await self.repository.get_all()
        
        # Agregar conteo de suscripciones activas
        responses = []
        for plan in plans:
            active_subs = await self.repository.count_active_subscriptions(str(plan.id))
            responses.append(self._to_response(plan, active_subs))
        
        return responses
    
    async def get_plan_by_id(self, plan_id: str) -> PlanResponse:
        """Obtiene un plan por ID."""
        plan = await self.repository.get_by_id(plan_id)
        if not plan:
            raise NotFoundError("Plan", plan_id)
        
        active_subs = await self.repository.count_active_subscriptions(plan_id)
        return self._to_response(plan, active_subs)
    
    async def get_plan_by_name(self, name: str) -> Optional[PlanResponse]:
        """Obtiene un plan por nombre."""
        plan = await self.repository.get_by_name(name)
        if not plan:
            return None
        
        active_subs = await self.repository.count_active_subscriptions(str(plan.id))
        return self._to_response(plan, active_subs)
    
    def _to_response(self, plan: PlanInDB, active_subscriptions: int = 0) -> PlanResponse:
        """Convierte PlanInDB a PlanResponse."""
        return PlanResponse(
            id=str(plan.id),
            name=plan.name,
            description=plan.description,
            price_usd=plan.price_usd,
            max_projects=plan.max_projects,
            max_diagrams=plan.max_diagrams,
            is_active=plan.is_active,
            is_free=plan.is_free,
            active_subscriptions=active_subscriptions,
            created_at=plan.created_at,
            updated_at=plan.updated_at
        )
