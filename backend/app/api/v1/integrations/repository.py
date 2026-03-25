"""
MongoDB repository implementation for vendor integrations using Beanie.
"""
import json
from datetime import datetime
from typing import Optional

from beanie import PydanticObjectId

from app.api.v1.integrations.schemas import (
    VendorCategory,
    VendorConfigCreate,
    VendorConfigInDB,
    VendorConfigUpdate,
)
from app.core.security import decrypt_api_key, encrypt_api_key


class IntegrationsRepository:
    """MongoDB implementation of integrations repository using Beanie."""

    # ── helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _encrypt_config(config: dict) -> str:
        """Serialize a config dict to JSON and encrypt it with Fernet."""
        return encrypt_api_key(json.dumps(config))

    @staticmethod
    def _decrypt_config(encrypted_config: str) -> dict:
        """Decrypt a Fernet-encrypted string and deserialize it to a dict."""
        return json.loads(decrypt_api_key(encrypted_config))

    # ── CRUD ─────────────────────────────────────────────────────────

    async def create(
        self, vendor_data: VendorConfigCreate, created_by: str
    ) -> VendorConfigInDB:
        """Create a new vendor configuration with encrypted credentials."""
        vendor = VendorConfigInDB(
            vendor_type=vendor_data.vendor_type,
            category=vendor_data.category,
            display_name=vendor_data.display_name,
            encrypted_config=self._encrypt_config(vendor_data.config),
            is_configured=True,
            created_by=created_by,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        await vendor.insert()
        return vendor

    async def list_by_category(
        self, category: VendorCategory
    ) -> list[VendorConfigInDB]:
        """Return all vendor configs that belong to *category*."""
        return await VendorConfigInDB.find(
            VendorConfigInDB.category == category
        ).to_list()

    async def get_by_id(self, vendor_id: str) -> Optional[VendorConfigInDB]:
        """Return a single vendor config by its ID, or ``None``."""
        return await VendorConfigInDB.get(PydanticObjectId(vendor_id))

    async def get_by_id_decrypted(
        self, vendor_id: str
    ) -> Optional[tuple[VendorConfigInDB, dict]]:
        """Return a vendor config together with its decrypted config dict.

        Returns ``None`` when the vendor is not found.
        """
        vendor = await self.get_by_id(vendor_id)
        if vendor is None:
            return None
        config = self._decrypt_config(vendor.encrypted_config)
        return vendor, config

    async def update(
        self, vendor_id: str, update_data: VendorConfigUpdate
    ) -> Optional[VendorConfigInDB]:
        """Update an existing vendor configuration.

        Only the fields present in *update_data* are changed.  When
        ``config`` is provided it is re-encrypted before storage.
        """
        vendor = await self.get_by_id(vendor_id)
        if vendor is None:
            return None

        if update_data.display_name is not None:
            vendor.display_name = update_data.display_name

        if update_data.config is not None:
            vendor.encrypted_config = self._encrypt_config(update_data.config)

        vendor.updated_at = datetime.utcnow()
        await vendor.save()
        return vendor

    async def delete(self, vendor_id: str) -> bool:
        """Delete a vendor configuration.  Returns ``True`` on success."""
        vendor = await self.get_by_id(vendor_id)
        if vendor is None:
            return False
        await vendor.delete()
        return True

    # ── default / active helpers ─────────────────────────────────────

    async def set_default_email(self, vendor_id: str) -> Optional[VendorConfigInDB]:
        """Mark *vendor_id* as the default email vendor.

        All other email vendors have ``is_default`` cleared first
        (mutual exclusion).
        """
        vendor = await self.get_by_id(vendor_id)
        if vendor is None or vendor.category != VendorCategory.EMAIL:
            return None

        # Unset current defaults
        current_defaults = await VendorConfigInDB.find(
            VendorConfigInDB.category == VendorCategory.EMAIL,
            VendorConfigInDB.is_default == True,  # noqa: E712
        ).to_list()

        for v in current_defaults:
            v.is_default = False
            v.updated_at = datetime.utcnow()
            await v.save()

        # Set the new default
        vendor.is_default = True
        vendor.updated_at = datetime.utcnow()
        await vendor.save()
        return vendor

    async def set_active_payment(
        self, vendor_id: str
    ) -> Optional[VendorConfigInDB]:
        """Mark *vendor_id* as the active payment vendor.

        All other payment vendors have ``is_active_payment`` cleared first
        (mutual exclusion).
        """
        vendor = await self.get_by_id(vendor_id)
        if vendor is None or vendor.category != VendorCategory.PAYMENT:
            return None

        # Unset current active payment vendors
        current_active = await VendorConfigInDB.find(
            VendorConfigInDB.category == VendorCategory.PAYMENT,
            VendorConfigInDB.is_active_payment == True,  # noqa: E712
        ).to_list()

        for v in current_active:
            v.is_active_payment = False
            v.updated_at = datetime.utcnow()
            await v.save()

        # Set the new active payment vendor
        vendor.is_active_payment = True
        vendor.updated_at = datetime.utcnow()
        await vendor.save()
        return vendor
