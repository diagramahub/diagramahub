"""
Pydantic schemas and Beanie documents for the integrations module.
"""
from datetime import datetime
from enum import Enum
from typing import Optional

from beanie import Document
from pydantic import BaseModel, Field


class VendorCategory(str, Enum):
    """Categories of vendor integrations."""
    EMAIL = "email"
    PAYMENT = "payment"


class VendorConfigInDB(Document):
    """Vendor configuration stored in MongoDB with encrypted credentials."""
    vendor_type: str  # "resend", "stripe", "ses", etc.
    category: VendorCategory
    display_name: str

    # Configuration encrypted as JSON string with Fernet
    encrypted_config: str

    # Status
    is_configured: bool = False
    is_default: bool = False  # For email: Motor_Default_de_Email
    is_active_payment: bool = False  # For payments: Pasarela_Activa_de_Pagos
    connection_tested: bool = False
    last_test_at: Optional[datetime] = None
    last_test_success: bool = False

    # Metadata
    created_by: str  # user_id of the admin
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "vendor_configs"
        indexes = ["vendor_type", "category", "is_default", "is_active_payment"]


class VendorConfigCreate(BaseModel):
    """Schema for creating a new vendor configuration."""
    vendor_type: str
    category: VendorCategory
    display_name: str
    config: dict  # Vendor-specific fields (encrypted before storage)


class VendorConfigUpdate(BaseModel):
    """Schema for updating an existing vendor configuration."""
    display_name: Optional[str] = None
    config: Optional[dict] = None


class VendorConfigResponse(BaseModel):
    """Schema for vendor configuration response (no sensitive data)."""
    id: str
    vendor_type: str
    category: str
    display_name: str
    is_configured: bool
    is_default: bool
    is_active_payment: bool
    connection_tested: bool
    last_test_at: Optional[datetime] = None
    last_test_success: bool
    config_fields: list[str]  # Only field names, no values
    created_at: datetime


class TestConnectionResponse(BaseModel):
    """Schema for vendor connection test result."""
    success: bool
    message: str
    error_detail: Optional[str] = None
