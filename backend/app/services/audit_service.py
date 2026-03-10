"""Audit logging service — records all sensitive user actions."""
import asyncio
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import AuditLog


class AuditService:
    async def log(
        self,
        db: AsyncSession,
        action: str,
        user_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        ip: Optional[str] = None,
        ua: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Write an audit log entry. Safe to call fire-and-forget via asyncio.create_task().

        Common actions:
            login, logout, register, mfa_enable, mfa_disable,
            invite_sent, invite_accepted, role_changed, password_changed,
            oauth_login, session_revoked, export_data
        """
        entry = AuditLog(
            user_id=uuid.UUID(user_id) if user_id else None,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip,
            user_agent=ua,
            extra_data=metadata or {},
        )
        db.add(entry)
        try:
            await db.commit()
        except Exception:
            await db.rollback()  # Don't let audit failures bubble up

    async def get_logs(
        self,
        db: AsyncSession,
        user_id: Optional[str] = None,
        action: Optional[str] = None,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list:
        """Query audit logs with optional filters."""
        from sqlalchemy import desc

        conditions = []
        if user_id:
            conditions.append(AuditLog.user_id == uuid.UUID(user_id))
        if action:
            conditions.append(AuditLog.action == action)
        if from_date:
            conditions.append(AuditLog.created_at >= from_date)
        if to_date:
            conditions.append(AuditLog.created_at <= to_date)

        query = select(AuditLog)
        if conditions:
            query = query.where(and_(*conditions))
        query = query.order_by(desc(AuditLog.created_at)).limit(limit).offset(offset)

        result = await db.execute(query)
        return result.scalars().all()
