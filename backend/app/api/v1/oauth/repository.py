"""
OAuth state token repository implementation using Beanie ODM.
"""
from datetime import datetime
from typing import Optional

from app.api.v1.oauth.interfaces import IOAuthStateRepository
from app.api.v1.oauth.schemas import OAuthStateToken
from app.core.clock import utcnow


class OAuthStateRepository(IOAuthStateRepository):
    """Concrete implementation of the OAuth state token repository."""

    async def create(
        self, state: str, provider: str, expires_at: datetime
    ) -> OAuthStateToken:
        """Persist a new OAuth state token for CSRF protection."""
        now = utcnow()
        oauth_state = OAuthStateToken(
            state=state,
            provider=provider,
            created_at=now,
            expires_at=expires_at,
        )
        await oauth_state.insert()
        return oauth_state

    async def get_by_token(self, state: str) -> Optional[OAuthStateToken]:
        """Fetch an OAuth state token document by its token value."""
        return await OAuthStateToken.find_one(OAuthStateToken.state == state)

    async def consume(self, state: str) -> bool:
        """Mark an OAuth state token as consumed."""
        doc = await OAuthStateToken.find_one(OAuthStateToken.state == state)
        if doc is None:
            return False

        doc.consumed = True
        await doc.save()
        return True
