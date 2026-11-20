"""
User administration service: block, unblock and delete accounts, and read a
user's billing (subscriptions and invoices) for the admin panel.

Rules
- An admin cannot block or delete their own account (the profile page covers
  self-deletion), so at least one active admin always remains.
- Blocking sets ``is_active=False``: sign-in is rejected and every open session
  and API token stops working on its next request (``app.api.deps``). The paid
  subscription is NOT cancelled: a block can be temporary.
- Deleting a user with an active paid subscription first cancels it with the
  payment provider. If that fails, nothing is deleted: removing the account
  while the provider keeps charging the card would be worse.
"""

import logging
from typing import Optional

from bson import ObjectId
from fastapi import HTTPException, status

from app.api.v1.subscriptions.billing_service import invoice_to_response
from app.api.v1.subscriptions.exceptions import PaymentProviderError
from app.api.v1.subscriptions.interfaces import IPlanRepository, ISubscriptionRepository
from app.api.v1.subscriptions.payment_providers.interfaces import IPaymentProvider
from app.api.v1.subscriptions.schemas import (
    AdminSubscriptionEntry,
    AdminUserBillingResponse,
    PlanInDB,
    SubscriptionInDB,
)
from app.api.v1.users import audit_log
from app.api.v1.users.deletion_service import AccountDeletionService
from app.api.v1.users.interfaces import IUserRepository
from app.api.v1.users.schemas import UserInDB

logger = logging.getLogger(__name__)

#: Invoices read per Stripe customer for the admin billing view.
ADMIN_INVOICE_LIMIT = 24


def is_paid_plan(plan: Optional[PlanInDB]) -> bool:
    """A plan the user pays for: not FREE and with a price above zero in any currency."""
    if plan is None or plan.is_free:
        return False
    return any(float(amount or 0) > 0 for amount in (plan.prices or {}).values())


class UserAdminService:
    """Admin actions on user accounts."""

    def __init__(
        self,
        user_repository: IUserRepository,
        subscription_repository: ISubscriptionRepository,
        plan_repository: IPlanRepository,
        payment_provider: Optional[IPaymentProvider] = None,
        deletion_service: Optional[AccountDeletionService] = None,
    ):
        self.user_repository = user_repository
        self.subscription_repository = subscription_repository
        self.plan_repository = plan_repository
        self.payment_provider = payment_provider
        self.deletion_service = deletion_service

    async def _get_target(self, user_id: str) -> UserInDB:
        """The user the action applies to. Unknown or malformed id -> 404."""
        user = await self.user_repository.get_by_id(user_id) if ObjectId.is_valid(user_id) else None
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return user

    @staticmethod
    def _reject_self(admin: UserInDB, target: UserInDB, detail: str) -> None:
        if str(admin.id) == str(target.id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)

    # ------------------------------------------------------------------
    # Block / unblock
    # ------------------------------------------------------------------

    async def set_status(
        self, admin: UserInDB, user_id: str, is_active: bool, reason: Optional[str] = None
    ) -> UserInDB:
        """Block (``is_active=False``) or unblock a user. Idempotent."""
        target = await self._get_target(user_id)
        self._reject_self(admin, target, "You cannot block your own account")

        if target.is_active == is_active:
            return target

        reason = (reason or "").strip() or None
        updated = await self.user_repository.set_active(
            user_id, is_active, blocked_by=admin.email, reason=reason
        )
        if updated is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        details = f"by={admin.email}"
        if reason and not is_active:
            details += f"; reason={reason}"
        await audit_log.log_event(
            (
                audit_log.EVENT_ADMIN_USER_UNBLOCKED
                if is_active
                else audit_log.EVENT_ADMIN_USER_BLOCKED
            ),
            target.email,
            user_id=user_id,
            details=details,
        )
        logger.info(
            "Admin %s %s user %s",
            admin.email,
            "unblocked" if is_active else "blocked",
            user_id,
        )
        return updated

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    async def _active_paid_subscription(
        self, user_id: str
    ) -> tuple[Optional[SubscriptionInDB], Optional[PlanInDB]]:
        subscription = await self.subscription_repository.get_active_by_user(user_id)
        if subscription is None:
            return None, None
        plan = await self.plan_repository.get_by_id(subscription.plan_id)
        if not is_paid_plan(plan) or not subscription.stripe_subscription_id:
            return None, None
        return subscription, plan

    async def delete_user(self, admin: UserInDB, user_id: str, confirm_email: str) -> dict:
        """Delete a user and all their data, cancelling their paid subscription first."""
        if self.deletion_service is None:
            raise RuntimeError("UserAdminService.delete_user needs a deletion_service")

        target = await self._get_target(user_id)
        self._reject_self(
            admin, target, "Delete your own account from your profile, not from the admin panel"
        )
        if confirm_email.strip().lower() != target.email.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The confirmation email does not match the user",
            )

        subscription, plan = await self._active_paid_subscription(user_id)
        cancelled = False
        if subscription is not None:
            if self.payment_provider is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "The user has a paid subscription and no payment provider is "
                        "configured to cancel it. Nothing was deleted."
                    ),
                )
            try:
                await self.payment_provider.cancel_subscription(
                    subscription.stripe_subscription_id, immediate=True
                )
            except PaymentProviderError as exc:
                logger.error("Admin delete: could not cancel subscription of %s: %s", user_id, exc)
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=(
                        "Could not cancel the user's subscription with the payment provider. "
                        "Nothing was deleted."
                    ),
                )
            cancelled = True

        try:
            await self.deletion_service.delete_user_account(user_id)
        except Exception:
            logger.exception("Admin delete failed for user %s", user_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not delete the account. Please try again.",
            )

        details = f"by={admin.email}"
        if cancelled:
            details += f"; cancelled_subscription={subscription.stripe_subscription_id}"
            details += f"; plan={plan.name if plan else 'unknown'}"
        await audit_log.log_event(
            audit_log.EVENT_ADMIN_USER_DELETED, target.email, user_id=user_id, details=details
        )
        logger.info("Admin %s deleted user %s", admin.email, user_id)
        return {
            "message": f"User {target.email} deleted",
            "subscription_cancelled": cancelled,
        }

    # ------------------------------------------------------------------
    # Billing
    # ------------------------------------------------------------------

    async def get_billing(self, user_id: str) -> AdminUserBillingResponse:
        """Subscriptions (current and past) and provider invoices of a user."""
        await self._get_target(user_id)
        subscriptions = await self.subscription_repository.list_by_user(user_id)

        plans: dict[str, Optional[PlanInDB]] = {}
        for sub in subscriptions:
            if sub.plan_id not in plans:
                plans[sub.plan_id] = await self.plan_repository.get_by_id(sub.plan_id)

        entries = [self._entry(sub, plans.get(sub.plan_id)) for sub in subscriptions]
        current = next((e for e in entries if e.status == "active"), None)
        is_paying = bool(current and current.is_paid_plan and current.stripe_subscription_id)

        invoices = []
        invoices_error = None
        customer_ids = list(
            dict.fromkeys(s.stripe_customer_id for s in subscriptions if s.stripe_customer_id)
        )
        if self.payment_provider is not None:
            for customer_id in customer_ids:
                try:
                    raw = await self.payment_provider.get_billing_history(
                        customer_id=customer_id, limit=ADMIN_INVOICE_LIMIT
                    )
                    invoices.extend(invoice_to_response(invoice) for invoice in raw)
                except Exception:
                    logger.exception("Admin billing: could not read invoices of %s", customer_id)
                    invoices_error = "Could not read the invoices from the payment provider"
        invoices.sort(key=lambda inv: inv.created_at, reverse=True)

        total_paid: dict[str, float] = {}
        for invoice in invoices:
            if invoice.status == "paid":
                total_paid[invoice.currency] = round(
                    total_paid.get(invoice.currency, 0.0) + invoice.amount, 2
                )

        return AdminUserBillingResponse(
            user_id=user_id,
            provider_configured=self.payment_provider is not None,
            is_paying=is_paying,
            current=current,
            subscriptions=entries,
            invoices=invoices,
            total_paid=total_paid,
            invoices_error=invoices_error,
        )

    @staticmethod
    def _entry(sub: SubscriptionInDB, plan: Optional[PlanInDB]) -> AdminSubscriptionEntry:
        return AdminSubscriptionEntry(
            id=str(sub.id),
            plan_id=sub.plan_id,
            plan_name=plan.name if plan else None,
            plan_code=plan.code if plan else None,
            prices=dict(plan.prices) if plan else {},
            is_paid_plan=is_paid_plan(plan),
            status=sub.status,
            payment_provider=sub.payment_provider,
            stripe_customer_id=sub.stripe_customer_id,
            stripe_subscription_id=sub.stripe_subscription_id,
            started_at=sub.started_at,
            current_period_start=sub.current_period_start,
            current_period_end=sub.current_period_end,
            cancelled_at=sub.cancelled_at,
            created_at=sub.created_at,
        )
