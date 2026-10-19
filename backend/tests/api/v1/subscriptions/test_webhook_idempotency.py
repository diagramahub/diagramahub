"""Tests for idempotent payment webhook processing (each event is applied once)."""

from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.api.v1.subscriptions.schemas import WebhookEventInDB, WebhookEventStatus
from app.api.v1.subscriptions.webhook_event_repository import (
    STALE_CLAIM_AFTER,
    WebhookEventRepository,
)
from app.api.v1.subscriptions.webhook_handler import WebhookHandler
from app.api.v1.subscriptions.webhook_routes import get_webhook_handler
from app.core.clock import utcnow
from app.main import app

EVENT_ID = "evt_test_123"
EVENT_TYPE = "customer.subscription.updated"


def _make_handler(event_id: str = EVENT_ID) -> WebhookHandler:
    """Build a handler with a fake provider that accepts any signature."""
    provider = MagicMock()
    provider.validate_webhook = AsyncMock(
        return_value={
            "event_id": event_id,
            "event_type": EVENT_TYPE,
            # The object id differs from the event id on purpose: the handler
            # must key idempotency on the event, not on the subscription.
            "data": {"id": "sub_object_id", "status": "active"},
        }
    )
    handler = WebhookHandler(
        subscription_service=MagicMock(),
        payment_provider=provider,
        event_repository=WebhookEventRepository(),
    )
    handler._handle_subscription_updated = AsyncMock()  # type: ignore[method-assign]
    return handler


@pytest.mark.integration
async def test_same_event_twice_is_applied_once(test_db) -> None:
    """A redelivered event is acknowledged as duplicate and not applied again."""
    handler = _make_handler()

    first = await handler.handle_webhook(b"{}", "sig")
    second = await handler.handle_webhook(b"{}", "sig")

    assert first == {"status": "processed"}
    assert second == {"status": "duplicate"}
    handler._handle_subscription_updated.assert_awaited_once()

    stored = await WebhookEventInDB.find_one(WebhookEventInDB.event_id == EVENT_ID)
    assert stored is not None
    assert stored.status == WebhookEventStatus.PROCESSED
    assert stored.event_type == EVENT_TYPE


@pytest.mark.integration
async def test_failed_event_is_processed_on_retry(test_db) -> None:
    """A failure answers 500 and releases the claim, so the retry is processed."""
    handler = _make_handler()
    handler._handle_subscription_updated.side_effect = [RuntimeError("db down"), None]

    with pytest.raises(HTTPException) as exc:
        await handler.handle_webhook(b"{}", "sig")
    assert exc.value.status_code == 500
    assert await WebhookEventInDB.find_one(WebhookEventInDB.event_id == EVENT_ID) is None

    retry = await handler.handle_webhook(b"{}", "sig")

    assert retry == {"status": "processed"}
    assert handler._handle_subscription_updated.await_count == 2


@pytest.mark.integration
async def test_invalid_signature_returns_401(test_db) -> None:
    """An invalid signature is rejected before anything is recorded."""
    handler = _make_handler()
    handler.payment_provider.validate_webhook = AsyncMock(
        side_effect=ValueError("Invalid webhook signature")
    )

    with pytest.raises(HTTPException) as exc:
        await handler.handle_webhook(b"{}", "bad")

    assert exc.value.status_code == 401
    assert await WebhookEventInDB.count() == 0
    handler._handle_subscription_updated.assert_not_awaited()


@pytest.mark.integration
async def test_event_in_progress_is_not_processed_twice(test_db) -> None:
    """A delivery that arrives while another one holds the claim is a duplicate."""
    repo = WebhookEventRepository()

    assert await repo.claim(EVENT_ID, EVENT_TYPE) is True
    assert await repo.claim(EVENT_ID, EVENT_TYPE) is False


@pytest.mark.integration
async def test_stale_claim_is_taken_over(test_db) -> None:
    """A claim abandoned mid-processing (worker crash) can be taken over later."""
    await WebhookEventInDB(
        event_id=EVENT_ID,
        event_type=EVENT_TYPE,
        status=WebhookEventStatus.PROCESSING,
        processed_at=utcnow() - STALE_CLAIM_AFTER - timedelta(minutes=1),
    ).insert()
    handler = _make_handler()

    result = await handler.handle_webhook(b"{}", "sig")

    assert result == {"status": "processed"}
    handler._handle_subscription_updated.assert_awaited_once()


@pytest.mark.integration
async def test_route_acknowledges_duplicate_delivery(client, test_db) -> None:
    """End to end: the endpoint answers 200 both times and applies the event once."""
    handler = _make_handler()
    app.dependency_overrides[get_webhook_handler] = lambda: handler
    try:
        headers = {"stripe-signature": "sig"}
        first = await client.post("/api/v1/webhooks/stripe", content=b"{}", headers=headers)
        second = await client.post("/api/v1/webhooks/stripe", content=b"{}", headers=headers)
    finally:
        app.dependency_overrides.pop(get_webhook_handler, None)

    assert first.status_code == 200 and first.json() == {"status": "processed"}
    assert second.status_code == 200 and second.json() == {"status": "duplicate"}
    handler._handle_subscription_updated.assert_awaited_once()
