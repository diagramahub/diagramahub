"""
Admin routes for user accounts: block / unblock, delete, and billing detail.

The admin user listing and the MFA reset live in ``mfa/routes.py``
(``/mfa/admin/users``); these routes act on one user at a time.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.api.v1.subscriptions.payment_providers.stripe_provider import StripePaymentProvider
from app.api.v1.subscriptions.plan_repository import PlanRepository
from app.api.v1.subscriptions.schemas import AdminUserBillingResponse
from app.api.v1.subscriptions.subscription_repository import SubscriptionRepository
from app.api.v1.users.admin_service import UserAdminService
from app.api.v1.users.deletion_service import build_account_deletion_service
from app.api.v1.users.repository import UserRepository
from app.api.v1.users.schemas import (
    AdminDeleteUserRequest,
    AdminUserStatusRequest,
    UserInDB,
    UserRole,
)

router = APIRouter(prefix="/users/admin", tags=["users", "admin"])


async def require_admin(current_user: Annotated[UserInDB, Depends(get_current_user)]) -> UserInDB:
    """The signed-in admin. Anyone else -> 403."""
    if current_user is None or current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def _service(payment_provider=None, with_deletion: bool = False) -> UserAdminService:
    return UserAdminService(
        user_repository=UserRepository(),
        subscription_repository=SubscriptionRepository(),
        plan_repository=PlanRepository(),
        payment_provider=payment_provider,
        deletion_service=build_account_deletion_service() if with_deletion else None,
    )


def get_admin_service() -> UserAdminService:
    """Service for actions that never talk to the payment provider."""
    return _service()


async def get_admin_billing_service() -> UserAdminService:
    """Service with the payment provider (None when not configured) and the deletion service."""
    return _service(await StripePaymentProvider.from_db_or_env(), with_deletion=True)


def _status_payload(user: UserInDB) -> dict:
    return {
        "id": str(user.id),
        "is_active": user.is_active,
        "blocked_at": user.blocked_at.isoformat() if user.blocked_at else None,
        "blocked_by": user.blocked_by,
        "blocked_reason": user.blocked_reason,
    }


@router.put("/{user_id}/status")
async def admin_set_user_status(
    user_id: str,
    body: AdminUserStatusRequest,
    admin: Annotated[UserInDB, Depends(require_admin)],
    service: Annotated[UserAdminService, Depends(get_admin_service)],
) -> dict:
    """Block (``is_active=false``) or unblock a user. A blocked user cannot sign in and
    their open sessions and API tokens stop working. Their subscription is not touched."""
    user = await service.set_status(admin, user_id, body.is_active, body.reason)
    return _status_payload(user)


@router.delete("/{user_id}")
async def admin_delete_user(
    user_id: str,
    body: AdminDeleteUserRequest,
    admin: Annotated[UserInDB, Depends(require_admin)],
    service: Annotated[UserAdminService, Depends(get_admin_billing_service)],
) -> dict:
    """Delete a user and all their data. An active paid subscription is cancelled with the
    payment provider first; if that fails nothing is deleted."""
    return await service.delete_user(admin, user_id, body.confirm_email)


@router.get("/{user_id}/billing", response_model=AdminUserBillingResponse)
async def admin_get_user_billing(
    user_id: str,
    admin: Annotated[UserInDB, Depends(require_admin)],
    service: Annotated[UserAdminService, Depends(get_admin_billing_service)],
) -> AdminUserBillingResponse:
    """Subscriptions (current and past) and payment-provider invoices of a user."""
    return await service.get_billing(user_id)
