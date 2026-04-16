"""
Stripe catalog sync service.

Synchronizes plan data with Stripe's Product/Price catalog.
Uses Stripe's native multi-currency Price feature: creates ONE Price
with `currency_options` that includes all configured currencies.
Stripe Checkout then automatically resolves the correct currency
based on the customer's location/card.
"""
import logging

import stripe

from .exceptions import PaymentProviderError
from .schemas import PlanInDB

logger = logging.getLogger(__name__)


async def sync_plan_to_stripe(
    plan: PlanInDB,
    prices: dict,
    stripe_api_key: str,
) -> tuple[str, str]:
    """
    Synchronize a plan with Stripe's Product/Price catalog.

    Creates or updates the Stripe Product, then ensures a single
    multi-currency Price exists with currency_options for all non-USD
    currencies.

    Stripe Prices are immutable, so when amounts change a new Price is
    created and the old one is deactivated.

    Args:
        plan: The plan document from MongoDB.
        prices: Dict of currency->amount, e.g. {"usd": 2, "mxn": 40}.
        stripe_api_key: Stripe secret key to use for API calls.

    Returns:
        A tuple of (stripe_product_id, stripe_price_id).

    Raises:
        PaymentProviderError: If any Stripe API call fails.
    """
    stripe.api_key = stripe_api_key

    plan_id_str = str(plan.id)
    base_metadata = {
        "created_by": "diagramahub",
        "plan_id": plan_id_str,
    }

    gw = plan.parsed_gateway_config

    # ------------------------------------------------------------------
    # 1. Create or update Stripe Product
    # ------------------------------------------------------------------
    try:
        product_id = gw.external_product_id if gw else None
        if product_id:
            stripe.Product.modify(
                product_id,
                name=plan.name,
                description=plan.description,
                metadata=base_metadata,
            )
            logger.info("Updated Stripe Product %s for plan %s", product_id, plan.name)
        else:
            product = stripe.Product.create(
                name=plan.name,
                description=plan.description or "",
                metadata=base_metadata,
            )
            product_id = product.id
            logger.info("Created Stripe Product %s for plan %s", product_id, plan.name)
    except stripe.error.StripeError as exc:
        logger.error("Stripe Product sync failed for plan %s: %s", plan.name, exc)
        raise PaymentProviderError("stripe", str(exc))

    # ------------------------------------------------------------------
    # 2. Check if existing Price matches current prices
    # ------------------------------------------------------------------
    existing_price_id = gw.external_price_id if gw else None
    if existing_price_id and plan.prices == prices:
        logger.info(
            "Stripe Price unchanged (price_id=%s)",
            existing_price_id,
        )
        return product_id, existing_price_id

    # ------------------------------------------------------------------
    # 3. Create new multi-currency Price
    # ------------------------------------------------------------------
    usd_amount = prices.get("usd", 0)
    currency_options = {
        currency: {"unit_amount": int(amount * 100)}
        for currency, amount in prices.items()
        if currency != "usd"
    }

    try:
        create_params = {
            "product": product_id,
            "unit_amount": int(usd_amount * 100),
            "currency": "usd",
            "recurring": {"interval": "month"},
            "metadata": base_metadata,
        }
        if currency_options:
            create_params["currency_options"] = currency_options

        price_obj = stripe.Price.create(**create_params)
        new_price_id = price_obj.id
        logger.info(
            "Created Stripe Price %s with currencies %s",
            new_price_id,
            list(prices.keys()),
        )
    except stripe.error.StripeError as exc:
        logger.error("Failed to create Stripe Price: %s", exc)
        raise PaymentProviderError("stripe", str(exc))

    # Deactivate the old Price if it existed
    if existing_price_id:
        try:
            stripe.Price.modify(existing_price_id, active=False)
            logger.info(
                "Deactivated old Stripe Price %s",
                existing_price_id,
            )
        except stripe.error.StripeError as exc:
            logger.error(
                "Failed to deactivate old Stripe Price %s: %s",
                existing_price_id,
                exc,
            )
            raise PaymentProviderError("stripe", str(exc))

    return product_id, new_price_id


async def update_price_currency_options(
    plan: PlanInDB,
    prices: dict,
    stripe_api_key: str,
) -> str:
    """
    Create a new multi-currency Price with updated currency_options.

    Stripe Prices are immutable, so adding/removing a currency requires
    creating a new Price and deactivating the old one.

    Args:
        plan: The plan document from MongoDB.
        prices: Updated dict of currency->amount.
        stripe_api_key: Stripe secret key.

    Returns:
        The new stripe_price_id.

    Raises:
        PaymentProviderError: If any Stripe API call fails.
    """
    stripe.api_key = stripe_api_key

    gw = plan.parsed_gateway_config

    base_metadata = {
        "created_by": "diagramahub",
        "plan_id": str(plan.id),
    }

    usd_amount = prices.get("usd", 0)
    currency_options = {
        currency: {"unit_amount": int(amount * 100)}
        for currency, amount in prices.items()
        if currency != "usd"
    }

    product_id = gw.external_product_id if gw else None

    try:
        create_params = {
            "product": product_id,
            "unit_amount": int(usd_amount * 100),
            "currency": "usd",
            "recurring": {"interval": "month"},
            "metadata": base_metadata,
        }
        if currency_options:
            create_params["currency_options"] = currency_options

        price_obj = stripe.Price.create(**create_params)
        new_price_id = price_obj.id
        logger.info(
            "Created new Stripe Price %s with currencies %s",
            new_price_id,
            list(prices.keys()),
        )
    except stripe.error.StripeError as exc:
        logger.error("Failed to create Stripe Price: %s", exc)
        raise PaymentProviderError("stripe", str(exc))

    # Deactivate the old Price
    existing_price_id = gw.external_price_id if gw else None
    if existing_price_id:
        try:
            stripe.Price.modify(existing_price_id, active=False)
            logger.info("Deactivated old Stripe Price %s", existing_price_id)
        except stripe.error.StripeError as exc:
            logger.error(
                "Failed to deactivate old Stripe Price %s: %s",
                existing_price_id,
                exc,
            )
            raise PaymentProviderError("stripe", str(exc))

    return new_price_id


async def archive_plan_in_stripe(
    plan: PlanInDB,
    stripe_api_key: str,
) -> None:
    """
    Remove a plan's Product from Stripe.

    Strategy:
    1. Deactivate the single Price
    2. Try to delete the Product (works if not in use by any subscription)
    3. If delete fails, fall back to archiving (active=False)

    Args:
        plan: The plan document from MongoDB.
        stripe_api_key: Stripe secret key to use for API calls.

    Raises:
        PaymentProviderError: If archiving fails as fallback.
    """
    if not plan.gateway_config:
        return

    stripe.api_key = stripe_api_key

    gw = plan.parsed_gateway_config
    product_id = gw.external_product_id if gw else None
    price_id = gw.external_price_id if gw else None

    # 1. Deactivate the Price
    if price_id:
        try:
            stripe.Price.modify(price_id, active=False)
            logger.info("Deactivated Stripe Price %s", price_id)
        except stripe.error.StripeError as exc:
            logger.error(
                "Failed to deactivate Stripe Price %s: %s",
                price_id,
                exc,
            )

    # 2. Try to delete the Product
    if not product_id:
        return

    try:
        stripe.Product.delete(product_id)
        logger.info("Deleted Stripe Product %s", product_id)
        return
    except stripe.error.StripeError as exc:
        logger.info(
            "Cannot delete Stripe Product %s (likely in use), falling back to archive: %s",
            product_id,
            exc,
        )

    # 3. Fallback: archive the Product
    try:
        stripe.Product.modify(product_id, active=False)
        logger.info("Archived Stripe Product %s", product_id)
    except stripe.error.StripeError as exc:
        logger.error(
            "Failed to archive Stripe Product %s: %s",
            product_id,
            exc,
        )
        raise PaymentProviderError("stripe", str(exc))


async def reactivate_plan_in_stripe(
    plan: PlanInDB,
    stripe_api_key: str,
) -> None:
    """
    Reactivate a plan's Product and Price in Stripe.

    Args:
        plan: The plan document from MongoDB.
        stripe_api_key: Stripe secret key to use for API calls.

    Raises:
        PaymentProviderError: If reactivation fails.
    """
    if not plan.gateway_config:
        return

    stripe.api_key = stripe_api_key

    gw = plan.parsed_gateway_config
    product_id = gw.external_product_id if gw else None
    price_id = gw.external_price_id if gw else None

    # Reactivate the Product
    if product_id:
        try:
            stripe.Product.modify(product_id, active=True)
            logger.info("Reactivated Stripe Product %s", product_id)
        except stripe.error.StripeError as exc:
            logger.error(
                "Failed to reactivate Stripe Product %s: %s",
                product_id,
                exc,
            )
            raise PaymentProviderError("stripe", str(exc))

    # Reactivate the Price
    if price_id:
        try:
            stripe.Price.modify(price_id, active=True)
            logger.info("Reactivated Stripe Price %s", price_id)
        except stripe.error.StripeError as exc:
            logger.error(
                "Failed to reactivate Stripe Price %s: %s",
                price_id,
                exc,
            )
