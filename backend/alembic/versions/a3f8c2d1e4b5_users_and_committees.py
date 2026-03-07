"""users and committees

Revision ID: a3f8c2d1e4b5
Revises: 916615dcd8ef
Create Date: 2026-03-06 16:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a3f8c2d1e4b5'
down_revision: Union[str, Sequence[str], None] = '916615dcd8ef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- ENUM TYPES ---
    op.execute("CREATE TYPE user_role AS ENUM ('admin','committee_chair','committee_member','observer')")
    op.execute("CREATE TYPE committee_member_role AS ENUM ('chair','member','observer')")
    op.execute("CREATE TYPE vote_type AS ENUM ('strong_yes','yes','maybe','no','strong_no')")

    # --- USERS ---
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('role', sa.Enum('admin', 'committee_chair', 'committee_member', 'observer',
                                  name='user_role', create_type=False), nullable=False, server_default='committee_member'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('last_login_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_users_email', 'users', ['email'])

    # --- COMMITTEES ---
    op.create_table(
        'committees',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('batch_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('batch_jobs.id'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('created_by_name', sa.String(200), nullable=False),
        sa.Column('created_by_email', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_committees_batch_id', 'committees', ['batch_id'])

    # --- COMMITTEE MEMBERS ---
    op.create_table(
        'committee_members',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('committee_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('committees.id'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('role', sa.Enum('chair', 'member', 'observer',
                                  name='committee_member_role', create_type=False), nullable=False, server_default='member'),
        sa.Column('joined_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_committee_members_committee_id', 'committee_members', ['committee_id'])

    # --- CANDIDATE VOTES ---
    op.create_table(
        'candidate_votes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('committee_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('committees.id'), nullable=False),
        sa.Column('candidate_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('analyses.id'), nullable=False),
        sa.Column('member_name', sa.String(200), nullable=False),
        sa.Column('member_email', sa.String(255), nullable=False),
        sa.Column('vote', sa.Enum('strong_yes', 'yes', 'maybe', 'no', 'strong_no',
                                  name='vote_type', create_type=False), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('voted_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_candidate_votes_committee_id', 'candidate_votes', ['committee_id'])
    op.create_index('ix_candidate_votes_candidate_id', 'candidate_votes', ['candidate_id'])

    # --- CANDIDATE COMMENTS ---
    op.create_table(
        'candidate_comments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('committee_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('committees.id'), nullable=False),
        sa.Column('candidate_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('analyses.id'), nullable=False),
        sa.Column('author_name', sa.String(200), nullable=False),
        sa.Column('author_email', sa.String(255), nullable=False),
        sa.Column('comment', sa.Text(), nullable=False),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('candidate_comments.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_candidate_comments_committee_id', 'candidate_comments', ['committee_id'])
    op.create_index('ix_candidate_comments_candidate_id', 'candidate_comments', ['candidate_id'])


def downgrade() -> None:
    op.drop_table('candidate_comments')
    op.drop_table('candidate_votes')
    op.drop_table('committee_members')
    op.drop_table('committees')
    op.drop_table('users')

    op.execute("DROP TYPE IF EXISTS vote_type")
    op.execute("DROP TYPE IF EXISTS committee_member_role")
    op.execute("DROP TYPE IF EXISTS user_role")
