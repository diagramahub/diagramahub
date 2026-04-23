"""
Security audit log for tracking authentication and account events.

Stores events in a MongoDB collection for SOC2 CC7.2 compliance.
"""
import logging
from datetime import datetime
from typing import Optional

from beanie import Document
from pydantic import Field
from pymongo import IndexModel

logger = logging.getLogger(__name__)

# Retention period: 90 days (in seconds)
AUDIT_LOG_TTL_SECONDS = 90 * 24 * 60 * 60


class AuditLogEntry(Document):
    """Security audit log entry stored in MongoDB."""

    timestamp: datetime = Field(default_factory=datetime.utcnow)
    event: str  # e.g. "login_success", "login_failed", "password_changed"
    user_email: str
    user_id: Optional[str] = None
    ip_address: Optional[str] = None
    details: Optional[str] = None  # Extra context (e.g. "MFA method: totp")

    class Settings:
        name = "audit_log"
        indexes = [
            "user_email",
            "event",
            IndexModel(
                [("timestamp", 1)],
                expireAfterSeconds=AUDIT_LOG_TTL_SECONDS,
                name="timestamp_ttl_90d",
            ),
        ]


# ---------------------------------------------------------------------------
# Event constants
# ---------------------------------------------------------------------------

EVENT_LOGIN_SUCCESS = "login_success"
EVENT_LOGIN_FAILED = "login_failed"
EVENT_LOGIN_LOCKED = "login_locked"
EVENT_LOGIN_MFA_VERIFIED = "login_mfa_verified"
EVENT_PASSWORD_CHANGED = "password_changed"
EVENT_PASSWORD_RESET_REQUESTED = "password_reset_requested"
EVENT_PASSWORD_RESET_CONFIRMED = "password_reset_confirmed"
EVENT_MFA_ENABLED = "mfa_enabled"
EVENT_MFA_DISABLED = "mfa_disabled"
EVENT_MFA_RECOVERY_USED = "mfa_recovery_used"
EVENT_ADMIN_MFA_RESET = "admin_mfa_reset"
EVENT_ACCOUNT_DELETED = "account_deleted"
EVENT_OAUTH_LOGIN_SUCCESS = "oauth_login_success"
EVENT_OAUTH_LOGIN_FAILED = "oauth_login_failed"
EVENT_OAUTH_ACCOUNT_LINKED = "oauth_account_linked"


async def log_event(
    event: str,
    user_email: str,
    user_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    details: Optional[str] = None,
) -> None:
    """Write a security audit log entry. Failures are logged but never raise."""
    try:
        entry = AuditLogEntry(
            event=event,
            user_email=user_email,
            user_id=user_id,
            ip_address=ip_address,
            details=details,
        )
        await entry.insert()
    except Exception:
        logger.warning("Failed to write audit log: %s %s", event, user_email)
