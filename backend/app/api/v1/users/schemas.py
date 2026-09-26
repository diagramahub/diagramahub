"""
Pydantic schemas for user-related data validation.
"""
from datetime import datetime
from enum import Enum
from typing import Optional

from beanie import Document
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


# Set of allowed special characters for password policy
_SPECIAL_CHARACTERS = set("!@#$%^&*()_+-=[]{}|;:',.<>?/~")


def _validate_password_strength(password: str) -> str:
    """Validate password strength against the security policy.

    Checks: min 12 chars, max 128 chars, at least one uppercase,
    one lowercase, one digit, and one special character.
    Does NOT check email comparison — that is handled by model validators.
    """
    if len(password) < 12:
        raise ValueError("Password must be at least 12 characters long")
    if len(password) > 128:
        raise ValueError("Password must be at most 128 characters long")
    if not any(char.isupper() for char in password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not any(char.islower() for char in password):
        raise ValueError("Password must contain at least one lowercase letter")
    if not any(char.isdigit() for char in password):
        raise ValueError("Password must contain at least one digit")
    if not any(char in _SPECIAL_CHARACTERS for char in password):
        raise ValueError(
            "Password must contain at least one special character "
            "(!@#$%^&*()_+-=[]{}|;:',.<>?/~)"
        )
    return password


class UserRole(str, Enum):
    """User role enumeration."""
    ADMIN = "admin"
    USER = "user"


class UserBase(BaseModel):
    """Base user schema with common attributes."""
    email: EmailStr
    full_name: Optional[str] = None
    is_active: bool = True
    profile_picture: Optional[str] = None  # Base64 encoded image
    timezone: Optional[str] = 'UTC'  # User's preferred timezone
    role: UserRole = UserRole.USER  # User role (admin or user)


class UserCreate(UserBase):
    """Schema for user registration."""
    password: str = Field(..., min_length=12, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password strength."""
        return _validate_password_strength(v)

    @model_validator(mode="after")
    def validate_password_not_email(self) -> "UserCreate":
        """Ensure password is not equal to the user's email (case-insensitive)."""
        if self.password.lower() == self.email.lower():
            raise ValueError("Password cannot be the same as your email address")
        return self


class UserUpdate(BaseModel):
    """Schema for updating user information."""
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    profile_picture: Optional[str] = None  # Base64 encoded image
    timezone: Optional[str] = None  # User's preferred timezone


class RecoveryCodeEntry(BaseModel):
    """Model for a hashed MFA recovery code."""
    hash: str
    used: bool = False


class OAuthProviderEntry(BaseModel):
    """Linked OAuth provider identity."""
    provider: str  # e.g., "google", "github"
    provider_user_id: str  # Provider's unique user ID
    linked_at: datetime = Field(default_factory=datetime.utcnow)


class UserInDB(Document):
    """User model for database storage using Beanie."""
    email: EmailStr
    hashed_password: str
    full_name: Optional[str] = None
    profile_picture: Optional[str] = None  # Base64 encoded image
    timezone: str = 'UTC'  # User's preferred timezone (default UTC)
    role: UserRole = UserRole.USER  # User role (admin or user)
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login_at: Optional[datetime] = None

    # Password reset fields
    reset_token: Optional[str] = None
    reset_token_expires: Optional[float] = None

    # Session invalidation: updated on every password change
    password_changed_at: Optional[float] = None

    # True when the user has set a password they can actually use to sign in.
    # OAuth-only accounts are created with a random placeholder hash nobody
    # knows, so they must never be asked to confirm a "current password".
    password_set_by_user: bool = False

    # MFA fields (all with defaults for backward compatibility)
    mfa_enabled: bool = False
    mfa_methods: list[str] = []  # ["email", "totp"] — active methods
    mfa_default_method: Optional[str] = None  # "email" | "totp" | None
    totp_secret_encrypted: Optional[str] = None  # Encrypted with Fernet
    recovery_codes: list[RecoveryCodeEntry] = []  # Hashed recovery codes
    email_mfa_code_hash: Optional[str] = None
    email_mfa_code_expires: Optional[float] = None
    mfa_temp_resend_count: int = 0
    mfa_temp_last_resend: Optional[float] = None

    # OAuth linked providers
    oauth_providers: list[OAuthProviderEntry] = []

    class Settings:
        name = "users"
        indexes = [
            # NOTE: non-unique on purpose. Making this unique is a breaking upgrade:
            # existing deployments already have an index named email_1 and Beanie
            # cannot replace it (IndexKeySpecsConflict fails startup). It needs a
            # migration that drops the old index -- tracked for 0.7.0.
            "email",
        ]

    @property
    def is_oauth_only(self) -> bool:
        """True when the account signs in with OAuth and has no user-set password.

        Documents created before ``password_set_by_user`` existed are detected
        through the OAuth link plus the absence of a password change: their
        stored hash is a placeholder nobody knows. The worst outcome of a wrong
        answer is that an account is pointed at the reset flow instead of typing
        its password -- verification is enforced server-side either way.
        """
        return (
            not self.password_set_by_user
            and bool(self.oauth_providers)
            and self.password_changed_at is None
        )


class UserResponse(BaseModel):
    """Schema for user response (excludes sensitive data)."""
    id: str
    email: EmailStr
    full_name: Optional[str] = None
    profile_picture: Optional[str] = None  # Base64 encoded image
    timezone: str = 'UTC'  # User's preferred timezone
    role: UserRole = UserRole.USER  # User role (admin or user)
    is_active: bool
    created_at: datetime
    subscription: Optional[dict] = None  # Subscription info for premium badge
    oauth_providers: list[OAuthProviderEntry] = []  # Linked OAuth identities
    # False for OAuth-only accounts, which have no password to confirm. Drives
    # the profile UI: show the change form only when this is True.
    can_change_password: bool = True


class Token(BaseModel):
    """Schema for JWT token response."""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Schema for decoded token data."""
    email: Optional[str] = None


class LoginRequest(BaseModel):
    """Schema for login request."""
    email: EmailStr
    password: str


class SimplifiedChangePasswordRequest(BaseModel):
    """Schema for authenticated password change.

    ``current_password`` is required for accounts that have a user-set password.
    OAuth-only accounts have nothing to confirm against, so the service rejects
    them and points at the password reset flow instead.
    """
    current_password: Optional[str] = Field(
        default=None,
        max_length=128,
        description="Current password. Required unless the account signs in with OAuth.",
    )
    new_password: str = Field(..., min_length=12, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password strength."""
        return _validate_password_strength(v)


class ResetPasswordRequest(BaseModel):
    """Schema for password reset request."""
    email: EmailStr


class ResetPasswordConfirm(BaseModel):
    """Schema for password reset confirmation."""
    email: EmailStr
    token: str
    new_password: str = Field(..., min_length=12, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password strength."""
        return _validate_password_strength(v)

    @model_validator(mode="after")
    def validate_password_not_email(self) -> "ResetPasswordConfirm":
        """Ensure password is not equal to the user's email (case-insensitive)."""
        if self.new_password.lower() == self.email.lower():
            raise ValueError("Password cannot be the same as your email address")
        return self


class DeleteAccountRequest(BaseModel):
    """Schema for account deletion request. Requires a confirmation phrase."""
    confirmation_phrase: str
