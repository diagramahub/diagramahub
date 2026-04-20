"""
Business logic layer for vendor integrations.
"""
import logging
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status

from .repository import IntegrationsRepository
from .schemas import (
    VendorCategory,
    VendorConfigCreate,
    VendorConfigInDB,
    VendorConfigResponse,
    VendorConfigUpdate,
    TestConnectionResponse,
)
from .vendor_factory import VendorFactory

logger = logging.getLogger(__name__)

# Required configuration fields per vendor type
REQUIRED_FIELDS: dict[str, list[str]] = {
    "resend": ["api_key", "from_email"],
    "stripe": ["secret_key", "publishable_key", "webhook_secret"],
    "google": ["client_id", "client_secret", "redirect_uri"],
}


class IntegrationsService:
    """Service for vendor integration business logic."""

    def __init__(self, repository: IntegrationsRepository):
        self.repository = repository

    # ── helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _validate_required_fields(vendor_type: str, config: dict) -> None:
        """Raise 422 if any required field for *vendor_type* is missing or empty."""
        required = REQUIRED_FIELDS.get(vendor_type)
        if required is None:
            return  # unknown vendor type – skip field validation
        missing = [f for f in required if not config.get(f)]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Missing required fields for {vendor_type}: {', '.join(missing)}",
            )

    @staticmethod
    def _to_response(vendor: VendorConfigInDB, config_keys: list[str]) -> VendorConfigResponse:
        """Map a DB document to the public response schema."""
        return VendorConfigResponse(
            id=str(vendor.id),
            vendor_type=vendor.vendor_type,
            category=vendor.category.value,
            display_name=vendor.display_name,
            is_configured=vendor.is_configured,
            is_default=vendor.is_default,
            is_active_payment=vendor.is_active_payment,
            is_active_oauth=vendor.is_active_oauth,
            connection_tested=vendor.connection_tested,
            last_test_at=vendor.last_test_at,
            last_test_success=vendor.last_test_success,
            config_fields=config_keys,
            created_at=vendor.created_at,
        )

    # ── public API ───────────────────────────────────────────────────

    async def list_vendors(
        self, category: Optional[str] = None
    ) -> list[VendorConfigResponse]:
        """List vendor configs, optionally filtered by category.

        Returns ``VendorConfigResponse`` objects whose ``config_fields``
        contain only the *names* of the stored configuration keys (no
        values).
        """
        if category:
            cat = VendorCategory(category)
            vendors = await self.repository.list_by_category(cat)
        else:
            email_vendors = await self.repository.list_by_category(VendorCategory.EMAIL)
            payment_vendors = await self.repository.list_by_category(VendorCategory.PAYMENT)
            oauth_vendors = await self.repository.list_by_category(VendorCategory.OAUTH)
            vendors = email_vendors + payment_vendors + oauth_vendors

        results: list[VendorConfigResponse] = []
        for v in vendors:
            config = self.repository._decrypt_config(v.encrypted_config)
            results.append(self._to_response(v, list(config.keys())))
        return results

    async def save_vendor_config(
        self, vendor_data: VendorConfigCreate, user_id: str
    ) -> VendorConfigResponse:
        """Create a new vendor configuration.

        Validates required fields for the vendor type before persisting.
        If this is the first vendor in its category, it is automatically
        set as the default (email) or active (payment).
        """
        self._validate_required_fields(vendor_data.vendor_type, vendor_data.config)

        # Check if there are existing vendors in this category
        existing = await self.repository.list_by_category(vendor_data.category)

        vendor = await self.repository.create(vendor_data, created_by=user_id)

        # Auto-set as default/active if it's the first in its category
        if len(existing) == 0:
            if vendor_data.category == VendorCategory.EMAIL:
                await self.repository.set_default_email(str(vendor.id))
            elif vendor_data.category == VendorCategory.PAYMENT:
                await self.repository.set_active_payment(str(vendor.id))
            elif vendor_data.category == VendorCategory.OAUTH:
                await self._set_active_oauth(str(vendor.id), vendor_data.vendor_type)
            # Refresh vendor from DB to get updated flags
            vendor = await self.repository.get_by_id(str(vendor.id))

        return self._to_response(vendor, list(vendor_data.config.keys()))

    async def update_vendor_config(
        self, vendor_id: str, update_data: VendorConfigUpdate
    ) -> VendorConfigResponse:
        """Update an existing vendor configuration.

        If ``config`` is provided, required-field validation is performed
        against the *merged* result of old + new config values.
        """
        vendor = await self.repository.get_by_id(vendor_id)
        if vendor is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor configuration not found",
            )

        # When new config fields are supplied, validate the merged config
        if update_data.config is not None:
            existing_config = self.repository._decrypt_config(vendor.encrypted_config)
            merged = {**existing_config, **update_data.config}
            self._validate_required_fields(vendor.vendor_type, merged)

        updated = await self.repository.update(vendor_id, update_data)
        if updated is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor configuration not found",
            )

        config = self.repository._decrypt_config(updated.encrypted_config)
        return self._to_response(updated, list(config.keys()))

    async def delete_vendor_config(self, vendor_id: str) -> bool:
        """Delete a vendor configuration by ID."""
        deleted = await self.repository.delete(vendor_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor configuration not found",
            )
        return True

    async def test_vendor_connection(self, vendor_id: str) -> TestConnectionResponse:
        """Instantiate the vendor via VendorFactory, call its test method,
        and persist the result in the DB."""
        result = await self.repository.get_by_id_decrypted(vendor_id)
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor configuration not found",
            )

        vendor, config = result
        logger.info(
            "test_vendor_connection: vendor_id=%s, type=%s, category=%s, config_keys=%s",
            vendor_id, vendor.vendor_type, vendor.category, list(config.keys()),
        )

        try:
            if vendor.category == VendorCategory.EMAIL:
                adapter = VendorFactory.create_email_vendor(vendor.vendor_type, config)
                logger.info("test_vendor_connection: adapter created, calling test_connection()")
                success = await adapter.test_connection()
                logger.info("test_vendor_connection: test_connection returned %s", success)
            elif vendor.category == VendorCategory.PAYMENT:
                adapter = VendorFactory.create_payment_vendor(vendor.vendor_type, config)
                logger.info("test_vendor_connection: payment adapter created, calling validate_configuration()")
                success = await adapter.validate_configuration()
            elif vendor.category == VendorCategory.OAUTH:
                from app.api.v1.oauth.providers.factory import OAuthProviderFactory

                oauth_adapter = OAuthProviderFactory.create(vendor.vendor_type, config)
                logger.info(
                    "test_vendor_connection: OAuth adapter created, calling test_connection()"
                )
                success = await oauth_adapter.test_connection()
                logger.info("test_vendor_connection: test_connection returned %s", success)
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unknown vendor category: {vendor.category}",
                )
        except ValueError as exc:
            logger.error("test_vendor_connection: ValueError: %s", exc)
            return TestConnectionResponse(
                success=False,
                message="Unsupported vendor type",
                error_detail=str(exc),
            )
        except Exception as exc:
            logger.exception("test_vendor_connection: EXCEPTION for %s", vendor_id)
            success = False
            # Persist failure
            vendor.connection_tested = True
            vendor.last_test_at = datetime.utcnow()
            vendor.last_test_success = False
            vendor.updated_at = datetime.utcnow()
            await vendor.save()
            return TestConnectionResponse(
                success=False,
                message=f"Connection test failed for {vendor.vendor_type}",
                error_detail=str(exc),
            )

        # Persist test result
        vendor.connection_tested = True
        vendor.last_test_at = datetime.utcnow()
        vendor.last_test_success = success
        vendor.updated_at = datetime.utcnow()
        await vendor.save()

        if success:
            return TestConnectionResponse(
                success=True,
                message=f"Connection to {vendor.vendor_type} successful",
            )
        return TestConnectionResponse(
            success=False,
            message=f"Connection test failed for {vendor.vendor_type}",
        )

    async def set_default_vendor(self, vendor_id: str) -> VendorConfigResponse:
        """Set a vendor as the default (email) or active (payment).

        The vendor must have passed a successful connection test first.
        """
        vendor = await self.repository.get_by_id(vendor_id)
        if vendor is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor configuration not found",
            )

        # Guard: must have a successful connection test
        if not vendor.connection_tested or not vendor.last_test_success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El vendor debe probarse exitosamente primero",
            )

        if vendor.category == VendorCategory.EMAIL:
            updated = await self.repository.set_default_email(vendor_id)
        elif vendor.category == VendorCategory.PAYMENT:
            updated = await self.repository.set_active_payment(vendor_id)
        elif vendor.category == VendorCategory.OAUTH:
            updated = await self._set_active_oauth(vendor_id, vendor.vendor_type)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown vendor category: {vendor.category}",
            )

        if updated is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor configuration not found",
            )

        config = self.repository._decrypt_config(updated.encrypted_config)
        return self._to_response(updated, list(config.keys()))

    async def _set_active_oauth(self, vendor_id: str, vendor_type: str) -> VendorConfigInDB:
        """Activate an OAuth vendor, ensuring mutual exclusion per vendor_type.

        Deactivates all other OAuth vendors of the same ``vendor_type``
        before activating the requested one.
        """
        # Deactivate all OAuth vendors of the same vendor_type
        oauth_vendors = await self.repository.list_by_category(VendorCategory.OAUTH)
        for v in oauth_vendors:
            if v.vendor_type == vendor_type and v.is_active_oauth:
                v.is_active_oauth = False
                v.updated_at = datetime.utcnow()
                await v.save()

        # Activate the requested vendor
        vendor = await self.repository.get_by_id(vendor_id)
        if vendor is None:
            return None
        vendor.is_active_oauth = True
        vendor.updated_at = datetime.utcnow()
        await vendor.save()
        return vendor

    # ── sensitive fields that should be masked ───────────────────────
    SENSITIVE_FIELDS = {
        "api_key", "secret_key", "webhook_secret", "publishable_key", "client_secret",
    }

    async def get_vendor_config_masked(self, vendor_id: str) -> dict:
        """Return vendor config with sensitive values masked.

        Non-sensitive fields (like from_email) are returned in full.
        Sensitive fields show only the last 4 characters.
        """
        result = await self.repository.get_by_id_decrypted(vendor_id)
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor configuration not found",
            )
        vendor, config = result
        masked: dict[str, str] = {}
        for key, value in config.items():
            if key in self.SENSITIVE_FIELDS and len(value) > 4:
                masked[key] = "•" * 12 + value[-4:]
            else:
                masked[key] = value
        return {"vendor_id": str(vendor.id), "config": masked}
