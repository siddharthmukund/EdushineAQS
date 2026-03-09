"""Admin panel routes — user management, invitations, audit logs (ICCV #3)."""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, or_, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_audit_service,
    get_invitation_service,
    require_permission,
)
from app.config import settings
from app.dependencies import get_db_session
from app.models.database import AuditLog, User, UserInvitation
from app.services.audit_service import AuditService
from app.services.invitation_service import InvitationService

router = APIRouter(prefix="/admin", tags=["Admin"])

VALID_ROLES = frozenset({
    "super_admin", "admin", "committee_chair", "committee_member",
    "analyst", "observer", "viewer", "invited",
})


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@router.get("/users")
async def list_users(
    search: Optional[str] = Query(None, description="Filter by name or email"),
    role: Optional[str] = Query(None, description="Filter by role"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_permission("manage_users")),
    db: AsyncSession = Depends(get_db_session),
):
    """Paginated user directory. Requires manage_users permission."""
    conditions = []
    if search:
        conditions.append(
            or_(User.email.ilike(f"%{search}%"), User.name.ilike(f"%{search}%"))
        )
    if role:
        conditions.append(User.role == role)

    # Count total
    count_q = select(func.count(User.id))
    if conditions:
        count_q = count_q.where(and_(*conditions))
    total = (await db.execute(count_q)).scalar_one()

    # Fetch page
    data_q = select(User).order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    if conditions:
        data_q = data_q.where(and_(*conditions))
    result = await db.execute(data_q)
    users = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "users": [
            {
                "id": str(u.id),
                "email": u.email,
                "name": u.name,
                "role": u.role,
                "is_active": u.is_active,
                "mfa_enabled": u.mfa_enabled,
                "sso_provider": u.sso_provider,
                "department": u.department,
                "title": u.title,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
            }
            for u in users
        ],
    }


class ChangeRoleRequest(BaseModel):
    role: str


@router.put("/users/{user_id}/role")
async def change_user_role(
    user_id: str,
    req: ChangeRoleRequest,
    current_user: dict = Depends(require_permission("manage_users")),
    db: AsyncSession = Depends(get_db_session),
    audit_svc: AuditService = Depends(get_audit_service),
):
    """Change a user's RBAC role. Audit-logged."""
    if req.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Valid roles: {sorted(VALID_ROLES)}")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_role = user.role
    user.role = req.role
    await db.commit()

    await audit_svc.log(
        db, "role_changed",
        user_id=current_user["user_id"],
        resource_type="user", resource_id=user_id,
        metadata={"old_role": old_role, "new_role": req.role, "target_email": user.email},
    )
    return {"ok": True, "user_id": user_id, "role": req.role}


class ToggleStatusRequest(BaseModel):
    is_active: bool


@router.put("/users/{user_id}/status")
async def toggle_user_status(
    user_id: str,
    req: ToggleStatusRequest,
    current_user: dict = Depends(require_permission("manage_users")),
    db: AsyncSession = Depends(get_db_session),
    audit_svc: AuditService = Depends(get_audit_service),
):
    """Enable or disable a user account. Audit-logged."""
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = req.is_active
    await db.commit()

    await audit_svc.log(
        db, "user_status_changed",
        user_id=current_user["user_id"],
        resource_type="user", resource_id=user_id,
        metadata={"is_active": req.is_active, "target_email": user.email},
    )
    return {"ok": True, "user_id": user_id, "is_active": req.is_active}


# ---------------------------------------------------------------------------
# Invitations
# ---------------------------------------------------------------------------

class InviteRequest(BaseModel):
    email: EmailStr
    role: str


@router.post("/users/invite")
async def send_invitation(
    req: InviteRequest,
    current_user: dict = Depends(require_permission("manage_users")),
    db: AsyncSession = Depends(get_db_session),
    inv_svc: InvitationService = Depends(get_invitation_service),
    audit_svc: AuditService = Depends(get_audit_service),
):
    """Create an invite link for a new user. URL is printed to console (dev mode)."""
    if req.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Valid roles: {sorted(VALID_ROLES)}")

    invite, raw_token = await inv_svc.create_invite(
        db,
        email=str(req.email),
        role=req.role,
        invited_by_id=current_user["user_id"],
    )

    await audit_svc.log(
        db, "invite_sent",
        user_id=current_user["user_id"],
        resource_type="invitation", resource_id=str(invite.id),
        metadata={"email": str(req.email), "role": req.role},
    )

    invite_url = f"{settings.FRONTEND_URL}/register?invite={raw_token}"
    return {
        "ok": True,
        "invitation_id": str(invite.id),
        "invite_url": invite_url,
    }


@router.get("/invitations")
async def list_invitations(
    current_user: dict = Depends(require_permission("manage_users")),
    db: AsyncSession = Depends(get_db_session),
):
    """List all invitations ordered by newest first."""
    result = await db.execute(
        select(UserInvitation).order_by(UserInvitation.created_at.desc())
    )
    invites = result.scalars().all()
    now = datetime.utcnow()
    return [
        {
            "id": str(i.id),
            "email": i.email,
            "role": i.role,
            "invited_by_id": str(i.invited_by_id) if i.invited_by_id else None,
            "expires_at": i.expires_at.isoformat() if i.expires_at else None,
            "accepted_at": i.accepted_at.isoformat() if i.accepted_at else None,
            "created_at": i.created_at.isoformat() if i.created_at else None,
            "status": (
                "accepted" if i.accepted_at
                else ("expired" if i.expires_at < now else "pending")
            ),
        }
        for i in invites
    ]


@router.delete("/invitations/{invitation_id}")
async def revoke_invitation(
    invitation_id: str,
    current_user: dict = Depends(require_permission("manage_users")),
    db: AsyncSession = Depends(get_db_session),
):
    """Revoke a pending invitation by setting its expiry to now."""
    result = await db.execute(
        select(UserInvitation).where(UserInvitation.id == uuid.UUID(invitation_id))
    )
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Invitation not found")

    invite.expires_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------

@router.get("/audit-logs")
async def get_audit_logs(
    user_id_filter: Optional[str] = Query(None, alias="user_id"),
    action: Optional[str] = Query(None),
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(require_permission("view_audit_logs")),
    db: AsyncSession = Depends(get_db_session),
    audit_svc: AuditService = Depends(get_audit_service),
):
    """Paginated, filtered audit log viewer."""
    logs = await audit_svc.get_logs(
        db,
        user_id=user_id_filter,
        action=action,
        from_date=from_date,
        to_date=to_date,
        limit=limit,
        offset=offset,
    )
    return [
        {
            "id": str(log.id),
            "user_id": str(log.user_id) if log.user_id else None,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "metadata": log.metadata or {},
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]
