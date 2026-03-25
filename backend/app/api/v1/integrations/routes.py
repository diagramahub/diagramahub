"""
Admin routes for managing vendor integrations (email and payment).

All endpoints require admin role.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.v1.users.repository import UserRepository
from app.api.v1.users.routes import get_current_user_email
from app.api.v1.users.schemas import UserRole

from .repository import IntegrationsRepository
from .schemas import (
    VendorConfigCreate,
    VendorConfigResponse,
    VendorConfigUpdate,
    TestConnectionResponse,
)
from .services import IntegrationsService

router = APIRouter(prefix="/admin/integrations", tags=["Integrations (Admin)"])


# ── Dependencies ─────────────────────────────────────────────────────

def get_integrations_service() -> IntegrationsService:
    """Dependency injection for IntegrationsService."""
    return IntegrationsService(repository=IntegrationsRepository())


async def get_current_admin_user_id(
    current_user_email: str = Depends(get_current_user_email),
) -> str:
    """Verify the current user has admin role and return their user ID.

    Raises:
        HTTPException 403: If the user is not an admin.
        HTTPException 404: If the user is not found.
    """
    user_repo = UserRepository()
    user = await user_repo.get_by_email(current_user_email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return str(user.id)


# ── Endpoints ────────────────────────────────────────────────────────


@router.get("/vendors", response_model=list[VendorConfigResponse])
async def list_vendors(
    category: Optional[str] = None,
    admin_user_id: str = Depends(get_current_admin_user_id),
    service: IntegrationsService = Depends(get_integrations_service),
) -> list[VendorConfigResponse]:
    """List vendor configurations, optionally filtered by category (email/payment)."""
    return await service.list_vendors(category)


@router.post(
    "/vendors",
    response_model=VendorConfigResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_vendor(
    vendor_data: VendorConfigCreate,
    admin_user_id: str = Depends(get_current_admin_user_id),
    service: IntegrationsService = Depends(get_integrations_service),
) -> VendorConfigResponse:
    """Create a new vendor configuration."""
    return await service.save_vendor_config(vendor_data, user_id=admin_user_id)


@router.put("/vendors/{vendor_id}", response_model=VendorConfigResponse)
async def update_vendor(
    vendor_id: str,
    update_data: VendorConfigUpdate,
    admin_user_id: str = Depends(get_current_admin_user_id),
    service: IntegrationsService = Depends(get_integrations_service),
) -> VendorConfigResponse:
    """Update an existing vendor configuration."""
    return await service.update_vendor_config(vendor_id, update_data)


@router.delete("/vendors/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vendor(
    vendor_id: str,
    admin_user_id: str = Depends(get_current_admin_user_id),
    service: IntegrationsService = Depends(get_integrations_service),
) -> None:
    """Delete a vendor configuration."""
    await service.delete_vendor_config(vendor_id)


@router.post("/vendors/{vendor_id}/test", response_model=TestConnectionResponse)
async def test_vendor_connection(
    vendor_id: str,
    admin_user_id: str = Depends(get_current_admin_user_id),
    service: IntegrationsService = Depends(get_integrations_service),
) -> TestConnectionResponse:
    """Test the connection for a vendor configuration."""
    return await service.test_vendor_connection(vendor_id)


@router.put("/vendors/{vendor_id}/set-default", response_model=VendorConfigResponse)
async def set_default_vendor(
    vendor_id: str,
    admin_user_id: str = Depends(get_current_admin_user_id),
    service: IntegrationsService = Depends(get_integrations_service),
) -> VendorConfigResponse:
    """Set a vendor as the default (email) or active (payment)."""
    return await service.set_default_vendor(vendor_id)


@router.get("/status")
async def get_integration_status(
    admin_user_id: str = Depends(get_current_admin_user_id),
    service: IntegrationsService = Depends(get_integrations_service),
) -> dict:
    """Get an overview of integration status across all categories."""
    email_vendors = await service.list_vendors("email")
    payment_vendors = await service.list_vendors("payment")

    email_default = next((v for v in email_vendors if v.is_default), None)
    payment_active = next((v for v in payment_vendors if v.is_active_payment), None)

    return {
        "email": {
            "configured_count": len(email_vendors),
            "default_vendor": email_default.display_name if email_default else None,
            "has_default": email_default is not None,
        },
        "payment": {
            "configured_count": len(payment_vendors),
            "active_vendor": payment_active.display_name if payment_active else None,
            "has_active": payment_active is not None,
        },
    }


@router.get("/vendors/{vendor_id}/config")
async def get_vendor_config_masked(
    vendor_id: str,
    admin_user_id: str = Depends(get_current_admin_user_id),
    service: IntegrationsService = Depends(get_integrations_service),
) -> dict:
    """Get vendor config with sensitive values masked for editing."""
    return await service.get_vendor_config_masked(vendor_id)
