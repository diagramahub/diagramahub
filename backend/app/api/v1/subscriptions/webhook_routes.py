"""
Webhook routes for payment providers.
"""

from fastapi import APIRouter, Depends, Header, Request
from typing import Optional

from .webhook_handler import WebhookHandler
from .subscription_service import SubscriptionService
from .subscription_repository import SubscriptionRepository
from .plan_repository import PlanRepository
from .webhook_event_repository import WebhookEventRepository
from .payment_providers.stripe_provider import StripePaymentProvider

router = APIRouter()


async def get_webhook_handler() -> WebhookHandler:
    """Get webhook handler instance.

    Tries to load Stripe credentials from the DB first (active payment
    vendor), falling back to .env for gradual migration.
    """
    payment_provider = await StripePaymentProvider.from_db_or_env()

    subscription_service = SubscriptionService(
        repository=SubscriptionRepository(),
        plan_repository=PlanRepository(),
        payment_provider=payment_provider,
    )

    return WebhookHandler(
        subscription_service=subscription_service,
        payment_provider=payment_provider,
        event_repository=WebhookEventRepository(),
    )


@router.post("/webhooks/stripe", tags=["webhooks"])
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None, alias="stripe-signature"),
    handler: WebhookHandler = Depends(get_webhook_handler),
):
    """
    Stripe webhook endpoint.

    Receives and processes Stripe events:
    - checkout.session.completed: Activate subscription
    - customer.subscription.updated: Update subscription status
    - customer.subscription.deleted: Cancel subscription and switch to FREE
    - invoice.payment_failed: Mark subscription as payment_failed

    Validates the webhook signature (401 when invalid) and processes each event
    once: a repeated delivery returns {"status": "duplicate"}. An internal error
    returns 500 so Stripe retries the delivery.
    """
    # Obtener payload raw
    payload = await request.body()

    if not handler.payment_provider:
        return {"status": "error", "message": "Stripe not configured"}

    # Procesar webhook
    result = await handler.handle_webhook(payload, stripe_signature)

    return result
