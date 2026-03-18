"""
Pydantic models for subscription and plan management.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from beanie import Document
from pymongo import IndexModel, ASCENDING


# ============================================================================
# Enums and Constants
# ============================================================================

class SubscriptionStatus:
    """Estados posibles de una suscripción."""
    ACTIVE = "active"
    PENDING = "pending"
    PAYMENT_FAILED = "payment_failed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


# ============================================================================
# Plan Schemas
# ============================================================================

class PlanBase(BaseModel):
    """Base plan model."""
    name: str = Field(..., min_length=1, max_length=50)
    code: str = Field(
        ...,
        min_length=1,
        max_length=30,
        pattern=r'^[A-Z0-9_-]+$',
        description="Código único del plan (mayúsculas, sin espacios)"
    )
    description: Optional[str] = Field(None, max_length=500)
    price_usd: float = Field(..., ge=0, description="Precio mensual en USD")
    max_projects: Optional[int] = Field(
        None,
        ge=-1,
        description="Máximo de proyectos (-1 o None = ilimitado)"
    )
    max_diagrams: Optional[int] = Field(
        None,
        ge=-1,
        description="Máximo de diagramas (-1 o None = ilimitado)"
    )


class PlanCreate(PlanBase):
    """Model for creating a new plan."""
    pass


class PlanUpdate(BaseModel):
    """Model for updating a plan."""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    code: Optional[str] = Field(
        None,
        min_length=1,
        max_length=30,
        pattern=r'^[A-Z0-9_-]+$'
    )
    description: Optional[str] = None
    price_usd: Optional[float] = Field(None, ge=0)
    max_projects: Optional[int] = Field(None, ge=-1)
    max_diagrams: Optional[int] = Field(None, ge=-1)
    is_active: Optional[bool] = None


class PlanInDB(Document):
    """Plan document stored in MongoDB."""
    name: str
    code: str = ""
    description: Optional[str] = None
    price_usd: float
    max_projects: Optional[int] = None
    max_diagrams: Optional[int] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @property
    def is_free(self) -> bool:
        """Plan is free if its code is FREE."""
        return self.code == "FREE"

    class Settings:
        name = "plans"
        indexes = [
            "name",
            "code",
            "is_active"
        ]


class PlanResponse(BaseModel):
    """Model for plan API responses."""
    id: str
    name: str
    code: str
    description: Optional[str]
    price_usd: float
    max_projects: Optional[int]
    max_diagrams: Optional[int]
    is_active: bool
    is_free: bool = False
    active_subscriptions: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Subscription Schemas
# ============================================================================

class SubscriptionBase(BaseModel):
    """Base subscription model."""
    user_id: str
    plan_id: str


class SubscriptionCreate(SubscriptionBase):
    """Model for creating a new subscription."""
    pass


class SubscriptionInDB(Document):
    """Subscription document stored in MongoDB."""
    user_id: str
    plan_id: str
    status: str = SubscriptionStatus.ACTIVE

    # Stripe integration fields
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    payment_provider: str = "stripe"

    # Dates
    started_at: datetime = Field(default_factory=datetime.utcnow)
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "subscriptions"
        indexes = [
            "user_id",
            "plan_id",
            "status",
            "stripe_subscription_id"
        ]


class SubscriptionResponse(BaseModel):
    """Model for subscription API responses."""
    id: str
    user_id: str
    plan: PlanResponse
    status: str
    stripe_customer_id: Optional[str]
    stripe_subscription_id: Optional[str]
    payment_provider: str
    started_at: datetime
    current_period_start: Optional[datetime]
    current_period_end: Optional[datetime]
    cancelled_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SubscriptionWithUsage(SubscriptionResponse):
    """Subscription response with usage information."""
    usage: dict


# ============================================================================
# Stripe Configuration Schemas
# ============================================================================

class StripeConfigBase(BaseModel):
    """Base Stripe configuration model."""
    secret_key: str = Field(..., min_length=1)
    publishable_key: str = Field(..., min_length=1)
    webhook_secret: str = Field(..., min_length=1)


class StripeConfigCreate(StripeConfigBase):
    """Model for creating Stripe configuration."""
    pass


class StripeConfigInDB(Document):
    """Stripe configuration stored in MongoDB."""
    secret_key: str
    publishable_key: str
    webhook_secret: str
    is_test_mode: bool = False
    is_configured: bool = True
    validated_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "stripe_config"


class StripeConfigResponse(BaseModel):
    """Model for Stripe config API responses."""
    id: str
    publishable_key: str
    is_test_mode: bool
    is_configured: bool
    validated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ============================================================================
# Webhook Event Schemas
# ============================================================================

class WebhookEventInDB(Document):
    """Webhook event stored in MongoDB for idempotency."""
    event_id: str
    event_type: str
    processed_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "webhook_events"
        indexes = [
            IndexModel(
                [("event_id", ASCENDING)],
                unique=True,
                name="event_id_unique_idx"
            ),
        ]


# ============================================================================
# Request/Response Schemas
# ============================================================================

class CheckoutSessionRequest(BaseModel):
    """Request to create a checkout session."""
    plan_id: str


class CheckoutSessionResponse(BaseModel):
    """Response with checkout session URL."""
    session_id: str
    session_url: str


class PlanChangeResponse(BaseModel):
    """Response for plan change request."""
    type: str
    data: dict


class UsageSummaryResponse(BaseModel):
    """Response with usage summary."""
    plan_name: str
    projects: dict
    diagrams: dict
    usage_percentage: dict


class ResourceLimitCheckResponse(BaseModel):
    """Response for resource limit check."""
    allowed: bool
    current_usage: int
    limit: Optional[int]
    plan_name: str


# ============================================================================
# Billing History Schemas
# ============================================================================

class InvoiceResponse(BaseModel):
    """Model for invoice/payment API responses."""
    id: str
    amount: float
    currency: str
    status: str
    description: str
    invoice_pdf: Optional[str] = None
    hosted_invoice_url: Optional[str] = None
    created_at: datetime
    paid_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BillingHistoryResponse(BaseModel):
    """Response with list of invoices."""
    invoices: list[InvoiceResponse]
    total_count: int
