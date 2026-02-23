"""
Subscription service with business logic.
"""
from datetime import datetime
from typing import Optional
import os

from .interfaces import ISubscriptionRepository, IPlanRepository
from .schemas import (
    SubscriptionCreate, SubscriptionResponse, SubscriptionWithUsage,
    PlanResponse
)
from .payment_providers.interfaces import IPaymentProvider
from .exceptions import NotFoundError, ValidationError
from .constants import FREE_PLAN_NAME, STATUS_ACTIVE, STATUS_PENDING


class SubscriptionService:
    """Servicio para gestión de suscripciones."""
    
    def __init__(
        self,
        repository: ISubscriptionRepository,
        plan_repository: IPlanRepository,
        payment_provider: IPaymentProvider
    ):
        self.repository = repository
        self.plan_repository = plan_repository
        self.payment_provider = payment_provider
    
    async def create_free_subscription(
        self, 
        user_id: str
    ) -> SubscriptionResponse:
        """
        Crea suscripción FREE para nuevo usuario.
        
        Llamado automáticamente en registro de usuario.
        Estado inicial: "active"
        """
        # Obtener plan FREE
        free_plan = await self.plan_repository.get_by_name(FREE_PLAN_NAME)
        if not free_plan:
            raise NotFoundError("Plan", FREE_PLAN_NAME)
        
        # Crear suscripción
        subscription_data = SubscriptionCreate(
            user_id=user_id,
            plan_id=str(free_plan.id)
        )
        subscription = await self.repository.create(subscription_data)
        
        # Retornar respuesta con plan embebido
        return await self._to_response(subscription)
    
    async def initiate_plan_change(
        self,
        user_id: str,
        new_plan_id: str
    ) -> dict:
        """
        Inicia cambio de plan.
        
        Lógica:
        - Si nuevo plan es FREE: cambio inmediato
        - Si nuevo plan es de pago: crear checkout session
        - Retorna: {"type": "immediate" | "checkout", "data": ...}
        """
        # Obtener nuevo plan
        new_plan = await self.plan_repository.get_by_id(new_plan_id)
        if not new_plan:
            raise NotFoundError("Plan", new_plan_id)
        
        # Si el plan es FREE, cambio inmediato
        if new_plan.price_usd == 0:
            # Cancelar suscripción actual si existe
            current_sub = await self.repository.get_active_by_user(user_id)
            if current_sub:
                await self.repository.update_status(str(current_sub.id), "cancelled")
            
            # Crear nueva suscripción FREE
            subscription = await self.create_free_subscription(user_id)
            
            return {
                "type": "immediate",
                "data": subscription.model_dump()
            }
        
        # Si el plan es de pago, crear checkout session
        checkout_data = await self.create_checkout_session(user_id, new_plan_id)
        
        return {
            "type": "checkout",
            "data": checkout_data
        }
    
    async def create_checkout_session(
        self,
        user_id: str,
        plan_id: str
    ) -> dict:
        """
        Crea sesión de Stripe Checkout.
        
        Retorna: {"session_url": str, "session_id": str}
        """
        # Obtener plan
        plan = await self.plan_repository.get_by_id(plan_id)
        if not plan:
            raise NotFoundError("Plan", plan_id)
        
        # Validar que el plan sea de pago
        if plan.price_usd == 0:
            raise ValidationError("Cannot create checkout session for free plan")
        
        # Obtener email del usuario (necesitamos acceso al user repository)
        # Por ahora, usaremos un placeholder - esto se debe mejorar
        user_email = f"user_{user_id}@placeholder.com"  # TODO: Get real email
        
        # Configurar URLs
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        success_url = f"{frontend_url}/subscription/success"
        cancel_url = f"{frontend_url}/subscription/cancel"
        
        # Crear sesión de checkout
        session = await self.payment_provider.create_checkout_session(
            user_email=user_email,
            plan_name=plan.name,
            plan_price=plan.price_usd,
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": user_id,
                "plan_id": plan_id
            }
        )
        
        return session
    
    async def activate_subscription(
        self,
        user_id: str,
        plan_id: str,
        stripe_customer_id: str,
        stripe_subscription_id: str
    ) -> SubscriptionResponse:
        """
        Activa suscripción tras pago exitoso.
        
        Llamado por webhook handler.
        """
        # Cancelar suscripción actual si existe
        current_sub = await self.repository.get_active_by_user(user_id)
        if current_sub:
            await self.repository.update_status(str(current_sub.id), "cancelled")
        
        # Crear nueva suscripción
        subscription_data = SubscriptionCreate(
            user_id=user_id,
            plan_id=plan_id
        )
        subscription = await self.repository.create(subscription_data)
        
        # Actualizar con datos de Stripe
        await self.repository.update(
            str(subscription.id),
            {
                "stripe_customer_id": stripe_customer_id,
                "stripe_subscription_id": stripe_subscription_id,
                "status": STATUS_ACTIVE,
                "current_period_start": datetime.utcnow()
            }
        )
        
        # Obtener suscripción actualizada
        updated_sub = await self.repository.get_by_id(str(subscription.id))
        return await self._to_response(updated_sub)
    
    async def cancel_subscription(
        self,
        user_id: str
    ) -> dict:
        """
        Cancela suscripción de pago.
        
        Lógica:
        - Cancela en Stripe
        - Mantiene activa hasta fin de período
        - Programa cambio a FREE
        """
        # Obtener suscripción activa
        subscription = await self.repository.get_active_by_user(user_id)
        if not subscription:
            raise NotFoundError("Subscription", user_id)
        
        # Si no tiene stripe_subscription_id, es FREE
        if not subscription.stripe_subscription_id:
            raise ValidationError("Cannot cancel free subscription")
        
        # Cancelar en Stripe
        cancel_result = await self.payment_provider.cancel_subscription(
            subscription.stripe_subscription_id
        )
        
        # Actualizar suscripción local
        await self.repository.update(
            str(subscription.id),
            {
                "cancelled_at": datetime.utcnow(),
                "current_period_end": cancel_result.get("cancel_at")
            }
        )
        
        return {
            "message": "Subscription cancelled successfully",
            "cancel_at": cancel_result.get("cancel_at"),
            "access_until": cancel_result.get("cancel_at")
        }
    
    async def get_user_subscription(
        self,
        user_id: str
    ) -> SubscriptionResponse:
        """Obtiene suscripción activa del usuario."""
        subscription = await self.repository.get_active_by_user(user_id)
        if not subscription:
            raise NotFoundError("Subscription", user_id)
        
        return await self._to_response(subscription)
    
    async def update_subscription_status(
        self,
        subscription_id: str,
        status: str
    ) -> SubscriptionResponse:
        """Actualiza estado de suscripción."""
        subscription = await self.repository.update_status(subscription_id, status)
        if not subscription:
            raise NotFoundError("Subscription", subscription_id)
        
        return await self._to_response(subscription)
    
    async def _to_response(self, subscription) -> SubscriptionResponse:
        """Convierte SubscriptionInDB a SubscriptionResponse."""
        # Obtener plan
        plan = await self.plan_repository.get_by_id(subscription.plan_id)
        if not plan:
            raise NotFoundError("Plan", subscription.plan_id)
        
        # Contar suscripciones activas del plan
        active_subs = await self.plan_repository.count_active_subscriptions(
            subscription.plan_id
        )
        
        plan_response = PlanResponse(
            id=str(plan.id),
            name=plan.name,
            description=plan.description,
            price_usd=plan.price_usd,
            max_projects=plan.max_projects,
            max_diagrams=plan.max_diagrams,
            is_active=plan.is_active,
            is_free=plan.is_free,
            active_subscriptions=active_subs,
            created_at=plan.created_at,
            updated_at=plan.updated_at
        )
        
        return SubscriptionResponse(
            id=str(subscription.id),
            user_id=subscription.user_id,
            plan=plan_response,
            status=subscription.status,
            stripe_customer_id=subscription.stripe_customer_id,
            stripe_subscription_id=subscription.stripe_subscription_id,
            payment_provider=subscription.payment_provider,
            started_at=subscription.started_at,
            current_period_start=subscription.current_period_start,
            current_period_end=subscription.current_period_end,
            cancelled_at=subscription.cancelled_at,
            created_at=subscription.created_at,
            updated_at=subscription.updated_at
        )
