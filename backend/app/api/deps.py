from typing import Optional

from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.security.api_key import APIKeyHeader
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_db_session
from app.services.llm_service import LLMService
from app.services.cache_service import CacheService
from app.repositories.analysis_repo import AnalysisRepository
from app.repositories.committee_repo import CommitteeRepository
from app.repositories.tenant_repo import TenantRepository

API_KEY_NAME = "Authorization"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)
bearer_scheme = HTTPBearer(auto_error=False)


async def verify_api_key(api_key: str = Security(api_key_header)):
    """Backward-compatible API key check. Accepts Bearer tokens too."""
    if not api_key:
        return "development-key"
    if api_key.startswith("Bearer "):
        api_key = api_key[7:]
    return api_key


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(bearer_scheme),
) -> dict:
    """Decode a JWT and return the user payload. Raises 401 on failure."""
    from app.services.auth_service import decode_token
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(credentials.credentials)
        return {
            "user_id": payload.get("sub"),
            "role": payload.get("role"),
            "email": payload.get("email"),
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def require_role(minimum_role: str):
    """Dependency factory: enforces a minimum RBAC role."""
    async def _checker(current_user: dict = Depends(get_current_user)) -> dict:
        from app.services.auth_service import has_minimum_role
        if not has_minimum_role(current_user.get("role", ""), minimum_role):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return _checker


async def get_committee_session(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(bearer_scheme),
) -> dict:
    """Decode a committee session JWT (no DB user required)."""
    from app.services.auth_service import decode_committee_session
    if not credentials:
        raise HTTPException(status_code=401, detail="Committee session token required")
    try:
        return decode_committee_session(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid committee session token")


def get_llm_service() -> LLMService:
    return LLMService()


def get_cache_service() -> CacheService:
    return CacheService()


def get_analysis_repo(db: AsyncSession = Depends(get_db_session)) -> AnalysisRepository:
    return AnalysisRepository(db)


def get_committee_repo(db: AsyncSession = Depends(get_db_session)) -> CommitteeRepository:
    return CommitteeRepository(db)


def get_tenant_repo(db: AsyncSession = Depends(get_db_session)) -> TenantRepository:
    return TenantRepository(db)


async def get_current_tenant(request) -> dict:
    """Return the tenant attached to the request by TenantMiddleware."""
    return request.state.tenant


# Re-export get_db_session under the shorter alias used by new routes
get_db = get_db_session
