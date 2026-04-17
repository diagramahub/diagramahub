"""
TOTP (Time-based One-Time Password) service for MFA.

Encapsulates pyotp logic for generating secrets, QR codes, and verifying TOTP codes
according to RFC 6238.
"""
import base64
import io

import pyotp
import qrcode


class TotpService:
    """Service for TOTP generation and verification.

    All methods are static since no instance state is required.
    """

    @staticmethod
    def generate_secret() -> str:
        """Generate a random base32-encoded TOTP secret.

        Returns:
            A base32 string suitable for use with authenticator apps.
        """
        return pyotp.random_base32()

    @staticmethod
    def generate_qr_uri(
        secret: str, email: str, issuer: str = "Diagramahub"
    ) -> str:
        """Generate an ``otpauth://`` URI for QR code scanning.

        Args:
            secret: Base32-encoded TOTP secret.
            email: User email address (used as the account name).
            issuer: Issuer name displayed in the authenticator app.

        Returns:
            An ``otpauth://totp/...`` URI string.
        """
        totp = pyotp.totp.TOTP(secret)
        return totp.provisioning_uri(name=email, issuer_name=issuer)

    @staticmethod
    def generate_qr_base64(uri: str) -> str:
        """Generate a QR code image from a URI and return it as a base64-encoded PNG.

        Args:
            uri: The ``otpauth://`` URI to encode in the QR image.

        Returns:
            Base64-encoded PNG image string.
        """
        img = qrcode.make(uri)
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        return base64.b64encode(buffer.getvalue()).decode("utf-8")

    @staticmethod
    def verify_code(secret: str, code: str) -> bool:
        """Validate a TOTP code against a secret with a ±1 step window (30s).

        Args:
            secret: Base32-encoded TOTP secret.
            code: The 6-digit TOTP code to verify.

        Returns:
            ``True`` if the code is valid within the time window, ``False`` otherwise.
        """
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=1)
