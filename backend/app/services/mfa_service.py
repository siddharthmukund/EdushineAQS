"""TOTP Multi-Factor Authentication service."""
import base64
import io
import secrets
import uuid
from datetime import datetime

import pyotp
import qrcode
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.database import User, UserMFA

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _get_fernet():
    """Return a Fernet cipher for TOTP secret encryption."""
    from cryptography.fernet import Fernet
    # Derive a 32-byte Fernet key from JWT_SECRET_KEY
    key_bytes = (settings.JWT_SECRET_KEY * 3)[:32].encode("utf-8")
    b64_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(b64_key)


class MFAService:
    # ----------------------------------------------------------------
    # Setup — generate secret + QR + recovery codes
    # ----------------------------------------------------------------
    async def setup_totp(self, user_id: str, db: AsyncSession) -> dict:
        """Generate a new TOTP secret and QR code. Saves to DB (unconfirmed)."""
        # Look up user email for the QR provisioning URI
        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user:
            raise ValueError("User not found")

        secret = pyotp.random_base32()
        totp = pyotp.TOTP(secret)
        uri = totp.provisioning_uri(name=user.email, issuer_name="AQS Analyzer")

        # Generate QR PNG as base64
        qr_img = qrcode.make(uri)
        buf = io.BytesIO()
        qr_img.save(buf, format="PNG")
        qr_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        # Generate 10 recovery codes (8 hex chars each → 4 bytes)
        recovery_codes = [secrets.token_hex(4).upper() for _ in range(10)]
        recovery_hashes = [_pwd_context.hash(code) for code in recovery_codes]

        # Encrypt TOTP secret with Fernet
        fernet = _get_fernet()
        encrypted_secret = fernet.encrypt(secret.encode()).decode()

        # Upsert UserMFA row (not yet confirmed — mfa_enabled stays False)
        existing = await db.execute(select(UserMFA).where(UserMFA.user_id == uuid.UUID(user_id)))
        mfa_row = existing.scalar_one_or_none()
        if mfa_row:
            mfa_row.totp_secret_encrypted = encrypted_secret
            mfa_row.recovery_codes_hashed = recovery_hashes
            mfa_row.last_used_at = None
        else:
            mfa_row = UserMFA(
                user_id=uuid.UUID(user_id),
                totp_secret_encrypted=encrypted_secret,
                recovery_codes_hashed=recovery_hashes,
            )
            db.add(mfa_row)
        await db.commit()

        return {
            "secret": secret,
            "qr_code": f"data:image/png;base64,{qr_b64}",
            "recovery_codes": recovery_codes,
        }

    # ----------------------------------------------------------------
    # Confirm — verify a TOTP code and enable MFA for the user
    # ----------------------------------------------------------------
    async def confirm_totp(self, user_id: str, code: str, db: AsyncSession) -> bool:
        """Verify TOTP code and mark MFA as enabled on the user."""
        valid = await self.verify_totp(user_id, code, db)
        if valid:
            result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
            user = result.scalar_one_or_none()
            if user:
                user.mfa_enabled = True
                await db.commit()
        return valid

    # ----------------------------------------------------------------
    # Verify — check a TOTP code
    # ----------------------------------------------------------------
    async def verify_totp(self, user_id: str, code: str, db: AsyncSession) -> bool:
        """Return True if the TOTP code is valid (±1 window = 90-second tolerance)."""
        result = await db.execute(select(UserMFA).where(UserMFA.user_id == uuid.UUID(user_id)))
        mfa_row = result.scalar_one_or_none()
        if not mfa_row:
            return False

        fernet = _get_fernet()
        try:
            secret = fernet.decrypt(mfa_row.totp_secret_encrypted.encode()).decode()
        except Exception:
            return False

        totp = pyotp.TOTP(secret)
        is_valid = totp.verify(code, valid_window=1)

        if is_valid:
            mfa_row.last_used_at = datetime.utcnow()
            await db.commit()

        return is_valid

    # ----------------------------------------------------------------
    # Recovery code
    # ----------------------------------------------------------------
    async def verify_recovery_code(self, user_id: str, code: str, db: AsyncSession) -> bool:
        """Verify a recovery code and remove it if valid."""
        result = await db.execute(select(UserMFA).where(UserMFA.user_id == uuid.UUID(user_id)))
        mfa_row = result.scalar_one_or_none()
        if not mfa_row:
            return False

        hashes = list(mfa_row.recovery_codes_hashed)
        for i, h in enumerate(hashes):
            if _pwd_context.verify(code.upper(), h):
                # Consume this recovery code
                hashes.pop(i)
                mfa_row.recovery_codes_hashed = hashes
                await db.commit()
                return True
        return False

    # ----------------------------------------------------------------
    # Disable MFA
    # ----------------------------------------------------------------
    async def disable_mfa(self, user_id: str, db: AsyncSession) -> None:
        """Remove MFA configuration and mark user.mfa_enabled = False."""
        result = await db.execute(select(UserMFA).where(UserMFA.user_id == uuid.UUID(user_id)))
        mfa_row = result.scalar_one_or_none()
        if mfa_row:
            await db.delete(mfa_row)

        user_result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = user_result.scalar_one_or_none()
        if user:
            user.mfa_enabled = False

        await db.commit()
