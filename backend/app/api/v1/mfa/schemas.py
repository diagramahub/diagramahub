"""
Pydantic schemas for the MFA (Multi-Factor Authentication) module.
"""
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# --- Allowed MFA methods ---

ALLOWED_MFA_METHODS = {"email", "totp"}


def _validate_mfa_method(v: str) -> str:
    """Validate that the MFA method is one of the allowed values."""
    if v not in ALLOWED_MFA_METHODS:
        raise ValueError(f"Method must be one of: {', '.join(sorted(ALLOWED_MFA_METHODS))}")
    return v


class MfaEnableEmailRequest(BaseModel):
    """Request to initiate MFA email activation.

    Empty body — uses the authenticated user's registered email address.
    """

    pass


class MfaVerifyEmailActivationRequest(BaseModel):
    """Request to confirm MFA email activation with the verification code."""

    code: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")

    @field_validator("code")
    @classmethod
    def validate_code_digits(cls, v: str) -> str:
        """Ensure the code contains only digits."""
        if not v.isdigit():
            raise ValueError("Code must contain only digits")
        return v


class MfaSetupTotpResponse(BaseModel):
    """Response containing TOTP setup data (QR code and secret key)."""

    qr_code_base64: str = Field(..., description="QR code image encoded in base64")
    secret_key: str = Field(..., description="TOTP secret key in plain text for manual entry")


class MfaEnableTotpRequest(BaseModel):
    """Request to activate TOTP MFA with a verification code from the authenticator app."""

    code: str = Field(..., min_length=6, max_length=6, description="6-digit TOTP verification code")
    set_as_default: bool = Field(
        default=True, description="Whether to set TOTP as the default MFA method"
    )

    @field_validator("code")
    @classmethod
    def validate_code_digits(cls, v: str) -> str:
        """Ensure the code contains only digits."""
        if not v.isdigit():
            raise ValueError("Code must contain only digits")
        return v


class MfaDisableRequest(BaseModel):
    """Request to disable a specific MFA method. Requires password confirmation."""

    password: str = Field(..., description="Current account password for confirmation")
    method: str = Field(..., description="MFA method to disable: 'email' or 'totp'")

    @field_validator("method")
    @classmethod
    def validate_method(cls, v: str) -> str:
        """Ensure the method is a valid MFA method."""
        return _validate_mfa_method(v)


class MfaVerifyRequest(BaseModel):
    """Request to verify an MFA code during the login flow."""

    mfa_token: str = Field(..., description="Temporary MFA token from the login step")
    code: str = Field(..., description="MFA verification code or recovery code")
    method: Optional[str] = Field(
        default=None, description="MFA method used: 'email' or 'totp' (optional)"
    )
    is_recovery_code: bool = Field(
        default=False, description="Whether the code is a recovery code"
    )

    @field_validator("method")
    @classmethod
    def validate_method(cls, v: Optional[str]) -> Optional[str]:
        """Ensure the method, if provided, is a valid MFA method."""
        if v is not None:
            return _validate_mfa_method(v)
        return v


class MfaStatusResponse(BaseModel):
    """Response containing the current MFA status for a user."""

    enabled: bool = Field(..., description="Whether MFA is enabled for the account")
    methods: list[str] = Field(..., description="List of active MFA methods")
    default_method: Optional[str] = Field(
        default=None, description="The default MFA method, if any"
    )
    recovery_codes_remaining: int = Field(
        ..., description="Number of unused recovery codes remaining"
    )


class MfaLoginResponse(BaseModel):
    """Response returned during login when MFA verification is required."""

    mfa_required: bool = Field(default=True, description="Indicates MFA verification is needed")
    mfa_token: str = Field(..., description="Temporary token for the MFA verification step")
    mfa_default_method: str = Field(..., description="The user's default MFA method")
    available_methods: list[str] = Field(
        ..., description="All active MFA methods available for verification"
    )


class RecoveryCodesResponse(BaseModel):
    """Response containing newly generated recovery codes. Only shown once during generation."""

    codes: list[str] = Field(..., description="List of recovery codes in XXXXX-XXXXX format")


class MfaResendRequest(BaseModel):
    """Request to resend the email MFA verification code."""

    mfa_token: str = Field(..., description="Temporary MFA token from the login step")


class MfaResendResponse(BaseModel):
    """Response after resending an email MFA code."""

    message: str = Field(..., description="Confirmation message")
    resends_remaining: int = Field(..., description="Number of resends remaining for this session")


class MfaSwitchMethodRequest(BaseModel):
    """Request to switch to an alternative MFA method during login verification."""

    mfa_token: str = Field(..., description="Temporary MFA token from the login step")
    method: str = Field(..., description="MFA method to switch to: 'email' or 'totp'")

    @field_validator("method")
    @classmethod
    def validate_method(cls, v: str) -> str:
        """Ensure the method is a valid MFA method."""
        return _validate_mfa_method(v)


class MfaSetDefaultMethodRequest(BaseModel):
    """Request to change the default MFA method."""

    method: str = Field(..., description="MFA method to set as default: 'email' or 'totp'")

    @field_validator("method")
    @classmethod
    def validate_method(cls, v: str) -> str:
        """Ensure the method is a valid MFA method."""
        return _validate_mfa_method(v)
