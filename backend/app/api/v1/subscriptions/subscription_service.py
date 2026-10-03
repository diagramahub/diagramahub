"""
Subscription service with business logic.
"""

import logging
from datetime import datetime
from typing import Optional

from app.core.config import settings
from .interfaces import ISubscriptionRepository, IPlanRepository
from .schemas import SubscriptionCreate, SubscriptionResponse, SubscriptionInDB, PlanResponse
from .payment_providers.interfaces import IPaymentProvider
from .exceptions import NotFoundError, ValidationError
from .constants import FREE_PLAN_NAME, STATUS_ACTIVE
from .logger import SubscriptionLogger
from app.core.clock import utcnow

logger = logging.getLogger(__name__)


class SubscriptionService:
    """Servicio para gestión de suscripciones."""

    def __init__(
        self,
        repository: ISubscriptionRepository,
        plan_repository: IPlanRepository,
        payment_provider: IPaymentProvider,
    ):
        self.repository = repository
        self.plan_repository = plan_repository
        self.payment_provider = payment_provider

    async def create_free_subscription(self, user_id: str) -> SubscriptionResponse:
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
        subscription_data = SubscriptionCreate(user_id=user_id, plan_id=str(free_plan.id))
        subscription = await self.repository.create(subscription_data)

        # Log creation
        SubscriptionLogger.subscription_created(
            subscription_id=str(subscription.id),
            user_id=user_id,
            plan_name=FREE_PLAN_NAME,
            status=STATUS_ACTIVE,
        )

        # Retornar respuesta con plan embebido
        return await self._to_response(subscription)

    async def initiate_plan_change(
        self, user_id: str, new_plan_id: str, user_email: str = ""
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

            return {"type": "immediate", "data": subscription.model_dump()}

        # Si el plan es de pago, crear checkout session
        checkout_data = await self.create_checkout_session(user_id, new_plan_id, user_email)

        return {"type": "checkout", "data": checkout_data}

    async def create_checkout_session(
        self, user_id: str, plan_id: str, user_email: str = ""
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

        if not user_email:
            user_email = f"user_{user_id}@placeholder.com"

        # Use the single multi-currency price_id from gateway_config
        gw = plan.parsed_gateway_config if hasattr(plan, "parsed_gateway_config") else None
        if not gw or not gw.external_price_id:
            raise ValidationError("Plan must be synced with a payment gateway before checkout")

        # Configurar URLs usando settings
        success_url = f"{settings.FRONTEND_URL}/profile?tab=subscription&success=true&session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{settings.FRONTEND_URL}/profile?tab=subscription"

        # Crear sesión de checkout
        session = await self.payment_provider.create_checkout_session(
            user_email=user_email,
            stripe_price_id=gw.external_price_id,
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"user_id": user_id, "plan_id": plan_id},
        )

        # Log checkout session creation
        SubscriptionLogger.checkout_session_created(
            user_id=user_id,
            plan_name=plan.name,
            session_id=session["session_id"],
            amount=plan.price_usd,
        )

        return session

    async def activate_subscription(
        self,
        user_id: str,
        plan_id: str,
        stripe_customer_id: str,
        stripe_subscription_id: str,
        current_period_end: Optional[datetime] = None,
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
        subscription_data = SubscriptionCreate(user_id=user_id, plan_id=plan_id)
        subscription = await self.repository.create(subscription_data)

        # Actualizar con datos de Stripe
        update_data = {
            "stripe_customer_id": stripe_customer_id,
            "stripe_subscription_id": stripe_subscription_id,
            "status": STATUS_ACTIVE,
            "current_period_start": utcnow(),
        }

        if current_period_end:
            update_data["current_period_end"] = current_period_end

        await self.repository.update(str(subscription.id), update_data)

        # Obtener suscripción actualizada
        updated_sub = await self.repository.get_by_id(str(subscription.id))
        response = await self._to_response(updated_sub)

        # Log activation
        SubscriptionLogger.subscription_activated(
            subscription_id=str(subscription.id),
            user_id=user_id,
            plan_name=response.plan.name,
            stripe_subscription_id=stripe_subscription_id,
        )

        return response

    async def has_active_subscription(self, user_id: str) -> bool:
        """Return True when the user has an active subscription."""
        subscription = await self.repository.get_active_by_user(user_id)
        return subscription is not None

    async def cancel_subscription(self, user_id: str, immediate: bool = False) -> dict:
        """
        Cancela suscripción de pago.

        Args:
            user_id: ID del usuario
            immediate: Si es True, cancela inmediatamente y cambia a FREE.
                      Si es False, mantiene activa hasta fin de período.

        Lógica:
        - Si immediate=True:
          * Cancela en Stripe inmediatamente
          * Cambia a plan FREE de inmediato
          * Usuario pierde acceso premium ahora
        - Si immediate=False:
          * Cancela en Stripe con cancel_at_period_end=True
          * Mantiene activa hasta fin de período
          * Programa cambio a FREE
        """
        # Obtener suscripción activa
        subscription = await self.repository.get_active_by_user(user_id)
        if not subscription:
            raise NotFoundError("Subscription", user_id)

        # Si no tiene stripe_subscription_id, es FREE
        if not subscription.stripe_subscription_id:
            raise ValidationError("Cannot cancel free subscription")

        # Get plan for logging
        plan = await self.plan_repository.get_by_id(subscription.plan_id)

        if immediate:
            # Cancelación inmediata
            try:
                # Cancelar en Stripe inmediatamente
                await self.payment_provider.cancel_subscription(
                    subscription.stripe_subscription_id, immediate=True
                )
            except Exception as e:
                # Si falla la cancelación en Stripe, continuar de todos modos
                logger.warning("Error cancelling in Stripe: %s", e)

            # Marcar suscripción actual como cancelada
            await self.repository.update(
                str(subscription.id), {"cancelled_at": utcnow(), "status": "cancelled"}
            )

            # Cambiar a plan FREE inmediatamente
            await self.create_free_subscription(user_id)

            # Log cancellation
            SubscriptionLogger.subscription_cancelled(
                subscription_id=str(subscription.id),
                user_id=user_id,
                plan_name=plan.name if plan else "Unknown",
                cancel_at=utcnow(),
            )

            return {
                "message": "Subscription cancelled immediately",
                "cancel_at": utcnow(),
                "access_until": utcnow(),
                "immediate": True,
            }
        else:
            # Cancelación al final del período (comportamiento actual)
            cancel_result = await self.payment_provider.cancel_subscription(
                subscription.stripe_subscription_id
            )

            # Actualizar suscripción local
            await self.repository.update(
                str(subscription.id),
                {
                    "cancelled_at": utcnow(),
                    "current_period_end": cancel_result.get("cancel_at"),
                },
            )

            # Log cancellation
            SubscriptionLogger.subscription_cancelled(
                subscription_id=str(subscription.id),
                user_id=user_id,
                plan_name=plan.name if plan else "Unknown",
                cancel_at=cancel_result.get("cancel_at"),
            )

            return {
                "message": "Subscription cancelled successfully",
                "cancel_at": cancel_result.get("cancel_at"),
                "access_until": cancel_result.get("cancel_at"),
                "immediate": False,
            }

    async def create_setup_session(self, user_id: str) -> dict:
        """
        Crea sesión de Stripe Checkout en modo setup para cambiar método de pago.
        """
        # Obtener suscripción activa
        subscription = await self.repository.get_active_by_user(user_id)
        if not subscription:
            raise NotFoundError("Subscription", user_id)

        if not subscription.stripe_customer_id:
            raise ValidationError("No payment method to update on free plan")

        if not self.payment_provider:
            raise ValidationError("Payment provider not configured")

        success_url = f"{settings.FRONTEND_URL}/profile?tab=subscription&payment_updated=true"
        cancel_url = f"{settings.FRONTEND_URL}/profile?tab=subscription"

        return await self.payment_provider.create_setup_session(
            customer_id=subscription.stripe_customer_id,
            success_url=success_url,
            cancel_url=cancel_url,
        )

    async def get_by_stripe_id(self, stripe_id: str) -> Optional[SubscriptionInDB]:
        """Obtiene suscripción local por ID de suscripción de Stripe."""
        return await self.repository.get_by_stripe_id(stripe_id)

    async def update_from_webhook(
        self, subscription_id: str, **fields
    ) -> Optional[SubscriptionInDB]:
        """Actualiza suscripción local con datos provenientes del webhook."""
        return await self.repository.update(subscription_id, fields)

    async def handle_subscription_deleted(self, stripe_subscription_id: str) -> None:
        """
        Maneja evento customer.subscription.deleted.

        Marca la suscripción local como cancelada y crea una suscripción
        FREE para el usuario.
        """
        # Buscar suscripción local
        subscription = await self.repository.get_by_stripe_id(stripe_subscription_id)

        if subscription:
            # Marcar como cancelled
            await self.update_subscription_status(str(subscription.id), "cancelled")

            # Crear suscripción FREE
            logger.info(f"Creating FREE subscription for user {subscription.user_id}")
            await self.create_free_subscription(subscription.user_id)
        else:
            logger.warning(f"Subscription not found for stripe_id {stripe_subscription_id}")

    async def get_user_subscription(self, user_id: str, is_admin: bool = False):
        """
        Obtiene suscripción activa del usuario.

        Los administradores reciben una suscripción virtual ilimitada.
        """
        if is_admin:
            return {
                "id": None,
                "user_id": user_id,
                "plan": {
                    "id": None,
                    "name": "Administrador",
                    "description": "Acceso completo sin límites",
                    "price_usd": 0,
                    "max_projects": None,
                    "max_diagrams": None,
                    "is_active": True,
                    "is_free": False,
                    "active_subscriptions": 0,
                    "created_at": None,
                    "updated_at": None,
                },
                "status": "active",
                "stripe_customer_id": None,
                "stripe_subscription_id": None,
                "payment_provider": None,
                "started_at": None,
                "current_period_start": None,
                "current_period_end": None,
                "cancelled_at": None,
                "created_at": None,
                "updated_at": None,
            }

        subscription = await self.repository.get_active_by_user(user_id)
        if not subscription:
            raise NotFoundError("Subscription", user_id)

        return await self._to_response(subscription)

    async def update_subscription_status(
        self, subscription_id: str, status: str
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
        active_subs = await self.plan_repository.count_active_subscriptions(subscription.plan_id)

        plan_response = PlanResponse(
            id=str(plan.id),
            name=plan.name,
            code=plan.code or plan.name.upper().replace(" ", "_"),
            description=plan.description,
            price_usd=plan.price_usd,
            max_projects=plan.max_projects,
            max_diagrams=plan.max_diagrams,
            is_active=plan.is_active,
            is_free=plan.is_free,
            active_subscriptions=active_subs,
            gateway_config=getattr(plan, "gateway_config", None),
            prices=getattr(plan, "prices", {}),
            created_at=plan.created_at,
            updated_at=plan.updated_at,
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
            updated_at=subscription.updated_at,
        )
