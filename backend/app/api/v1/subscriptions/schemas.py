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
    description: Optional[str] = None
    price_usd: Optional[float] = Field(None, ge=0)
    max_projects: Optional[int] = Field(None, ge=-1)
    max_diagrams: Optional[int] = Field(None, ge=-1)


class PlanInDB(Document):
    """Plan document stored in MongoDB."""
    name: str
    description: Optional[str] = None
    price_usd: float
    max_projects: Optional[int] = None  # None = ilimitado
    max_diagrams: Optional[int] = None  # None = ilimitado
    is_active: bool = True
    is_free: bool = False  # True solo para plan FREE
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "plans"
        indexes = [
            "name",
            "is_active"
        ]


class PlanResponse(BaseModel):
    """Model for plan API responses."""
    id: str
    name: str
    description: Optional[str]
    price_usd: float
    max_projects: Optional[int]
    max_diagrams: Optional[int]
    is_active: bool
    is_free: bool
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
    payment_provider: str = "stripe"  # Extensible para otros proveedores
    
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
    plan: PlanResponse  # Plan completo embebido
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
    usage: dict  # Del UsageLimiter.get_usage_summary()


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
    secret_key: str  # Encriptado
    publishable_key: str
    webhook_secret: str  # Encriptado
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
    # NO exponer secret_key ni webhook_secret
    
    class Config:
        from_attributes = True


# ============================================================================
# Webhook Event Schemas
# ============================================================================

class WebhookEventInDB(Document):
    """Webhook event stored in MongoDB for idempotency."""
    event_id: str  # Stripe event ID
    event_type: str
    processed_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "webhook_events"
        indexes = [
            IndexModel([("event_id", ASCENDING)], unique=True, name="event_id_unique_idx"),
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
    type: str  # "immediate" or "checkout"
    data: dict  # Contiene session_url si type="checkout", o subscription si type="immediate"


class UsageSummaryResponse(BaseModel):
    """Response with usage summary."""
    plan_name: str
    projects: dict  # {"current": int, "limit": int | None}
    diagrams: dict  # {"current": int, "limit": int | None}
    usage_percentage: dict  # {"projects": float, "diagrams": float}


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
    amount: float  # En USD
    currency: str
    status: str  # "paid", "open", "void", "uncollectible"
    description: str
    invoice_pdf: Optional[str] = None  # URL del PDF en Stripe
    hosted_invoice_url: Optional[str] = None  # URL para ver en Stripe
    created_at: datetime
    paid_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class BillingHistoryResponse(BaseModel):
    """Response with list of invoices."""
    invoices: list[InvoiceResponse]
    total_count: int
