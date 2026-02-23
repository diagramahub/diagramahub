"""
Webhook handler for payment provider events.
"""
import logging
from fastapi import HTTPException

from .subscription_service import SubscriptionService
from .payment_providers.interfaces import IPaymentProvider
from .constants import FREE_PLAN_NAME

logger = logging.getLogger(__name__)


class WebhookHandler:
    """Manejador de webhooks de proveedores de pago."""
    
    def __init__(
        self,
        subscription_service: SubscriptionService,
        payment_provider: IPaymentProvider
    ):
        self.subscription_service = subscription_service
        self.payment_provider = payment_provider
    
    async def handle_webhook(
        self,
        payload: bytes,
        signature: str
    ) -> dict:
        """
        Procesa webhook entrante.
        
        Proceso:
        1. Validar firma usando payment_provider.validate_webhook()
        2. Extraer event_type y data
        3. Delegar a método específico según event_type
        4. Registrar evento en logs
        5. Retornar {"status": "processed"}
        """
        # Validar webhook
        try:
            event = await self.payment_provider.validate_webhook(
                payload, signature
            )
        except ValueError as e:
            logger.warning(f"Invalid webhook signature: {str(e)}")
            raise HTTPException(status_code=401, detail=str(e))
        
        # Procesar según tipo de evento
        event_type = event["event_type"]
        data = event["data"]
        
        logger.info(f"Processing webhook event: {event_type}")
        
        try:
            if event_type == "checkout.session.completed":
                await self._handle_checkout_completed(data)
            elif event_type == "customer.subscription.updated":
                await self._handle_subscription_updated(data)
            elif event_type == "customer.subscription.deleted":
                await self._handle_subscription_deleted(data)
            elif event_type == "invoice.payment_failed":
                await self._handle_payment_failed(data)
            else:
                logger.info(f"Unhandled webhook event type: {event_type}")
            
            logger.info(f"Webhook processed successfully: {event_type}")
            return {"status": "processed"}
        
        except Exception as e:
            logger.error(f"Error processing webhook {event_type}: {str(e)}")
            # No lanzar excepción para que Stripe no reintente
            return {"status": "error", "message": str(e)}
    
    async def _handle_checkout_completed(self, data: dict):
        """
        Maneja evento checkout.session.completed.
        
        Proceso:
        1. Extraer user_id de metadata
        2. Extraer plan_id de metadata
        3. Extraer customer_id y subscription_id
        4. Llamar subscription_service.activate_subscription()
        """
        metadata = data.get("metadata", {})
        user_id = metadata.get("user_id")
        plan_id = metadata.get("plan_id")
        customer_id = data.get("customer")
        subscription_id = data.get("subscription")
        
        if not user_id or not plan_id:
            logger.error("Missing user_id or plan_id in checkout.session.completed metadata")
            return
        
        logger.info(
            f"Activating subscription for user {user_id}, "
            f"plan {plan_id}, stripe_sub {subscription_id}"
        )
        
        await self.subscription_service.activate_subscription(
            user_id=user_id,
            plan_id=plan_id,
            stripe_customer_id=customer_id,
            stripe_subscription_id=subscription_id
        )
    
    async def _handle_subscription_updated(self, data: dict):
        """
        Maneja evento customer.subscription.updated.
        
        Proceso:
        1. Buscar suscripción por stripe_subscription_id
        2. Actualizar estado según data.status
        """
        subscription_id = data.get("id")
        status = data.get("status")
        
        logger.info(f"Updating subscription {subscription_id} to status {status}")
        
        # Buscar suscripción local
        subscription = await self.subscription_service.repository.get_by_stripe_id(
            subscription_id
        )
        
        if subscription:
            await self.subscription_service.update_subscription_status(
                str(subscription.id), status
            )
        else:
            logger.warning(f"Subscription not found for stripe_id {subscription_id}")
    
    async def _handle_subscription_deleted(self, data: dict):
        """
        Maneja evento customer.subscription.deleted.
        
        Proceso:
        1. Buscar suscripción por stripe_subscription_id
        2. Cambiar estado a "cancelled"
        3. Cambiar usuario a plan FREE
        """
        subscription_id = data.get("id")
        
        logger.info(f"Handling subscription deletion for {subscription_id}")
        
        # Buscar suscripción local
        subscription = await self.subscription_service.repository.get_by_stripe_id(
            subscription_id
        )
        
        if subscription:
            # Marcar como cancelled
            await self.subscription_service.update_subscription_status(
                str(subscription.id), "cancelled"
            )
            
            # Crear suscripción FREE
            logger.info(f"Creating FREE subscription for user {subscription.user_id}")
            await self.subscription_service.create_free_subscription(
                subscription.user_id
            )
        else:
            logger.warning(f"Subscription not found for stripe_id {subscription_id}")
    
    async def _handle_payment_failed(self, data: dict):
        """
        Maneja evento invoice.payment_failed.
        
        Proceso:
        1. Extraer subscription_id
        2. Actualizar estado a "payment_failed"
        """
        subscription_id = data.get("subscription")
        
        logger.warning(f"Payment failed for subscription {subscription_id}")
        
        # Buscar suscripción local
        subscription = await self.subscription_service.repository.get_by_stripe_id(
            subscription_id
        )
        
        if subscription:
            await self.subscription_service.update_subscription_status(
                str(subscription.id), "payment_failed"
            )
        else:
            logger.warning(f"Subscription not found for stripe_id {subscription_id}")
