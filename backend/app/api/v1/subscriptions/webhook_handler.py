"""
Webhook handler for payment provider events.
"""
import logging
from fastapi import HTTPException

from .subscription_service import SubscriptionService
from .payment_providers.interfaces import IPaymentProvider
from .constants import FREE_PLAN_NAME
from .logger import SubscriptionLogger

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
        event_id = data.get("id", "unknown")
        
        # Log webhook received
        SubscriptionLogger.webhook_received(event_type, event_id)
        
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
            
            # Log successful processing
            SubscriptionLogger.webhook_processed(event_type, event_id, success=True)
            logger.info(f"Webhook processed successfully: {event_type}")
            return {"status": "processed"}
        
        except Exception as e:
            # Log failed processing
            SubscriptionLogger.webhook_processed(event_type, event_id, success=False)
            logger.error(f"Error processing webhook {event_type}: {str(e)}")
            # No lanzar excepción para que Stripe no reintente
            return {"status": "error", "message": str(e)}
    
    async def _handle_checkout_completed(self, data: dict):
        """
        Maneja evento checkout.session.completed.
        
        Distingue entre:
        - mode='subscription': Activar nueva suscripción
        - mode='setup': Actualizar método de pago por defecto
        """
        import stripe
        from datetime import datetime
        
        mode = data.get("mode")
        
        if mode == "setup":
            # Actualizar método de pago
            await self._handle_setup_completed(data)
            return
        
        # mode='subscription' — flujo original
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
        
        # Obtener detalles de la suscripción de Stripe para current_period_end
        current_period_end = None
        if subscription_id:
            try:
                stripe_subscription = stripe.Subscription.retrieve(subscription_id)
                if stripe_subscription.current_period_end:
                    current_period_end = datetime.fromtimestamp(stripe_subscription.current_period_end)
            except Exception as e:
                logger.warning(f"Could not retrieve subscription details from Stripe: {str(e)}")
        
        await self.subscription_service.activate_subscription(
            user_id=user_id,
            plan_id=plan_id,
            stripe_customer_id=customer_id,
            stripe_subscription_id=subscription_id,
            current_period_end=current_period_end
        )
    
    async def _handle_setup_completed(self, data: dict):
        """
        Maneja checkout.session.completed en modo setup.
        
        Establece el nuevo método de pago como default en el customer
        y en la suscripción activa.
        """
        import stripe
        
        customer_id = data.get("customer")
        setup_intent_id = data.get("setup_intent")
        
        if not customer_id or not setup_intent_id:
            logger.error("Missing customer or setup_intent in setup checkout")
            return
        
        try:
            # Obtener el setup intent para extraer el payment method
            setup_intent = stripe.SetupIntent.retrieve(setup_intent_id)
            payment_method_id = setup_intent.payment_method
            
            # Establecer como default en el customer
            stripe.Customer.modify(
                customer_id,
                invoice_settings={"default_payment_method": payment_method_id}
            )
            
            # También actualizar la suscripción activa si existe
            subscriptions = stripe.Subscription.list(customer=customer_id, status="active", limit=1)
            if subscriptions.data:
                stripe.Subscription.modify(
                    subscriptions.data[0].id,
                    default_payment_method=payment_method_id
                )
            
            logger.info(f"Payment method updated for customer {customer_id}")
        except Exception as e:
            logger.error(f"Error updating payment method: {str(e)}")
    
    async def _handle_subscription_updated(self, data: dict):
        """
        Maneja evento customer.subscription.updated.
        
        Proceso:
        1. Buscar suscripción por stripe_subscription_id
        2. Actualizar estado y períodos según data
        """
        from datetime import datetime
        
        subscription_id = data.get("id")
        status = data.get("status")
        current_period_start = data.get("current_period_start")
        current_period_end = data.get("current_period_end")
        
        logger.info(f"Updating subscription {subscription_id} to status {status}")
        
        # Buscar suscripción local
        subscription = await self.subscription_service.repository.get_by_stripe_id(
            subscription_id
        )
        
        if subscription:
            # Preparar datos de actualización
            update_data = {"status": status}
            
            if current_period_start:
                update_data["current_period_start"] = datetime.fromtimestamp(current_period_start)
            
            if current_period_end:
                update_data["current_period_end"] = datetime.fromtimestamp(current_period_end)
            
            # Actualizar suscripción
            await self.subscription_service.repository.update(
                str(subscription.id),
                update_data
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
