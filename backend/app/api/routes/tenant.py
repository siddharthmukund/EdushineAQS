from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.repositories.tenant_repo import TenantRepository

router = APIRouter(prefix="/api/tenants", tags=["tenants"])


class TenantCreate(BaseModel):
    name: str
    subdomain: str
    plan: str = "free"
    region: str = "us"


@router.get("/current")
async def get_current_tenant(request: Request):
    """Return the tenant resolved from the current request headers."""
    return {"status": "success", "tenant": request.state.tenant}


@router.post("", status_code=201)
async def create_tenant(
    body: TenantCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role("admin")),
):
    repo = TenantRepository(db)
    existing = await repo.get_by_subdomain(body.subdomain)
    if existing:
        raise HTTPException(status_code=409, detail="Subdomain already taken")
    tenant = await repo.create_tenant(body.name, body.subdomain, body.plan, body.region)
    return {"status": "success", "tenant": {
        "id": str(tenant.id),
        "name": tenant.name,
        "subdomain": tenant.subdomain,
        "plan": tenant.plan,
        "region": tenant.region,
        "created_at": tenant.created_at.isoformat(),
    }}


@router.get("")
async def list_tenants(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role("admin")),
):
    repo = TenantRepository(db)
    tenants = await repo.list_tenants()
    return {"status": "success", "tenants": [
        {"id": str(t.id), "name": t.name, "subdomain": t.subdomain, "plan": t.plan, "region": t.region}
        for t in tenants
    ]}
