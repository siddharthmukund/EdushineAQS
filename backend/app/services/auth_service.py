"""JWT-based authentication and RBAC utilities."""
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ROLE_HIERARCHY = {
    "super_admin": 8,
    "admin": 7,
    "committee_chair": 6,
    "committee_member": 5,
    "analyst": 4,
    "observer": 3,
    "viewer": 2,
    "invited": 1,
}

# Permission sets per role (ICCV #3)
PERMISSIONS: dict[str, frozenset] = {
    "super_admin": frozenset([
        "manage_users", "manage_settings", "view_audit_logs",
        "analyze", "view_analytics", "export_reports",
        "create_committee", "finalize_decisions", "view_votes",
        "join_committee", "vote", "view_candidates",
    ]),
    "admin": frozenset([
        "manage_users", "manage_settings", "view_audit_logs",
        "analyze", "view_analytics", "export_reports",
        "view_votes", "view_candidates",
    ]),
    "committee_chair": frozenset([
        "create_committee", "finalize_decisions", "view_votes",
        "analyze", "view_analytics", "view_candidates",
    ]),
    "committee_member": frozenset([
        "join_committee", "vote", "view_candidates",
    ]),
    "analyst": frozenset([
        "analyze", "export_reports", "view_analytics", "view_candidates",
    ]),
    "observer": frozenset(["view_candidates"]),
    "invited": frozenset(),
    "viewer": frozenset(["view_candidates"]),
}


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode a JWT token. Raises JWTError on failure."""
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


def has_minimum_role(user_role: str, required_role: str) -> bool:
    """Return True if user_role meets or exceeds required_role in the hierarchy."""
    return ROLE_HIERARCHY.get(user_role, 0) >= ROLE_HIERARCHY.get(required_role, 0)


def create_committee_session_token(
    committee_id: str,
    member_name: str,
    member_email: str,
) -> str:
    """Create a short-lived session token for a committee member (no DB user needed)."""
    data = {
        "sub": member_email,
        "name": member_name,
        "committee_id": committee_id,
        "type": "committee_session",
    }
    return create_access_token(data, expires_delta=timedelta(hours=24))


def decode_committee_session(token: str) -> dict:
    """Decode and validate a committee session token."""
    payload = decode_token(token)
    if payload.get("type") != "committee_session":
        raise JWTError("Not a committee session token")
    return payload
