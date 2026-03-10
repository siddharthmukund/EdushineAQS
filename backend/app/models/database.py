import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text, JSON, DECIMAL, Boolean, Enum, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Analysis(Base):
    __tablename__ = 'analyses'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_name = Column(String(255), nullable=True)
    overall_aqs = Column(DECIMAL(5,2), nullable=True)
    research_score = Column(DECIMAL(5,2), nullable=True)
    education_score = Column(DECIMAL(5,2), nullable=True)
    teaching_score = Column(DECIMAL(5,2), nullable=True)
    fitment_score = Column(DECIMAL(5,2), nullable=True)
    recommendation = Column(String(50), nullable=True)
    result_json = Column(JSONB, nullable=True)
    job_description_hash = Column(String(64), nullable=True)
    processing_time_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    api_key_hash = Column(String(64), nullable=True)
    cost_usd = Column(DECIMAL(10,4), nullable=True)
    batch_id = Column(UUID(as_uuid=True), ForeignKey('batch_jobs.id'), nullable=True)
    filename = Column(String(255), nullable=True)

class BatchJob(Base):
    __tablename__ = 'batch_jobs'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cv_count = Column(Integer, nullable=False)
    completed_count = Column(Integer, default=0)
    status = Column(String(50), default="pending")
    total_cost_usd = Column(DECIMAL(10,4), nullable=True)
    total_time_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

class ApiKey(Base):
    __tablename__ = 'api_keys'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key_hash = Column(String(255), unique=True, nullable=False)
    name = Column(String(100), nullable=True)
    rate_limit_hour = Column(Integer, default=100)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)


# ---------------------------------------------------------------------------
# JWT Auth / Users
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = 'users'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(
        Enum('admin', 'committee_chair', 'committee_member', 'observer',
             'super_admin', 'analyst', 'viewer', 'invited', name='user_role'),
        default='committee_member',
        nullable=False,
    )
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)
    # ICCV #3 — enterprise auth additions
    avatar_url = Column(String(500), nullable=True)
    timezone = Column(String(50), default='UTC')
    language_preference = Column(String(10), default='en')
    notification_preferences = Column(JSONB, default=dict)
    password_changed_at = Column(DateTime, nullable=True)
    mfa_enabled = Column(Boolean, default=False, nullable=False)
    sso_provider = Column(String(50), nullable=True)   # 'google' | 'microsoft'
    sso_id = Column(String(255), nullable=True)         # IdP subject / oid
    department = Column(String(200), nullable=True)
    title = Column(String(200), nullable=True)


# ---------------------------------------------------------------------------
# Enterprise Auth — MFA, Sessions, Audit Logs, Invitations (ICCV #3)
# ---------------------------------------------------------------------------

class UserMFA(Base):
    __tablename__ = 'user_mfa'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), unique=True, nullable=False)
    totp_secret_encrypted = Column(String(500), nullable=False)
    recovery_codes_hashed = Column(JSONB, nullable=False)  # list of bcrypt hashes
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)


class UserSession(Base):
    __tablename__ = 'user_sessions'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False)  # SHA-256 hex of JWT
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)


class AuditLog(Base):
    __tablename__ = 'audit_logs'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True, index=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    extra_data = Column('metadata', JSONB, default=dict)   # 'metadata' reserved in SA; use extra_data attr
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class UserInvitation(Base):
    __tablename__ = 'user_invitations'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False, index=True)
    role = Column(String(50), nullable=False)              # plain string, no ENUM
    invited_by_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    token_hash = Column(String(64), unique=True, nullable=False)  # SHA-256 hex
    tenant_id = Column(UUID(as_uuid=True), ForeignKey('tenants.id'), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# Committee Collaboration
# ---------------------------------------------------------------------------

class Committee(Base):
    __tablename__ = 'committees'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id = Column(UUID(as_uuid=True), ForeignKey('batch_jobs.id'), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    created_by_name = Column(String(200), nullable=False)
    created_by_email = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class CommitteeMember(Base):
    __tablename__ = 'committee_members'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    committee_id = Column(UUID(as_uuid=True), ForeignKey('committees.id'), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    email = Column(String(255), nullable=False)
    role = Column(
        Enum('chair', 'member', 'observer', name='committee_member_role'),
        default='member',
        nullable=False,
    )
    joined_at = Column(DateTime, default=datetime.utcnow)


class CandidateVote(Base):
    __tablename__ = 'candidate_votes'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    committee_id = Column(UUID(as_uuid=True), ForeignKey('committees.id'), nullable=False, index=True)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey('analyses.id'), nullable=False, index=True)
    member_name = Column(String(200), nullable=False)
    member_email = Column(String(255), nullable=False)
    vote = Column(
        Enum('strong_yes', 'yes', 'maybe', 'no', 'strong_no', name='vote_type'),
        nullable=False,
    )
    comment = Column(Text, nullable=True)
    voted_at = Column(DateTime, default=datetime.utcnow)


class CandidateComment(Base):
    __tablename__ = 'candidate_comments'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    committee_id = Column(UUID(as_uuid=True), ForeignKey('committees.id'), nullable=False, index=True)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey('analyses.id'), nullable=False, index=True)
    author_name = Column(String(200), nullable=False)
    author_email = Column(String(255), nullable=False)
    comment = Column(Text, nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey('candidate_comments.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# Multi-Tenancy
# ---------------------------------------------------------------------------

class Tenant(Base):
    __tablename__ = 'tenants'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    subdomain = Column(String(100), unique=True, nullable=False, index=True)
    plan = Column(
        Enum('free', 'pro', 'enterprise', name='tenant_plan'),
        default='free',
        nullable=False,
    )
    region = Column(
        Enum('us', 'eu', 'ap', name='tenant_region'),
        default='us',
        nullable=False,
    )
    is_active = Column(Boolean, default=True, nullable=False)
    settings = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# Candidate Platform
# ---------------------------------------------------------------------------

class CandidateProfile(Base):
    __tablename__ = 'candidate_profiles'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey('tenants.id'), nullable=False, index=True)
    orcid_id = Column(String(50), unique=True, nullable=True)
    email = Column(String(255), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    institution = Column(String(300), nullable=True)
    h_index = Column(Integer, nullable=True)
    research_areas = Column(ARRAY(String), default=list)
    bio = Column(Text, nullable=True)
    job_preferences = Column(JSON, default=dict)
    is_public = Column(Boolean, default=True, nullable=False)
    orcid_verified = Column(Boolean, default=False, nullable=False)
    orcid_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class JobPosting(Base):
    __tablename__ = 'job_postings'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey('tenants.id'), nullable=False, index=True)
    title = Column(String(300), nullable=False)
    institution = Column(String(300), nullable=False)
    department = Column(String(200), nullable=True)
    position_type = Column(
        Enum('tenure_track', 'postdoc', 'lecturer', 'visiting', 'research', name='position_type'),
        nullable=False,
    )
    description = Column(Text, nullable=False)
    requirements = Column(JSON, default=dict)
    salary_range = Column(JSON, nullable=True)
    location = Column(String(200), nullable=True)
    deadline = Column(Date, nullable=True)
    created_by_email = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True, nullable=False)


class JobApplication(Base):
    __tablename__ = 'job_applications'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_profile_id = Column(UUID(as_uuid=True), ForeignKey('candidate_profiles.id'), nullable=False, index=True)
    job_posting_id = Column(UUID(as_uuid=True), ForeignKey('job_postings.id'), nullable=False, index=True)
    analysis_id = Column(UUID(as_uuid=True), ForeignKey('analyses.id'), nullable=True, index=True)
    status = Column(
        Enum('submitted', 'reviewing', 'shortlisted', 'interviewed', 'offered', 'rejected', name='application_status'),
        default='submitted',
        nullable=False,
    )
    status_history = Column(JSON, default=list)
    cover_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# Developer Ecosystem
# ---------------------------------------------------------------------------

class DeveloperApp(Base):
    __tablename__ = 'developer_apps'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey('tenants.id'), nullable=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    developer_email = Column(String(255), nullable=False, index=True)
    api_key_hash = Column(String(255), unique=True, nullable=False)
    api_key_prefix = Column(String(8), nullable=False)
    webhook_url = Column(String(500), nullable=True)
    rate_limit_hour = Column(Integer, default=1000)
    category = Column(
        Enum('analytics', 'integration', 'workflow', 'reporting', 'other', name='app_category'),
        default='other',
        nullable=False,
    )
    is_active = Column(Boolean, default=True, nullable=False)
    is_marketplace_listed = Column(Boolean, default=False, nullable=False)
    total_requests = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)


class WebhookEvent(Base):
    __tablename__ = 'webhook_events'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    developer_app_id = Column(UUID(as_uuid=True), ForeignKey('developer_apps.id'), nullable=False, index=True)
    event_type = Column(String(100), nullable=False)
    payload = Column(JSON, nullable=False)
    delivered = Column(Boolean, default=False, nullable=False)
    attempts = Column(Integer, default=0)
    last_attempt_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
