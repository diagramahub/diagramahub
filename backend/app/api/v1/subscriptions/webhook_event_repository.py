"""
Webhook event repository: MongoDB log that makes webhook processing idempotent.
"""

from datetime import timedelta

from pymongo.errors import DuplicateKeyError

from .interfaces import IWebhookEventRepository
from .schemas import WebhookEventInDB, WebhookEventStatus
from app.core.clock import utcnow

# A claim older than this is considered abandoned (the worker died mid-processing)
# and the next delivery of the same event may take it over.
STALE_CLAIM_AFTER = timedelta(minutes=10)


class WebhookEventRepository(IWebhookEventRepository):
    """MongoDB implementation of the webhook event log using Beanie."""

    async def claim(self, event_id: str, event_type: str) -> bool:
        """Insert the event as ``processing``; the unique index rejects a second claim."""
        try:
            await WebhookEventInDB(
                event_id=event_id,
                event_type=event_type,
                status=WebhookEventStatus.PROCESSING,
                processed_at=utcnow(),
            ).insert()
            return True
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
            {"$set": {"processed_at": utcnow()}},
        )
        return result.modified_count == 1

    async def mark_processed(self, event_id: str) -> None:
        """Mark the event as processed."""
        await WebhookEventInDB.get_motor_collection().update_one(
            {"event_id": event_id},
            {"$set": {"status": WebhookEventStatus.PROCESSED, "processed_at": utcnow()}},
        )

    async def release(self, event_id: str) -> None:
        """Delete an unfinished claim so Stripe's retry processes the event again."""
        await WebhookEventInDB.get_motor_collection().delete_one(
            {"event_id": event_id, "status": WebhookEventStatus.PROCESSING}
        )
