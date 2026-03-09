import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import Tenant


class TenantRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, tenant_id: str) -> Tenant | None:
        result = await self.db.execute(
            select(Tenant).where(Tenant.id == uuid.UUID(str(tenant_id)), Tenant.is_active == True)
        )
        return result.scalar_one_or_none()

    async def get_by_subdomain(self, subdomain: str) -> Tenant | None:
        result = await self.db.execute(
            select(Tenant).where(Tenant.subdomain == subdomain, Tenant.is_active == True)
        )
        return result.scalar_one_or_none()

    async def create_tenant(self, name: str, subdomain: str, plan: str = 'free', region: str = 'us') -> Tenant:
        tenant = Tenant(name=name, subdomain=subdomain, plan=plan, region=region)
        self.db.add(tenant)
        await self.db.commit()
        await self.db.refresh(tenant)
        return tenant

    async def list_tenants(self) -> list[Tenant]:
        result = await self.db.execute(select(Tenant).order_by(Tenant.created_at.desc()))
        return list(result.scalars().all())
