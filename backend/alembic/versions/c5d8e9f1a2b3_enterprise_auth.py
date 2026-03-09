"""enterprise_auth

Revision ID: c5d8e9f1a2b3
Revises: b4c9d3e2f5a1
Create Date: 2026-03-09 14:00:00.000000

Adds enterprise auth tables: user_mfa, user_sessions, audit_logs, user_invitations.
Expands user_role ENUM (super_admin, analyst, viewer, invited).
Adds 10 new columns to users table.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'c5d8e9f1a2b3'
down_revision = 'b4c9d3e2f5a1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ----------------------------------------------------------------
    # 1. Expand user_role ENUM — safe in PostgreSQL (ADD VALUE is DDL,
    #    committed immediately; IF NOT EXISTS prevents duplicates)
    # ----------------------------------------------------------------
    conn.execute(sa.text("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin'"))
    conn.execute(sa.text("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'analyst'"))
    conn.execute(sa.text("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'viewer'"))
    conn.execute(sa.text("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'invited'"))

    # ----------------------------------------------------------------
    # 2. Add new columns to existing 'users' table
    # ----------------------------------------------------------------
    op.add_column('users', sa.Column('avatar_url', sa.String(500), nullable=True))
    op.add_column('users', sa.Column('timezone', sa.String(50), server_default='UTC', nullable=False))
    op.add_column('users', sa.Column('language_preference', sa.String(10), server_default='en', nullable=False))
    op.add_column('users', sa.Column('notification_preferences', postgresql.JSONB, server_default='{}', nullable=False))
    op.add_column('users', sa.Column('password_changed_at', sa.DateTime, nullable=True))
    op.add_column('users', sa.Column('mfa_enabled', sa.Boolean, server_default='false', nullable=False))
    op.add_column('users', sa.Column('sso_provider', sa.String(50), nullable=True))
    op.add_column('users', sa.Column('sso_id', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('department', sa.String(200), nullable=True))
    op.add_column('users', sa.Column('title', sa.String(200), nullable=True))

    # ----------------------------------------------------------------
    # 3. Create user_mfa table
    # ----------------------------------------------------------------
    op.execute("""
        CREATE TABLE user_mfa (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            totp_secret_encrypted VARCHAR(500) NOT NULL,
            recovery_codes_hashed JSONB NOT NULL DEFAULT '[]',
            created_at TIMESTAMP DEFAULT now(),
            last_used_at TIMESTAMP
        )
    """)

    # ----------------------------------------------------------------
    # 4. Create user_sessions table
    # ----------------------------------------------------------------
    op.execute("""
        CREATE TABLE user_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash VARCHAR(64) NOT NULL UNIQUE,
            ip_address VARCHAR(45),
            user_agent VARCHAR(500),
            created_at TIMESTAMP DEFAULT now(),
            last_used_at TIMESTAMP DEFAULT now(),
            expires_at TIMESTAMP NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT true
        )
    """)
    op.execute("CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id)")
    op.execute("CREATE INDEX idx_user_sessions_active ON user_sessions(user_id, is_active)")

    # ----------------------------------------------------------------
    # 5. Create audit_logs table
    # ----------------------------------------------------------------
    op.execute("""
        CREATE TABLE audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            action VARCHAR(100) NOT NULL,
            resource_type VARCHAR(50),
            resource_id VARCHAR(255),
            ip_address VARCHAR(45),
            user_agent VARCHAR(500),
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id)")
    op.execute("CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC)")
    op.execute("CREATE INDEX idx_audit_logs_action ON audit_logs(action)")

    # ----------------------------------------------------------------
    # 6. Create user_invitations table
    # ----------------------------------------------------------------
    op.execute("""
        CREATE TABLE user_invitations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL,
            invited_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
            token_hash VARCHAR(64) NOT NULL UNIQUE,
            tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
            expires_at TIMESTAMP NOT NULL,
            accepted_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX idx_user_invitations_email ON user_invitations(email)")
    op.execute("CREATE INDEX idx_user_invitations_token ON user_invitations(token_hash)")


def downgrade() -> None:
    # Drop tables in reverse order
    op.execute("DROP TABLE IF EXISTS user_invitations CASCADE")
    op.execute("DROP TABLE IF EXISTS audit_logs CASCADE")
    op.execute("DROP TABLE IF EXISTS user_sessions CASCADE")
    op.execute("DROP TABLE IF EXISTS user_mfa CASCADE")

    # Remove added columns from users
    op.drop_column('users', 'title')
    op.drop_column('users', 'department')
    op.drop_column('users', 'sso_id')
    op.drop_column('users', 'sso_provider')
    op.drop_column('users', 'mfa_enabled')
    op.drop_column('users', 'password_changed_at')
    op.drop_column('users', 'notification_preferences')
    op.drop_column('users', 'language_preference')
    op.drop_column('users', 'timezone')
    op.drop_column('users', 'avatar_url')

    # Note: Cannot remove values from PostgreSQL ENUM types easily.
    # The added ENUM values (super_admin, analyst, viewer, invited) remain.
