"""
Constants for subscription system.
"""

# Plan FREE predefinido
FREE_PLAN_NAME = "FREE"
FREE_PLAN_DESCRIPTION = "Plan gratuito con límites básicos"
FREE_PLAN_PRICE = 0.0
FREE_PLAN_MAX_PROJECTS = 1
FREE_PLAN_MAX_DIAGRAMS = 10

# Subscription statuses
STATUS_ACTIVE = "active"
STATUS_PENDING = "pending"
STATUS_PAYMENT_FAILED = "payment_failed"
STATUS_CANCELLED = "cancelled"
STATUS_EXPIRED = "expired"

# Resource types
RESOURCE_TYPE_PROJECT = "projects"
RESOURCE_TYPE_DIAGRAM = "diagrams"

# Payment providers
PAYMENT_PROVIDER_STRIPE = "stripe"

# Usage thresholds for notifications
USAGE_WARNING_THRESHOLD = 0.8  # 80%
USAGE_LIMIT_THRESHOLD = 1.0    # 100%
