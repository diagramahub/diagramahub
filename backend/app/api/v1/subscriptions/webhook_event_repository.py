"""
Webhook event repository: MongoDB log that makes webhook processing idempotent.
"""

import secrets
from datetime import timedelta
from typing import Optional

from pymongo.errors import DuplicateKeyError

from .interfaces import IWebhookEventRepository
from .schemas import WebhookEventInDB, WebhookEventStatus
from app.core.clock import utcnow

# A claim older than this is considered abandoned (the worker died mid-processing)
# and the next delivery of the same event may take it over.
STALE_CLAIM_AFTER = timedelta(minutes=10)


class WebhookEventRepository(IWebhookEventRepository):
    """MongoDB implementation of the webhook event log using Beanie."""

    async def claim(self, event_id: str, event_type: str) -> Optional[str]:
        """Insert the event as ``processing``; the unique index rejects a second claim.

        Each claim gets its own lease token, so a delivery that lost its claim to a
        takeover can no longer complete or release the new owner's claim.
        """
        lease = secrets.token_urlsafe(16)
        try:
            await WebhookEventInDB(
                event_id=event_id,
                event_type=event_type,
                status=WebhookEventStatus.PROCESSING,
                processed_at=utcnow(),
                claim_token=lease,
            ).insert()
            return lease
        except DuplicateKeyError:
            pass

        # Already known: take it over only if its claim is stale. The status and
        # timestamp filter makes the takeover atomic across concurrent deliveries.
        result = await WebhookEventInDB.get_motor_collection().update_one(
            {
                "event_id": event_id,
                "status": WebhookEventStatus.PROCESSING,
                "processed_at": {"$lt": utcnow() - STALE_CLAIM_AFTER},
            },
            {"$set": {"processed_at": utcnow(), "claim_token": lease}},
        )
        return lease if result.modified_count == 1 else None

    async def mark_processed(self, event_id: str, lease: str) -> bool:
        """Mark the event as processed if ``lease`` still holds its claim."""
        result = await WebhookEventInDB.get_motor_collection().update_one(
            {
                "event_id": event_id,
                "status": WebhookEventStatus.PROCESSING,
                "claim_token": lease,
            },
            {"$set": {"status": WebhookEventStatus.PROCESSED, "processed_at": utcnow()}},
        )
        return result.modified_count == 1

    async def release(self, event_id: str, lease: str) -> None:
        """Delete an unfinished claim held by ``lease`` so Stripe's retry runs the event."""
        await WebhookEventInDB.get_motor_collection().delete_one(
            {
                "event_id": event_id,
                "status": WebhookEventStatus.PROCESSING,
                "claim_token": lease,
            }
        )
