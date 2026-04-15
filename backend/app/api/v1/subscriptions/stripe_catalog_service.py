"""
Stripe catalog sync service.

Synchronizes plan data with Stripe's Product/Price catalog.
When a paid plan is created or updated, this service creates/updates
the corresponding Stripe Product and Price in USD.
"""
import logging

import stripe

from .exceptions import PaymentProviderError
from .schemas import PlanInDB, StripePriceEntry

logger = logging.getLogger(__name__)


async def sync_plan_to_stripe(
    plan: PlanInDB,
    price_usd: float,
    stripe_api_key: str,
) -> tuple[str, list[StripePriceEntry]]:
    """
    Synchronize a plan with Stripe's Product/Price catalog.

    Creates or updates the Stripe Product, then ensures a USD Price exists.
    Stripe Prices are immutable, so when an amount changes a new Price is
    created and the old one is deactivated.

    Args:
        plan: The plan document from MongoDB.
        price_usd: Desired USD price (monthly).
        stripe_api_key: Stripe secret key to use for API calls.

    Returns:
        A tuple of (stripe_product_id, list[StripePriceEntry]).

    Raises:
        PaymentProviderError: If any Stripe API call fails.
    """
    stripe.api_key = stripe_api_key

    plan_id_str = str(plan.id)
    base_metadata = {
        "created_by": "diagramahub",
        "plan_id": plan_id_str,
    }

    # ------------------------------------------------------------------
    # 1. Create or update Stripe Product
    # ------------------------------------------------------------------
    try:
        if plan.stripe_product_id:
            stripe.Product.modify(
                plan.stripe_product_id,
                name=plan.name,
                description=plan.description,
                metadata=base_metadata,
            )
            product_id = plan.stripe_product_id
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
    # 2. Check if existing USD price matches
    # ------------------------------------------------------------------
    existing_by_currency: dict[str, StripePriceEntry] = {
        entry.currency: entry for entry in plan.stripe_prices
    }

    existing_usd = existing_by_currency.get("usd")

    if existing_usd and existing_usd.amount == price_usd:
        logger.info(
            "Stripe Price unchanged for USD %s (price_id=%s)",
            price_usd,
            existing_usd.stripe_price_id,
        )
        non_usd_entries = [e for e in plan.stripe_prices if e.currency != "usd"]
        return product_id, [existing_usd] + non_usd_entries

    # ------------------------------------------------------------------
    # 3. Create new USD Price
    # ------------------------------------------------------------------
    try:
        price_obj = stripe.Price.create(
            product=product_id,
            unit_amount=int(price_usd * 100),
            currency="usd",
            recurring={"interval": "month"},
            metadata=base_metadata,
        )
        new_entry = StripePriceEntry(
            stripe_price_id=price_obj.id,
            currency="usd",
            amount=price_usd,
        )
        logger.info(
            "Created Stripe Price %s for USD %s",
            price_obj.id,
            price_usd,
        )
    except stripe.error.StripeError as exc:
        logger.error("Failed to create Stripe Price for USD %s: %s", price_usd, exc)
        raise PaymentProviderError("stripe", str(exc))

    # Deactivate the old USD price if it existed
    if existing_usd:
        try:
            stripe.Price.modify(existing_usd.stripe_price_id, active=False)
            logger.info(
                "Deactivated old Stripe Price %s for USD",
                existing_usd.stripe_price_id,
            )
        except stripe.error.StripeError as exc:
            logger.error(
                "Failed to deactivate old Stripe Price %s: %s",
                existing_usd.stripe_price_id,
                exc,
            )
            raise PaymentProviderError("stripe", str(exc))

    non_usd_entries = [e for e in plan.stripe_prices if e.currency != "usd"]
    return product_id, [new_entry] + non_usd_entries


async def archive_plan_in_stripe(
    plan: PlanInDB,
    stripe_api_key: str,
) -> None:
    """
    Remove a plan's Product from Stripe.

    Strategy:
    1. Deactivate all Prices
    2. Try to delete the Product (works if not in use by any subscription)
    3. If delete fails, fall back to archiving (active=False)

    Called when a plan is deactivated or deleted locally.

    Args:
        plan: The plan document from MongoDB.
        stripe_api_key: Stripe secret key to use for API calls.

    Raises:
        PaymentProviderError: If archiving fails as fallback.
    """
    if not plan.stripe_product_id:
        return

    stripe.api_key = stripe_api_key

    # 1. Deactivate all Prices
    for entry in plan.stripe_prices:
        try:
            stripe.Price.modify(entry.stripe_price_id, active=False)
            logger.info("Deactivated Stripe Price %s", entry.stripe_price_id)
        except stripe.error.StripeError as exc:
            logger.error(
                "Failed to deactivate Stripe Price %s: %s",
                entry.stripe_price_id,
                exc,
            )

    # 2. Try to delete the Product
    try:
        stripe.Product.delete(plan.stripe_product_id)
        logger.info("Deleted Stripe Product %s", plan.stripe_product_id)
        return
    except stripe.error.StripeError as exc:
        logger.info(
            "Cannot delete Stripe Product %s (likely in use), falling back to archive: %s",
            plan.stripe_product_id,
            exc,
        )

    # 3. Fallback: archive the Product
    try:
        stripe.Product.modify(plan.stripe_product_id, active=False)
        logger.info("Archived Stripe Product %s", plan.stripe_product_id)
    except stripe.error.StripeError as exc:
        logger.error(
            "Failed to archive Stripe Product %s: %s",
            plan.stripe_product_id,
            exc,
        )
        raise PaymentProviderError("stripe", str(exc))


async def reactivate_plan_in_stripe(
    plan: PlanInDB,
    stripe_api_key: str,
) -> None:
    """
    Reactivate a plan's Product and Prices in Stripe.

    Called when a previously deactivated plan is toggled back to active.

    Args:
        plan: The plan document from MongoDB.
        stripe_api_key: Stripe secret key to use for API calls.

    Raises:
        PaymentProviderError: If reactivation fails.
    """
    if not plan.stripe_product_id:
        return

    stripe.api_key = stripe_api_key

    # Reactivate the Product
    try:
        stripe.Product.modify(plan.stripe_product_id, active=True)
        logger.info("Reactivated Stripe Product %s", plan.stripe_product_id)
    except stripe.error.StripeError as exc:
        logger.error(
            "Failed to reactivate Stripe Product %s: %s",
            plan.stripe_product_id,
            exc,
        )
        raise PaymentProviderError("stripe", str(exc))

    # Reactivate all Prices
    for entry in plan.stripe_prices:
        try:
            stripe.Price.modify(entry.stripe_price_id, active=True)
            logger.info("Reactivated Stripe Price %s", entry.stripe_price_id)
        except stripe.error.StripeError as exc:
            logger.error(
                "Failed to reactivate Stripe Price %s: %s",
                entry.stripe_price_id,
                exc,
            )


async def create_currency_price(
    plan: PlanInDB,
    currency: str,
    amount: float,
    stripe_api_key: str,
) -> StripePriceEntry:
    """Create a single Stripe Price for a specific currency."""
    stripe.api_key = stripe_api_key
    metadata = {"created_by": "diagramahub", "plan_id": str(plan.id)}
    try:
        price_obj = stripe.Price.create(
            product=plan.stripe_product_id,
            unit_amount=int(amount * 100),
            currency=currency,
            recurring={"interval": "month"},
            metadata=metadata,
        )
        logger.info(
            "Created Stripe Price %s for %s %s", price_obj.id, currency.upper(), amount
        )
        return StripePriceEntry(
            stripe_price_id=price_obj.id, currency=currency, amount=amount
        )
    except stripe.error.StripeError as exc:
        logger.error("Failed to create Stripe Price for %s: %s", currency.upper(), exc)
        raise PaymentProviderError("stripe", str(exc))


async def deactivate_currency_price(
    stripe_price_id: str,
    stripe_api_key: str,
) -> None:
    """
    Archive a Stripe Price by setting active=False.

    Note: Stripe does not expose a delete endpoint for Prices via the API.
    Prices can only be deleted from the Dashboard. The API only supports
    archiving (active=False).
    """
    stripe.api_key = stripe_api_key
    try:
        stripe.Price.modify(stripe_price_id, active=False)
        logger.info("Archived Stripe Price %s", stripe_price_id)
    except stripe.error.StripeError as exc:
        logger.error(
            "Failed to archive Stripe Price %s: %s", stripe_price_id, exc
        )
        raise PaymentProviderError("stripe", str(exc))
