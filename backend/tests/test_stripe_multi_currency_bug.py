"""
Bug Condition Exploration Test — Stripe Multi-Currency Pricing

This test encodes the EXPECTED behavior after the fix:
  checkout sessions should use a pre-created `stripe_price_id` (via the `price`
  field in line_items) instead of constructing inline `price_data` with
  hardcoded `currency: 'usd'`.

On UNFIXED code this test WILL FAIL because `create_checkout_session()` always
builds inline `price_data`.  That failure confirms the bug exists.

Validates: Requirements 1.1, 1.3, 2.1, 2.3
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.api.v1.subscriptions.payment_providers.stripe_provider import (
    StripePaymentProvider,
)


@pytest.mark.asyncio
async def test_checkout_uses_stripe_price_id_not_inline_price_data():
    """
    For a paid plan ($2 USD/month), calling create_checkout_session() should
    result in line_items containing a `price` key that references a
    stripe_price_id — NOT an inline `price_data` dict with currency='usd'.

    On unfixed code this FAILS because the provider always constructs:
        line_items=[{'price_data': {'currency': 'usd', ...}, 'quantity': 1}]
    instead of:
        line_items=[{'price': 'price_xxx', 'quantity': 1}]
    """

    provider = StripePaymentProvider(
        secret_key="sk_test_fake_key_for_testing",
        webhook_secret="whsec_fake_secret",
        publishable_key="pk_test_fake_key",
    )

    # --- Mock Stripe API calls ---
    mock_customer = MagicMock()
    mock_customer.id = "cus_test_123"

    mock_customer_list = MagicMock()
    mock_customer_list.data = [mock_customer]

    mock_session = MagicMock()
    mock_session.id = "cs_test_session_456"
    mock_session.url = "https://checkout.stripe.com/pay/cs_test_session_456"

    with patch("stripe.Customer.list", return_value=mock_customer_list), \
         patch("stripe.Customer.create", return_value=mock_customer), \
         patch("stripe.checkout.Session.create", return_value=mock_session) as mock_session_create:

        # Act: call create_checkout_session for a $2 USD paid plan
        # After the fix, SubscriptionService extracts stripe_price_id from
        # plan.stripe_prices and passes it to the provider.
        result = await provider.create_checkout_session(
            user_email="testuser@example.com",
            plan_name="Pro",
            plan_price=2.0,
            success_url="https://app.example.com/success",
            cancel_url="https://app.example.com/cancel",
            metadata={"user_id": "user_001", "plan_id": "plan_pro"},
            plan_description="Pro plan — $2/month",
            stripe_price_id="price_test_usd_123",
        )

        # Verify the session was created
        assert result["session_id"] == "cs_test_session_456"
        mock_session_create.assert_called_once()

        # --- Core assertion: line_items should use `price`, not `price_data` ---
        call_kwargs = mock_session_create.call_args
        # stripe.checkout.Session.create is called with keyword arguments
        line_items = call_kwargs.kwargs.get("line_items") or call_kwargs[1].get("line_items")

        assert line_items is not None, "line_items must be present in Session.create call"
        assert len(line_items) == 1, "Expected exactly one line item"

        first_item = line_items[0]

        # The EXPECTED (fixed) behavior: line_items uses 'price' field
        assert "price" in first_item, (
            "BUG CONFIRMED: line_items[0] does not contain a 'price' key. "
            "The current code uses inline 'price_data' with hardcoded "
            "currency='usd' instead of referencing a pre-created stripe_price_id."
        )

        # Verify the specific stripe_price_id is used
        assert first_item.get("price") == "price_test_usd_123", (
            f"Expected price='price_test_usd_123', got price='{first_item.get('price')}'"
        )

        # The EXPECTED (fixed) behavior: no inline price_data
        assert "price_data" not in first_item, (
            "BUG CONFIRMED: line_items[0] contains 'price_data' with inline "
            "currency='usd'. Expected the checkout to use a pre-created "
            "stripe_price_id via the 'price' field instead."
        )
