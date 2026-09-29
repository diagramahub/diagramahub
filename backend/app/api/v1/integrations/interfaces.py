"""
Abstract interface for vendor integration repositories.
Follows the Dependency Inversion Principle (SOLID).
"""

from abc import ABC, abstractmethod
from typing import Optional

from .schemas import (
    VendorCategory,
    VendorConfigCreate,
    VendorConfigInDB,
    VendorConfigUpdate,
)


class IIntegrationsRepository(ABC):
    """Abstract interface for vendor integration data access."""

    # ── CRUD ─────────────────────────────────────────────────────────

    @abstractmethod
    async def create(self, vendor_data: VendorConfigCreate, created_by: str) -> VendorConfigInDB:
        """Create a new vendor configuration with encrypted credentials."""
        pass

    @abstractmethod
    async def list_by_category(self, category: VendorCategory) -> list[VendorConfigInDB]:
        """Return all vendor configs that belong to *category*."""
        pass

    @abstractmethod
    async def get_by_id(self, vendor_id: str) -> Optional[VendorConfigInDB]:
        """Return a single vendor config by its ID, or ``None``."""
        pass

    @abstractmethod
    async def get_by_id_decrypted(self, vendor_id: str) -> Optional[tuple[VendorConfigInDB, dict]]:
        """Return a vendor config together with its decrypted config dict."""
        pass

    @abstractmethod
    async def update(
        self, vendor_id: str, update_data: VendorConfigUpdate
    ) -> Optional[VendorConfigInDB]:
        """Update an existing vendor configuration."""
        pass

    @abstractmethod
    async def delete(self, vendor_id: str) -> bool:
        """Delete a vendor configuration.  Returns ``True`` on success."""
        pass

    # ── default / active helpers ─────────────────────────────────────

    @abstractmethod
    async def set_default_email(self, vendor_id: str) -> Optional[VendorConfigInDB]:
        """Mark *vendor_id* as the default email vendor."""
        pass

    @abstractmethod
    async def set_active_payment(self, vendor_id: str) -> Optional[VendorConfigInDB]:
        """Mark *vendor_id* as the active payment vendor."""
        pass

    @abstractmethod
    async def set_active_oauth(self, provider: str, vendor_id: str) -> Optional[VendorConfigInDB]:
        """Activate *vendor_id* for OAuth *provider* (mutual exclusion per provider)."""
        pass

    @abstractmethod
    async def record_test_result(self, vendor_id: str, result: bool) -> Optional[VendorConfigInDB]:
        """Persist the outcome of a connection test for *vendor_id*."""
        pass

    # ── public config accessors (decrypted) ──────────────────────────

    @abstractmethod
    async def get_active_email_vendor_config(
        self,
    ) -> Optional[tuple[VendorConfigInDB, dict]]:
        """Return the default email vendor with its decrypted config, or None."""
        pass

    @abstractmethod
    async def get_active_payment_config(
        self,
    ) -> Optional[tuple[VendorConfigInDB, dict]]:
        """Return the active payment vendor with its decrypted config, or None."""
        pass

    @abstractmethod
    async def get_active_oauth_config(
        self, provider: str
    ) -> Optional[tuple[VendorConfigInDB, dict]]:
        """Return the active OAuth vendor of *provider* with decrypted config."""
        pass
