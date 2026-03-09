"""Auth routes: register, login, logout, MFA verify, OAuth, invite check (ICCV #3)."""
import hashlib
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from jose import JWTError
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_audit_service,
    get_current_user,
    get_invitation_service,
    get_oauth_service,
    get_redis,
    get_session_service,
)
from app.config import settings
from app.dependencies import get_db_session
from app.models.database import User, UserSession
from app.services.audit_service import AuditService
from app.services.auth_service import (
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.services.invitation_service import InvitationService
from app.services.mfa_service import MFAService
from app.services.oauth_service import OAuthService
from app.services.session_service import SessionService

router = APIRouter(prefix="/auth", tags=["Auth"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _client_ip(request: Request) -> Optional[str]:
    fwd = request.headers.get("X-Forwarded-For")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else None)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    password: str
    invite_token: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str
    user_id: str
    mfa_enabled: bool = False


class MFAVerifyRequest(BaseModel):
    temp_token: str
    code: str
    use_recovery_code: bool = False


# ---------------------------------------------------------------------------
# POST /auth/register
# ---------------------------------------------------------------------------

@router.post("/register", status_code=201)
async def register(
    req: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    redis=Depends(get_redis),
    session_svc: SessionService = Depends(get_session_service),
    audit_svc: AuditService = Depends(get_audit_service),
    inv_svc: InvitationService = Depends(get_invitation_service),
):
    # Duplicate email check
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    # Determine role
    role = "committee_member"
    invite = None
    if req.invite_token:
        invite = await inv_svc.validate_invite(db, req.invite_token)
        if invite:
            if invite.email.lower() != str(req.email).lower():
                raise HTTPException(status_code=400, detail="Invite email does not match registration email")
            role = invite.role

    # First user ever becomes admin
    total = await db.execute(select(User))
    if total.first() is None:
        role = "admin"

    user = User(
        id=uuid.uuid4(),
        email=str(req.email),
        name=req.name,
        hashed_password=hash_password(req.password),
        role=role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Consume invite
    if invite:
        await inv_svc.consume_invite(db, str(invite.id))
        await audit_svc.log(
            db, "invite_accepted",
            user_id=str(user.id), resource_id=str(invite.id),
        )

    token = create_access_token({"sub": str(user.id), "role": user.role, "email": user.email})
    await session_svc.create_session(
        db, redis, str(user.id), token,
        ip=_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    await audit_svc.log(db, "register", user_id=str(user.id), ip=_client_ip(request))

    return TokenResponse(
        access_token=token,
        role=user.role,
        name=user.name,
        user_id=str(user.id),
        mfa_enabled=user.mfa_enabled,
    )


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------

@router.post("/login")
async def login(
    req: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    redis=Depends(get_redis),
    session_svc: SessionService = Depends(get_session_service),
    audit_svc: AuditService = Depends(get_audit_service),
):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    user.last_login_at = datetime.utcnow()
    await db.commit()

    # MFA gate — return a short-lived pending token
    if user.mfa_enabled:
        temp_token = create_access_token(
            {"sub": str(user.id), "role": user.role, "email": user.email, "type": "mfa_pending"},
            expires_delta=timedelta(minutes=15),
        )
        return {"mfa_required": True, "temp_token": temp_token}

    # Full login
    token = create_access_token({"sub": str(user.id), "role": user.role, "email": user.email})
    await session_svc.create_session(
        db, redis, str(user.id), token,
        ip=_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    await audit_svc.log(db, "login", user_id=str(user.id), ip=_client_ip(request))

    return TokenResponse(
        access_token=token,
        role=user.role,
        name=user.name,
        user_id=str(user.id),
        mfa_enabled=user.mfa_enabled,
    )


# ---------------------------------------------------------------------------
# POST /auth/mfa-verify  (second factor after password)
# ---------------------------------------------------------------------------

@router.post("/mfa-verify")
async def mfa_verify(
    req: MFAVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    redis=Depends(get_redis),
    session_svc: SessionService = Depends(get_session_service),
    audit_svc: AuditService = Depends(get_audit_service),
):
    # Validate the temp token
    try:
        payload = decode_token(req.temp_token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired temp token")

    if payload.get("type") != "mfa_pending":
        raise HTTPException(status_code=400, detail="Not a pending MFA token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or disabled")

    mfa_svc = MFAService()
    if req.use_recovery_code:
        ok = await mfa_svc.verify_recovery_code(user_id, req.code, db)
    else:
        ok = await mfa_svc.verify_totp(user_id, req.code, db)

    if not ok:
        raise HTTPException(status_code=401, detail="Invalid MFA code")

    token = create_access_token({"sub": str(user.id), "role": user.role, "email": user.email})
    await session_svc.create_session(
        db, redis, str(user.id), token,
        ip=_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    await audit_svc.log(db, "login", user_id=str(user.id), ip=_client_ip(request))

    return TokenResponse(
        access_token=token,
        role=user.role,
        name=user.name,
        user_id=str(user.id),
        mfa_enabled=user.mfa_enabled,
    )


# ---------------------------------------------------------------------------
# POST /auth/logout
# ---------------------------------------------------------------------------

@router.post("/logout")
async def logout(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    redis=Depends(get_redis),
    session_svc: SessionService = Depends(get_session_service),
    audit_svc: AuditService = Depends(get_audit_service),
):
    auth = request.headers.get("Authorization", "")
    raw_token = auth[7:] if auth.startswith("Bearer ") else ""

    if raw_token:
        th = _token_hash(raw_token)
        from sqlalchemy import and_
        sess_result = await db.execute(
            select(UserSession).where(
                and_(UserSession.token_hash == th, UserSession.is_active == True)
            )
        )
        session = sess_result.scalar_one_or_none()
        if session:
            await session_svc.revoke(db, redis, str(session.id), current_user["user_id"])

    await audit_svc.log(db, "logout", user_id=current_user["user_id"], ip=_client_ip(request))
    return {"ok": True}


# ---------------------------------------------------------------------------
# GET /auth/me
# ---------------------------------------------------------------------------

@router.get("/me")
async def me(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    result = await db.execute(select(User).where(User.id == uuid.UUID(current_user["user_id"])))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "user_id": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "mfa_enabled": user.mfa_enabled,
        "sso_provider": user.sso_provider,
        "avatar_url": user.avatar_url,
        "is_active": user.is_active,
    }


# ---------------------------------------------------------------------------
# GET /auth/oauth/{provider}  — get authorization URL
# ---------------------------------------------------------------------------

@router.get("/oauth/{provider}")
async def oauth_get_url(
    provider: str,
    oauth_svc: OAuthService = Depends(get_oauth_service),
):
    if not oauth_svc.is_configured(provider):
        raise HTTPException(
            status_code=501,
            detail=f"OAuth not configured for provider '{provider}'. Set {provider.upper()}_CLIENT_ID/SECRET in .env.",
        )
    state = str(uuid.uuid4())
    redirect_uri = f"{settings.FRONTEND_URL}/auth/callback"
    url = oauth_svc.get_authorization_url(provider, redirect_uri, state)
    return {"url": url, "state": state}


# ---------------------------------------------------------------------------
# GET /auth/oauth/{provider}/callback
# ---------------------------------------------------------------------------

@router.get("/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    request: Request,
    code: str = Query(...),
    state: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db_session),
    redis=Depends(get_redis),
    oauth_svc: OAuthService = Depends(get_oauth_service),
    session_svc: SessionService = Depends(get_session_service),
    audit_svc: AuditService = Depends(get_audit_service),
):
    if not oauth_svc.is_configured(provider):
        raise HTTPException(status_code=501, detail=f"OAuth not configured for provider '{provider}'")

    redirect_uri = f"{settings.FRONTEND_URL}/auth/callback"
    try:
        info = await oauth_svc.fetch_user_info(provider, code, redirect_uri)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"OAuth exchange failed: {exc}")

    email = info.get("email", "")
    if not email:
        raise HTTPException(status_code=400, detail="No email returned from OAuth provider")

    # Find or create user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        total = await db.execute(select(User))
        is_first = total.first() is None
        user = User(
            id=uuid.uuid4(),
            email=email,
            name=info.get("name") or email.split("@")[0],
            hashed_password=hash_password(str(uuid.uuid4())),  # unusable random password
            role="admin" if is_first else "committee_member",
            sso_provider=provider,
            sso_id=info.get("sso_id"),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        user.sso_provider = provider
        user.sso_id = info.get("sso_id")
        user.last_login_at = datetime.utcnow()
        await db.commit()

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    token = create_access_token({"sub": str(user.id), "role": user.role, "email": user.email})
    await session_svc.create_session(
        db, redis, str(user.id), token,
        ip=_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    await audit_svc.log(
        db, "oauth_login",
        user_id=str(user.id),
        ip=_client_ip(request),
        metadata={"provider": provider},
    )

    return TokenResponse(
        access_token=token,
        role=user.role,
        name=user.name,
        user_id=str(user.id),
        mfa_enabled=user.mfa_enabled,
    )


# ---------------------------------------------------------------------------
# POST /auth/invite/{token}/check  — validate an invite token for prefill
# ---------------------------------------------------------------------------

@router.post("/invite/{token}/check")
async def check_invite(
    token: str,
    db: AsyncSession = Depends(get_db_session),
    inv_svc: InvitationService = Depends(get_invitation_service),
):
    invite = await inv_svc.validate_invite(db, token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite token is invalid or expired")
    return {"email": invite.email, "role": invite.role}
