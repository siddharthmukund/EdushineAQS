import hashlib
import secrets
import uuid
from datetime import datetime
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import DeveloperApp, WebhookEvent


def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


class DeveloperRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register_app(
        self, name: str, developer_email: str,
        description: str | None = None, webhook_url: str | None = None,
        category: str = 'other', tenant_id: str | None = None,
    ) -> tuple[DeveloperApp, str]:
        raw_key = 'aqs_' + secrets.token_urlsafe(32)
        prefix = raw_key[:8]
        key_hash = _hash_key(raw_key)

        app = DeveloperApp(
            tenant_id=uuid.UUID(str(tenant_id)) if tenant_id else None,
            name=name,
            description=description,
            developer_email=developer_email,
            api_key_hash=key_hash,
            api_key_prefix=prefix,
            webhook_url=webhook_url,
            category=category,
        )
        self.db.add(app)
        await self.db.commit()
        await self.db.refresh(app)
        return app, raw_key

    async def get_app_by_key(self, raw_key: str) -> DeveloperApp | None:
        key_hash = _hash_key(raw_key)
        result = await self.db.execute(
            select(DeveloperApp).where(
                DeveloperApp.api_key_hash == key_hash,
                DeveloperApp.is_active == True,
            )
        )
        return result.scalar_one_or_none()

    async def increment_requests(self, app_id: str) -> None:
        await self.db.execute(
            update(DeveloperApp)
            .where(DeveloperApp.id == uuid.UUID(str(app_id)))
            .values(
                total_requests=DeveloperApp.total_requests + 1,
                last_used_at=datetime.utcnow(),
            )
        )
        await self.db.commit()

    async def list_marketplace_apps(self, category: str | None = None) -> list[DeveloperApp]:
        stmt = select(DeveloperApp).where(
            DeveloperApp.is_marketplace_listed == True,
            DeveloperApp.is_active == True,
        )
        if category:
            stmt = stmt.where(DeveloperApp.category == category)
        stmt = stmt.order_by(DeveloperApp.total_requests.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_webhook_event(
        self, developer_app_id: str, event_type: str, payload: dict
    ) -> WebhookEvent:
        event = WebhookEvent(
            developer_app_id=uuid.UUID(str(developer_app_id)),
            event_type=event_type,
            payload=payload,
        )
        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)
        return event

    async def mark_webhook_delivered(self, event_id: str, success: bool) -> None:
        await self.db.execute(
            update(WebhookEvent)
            .where(WebhookEvent.id == uuid.UUID(str(event_id)))
            .values(
                delivered=success,
                attempts=WebhookEvent.attempts + 1,
                last_attempt_at=datetime.utcnow(),
            )
        )
        await self.db.commit()

    async def get_apps_with_webhook(self) -> list[DeveloperApp]:
        result = await self.db.execute(
            select(DeveloperApp).where(
                DeveloperApp.webhook_url != None,
                DeveloperApp.is_active == True,
            )
        )
        return list(result.scalars().all())
