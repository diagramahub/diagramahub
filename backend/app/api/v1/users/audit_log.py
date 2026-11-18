"""
Security audit log for tracking authentication and account events.

Stores events in a MongoDB collection for SOC2 CC7.2 compliance.
"""

import logging
from datetime import datetime
from typing import Optional

from beanie import Document
from pydantic import Field
from fastapi import Request
from pymongo import IndexModel
from app.core.client_ip import get_client_ip
from app.core.clock import utcnow

logger = logging.getLogger(__name__)

# Retention period: 90 days (in seconds)
AUDIT_LOG_TTL_SECONDS = 90 * 24 * 60 * 60


class AuditLogEntry(Document):
    """Security audit log entry stored in MongoDB."""

    timestamp: datetime = Field(default_factory=utcnow)
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

# Sensitive actions outside authentication (invariant #7)
EVENT_AI_PROVIDER_ADDED = "ai_provider_added"
EVENT_AI_PROVIDER_UPDATED = "ai_provider_updated"
EVENT_AI_PROVIDER_REMOVED = "ai_provider_removed"
EVENT_SHARED_LINK_CREATED = "shared_link_created"
EVENT_SHARED_LINK_UPDATED = "shared_link_updated"
EVENT_SHARED_LINK_REVOKED = "shared_link_revoked"
EVENT_INTEGRATION_CREATED = "integration_created"
EVENT_INTEGRATION_UPDATED = "integration_updated"
EVENT_INTEGRATION_DELETED = "integration_deleted"
EVENT_INTEGRATION_SET_DEFAULT = "integration_set_default"
EVENT_PLAN_CREATED = "plan_created"
EVENT_PLAN_UPDATED = "plan_updated"
EVENT_PLAN_DELETED = "plan_deleted"
EVENT_PLAN_PRICE_ADDED = "plan_price_added"
EVENT_API_TOKEN_CREATED = "api_token_created"
EVENT_API_TOKEN_REVOKED = "api_token_revoked"
EVENT_COMMUNITY_PUBLISHED = "community_published"
EVENT_COMMUNITY_UNPUBLISHED = "community_unpublished"
EVENT_COMMUNITY_MODERATED = "community_moderated"


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
        logger.warning("Failed to write audit log entry", exc_info=True)


async def log_event_for_user_id(
    event: str,
    user_id: str,
    request: Optional[Request] = None,
    details: Optional[str] = None,
) -> None:
    """Write an audit entry for a request authenticated by user id.

    Resolves the user's email (the field the admin audit view searches by) and
    the client IP. Like :func:`log_event`, failures are logged but never raise,
    so an audit problem never blocks the action itself.
    """
    try:
        # Imported here: the users schemas module is heavy and this one is
        # imported by many modules at startup.
        from beanie import PydanticObjectId

        from app.api.v1.users.schemas import UserInDB

        user = await UserInDB.get(PydanticObjectId(user_id))
        email = user.email if user else f"unknown:{user_id}"
        ip_address = get_client_ip(request) if request is not None else None
    except Exception:
        logger.warning("Failed to resolve audit context", exc_info=True)
        email, ip_address = f"unknown:{user_id}", None
    await log_event(
        event,
        user_email=email,
        user_id=user_id,
        ip_address=ip_address,
        details=details,
    )
