"""
Structured logging for subscription system.
"""
import logging
from datetime import datetime
from typing import Optional, Dict, Any
import json

# Configure logger
logger = logging.getLogger("subscriptions")
logger.setLevel(logging.INFO)

# Create console handler with structured format
handler = logging.StreamHandler()
handler.setLevel(logging.INFO)

# Create formatter
formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
handler.setFormatter(formatter)
logger.addHandler(handler)


class SubscriptionLogger:
    """Structured logger for subscription events."""
    
    @staticmethod
    def _log(level: str, event: str, data: Optional[Dict[str, Any]] = None):
        """
        Log structured event.
        
        Args:
            level: Log level (info, warning, error)
            event: Event name
            data: Additional event data
        """
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "event": event,
            **(data or {})
        }
        
        message = json.dumps(log_data)
        
        if level == "info":
            logger.info(message)
        elif level == "warning":
            logger.warning(message)
        elif level == "error":
            logger.error(message)
    
    # Plan Management Events
    
    @staticmethod
    def plan_created(plan_id: str, plan_name: str, price: float, created_by: str):
        """Log plan creation."""
        SubscriptionLogger._log("info", "plan_created", {
            "plan_id": plan_id,
            "plan_name": plan_name,
            "price_usd": price,
            "created_by": created_by
        })
    
    @staticmethod
    def plan_updated(plan_id: str, plan_name: str, updated_by: str, changes: Dict[str, Any]):
        """Log plan update."""
        SubscriptionLogger._log("info", "plan_updated", {
            "plan_id": plan_id,
            "plan_name": plan_name,
            "updated_by": updated_by,
            "changes": changes
        })
    
    @staticmethod
    def plan_deactivated(plan_id: str, plan_name: str, deactivated_by: str):
        """Log plan deactivation."""
        SubscriptionLogger._log("info", "plan_deactivated", {
            "plan_id": plan_id,
            "plan_name": plan_name,
            "deactivated_by": deactivated_by
        })
    
    # Subscription Events
    
    @staticmethod
    def subscription_created(subscription_id: str, user_id: str, plan_name: str, status: str):
        """Log subscription creation."""
        SubscriptionLogger._log("info", "subscription_created", {
            "subscription_id": subscription_id,
            "user_id": user_id,
            "plan_name": plan_name,
            "status": status
        })
    
    @staticmethod
    def subscription_plan_changed(
        user_id: str,
        old_plan: str,
        new_plan: str,
        change_type: str  # "immediate" or "checkout"
    ):
        """Log subscription plan change."""
        SubscriptionLogger._log("info", "subscription_plan_changed", {
            "user_id": user_id,
            "old_plan": old_plan,
            "new_plan": new_plan,
            "change_type": change_type
        })
    
    @staticmethod
    def subscription_activated(
        subscription_id: str,
        user_id: str,
        plan_name: str,
        stripe_subscription_id: Optional[str] = None
    ):
        """Log subscription activation."""
        SubscriptionLogger._log("info", "subscription_activated", {
            "subscription_id": subscription_id,
            "user_id": user_id,
            "plan_name": plan_name,
            "stripe_subscription_id": stripe_subscription_id
        })
    
    @staticmethod
    def subscription_cancelled(
        subscription_id: str,
        user_id: str,
        plan_name: str,
        cancel_at: Optional[datetime] = None
    ):
        """Log subscription cancellation."""
        SubscriptionLogger._log("info", "subscription_cancelled", {
            "subscription_id": subscription_id,
            "user_id": user_id,
            "plan_name": plan_name,
            "cancel_at": cancel_at.isoformat() if cancel_at else None
        })
    
    @staticmethod
    def subscription_status_changed(
        subscription_id: str,
        user_id: str,
        old_status: str,
        new_status: str
    ):
        """Log subscription status change."""
        SubscriptionLogger._log("info", "subscription_status_changed", {
            "subscription_id": subscription_id,
            "user_id": user_id,
            "old_status": old_status,
            "new_status": new_status
        })
    
    # Webhook Events
    
    @staticmethod
    def webhook_received(event_type: str, event_id: str):
        """Log webhook received."""
        SubscriptionLogger._log("info", "webhook_received", {
            "event_type": event_type,
            "event_id": event_id
        })
    
    @staticmethod
    def webhook_processed(event_type: str, event_id: str, success: bool):
        """Log webhook processing result."""
        level = "info" if success else "error"
        SubscriptionLogger._log(level, "webhook_processed", {
            "event_type": event_type,
            "event_id": event_id,
            "success": success
        })
    
    @staticmethod
    def webhook_duplicate(event_id: str):
        """Log duplicate webhook (already processed)."""
        SubscriptionLogger._log("info", "webhook_duplicate", {
            "event_id": event_id,
            "message": "Webhook already processed (idempotency)"
        })
    
    # Payment Events
    
    @staticmethod
    def checkout_session_created(
        user_id: str,
        plan_name: str,
        session_id: str,
        amount: float
    ):
        """Log checkout session creation."""
        SubscriptionLogger._log("info", "checkout_session_created", {
            "user_id": user_id,
            "plan_name": plan_name,
            "session_id": session_id,
            "amount_usd": amount
        })
    
    @staticmethod
    def payment_succeeded(
        user_id: str,
        plan_name: str,
        amount: float,
        stripe_payment_id: str
    ):
        """Log successful payment."""
        SubscriptionLogger._log("info", "payment_succeeded", {
            "user_id": user_id,
            "plan_name": plan_name,
            "amount_usd": amount,
            "stripe_payment_id": stripe_payment_id
        })
    
    @staticmethod
    def payment_failed(
        user_id: str,
        plan_name: str,
        reason: str,
        stripe_payment_id: Optional[str] = None
    ):
        """Log failed payment."""
        SubscriptionLogger._log("error", "payment_failed", {
            "user_id": user_id,
            "plan_name": plan_name,
            "reason": reason,
            "stripe_payment_id": stripe_payment_id
        })
    
    # Resource Limit Events
    
    @staticmethod
    def resource_limit_exceeded(
        user_id: str,
        resource_type: str,
        current_usage: int,
        limit: int,
        plan_name: str
    ):
        """Log resource limit exceeded."""
        SubscriptionLogger._log("warning", "resource_limit_exceeded", {
            "user_id": user_id,
            "resource_type": resource_type,
            "current_usage": current_usage,
            "limit": limit,
            "plan_name": plan_name
        })
    
    # Error Events
    
    @staticmethod
    def error(
        error_type: str,
        message: str,
        context: Optional[Dict[str, Any]] = None
    ):
        """Log error."""
        SubscriptionLogger._log("error", "error", {
            "error_type": error_type,
            "message": message,
            **(context or {})
        })
    
    # Migration Events
    
    @staticmethod
    def migration_started(total_users: int):
        """Log migration start."""
        SubscriptionLogger._log("info", "migration_started", {
            "total_users": total_users
        })
    
    @staticmethod
    def migration_completed(
        total: int,
        migrated: int,
        already_had_subscription: int,
        errors: int
    ):
        """Log migration completion."""
        SubscriptionLogger._log("info", "migration_completed", {
            "total_users": total,
            "migrated": migrated,
            "already_had_subscription": already_had_subscription,
            "errors": errors
        })
