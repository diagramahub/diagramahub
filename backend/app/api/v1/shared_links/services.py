"""
Business logic layer for shared links.
"""
import hashlib
import secrets
import string
from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException, status

from app.core.config import settings
from app.core.security import pwd_context

from ..diagrams.interfaces import IDiagramRepository
from .interfaces import ISharedLinkRepository
from .schemas import (
    AccessLogCreate,
    CreateSharedLinkRequest,
    SharedDiagramResponse,
    SharedLinkCreate,
    SharedLinkInfoResponse,
    SharedLinkResponse,
    SharedLinkUpdate,
    UpdateSharedLinkRequest,
    VerifyAccessCodeRequest,
)

# Constants for brute-force protection
MAX_FAILED_ATTEMPTS = 5
FAILED_ATTEMPTS_WINDOW_MINUTES = 15

# Valid expiration day options
VALID_EXPIRATION_DAYS = {5, 10, 30}


def _hash_access_code(code: str) -> str:
    """Hash an access code using bcrypt via passlib."""
    return pwd_context.hash(code)


def _verify_access_code(plain_code: str, hashed_code: str) -> bool:
    """Verify a plain access code against its bcrypt hash."""
    return pwd_context.verify(plain_code, hashed_code)


def _generate_token() -> str:
    """Generate a cryptographically secure URL-safe token."""
    return secrets.token_urlsafe(32)


def _generate_access_code(length: int = 6) -> str:
    """Generate a random alphanumeric access code."""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _calculate_expiration(expiration_days: Optional[int]) -> Optional[datetime]:
    """Calculate expiration datetime from days. Returns None for unlimited."""
    if expiration_days is None:
        return None
    return datetime.utcnow() + timedelta(days=expiration_days)


def _anonymize_ip(ip: str) -> str:
    """Anonymize an IP address using SHA-256."""
    return hashlib.sha256(ip.encode()).hexdigest()


def _build_share_url(token: str) -> str:
    """Build the full share URL for a token."""
    base_url = settings.FRONTEND_URL.rstrip("/")
    return f"{base_url}/shared/{token}"


class SharedLinkService:
    """Service for shared link business logic."""

    def __init__(
        self,
        shared_link_repository: ISharedLinkRepository,
        diagram_repository: IDiagramRepository,
    ):
        self.shared_link_repository = shared_link_repository
        self.diagram_repository = diagram_repository

    async def _verify_diagram_ownership(
        self, diagram_id: str, user_id: str
    ):
        """
        Verify that the user owns the diagram (via its project).

        Returns the diagram if ownership is confirmed.

        Raises:
            HTTPException: If diagram not found or user doesn't own it.
        """
        diagram = await self.diagram_repository.get_by_id(diagram_id)
        if not diagram:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Diagrama no encontrado",
            )

        # Import here to avoid circular imports
        from beanie import PydanticObjectId
        from ..projects.schemas import ProjectInDB

        try:
            project = await ProjectInDB.get(PydanticObjectId(diagram.project_id))
        except Exception:
            project = None

        if not project or project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes acceso a este diagrama",
            )

        return diagram

    async def create_shared_link(
        self, request: CreateSharedLinkRequest, user_id: str
    ) -> SharedLinkResponse:
        """
        Create a new shared link for a diagram.

        Validates ownership, generates token, hashes access code if applicable,
        and stores the link in the database.
        """
        # Verify ownership
        await self._verify_diagram_ownership(request.diagram_id, user_id)

        # Revoke any existing active link for this diagram
        existing = await self.shared_link_repository.get_active_by_diagram(
            request.diagram_id
        )
        if existing:
            await self.shared_link_repository.revoke(str(existing.id))

        # Generate token
        token = _generate_token()

        # Handle access code
        access_code_hash: Optional[str] = None
        generated_code: Optional[str] = None

        if request.access_type == "protected":
            if request.access_code:
                access_code_hash = _hash_access_code(request.access_code)
                generated_code = request.access_code
            else:
                generated_code = _generate_access_code()
                access_code_hash = _hash_access_code(generated_code)

        # Calculate expiration
        expires_at = _calculate_expiration(request.expiration_days)

        # Create the link
        link_data = SharedLinkCreate(
            diagram_id=request.diagram_id,
            user_id=user_id,
            token=token,
            access_type=request.access_type,
            access_code_hash=access_code_hash,
            allow_copy_code=request.allow_copy_code,
            expires_at=expires_at,
        )

        link = await self.shared_link_repository.create(link_data)

        return SharedLinkResponse(
            id=str(link.id),
            diagram_id=link.diagram_id,
            token=link.token,
            share_url=_build_share_url(link.token),
            access_type=link.access_type,
            access_code=generated_code,
            allow_copy_code=link.allow_copy_code,
            expires_at=link.expires_at,
            is_active=link.is_active,
            created_at=link.created_at,
            updated_at=link.updated_at,
        )

    async def get_active_link(
        self, diagram_id: str, user_id: str
    ) -> Optional[SharedLinkResponse]:
        """
        Get the active shared link for a diagram, verifying ownership.

        Returns None if no active link exists.
        """
        await self._verify_diagram_ownership(diagram_id, user_id)

        link = await self.shared_link_repository.get_active_by_diagram(diagram_id)
        if not link:
            return None

        return SharedLinkResponse(
            id=str(link.id),
            diagram_id=link.diagram_id,
            token=link.token,
            share_url=_build_share_url(link.token),
            access_type=link.access_type,
            allow_copy_code=link.allow_copy_code,
            expires_at=link.expires_at,
            is_active=link.is_active,
            created_at=link.created_at,
            updated_at=link.updated_at,
        )

    async def update_shared_link(
        self, link_id: str, request: UpdateSharedLinkRequest, user_id: str
    ) -> SharedLinkResponse:
        """
        Update shared link configuration without changing the token.
        """
        # Get the existing link to verify ownership
        from .schemas import SharedLinkInDB as SharedLinkDoc
        from beanie import PydanticObjectId

        try:
            link = await SharedLinkDoc.get(PydanticObjectId(link_id))
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Enlace compartido no encontrado",
            )

        if not link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Enlace compartido no encontrado",
            )

        # Verify ownership via diagram
        await self._verify_diagram_ownership(link.diagram_id, user_id)

        # Build update data
        update_data = SharedLinkUpdate()

        if request.access_type is not None:
            update_data.access_type = request.access_type

        if request.allow_copy_code is not None:
            update_data.allow_copy_code = request.allow_copy_code

        # Handle access code update
        generated_code: Optional[str] = None
        if request.access_code is not None:
            update_data.access_code_hash = _hash_access_code(request.access_code)
            generated_code = request.access_code
        elif request.access_type == "protected" and not link.access_code_hash:
            # Switching to protected without providing a code: auto-generate
            generated_code = _generate_access_code()
            update_data.access_code_hash = _hash_access_code(generated_code)

        # Handle expiration update
        if request.expiration_days is not None:
            update_data.expires_at = _calculate_expiration(request.expiration_days)

        updated_link = await self.shared_link_repository.update(link_id, update_data)
        if not updated_link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Enlace compartido no encontrado",
            )

        return SharedLinkResponse(
            id=str(updated_link.id),
            diagram_id=updated_link.diagram_id,
            token=updated_link.token,
            share_url=_build_share_url(updated_link.token),
            access_type=updated_link.access_type,
            access_code=generated_code,
            allow_copy_code=updated_link.allow_copy_code,
            expires_at=updated_link.expires_at,
            is_active=updated_link.is_active,
            created_at=updated_link.created_at,
            updated_at=updated_link.updated_at,
        )

    async def revoke_shared_link(self, link_id: str, user_id: str) -> dict:
        """
        Revoke (deactivate) a shared link.
        """
        from .schemas import SharedLinkInDB as SharedLinkDoc
        from beanie import PydanticObjectId

        try:
            link = await SharedLinkDoc.get(PydanticObjectId(link_id))
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Enlace compartido no encontrado",
            )

        if not link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Enlace compartido no encontrado",
            )

        # Verify ownership via diagram
        await self._verify_diagram_ownership(link.diagram_id, user_id)

        success = await self.shared_link_repository.revoke(link_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al revocar el enlace",
            )

        return {"message": "Enlace revocado exitosamente"}

    async def get_link_info(self, token: str) -> SharedLinkInfoResponse:
        """
        Get public info for a shared link (no owner data exposed).
        Verifies expiration status.
        """
        link = await self.shared_link_repository.get_by_token(token)
        if not link or not link.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Enlace no encontrado",
            )

        # Check expiration
        is_expired = (
            link.expires_at is not None and link.expires_at < datetime.utcnow()
        )

        # Get diagram title
        diagram = await self.diagram_repository.get_by_id(link.diagram_id)
        if not diagram:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="El diagrama ya no está disponible",
            )

        return SharedLinkInfoResponse(
            requires_code=link.access_type == "protected",
            is_expired=is_expired,
            diagram_title=diagram.title,
        )

    async def _get_owner_display_name(self, user_id: str) -> Optional[str]:
        """Get the display name of a user by their ID."""
        from beanie import PydanticObjectId
        from ..users.schemas import UserInDB

        try:
            user = await UserInDB.get(PydanticObjectId(user_id))
            if user:
                return user.full_name or user.email.split("@")[0]
        except Exception:
            pass
        return None

    async def get_shared_diagram(
        self, token: str, client_ip: str
    ) -> SharedDiagramResponse:
        """
        Get diagram data for a public (non-protected) shared link.
        Controls content visibility based on allow_copy_code.
        """
        link = await self.shared_link_repository.get_by_token(token)
        if not link or not link.is_active:
            await self._log_access(token, client_ip, "not_found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Enlace no encontrado",
            )

        # Check expiration
        if link.expires_at is not None and link.expires_at < datetime.utcnow():
            await self._log_access(token, client_ip, "expired")
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Este enlace ha expirado",
            )

        # Public endpoint only serves public links
        if link.access_type != "public":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Este enlace requiere un código de acceso",
            )

        diagram = await self.diagram_repository.get_by_id(link.diagram_id)
        if not diagram:
            await self._log_access(token, client_ip, "not_found")
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="El diagrama ya no está disponible",
            )

        await self._log_access(token, client_ip, "success")

        owner_name = await self._get_owner_display_name(link.user_id)

        return SharedDiagramResponse(
            title=diagram.title,
            description=diagram.description or None,
            content=diagram.content if link.allow_copy_code else None,
            diagram_type=diagram.diagram_type,
            rendered_content=diagram.content,
            config=diagram.config.model_dump() if diagram.config else {},
            allow_copy_code=link.allow_copy_code,
            owner_name=owner_name,
        )

    async def verify_access_code(
        self,
        token: str,
        request: VerifyAccessCodeRequest,
        client_ip: str,
    ) -> SharedDiagramResponse:
        """
        Verify access code for a protected shared link.
        Controls brute-force attempts (max 5 in 15 min per IP+token).
        """
        ip_hash = _anonymize_ip(client_ip)

        link = await self.shared_link_repository.get_by_token(token)
        if not link or not link.is_active:
            await self._log_access(token, client_ip, "not_found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Enlace no encontrado",
            )

        # Check expiration
        if link.expires_at is not None and link.expires_at < datetime.utcnow():
            await self._log_access(token, client_ip, "expired")
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Este enlace ha expirado",
            )

        # Check brute-force protection
        failed_count = await self.shared_link_repository.count_failed_attempts(
            ip_hash, token, FAILED_ATTEMPTS_WINDOW_MINUTES
        )
        if failed_count >= MAX_FAILED_ATTEMPTS:
            await self._log_access(token, client_ip, "blocked")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiados intentos. Intenta en 15 minutos",
            )

        # Verify the code
        if not link.access_code_hash or not _verify_access_code(
            request.access_code, link.access_code_hash
        ):
            await self._log_access(token, client_ip, "invalid_code")
            remaining = MAX_FAILED_ATTEMPTS - failed_count - 1
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Código de acceso incorrecto. Intentos restantes: {remaining}",
            )

        # Code is correct — fetch diagram
        diagram = await self.diagram_repository.get_by_id(link.diagram_id)
        if not diagram:
            await self._log_access(token, client_ip, "not_found")
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="El diagrama ya no está disponible",
            )

        await self._log_access(token, client_ip, "success")

        owner_name = await self._get_owner_display_name(link.user_id)

        return SharedDiagramResponse(
            title=diagram.title,
            description=diagram.description or None,
            content=diagram.content if link.allow_copy_code else None,
            diagram_type=diagram.diagram_type,
            rendered_content=diagram.content,
            config=diagram.config.model_dump() if diagram.config else {},
            allow_copy_code=link.allow_copy_code,
            owner_name=owner_name,
        )

    async def _log_access(self, token: str, client_ip: str, result: str) -> None:
        """Log an access attempt with anonymized IP."""
        ip_hash = _anonymize_ip(client_ip)
        log_data = AccessLogCreate(
            token=token,
            ip_hash=ip_hash,
            result=result,
        )
        await self.shared_link_repository.log_access(log_data)
