"""User profile, MFA, session, and data-export routes (ICCV #3)."""
import hashlib
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_audit_service,
    get_current_user,
    get_mfa_service,
    get_redis,
    get_session_service,
)
from app.dependencies import get_db_session
from app.models.database import Analysis, User
from app.services.audit_service import AuditService
from app.services.mfa_service import MFAService
from app.services.session_service import SessionService

router = APIRouter(prefix="/user", tags=["User"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _user_to_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "is_active": user.is_active,
        "avatar_url": user.avatar_url,
        "timezone": user.timezone,
        "language_preference": user.language_preference,
        "notification_preferences": user.notification_preferences or {},
        "mfa_enabled": user.mfa_enabled,
        "sso_provider": user.sso_provider,
        "department": user.department,
        "title": user.title,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
    }


# ---------------------------------------------------------------------------
# Profile endpoints
# ---------------------------------------------------------------------------

@router.get("/profile")
async def get_profile(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    result = await db.execute(select(User).where(User.id == uuid.UUID(current_user["user_id"])))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_to_dict(user)


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    timezone: Optional[str] = None
    language_preference: Optional[str] = None
    department: Optional[str] = None
    title: Optional[str] = None


@router.put("/profile")
async def update_profile(
    req: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    result = await db.execute(select(User).where(User.id == uuid.UUID(current_user["user_id"])))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if req.name is not None:
        user.name = req.name
    if req.avatar_url is not None:
        user.avatar_url = req.avatar_url
    if req.timezone is not None:
        user.timezone = req.timezone
    if req.language_preference is not None:
        user.language_preference = req.language_preference
    if req.department is not None:
        user.department = req.department
    if req.title is not None:
        user.title = req.title

    await db.commit()
    await db.refresh(user)
    return _user_to_dict(user)


class UpdatePreferencesRequest(BaseModel):
    notification_preferences: dict


@router.put("/preferences")
async def update_preferences(
    req: UpdatePreferencesRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    result = await db.execute(select(User).where(User.id == uuid.UUID(current_user["user_id"])))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.notification_preferences = req.notification_preferences
    await db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# MFA endpoints
# ---------------------------------------------------------------------------

@router.post("/mfa/setup")
async def mfa_setup(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    mfa_svc: MFAService = Depends(get_mfa_service),
):
    """Generate TOTP secret + QR code + 10 recovery codes. Does NOT enable MFA yet."""
    return await mfa_svc.setup_totp(current_user["user_id"], db)


class MFACodeRequest(BaseModel):
    code: str


@router.post("/mfa/confirm")
async def mfa_confirm(
    req: MFACodeRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    mfa_svc: MFAService = Depends(get_mfa_service),
    audit_svc: AuditService = Depends(get_audit_service),
):
    """Verify the first TOTP code and enable MFA on the account."""
    ok = await mfa_svc.confirm_totp(current_user["user_id"], req.code, db)
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid TOTP code")
    await audit_svc.log(db, "mfa_enable", user_id=current_user["user_id"])
    return {"ok": True, "mfa_enabled": True}


@router.post("/mfa/disable")
async def mfa_disable(
    req: MFACodeRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    mfa_svc: MFAService = Depends(get_mfa_service),
    audit_svc: AuditService = Depends(get_audit_service),
):
    """Verify current TOTP code then disable MFA and remove the secret."""
    ok = await mfa_svc.verify_totp(current_user["user_id"], req.code, db)
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid TOTP code")
    await mfa_svc.disable_mfa(current_user["user_id"], db)
    await audit_svc.log(db, "mfa_disable", user_id=current_user["user_id"])
    return {"ok": True, "mfa_enabled": False}


# ---------------------------------------------------------------------------
# Session endpoints
# ---------------------------------------------------------------------------

@router.get("/sessions")
async def list_sessions(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    session_svc: SessionService = Depends(get_session_service),
):
    """Return all active sessions for the current user."""
    sessions = await session_svc.get_user_sessions(db, current_user["user_id"])
    return [
        {
            "id": str(s.id),
            "ip_address": s.ip_address,
            "user_agent": s.user_agent,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "last_used_at": s.last_used_at.isoformat() if s.last_used_at else None,
            "expires_at": s.expires_at.isoformat() if s.expires_at else None,
        }
        for s in sessions
    ]


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    redis=Depends(get_redis),
    session_svc: SessionService = Depends(get_session_service),
    audit_svc: AuditService = Depends(get_audit_service),
):
    """Revoke a single session by its ID."""
    await session_svc.revoke(db, redis, session_id, current_user["user_id"])
    await audit_svc.log(
        db, "session_revoked",
        user_id=current_user["user_id"],
        resource_type="session", resource_id=session_id,
    )
    return {"ok": True}


@router.delete("/sessions")
async def revoke_all_sessions(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    redis=Depends(get_redis),
    session_svc: SessionService = Depends(get_session_service),
    audit_svc: AuditService = Depends(get_audit_service),
):
    """Sign out all other devices. The current session is kept alive."""
    # Identify the current session by hashing the bearer token
    auth = request.headers.get("Authorization", "")
    raw_token = auth[7:] if auth.startswith("Bearer ") else ""
    current_session_id: Optional[str] = None
    if raw_token:
        from app.models.database import UserSession
        from sqlalchemy import and_
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        sess_result = await db.execute(
            select(UserSession).where(
                and_(UserSession.token_hash == token_hash, UserSession.is_active == True)
            )
        )
        sess = sess_result.scalar_one_or_none()
        if sess:
            current_session_id = str(sess.id)

    count = await session_svc.revoke_all(
        db, redis, current_user["user_id"], except_session_id=current_session_id
    )
    await audit_svc.log(
        db, "session_revoked_all",
        user_id=current_user["user_id"],
        metadata={"count": count},
    )
    return {"ok": True, "revoked": count}


# ---------------------------------------------------------------------------
# Data export
# ---------------------------------------------------------------------------

@router.get("/export")
async def export_my_data(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    audit_svc: AuditService = Depends(get_audit_service),
):
    """Export the current user's profile data and analysis history as JSON."""
    user_result = await db.execute(
        select(User).where(User.id == uuid.UUID(current_user["user_id"]))
    )
    user = user_result.scalar_one_or_none()

    # Fetch analyses (currently not user-scoped; future: filter by user_id FK)
    analyses_result = await db.execute(select(Analysis))
    analyses = analyses_result.scalars().all()

    await audit_svc.log(db, "export_data", user_id=current_user["user_id"])

    return {
        "exported_at": datetime.utcnow().isoformat(),
        "user": _user_to_dict(user) if user else None,
        "analyses": [
            {
                "id": str(a.id),
                "candidate_name": a.candidate_name,
                "overall_aqs": float(a.overall_aqs) if a.overall_aqs is not None else None,
                "recommendation": a.recommendation,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "filename": a.filename,
            }
            for a in analyses
        ],
    }
