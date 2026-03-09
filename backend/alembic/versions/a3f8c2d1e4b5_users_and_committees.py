"""users and committees

Revision ID: a3f8c2d1e4b5
Revises: 916615dcd8ef
Create Date: 2026-03-06 16:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'a3f8c2d1e4b5'
down_revision: Union[str, Sequence[str], None] = '916615dcd8ef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # --- ENUM TYPES (checkfirst=True prevents errors on re-runs) ---
    postgresql.ENUM('admin', 'committee_chair', 'committee_member', 'observer',
                    name='user_role').create(conn, checkfirst=True)
    postgresql.ENUM('chair', 'member', 'observer',
                    name='committee_member_role').create(conn, checkfirst=True)
    postgresql.ENUM('strong_yes', 'yes', 'maybe', 'no', 'strong_no',
                    name='vote_type').create(conn, checkfirst=True)

    # Use raw SQL for all tables to bypass SQLAlchemy's automatic ENUM
    # re-creation via _on_table_create (a SQLAlchemy 2.x behavior).

    # --- USERS ---
    op.execute("""
        CREATE TABLE users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) NOT NULL UNIQUE,
            name VARCHAR(200) NOT NULL,
            hashed_password VARCHAR(255) NOT NULL,
            role user_role NOT NULL DEFAULT 'committee_member',
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP DEFAULT now(),
            last_login_at TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX ix_users_email ON users(email)")

    # --- COMMITTEES ---
    op.execute("""
        CREATE TABLE committees (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            batch_id UUID NOT NULL REFERENCES batch_jobs(id),
            name VARCHAR(200) NOT NULL,
            created_by_name VARCHAR(200) NOT NULL,
            created_by_email VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_committees_batch_id ON committees(batch_id)")

    # --- COMMITTEE MEMBERS ---
    op.execute("""
        CREATE TABLE committee_members (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            committee_id UUID NOT NULL REFERENCES committees(id),
            name VARCHAR(200) NOT NULL,
            email VARCHAR(255) NOT NULL,
            role committee_member_role NOT NULL DEFAULT 'member',
            joined_at TIMESTAMP DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_committee_members_committee_id ON committee_members(committee_id)")

    # --- CANDIDATE VOTES ---
    op.execute("""
        CREATE TABLE candidate_votes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            committee_id UUID NOT NULL REFERENCES committees(id),
            candidate_id UUID NOT NULL REFERENCES analyses(id),
            member_name VARCHAR(200) NOT NULL,
            member_email VARCHAR(255) NOT NULL,
            vote vote_type NOT NULL,
            comment TEXT,
            voted_at TIMESTAMP DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_candidate_votes_committee_id ON candidate_votes(committee_id)")
    op.execute("CREATE INDEX ix_candidate_votes_candidate_id ON candidate_votes(candidate_id)")

    # --- CANDIDATE COMMENTS ---
    op.execute("""
        CREATE TABLE candidate_comments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            committee_id UUID NOT NULL REFERENCES committees(id),
            candidate_id UUID NOT NULL REFERENCES analyses(id),
            author_name VARCHAR(200) NOT NULL,
            author_email VARCHAR(255) NOT NULL,
            comment TEXT NOT NULL,
            parent_id UUID REFERENCES candidate_comments(id),
            created_at TIMESTAMP DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_candidate_comments_committee_id ON candidate_comments(committee_id)")
    op.execute("CREATE INDEX ix_candidate_comments_candidate_id ON candidate_comments(candidate_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS candidate_comments")
    op.execute("DROP TABLE IF EXISTS candidate_votes")
    op.execute("DROP TABLE IF EXISTS committee_members")
    op.execute("DROP TABLE IF EXISTS committees")
    op.execute("DROP TABLE IF EXISTS users")

    conn = op.get_bind()
    postgresql.ENUM(name='vote_type').drop(conn, checkfirst=True)
    postgresql.ENUM(name='committee_member_role').drop(conn, checkfirst=True)
    postgresql.ENUM(name='user_role').drop(conn, checkfirst=True)
