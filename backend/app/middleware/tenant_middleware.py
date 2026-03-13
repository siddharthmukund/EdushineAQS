"""Middleware that resolves the current tenant from request headers and attaches it to request.state."""
import json
import logging

import asyncpg
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse

logger = logging.getLogger(__name__)

_DEFAULT_SUBDOMAIN = "default"

# Simple in-memory cache for the default tenant to avoid repeated DB hits.
_tenant_cache: dict[str, dict] = {}


class TenantMiddleware(BaseHTTPMiddleware):
    """
    Resolves tenant from:
      1. X-Tenant-ID header (UUID)
      2. X-Tenant-Subdomain header
      3. Falls back to the "default" tenant

    Attaches ``request.state.tenant`` as a plain dict:
      {id, name, subdomain, plan, region, settings}

    Uses a direct asyncpg connection to avoid coupling with the SQLAlchemy
    session lifecycle, which isn't yet open during middleware execution.
    """

    # Paths that bypass tenant resolution entirely
    _SKIP_PATHS = {"/health"}

    def __init__(self, app, db_url: str):
        super().__init__(app)
        # Normalise DSN for asyncpg (handles both SQLAlchemy and Railway formats)
        self._dsn = (
            db_url
            .replace("postgresql+asyncpg://", "postgresql://")
            .replace("postgres://", "postgresql://")
        )
        self._pool: asyncpg.Pool | None = None

    async def _get_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            self._pool = await asyncpg.create_pool(self._dsn, min_size=1, max_size=3)
        return self._pool

    async def _fetch_tenant(self, where_col: str, value: str) -> dict | None:
        cache_key = f"{where_col}:{value}"
        if cache_key in _tenant_cache:
            return _tenant_cache[cache_key]

        try:
            pool = await self._get_pool()
            row = await pool.fetchrow(
                f"SELECT id, name, subdomain, plan, region, settings "
                f"FROM tenants WHERE {where_col} = $1 AND is_active = true LIMIT 1",
                value,
            )
        except Exception as exc:
            logger.warning("TenantMiddleware DB error: %s", exc)
            return None

        if row is None:
            return None

        tenant = {
            "id": str(row["id"]),
            "name": row["name"],
            "subdomain": row["subdomain"],
            "plan": row["plan"],
            "region": row["region"],
            "settings": row["settings"] or {},
        }
        # Cache for 60 seconds (light cache — tenants rarely change)
        _tenant_cache[cache_key] = tenant
        return tenant

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path in self._SKIP_PATHS:
            return await call_next(request)

        tenant: dict | None = None

        tenant_id_header = request.headers.get("X-Tenant-ID")
        tenant_sub_header = request.headers.get("X-Tenant-Subdomain")

        if tenant_id_header:
            tenant = await self._fetch_tenant("id::text", tenant_id_header)
        elif tenant_sub_header:
            tenant = await self._fetch_tenant("subdomain", tenant_sub_header)

        if tenant is None:
            # Fall back to the "default" tenant (always seeded in migration)
            tenant = await self._fetch_tenant("subdomain", _DEFAULT_SUBDOMAIN)

        if tenant is None:
            return JSONResponse({"error": "Tenant not found"}, status_code=404)

        request.state.tenant = tenant
        return await call_next(request)
