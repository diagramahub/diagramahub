"""
Concrete implementation of shared link repository.
"""
from datetime import datetime, timedelta
from typing import Optional

from beanie import PydanticObjectId

from .interfaces import ISharedLinkRepository
from .schemas import (
    AccessLogCreate,
    AccessLogInDB,
    SharedLinkCreate,
    SharedLinkInDB,
    SharedLinkUpdate,
)


class SharedLinkRepository(ISharedLinkRepository):
    """MongoDB implementation of shared link repository using Beanie."""

    async def create(self, link_data: SharedLinkCreate) -> SharedLinkInDB:
        """Create a new shared link."""
        link = SharedLinkInDB(
            diagram_id=link_data.diagram_id,
            user_id=link_data.user_id,
            token=link_data.token,
            access_type=link_data.access_type,
            access_code_hash=link_data.access_code_hash,
            allow_copy_code=link_data.allow_copy_code,
            expires_at=link_data.expires_at,
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        await link.insert()
        return link

    async def get_by_token(self, token: str) -> Optional[SharedLinkInDB]:
        """Get shared link by token."""
        return await SharedLinkInDB.find_one(SharedLinkInDB.token == token)

    async def get_active_by_diagram(self, diagram_id: str) -> Optional[SharedLinkInDB]:
        """Get the active shared link for a diagram."""
        return await SharedLinkInDB.find_one(
            SharedLinkInDB.diagram_id == diagram_id,
            SharedLinkInDB.is_active == True,
        )

    async def update(
        self, link_id: str, update_data: SharedLinkUpdate
    ) -> Optional[SharedLinkInDB]:
        """Update shared link configuration."""
        try:
            link = await SharedLinkInDB.get(PydanticObjectId(link_id))
        except Exception:
            return None

        if not link:
            return None

        data = update_data.model_dump(exclude_unset=True)
        if data:
            data["updated_at"] = datetime.utcnow()
            await link.set(data)

        return link

    async def revoke(self, link_id: str) -> bool:
        """Revoke (deactivate) a shared link."""
        try:
            link = await SharedLinkInDB.get(PydanticObjectId(link_id))
        except Exception:
            return False

        if not link:
            return False

        await link.set(
            {"is_active": False, "updated_at": datetime.utcnow()}
        )
        return True

    async def log_access(self, log_data: AccessLogCreate) -> AccessLogInDB:
        """Log an access attempt to a shared link."""
        log = AccessLogInDB(
            token=log_data.token,
            ip_hash=log_data.ip_hash,
            result=log_data.result,
            created_at=datetime.utcnow(),
        )
        await log.insert()
        return log

    async def count_failed_attempts(
        self, ip_hash: str, token: str, minutes: int
    ) -> int:
        """Count failed access attempts by IP hash and token within a time window."""
        cutoff = datetime.utcnow() - timedelta(minutes=minutes)
        return await AccessLogInDB.find(
            AccessLogInDB.ip_hash == ip_hash,
            AccessLogInDB.token == token,
            AccessLogInDB.result == "invalid_code",
            AccessLogInDB.created_at >= cutoff,
        ).count()
