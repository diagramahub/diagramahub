"""
Preservation Property Tests — Stripe Multi-Currency Pricing Bugfix

These tests capture the CURRENT (unfixed) behavior of the system as a baseline.
They MUST PASS on unfixed code. After the fix is applied, they must STILL pass
to confirm no regressions in free plan flows, cancellation, and webhook handling.

Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
"""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock
from hypothesis import given, settings as hyp_settings, HealthCheck
from hypothesis import strategies as st

from app.api.v1.subscriptions.plan_service import PlanService
from app.api.v1.subscriptions.subscription_service import SubscriptionService
from app.api.v1.subscriptions.payment_providers.stripe_provider import (
    StripePaymentProvider,
)
from app.api.v1.subscriptions.schemas import (
    PlanCreate,
    PlanInDB,
    SubscriptionInDB,
    SubscriptionCreate,
)
from app.api.v1.subscriptions.constants import FREE_PLAN_NAME, STATUS_ACTIVE


# ---------------------------------------------------------------------------
# Hypothesis strategies
# ---------------------------------------------------------------------------

plan_names = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "Zs")),
    min_size=1,
    max_size=30,
).filter(lambda s: s.strip() != "")

plan_codes = st.from_regex(r"[A-Z0-9_]{1,20}", fullmatch=True)

user_ids = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N")),
    min_size=5,
    max_size=30,
).filter(lambda s: s.strip() != "")

subscription_ids = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N")),
    min_size=5,
    max_size=40,
).filter(lambda s: s.strip() != "")

webhook_payloads = st.binary(min_size=1, max_size=500)
webhook_signatures = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N")),
    min_size=10,
    max_size=60,
).filter(lambda s: s.strip() != "")

event_types = st.sampled_from([
    "checkout.session.completed",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.payment_failed",
])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_plan_in_db(
    name: str = "Gratuito",
    code: str = "FREE",
    price_usd: float = 0.0,
    plan_id: str = "plan_free_001",
) -> MagicMock:
    """Create a mock PlanInDB for testing."""
    plan = MagicMock(spec=PlanInDB)
    plan.id = plan_id
    plan.name = name
    plan.code = code
    plan.description = "Free plan"
    plan.price_usd = price_usd
    plan.max_projects = 1
    plan.max_diagrams = 10
    plan.is_active = True
    plan.is_free = price_usd == 0.0 and code == "FREE"
    plan.stripe_product_id = None
    plan.stripe_prices = []
    plan.created_at = datetime.utcnow()
    plan.updated_at = datetime.utcnow()
    return plan


def _make_subscription_in_db(
    user_id: str = "user_001",
    plan_id: str = "plan_free_001",
    status: str = STATUS_ACTIVE,
    stripe_sub_id: str | None = None,
    stripe_cust_id: str | None = None,
) -> MagicMock:
    """Create a mock SubscriptionInDB for testing."""
    sub = MagicMock(spec=SubscriptionInDB)
    sub.id = "sub_001"
    sub.user_id = user_id
    sub.plan_id = plan_id
    sub.status = status
    sub.stripe_subscription_id = stripe_sub_id
    sub.stripe_customer_id = stripe_cust_id
    sub.payment_provider = "stripe"
    sub.started_at = datetime.utcnow()
    sub.current_period_start = None
    sub.current_period_end = None
    sub.cancelled_at = None
    sub.created_at = datetime.utcnow()
    sub.updated_at = datetime.utcnow()
    return sub


# ===========================================================================
# 1. Free plan creation preservation
# ===========================================================================

class TestFreePlanCreationPreservation:
    """
    **Validates: Requirements 3.1, 3.2**

    For any free plan (price_usd == 0), PlanService.create_plan() creates
    the plan in MongoDB without any Stripe API calls.
    """

    @given(
        name=plan_names,
        code=plan_codes,
    )
    @hyp_settings(
        max_examples=20,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        deadline=None,
    )
    @pytest.mark.asyncio
    async def test_free_plan_creation_no_stripe_calls(self, name, code):
        """
        **Validates: Requirements 3.1, 3.2**

        Creating a free plan (price_usd=0) must NOT trigger any Stripe API
        calls. The plan is persisted to MongoDB only.
        """
        mock_repo = AsyncMock()
        mock_repo.get_by_name = AsyncMock(return_value=None)
        mock_repo.get_by_code = AsyncMock(return_value=None)

        created_plan = _make_plan_in_db(name=name, code=code, price_usd=0.0)
        mock_repo.create = AsyncMock(return_value=created_plan)
        mock_repo.count_active_subscriptions = AsyncMock(return_value=0)

        service = PlanService(repository=mock_repo)

        plan_data = PlanCreate(
            name=name,
            code=code,
            description="Test free plan",
            price_usd=0.0,
            max_projects=1,
            max_diagrams=10,
        )

        with patch("stripe.Product.create") as mock_product, \
             patch("stripe.Price.create") as mock_price, \
             patch("stripe.checkout.Session.create") as mock_session:

            result = await service.create_plan(plan_data, admin_user_id="admin_001")

            # No Stripe calls should have been made
            mock_product.assert_not_called()
            mock_price.assert_not_called()
            mock_session.assert_not_called()

        # Plan was persisted via repository
        mock_repo.create.assert_called_once()
        assert result.price_usd == 0.0


# ===========================================================================
# 2. Free subscription creation preservation
# ===========================================================================

class TestFreeSubscriptionCreationPreservation:
    """
    **Validates: Requirements 3.1, 3.2**

    Creating a free subscription works without any Stripe interaction.
    """

    @given(user_id=user_ids)
    @hyp_settings(
        max_examples=20,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        deadline=None,
    )
    @pytest.mark.asyncio
    async def test_free_subscription_no_stripe_calls(self, user_id):
        """
        **Validates: Requirements 3.1, 3.2**

        SubscriptionService.create_free_subscription(user_id) creates a
        subscription with status='active' for the FREE plan without any
        Stripe API calls.
        """
        free_plan = _make_plan_in_db()
        created_sub = _make_subscription_in_db(user_id=user_id)

        mock_sub_repo = AsyncMock()
        mock_sub_repo.create = AsyncMock(return_value=created_sub)

        mock_plan_repo = AsyncMock()
        mock_plan_repo.get_by_name = AsyncMock(return_value=free_plan)
        mock_plan_repo.get_by_id = AsyncMock(return_value=free_plan)
        mock_plan_repo.count_active_subscriptions = AsyncMock(return_value=1)

        mock_payment = AsyncMock()

        service = SubscriptionService(
            repository=mock_sub_repo,
            plan_repository=mock_plan_repo,
            payment_provider=mock_payment,
        )

        with patch("stripe.Customer.list") as mock_cust_list, \
             patch("stripe.Customer.create") as mock_cust_create, \
             patch("stripe.checkout.Session.create") as mock_session:

            result = await service.create_free_subscription(user_id)

            # No Stripe calls
            mock_cust_list.assert_not_called()
            mock_cust_create.assert_not_called()
            mock_session.assert_not_called()

        # Payment provider should NOT have been called
        mock_payment.create_checkout_session.assert_not_called()

        # Subscription was created in the repository
        mock_sub_repo.create.assert_called_once()
        assert result.status == STATUS_ACTIVE


# ===========================================================================
# 3. Cancellation preservation
# ===========================================================================

class TestCancellationPreservation:
    """
    **Validates: Requirements 3.3**

    StripePaymentProvider.cancel_subscription() calls
    stripe.Subscription.modify(sub_id, cancel_at_period_end=True)
    and returns the expected structure.
    """

    @given(sub_id=subscription_ids)
    @hyp_settings(
        max_examples=20,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        deadline=None,
    )
    @pytest.mark.asyncio
    async def test_cancel_calls_modify_with_cancel_at_period_end(self, sub_id):
        """
        **Validates: Requirements 3.3**

        cancel_subscription(sub_id) must call
        stripe.Subscription.modify(sub_id, cancel_at_period_end=True)
        and return {"status": ..., "cancel_at": ...}.
        """
        provider = StripePaymentProvider(
            secret_key="sk_test_fake",
            webhook_secret="whsec_fake",
        )

        mock_subscription = MagicMock()
        mock_subscription.status = "active"
        mock_subscription.cancel_at = 1700000000  # some timestamp

        with patch("stripe.Subscription.modify", return_value=mock_subscription) as mock_modify:
            result = await provider.cancel_subscription(sub_id)

            mock_modify.assert_called_once_with(
                sub_id,
                cancel_at_period_end=True,
            )

        assert "status" in result
        assert "cancel_at" in result
        assert result["status"] == "active"
        assert isinstance(result["cancel_at"], datetime)


# ===========================================================================
# 4. Webhook validation preservation
# ===========================================================================

class TestWebhookValidationPreservation:
    """
    **Validates: Requirements 3.4, 3.5**

    StripePaymentProvider.validate_webhook() calls
    stripe.Webhook.construct_event() with the correct parameters
    and returns {"event_type": ..., "data": ...}.
    """

    @given(
        payload=webhook_payloads,
        signature=webhook_signatures,
        event_type=event_types,
    )
    @hyp_settings(
        max_examples=20,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        deadline=None,
    )
    @pytest.mark.asyncio
    async def test_validate_webhook_calls_construct_event(
        self, payload, signature, event_type
    ):
        """
        **Validates: Requirements 3.4, 3.5**

        validate_webhook(payload, signature) must call
        stripe.Webhook.construct_event(payload, signature, webhook_secret)
        and return {"event_type": ..., "data": ...}.
        """
        webhook_secret = "whsec_test_secret_123"
        provider = StripePaymentProvider(
            secret_key="sk_test_fake",
            webhook_secret=webhook_secret,
        )

        mock_event = MagicMock()
        mock_event.type = event_type
        mock_event.data.object = {"id": "evt_data_obj"}

        with patch(
            "stripe.Webhook.construct_event", return_value=mock_event
        ) as mock_construct:
            result = await provider.validate_webhook(payload, signature)

            mock_construct.assert_called_once_with(
                payload, signature, webhook_secret
            )

        assert result["event_type"] == event_type
        assert result["data"] == {"id": "evt_data_obj"}
