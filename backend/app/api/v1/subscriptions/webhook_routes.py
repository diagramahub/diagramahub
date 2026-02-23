"""
Webhook routes for payment providers.
"""
from fastapi import APIRouter, Request, Header
from typing import Optional

from .webhook_handler import WebhookHandler
from .subscription_service import SubscriptionService
from .subscription_repository import SubscriptionRepository
from .plan_repository import PlanRepository
from .payment_providers.stripe_provider import StripePaymentProvider

router = APIRouter()


def get_webhook_handler() -> WebhookHandler:
    """Get webhook handler instance."""
    try:
        payment_provider = StripePaymentProvider.from_env()
    except ValueError:
        # Si no hay credenciales, no se pueden procesar webhooks
        payment_provider = None
    
    subscription_service = SubscriptionService(
        repository=SubscriptionRepository(),
        plan_repository=PlanRepository(),
        payment_provider=payment_provider
    )
    
    return WebhookHandler(
        subscription_service=subscription_service,
        payment_provider=payment_provider
    )


@router.post("/webhooks/stripe", tags=["webhooks"])
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None, alias="stripe-signature")
):
    """
    Stripe webhook endpoint.
    
    Receives and processes Stripe events:
    - checkout.session.completed: Activate subscription
    - customer.subscription.updated: Update subscription status
    - customer.subscription.deleted: Cancel subscription and switch to FREE
    - invoice.payment_failed: Mark subscription as payment_failed
    
    Validates webhook signature for security.
    Always returns 200 OK to prevent Stripe retries on internal errors.
    """
    # Obtener payload raw
    payload = await request.body()
    
    # Obtener handler
    handler = get_webhook_handler()
    
    if not handler.payment_provider:
        return {
            "status": "error",
            "message": "Stripe not configured"
        }
    
    # Procesar webhook
    result = await handler.handle_webhook(payload, stripe_signature)
    
    return result
