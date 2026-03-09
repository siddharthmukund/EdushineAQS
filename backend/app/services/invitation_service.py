"""User invitation service — creates and validates invite tokens."""
import hashlib
import uuid
from datetime import datetime, timedelta
from typing import Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.database import UserInvitation


def _hash_token(raw_token: str) -> str:
    """SHA-256 hex digest of the raw token."""
    return hashlib.sha256(raw_token.encode()).hexdigest()


class InvitationService:
    async def create_invite(
        self,
        db: AsyncSession,
        email: str,
        role: str,
        invited_by_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
    ) -> Tuple[UserInvitation, str]:
        """
        Create an invitation record and return (invitation, raw_token).

        The raw_token should be shared with the invitee via the invite URL:
            {FRONTEND_URL}/register?invite={raw_token}

        In development, the invite URL is printed to the console.
        """
        raw_token = str(uuid.uuid4())
        token_hash = _hash_token(raw_token)

        invitation = UserInvitation(
            email=email,
            role=role,
            invited_by_id=uuid.UUID(invited_by_id) if invited_by_id else None,
            token_hash=token_hash,
            tenant_id=uuid.UUID(tenant_id) if tenant_id else None,
            expires_at=datetime.utcnow() + timedelta(days=7),
        )
        db.add(invitation)
        await db.commit()
        await db.refresh(invitation)

        invite_url = f"{settings.FRONTEND_URL}/register?invite={raw_token}"
        print(f"\n📨 INVITATION CREATED\n   Email: {email}\n   Role: {role}\n   URL: {invite_url}\n")

        return invitation, raw_token

    async def validate_invite(
        self, db: AsyncSession, raw_token: str
    ) -> Optional[UserInvitation]:
        """Return the invitation if the token is valid and unused, else None."""
        token_hash = _hash_token(raw_token)
        result = await db.execute(
            select(UserInvitation).where(UserInvitation.token_hash == token_hash)
        )
        invite = result.scalar_one_or_none()

        if not invite:
            return None
        if invite.accepted_at is not None:
            return None  # Already used
        if invite.expires_at < datetime.utcnow():
            return None  # Expired

        return invite

    async def consume_invite(self, db: AsyncSession, invite_id: str) -> None:
        """Mark the invitation as accepted."""
        result = await db.execute(
            select(UserInvitation).where(UserInvitation.id == uuid.UUID(invite_id))
        )
        invite = result.scalar_one_or_none()
        if invite:
            invite.accepted_at = datetime.utcnow()
            await db.commit()
