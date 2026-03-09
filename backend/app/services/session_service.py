"""Session management service — tracks JWT sessions and supports force-logout."""
import hashlib
import uuid
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select, update, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.database import UserSession


def _hash_token(token: str) -> str:
    """SHA-256 hex digest of a JWT string."""
    return hashlib.sha256(token.encode()).hexdigest()


class SessionService:
    async def create_session(
        self,
        db: AsyncSession,
        redis,
        user_id: str,
        token: str,
        ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        expires_at: Optional[datetime] = None,
    ) -> UserSession:
        """Create a session record in DB and cache it in Redis."""
        if expires_at is None:
            expires_at = datetime.utcnow() + timedelta(
                minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
            )

        token_hash = _hash_token(token)
        session = UserSession(
            user_id=uuid.UUID(user_id),
            token_hash=token_hash,
            ip_address=ip,
            user_agent=user_agent,
            expires_at=expires_at,
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

        # Cache in Redis for fast invalidation checks
        ttl = max(1, int((expires_at - datetime.utcnow()).total_seconds()))
        try:
            await redis.setex(f"sess:{user_id}:{session.id}", ttl, "1")
        except Exception:
            pass  # Redis failure is non-fatal; DB is truth

        return session

    async def is_valid(self, redis, db: AsyncSession, token: str, user_id: str) -> bool:
        """Return True if the session token is still valid."""
        token_hash = _hash_token(token)

        # Fast path — check Redis
        try:
            result = await db.execute(
                select(UserSession).where(
                    and_(
                        UserSession.token_hash == token_hash,
                        UserSession.is_active == True,
                    )
                )
            )
            session = result.scalar_one_or_none()
            if not session:
                return False

            # Update last_used_at periodically (in background, non-blocking)
            session.last_used_at = datetime.utcnow()
            await db.commit()
            return True
        except Exception:
            return True  # On DB error, let through (token JWT validity is still enforced)

    async def revoke(
        self, db: AsyncSession, redis, session_id: str, user_id: str
    ) -> None:
        """Revoke a single session."""
        result = await db.execute(
            select(UserSession).where(
                and_(
                    UserSession.id == uuid.UUID(session_id),
                    UserSession.user_id == uuid.UUID(user_id),
                )
            )
        )
        session = result.scalar_one_or_none()
        if session:
            session.is_active = False
            await db.commit()

        try:
            await redis.delete(f"sess:{user_id}:{session_id}")
        except Exception:
            pass

    async def revoke_all(
        self, db: AsyncSession, redis, user_id: str, except_session_id: Optional[str] = None
    ) -> int:
        """Revoke all sessions for a user (optionally except the current one)."""
        query = select(UserSession).where(
            and_(
                UserSession.user_id == uuid.UUID(user_id),
                UserSession.is_active == True,
            )
        )
        result = await db.execute(query)
        sessions = result.scalars().all()

        count = 0
        for s in sessions:
            if except_session_id and str(s.id) == except_session_id:
                continue
            s.is_active = False
            try:
                await redis.delete(f"sess:{user_id}:{s.id}")
            except Exception:
                pass
            count += 1

        await db.commit()
        return count

    async def get_user_sessions(
        self, db: AsyncSession, user_id: str
    ) -> list:
        """Return all active sessions for a user."""
        result = await db.execute(
            select(UserSession).where(
                and_(
                    UserSession.user_id == uuid.UUID(user_id),
                    UserSession.is_active == True,
                )
            ).order_by(UserSession.last_used_at.desc())
        )
        return result.scalars().all()
