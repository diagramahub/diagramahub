"""
FastAPI routes for subscriptions and plans.
"""
from fastapi import APIRouter, Depends, status, HTTPException
from fastapi.responses import RedirectResponse
from app.api.v1.users.routes import get_current_user_email
from app.api.v1.users.repository import UserRepository
from app.api.v1.users.schemas import UserRole

from .plan_repository import PlanRepository
from .plan_service import PlanService
from .subscription_repository import SubscriptionRepository
from .subscription_service import SubscriptionService
from .billing_service import BillingService
from .usage_limiter import UsageLimiter
from .payment_providers.stripe_provider import StripePaymentProvider
from .schemas import (
    PlanCreate, PlanUpdate, PlanResponse,
    CheckoutSessionRequest, CheckoutSessionResponse,
    UsageSummaryResponse, BillingHistoryResponse
)
from ..projects.repository import ProjectRepository
from ..diagrams.repository import DiagramRepository
import os

router = APIRouter()


# ============================================================================
# Dependency Injection
# ============================================================================

async def get_current_user_id(current_user_email: str = Depends(get_current_user_email)) -> str:
    """Get current user ID from email."""
    user_repo = UserRepository()
    user = await user_repo.get_by_email(current_user_email)
    return str(user.id)


async def get_current_user(current_user_email: str = Depends(get_current_user_email)):
    """Get current user."""
    user_repo = UserRepository()
    user = await user_repo.get_by_email(current_user_email)
    return user


async def require_admin(current_user = Depends(get_current_user)):
    """Require admin role."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


def get_plan_service() -> PlanService:
    """Get plan service instance."""
    return PlanService(repository=PlanRepository())


def get_subscription_service() -> SubscriptionService:
    """Get subscription service instance."""
    try:
        payment_provider = StripePaymentProvider.from_env()
    except ValueError:
        # Si no hay credenciales de Stripe, usar un provider dummy
        # Esto permite que el sistema funcione sin Stripe configurado
        payment_provider = None
    
    return SubscriptionService(
        repository=SubscriptionRepository(),
        plan_repository=PlanRepository(),
        payment_provider=payment_provider
    )


def get_usage_limiter() -> UsageLimiter:
    """Get usage limiter instance."""
    return UsageLimiter(
        subscription_repository=SubscriptionRepository(),
        plan_repository=PlanRepository(),
        project_repository=ProjectRepository(),
        diagram_repository=DiagramRepository()
    )


def get_billing_service() -> BillingService:
    """Get billing service instance."""
    stripe_api_key = os.getenv("STRIPE_SECRET_KEY")
    if not stripe_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing service not configured"
        )
    
    return BillingService(
        subscription_repository=SubscriptionRepository(),
        stripe_api_key=stripe_api_key
    )


# ============================================================================
# Admin Plan Endpoints
# ============================================================================

@router.post(
    "/admin/plans",
    response_model=PlanResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["admin", "plans"]
)
async def create_plan(
    plan_data: PlanCreate,
    admin_user = Depends(require_admin),
    service: PlanService = Depends(get_plan_service)
):
    """
    Create a new plan (admin only).
    
    Requires admin role.
    """
    return await service.create_plan(plan_data, str(admin_user.id))


@router.get(
    "/admin/plans",
    response_model=list[PlanResponse],
    tags=["admin", "plans"]
)
async def get_all_plans_admin(
    admin_user = Depends(require_admin),
    service: PlanService = Depends(get_plan_service)
):
    """
    Get all plans including inactive (admin only).
    
    Requires admin role.
    """
    return await service.get_all_plans()


@router.put(
    "/admin/plans/{plan_id}",
    response_model=PlanResponse,
    tags=["admin", "plans"]
)
async def update_plan(
    plan_id: str,
    plan_data: PlanUpdate,
    admin_user = Depends(require_admin),
    service: PlanService = Depends(get_plan_service)
):
    """
    Update a plan (admin only).
    
    Requires admin role.
    Cannot modify FREE plan.
    """
    return await service.update_plan(plan_id, plan_data, str(admin_user.id))


@router.delete(
    "/admin/plans/{plan_id}",
    tags=["admin", "plans"]
)
async def deactivate_plan(
    plan_id: str,
    admin_user = Depends(require_admin),
    service: PlanService = Depends(get_plan_service)
):
    """
    Deactivate a plan (admin only).
    
    Requires admin role.
    Cannot deactivate FREE plan.
    Existing subscriptions are maintained.
    """
    return await service.deactivate_plan(plan_id, str(admin_user.id))


# ============================================================================
# Public Plan Endpoints
# ============================================================================

@router.get(
    "/plans",
    response_model=list[PlanResponse],
    tags=["plans"]
)
async def get_active_plans(
    service: PlanService = Depends(get_plan_service)
):
    """
    Get all active plans (public).
    
    Returns only active plans available for subscription.
    """
    return await service.get_active_plans()


@router.get(
    "/plans/{plan_id}",
    response_model=PlanResponse,
    tags=["plans"]
)
async def get_plan(
    plan_id: str,
    service: PlanService = Depends(get_plan_service)
):
    """
    Get plan details (public).
    """
    return await service.get_plan_by_id(plan_id)


# ============================================================================
# Subscription Endpoints
# ============================================================================

@router.get(
    "/subscriptions/me",
    tags=["subscriptions"]
)
async def get_my_subscription(
    user_id: str = Depends(get_current_user_id),
    service: SubscriptionService = Depends(get_subscription_service)
):
    """
    Get current user's subscription.
    """
    return await service.get_user_subscription(user_id)


@router.post(
    "/subscriptions/checkout",
    response_model=CheckoutSessionResponse,
    tags=["subscriptions"]
)
async def create_checkout_session(
    request: CheckoutSessionRequest,
    user_id: str = Depends(get_current_user_id),
    service: SubscriptionService = Depends(get_subscription_service)
):
    """
    Initiate plan change / checkout.
    
    If the new plan is FREE, changes immediately.
    If the new plan is paid, returns Stripe checkout URL.
    """
    result = await service.initiate_plan_change(user_id, request.plan_id)
    
    if result["type"] == "immediate":
        # Plan FREE, cambio inmediato
        return {
            "session_id": None,
            "session_url": None,
            "message": "Plan changed immediately to FREE"
        }
    else:
        # Plan de pago, retornar checkout URL
        return CheckoutSessionResponse(
            session_id=result["data"]["session_id"],
            session_url=result["data"]["session_url"]
        )


@router.post(
    "/subscriptions/cancel",
    tags=["subscriptions"]
)
async def cancel_subscription(
    immediate: bool = False,
    user_id: str = Depends(get_current_user_id),
    service: SubscriptionService = Depends(get_subscription_service)
):
    """
    Cancel current subscription.
    
    Args:
        immediate: If True, cancels immediately and switches to FREE.
                  If False (default), maintains access until end of billing period.
    
    Returns:
        Cancellation details including when access ends.
    """
    return await service.cancel_subscription(user_id, immediate=immediate)


@router.post(
    "/subscriptions/update-payment-method",
    tags=["subscriptions"]
)
async def update_payment_method(
    user_id: str = Depends(get_current_user_id),
    service: SubscriptionService = Depends(get_subscription_service)
):
    """
    Create a Stripe Checkout session in setup mode to update payment method.
    
    Returns session_url to redirect the user to Stripe.
    """
    result = await service.create_setup_session(user_id)
    return result


@router.get(
    "/subscriptions/usage",
    response_model=UsageSummaryResponse,
    tags=["subscriptions"]
)
async def get_usage_summary(
    user_id: str = Depends(get_current_user_id),
    limiter: UsageLimiter = Depends(get_usage_limiter)
):
    """
    Get usage summary for current user.
    
    Returns current usage and limits for projects and diagrams.
    """
    return await limiter.get_usage_summary(user_id)



# ============================================================================
# Billing History Endpoints
# ============================================================================

@router.get(
    "/subscriptions/billing-history",
    response_model=BillingHistoryResponse,
    tags=["subscriptions", "billing"]
)
async def get_billing_history(
    limit: int = 10,
    user_id: str = Depends(get_current_user_id),
    service: BillingService = Depends(get_billing_service)
):
    """
    Get billing history for current user.
    
    Returns list of invoices/payments from Stripe.
    """
    return await service.get_billing_history(user_id, limit)


@router.get(
    "/subscriptions/invoices/{invoice_id}/pdf-url",
    tags=["subscriptions", "billing"]
)
async def get_invoice_pdf_url(
    invoice_id: str,
    user_id: str = Depends(get_current_user_id),
    service: BillingService = Depends(get_billing_service)
):
    """
    Get invoice PDF URL.
    
    Returns the Stripe-hosted PDF URL for the invoice.
    Verifies that the invoice belongs to the current user.
    """
    try:
        pdf_url = await service.get_invoice_pdf_url(user_id, invoice_id)
        return {"pdf_url": pdf_url}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice not found or access denied"
        )
