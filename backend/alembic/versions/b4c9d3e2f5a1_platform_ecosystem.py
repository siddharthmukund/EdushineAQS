"""platform_ecosystem: tenants, candidate_profiles, job_postings, job_applications, developer_apps, webhook_events

Revision ID: b4c9d3e2f5a1
Revises: a3f8c2d1e4b5
Create Date: 2026-03-07 00:00:00.000000
"""
from alembic import op
from sqlalchemy.dialects import postgresql

revision = 'b4c9d3e2f5a1'
down_revision = 'a3f8c2d1e4b5'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # --- Create ENUMs explicitly (checkfirst=True avoids duplicate errors) ---
    postgresql.ENUM('free', 'pro', 'enterprise',
                    name='tenant_plan').create(conn, checkfirst=True)
    postgresql.ENUM('us', 'eu', 'ap',
                    name='tenant_region').create(conn, checkfirst=True)
    postgresql.ENUM('tenure_track', 'postdoc', 'lecturer', 'visiting', 'research',
                    name='position_type').create(conn, checkfirst=True)
    postgresql.ENUM('submitted', 'reviewing', 'shortlisted', 'interviewed', 'offered', 'rejected',
                    name='application_status').create(conn, checkfirst=True)
    postgresql.ENUM('analytics', 'integration', 'workflow', 'reporting', 'other',
                    name='app_category').create(conn, checkfirst=True)

    # Use raw SQL for all tables to bypass SQLAlchemy's automatic ENUM
    # re-creation via _on_table_create (a SQLAlchemy 2.x behavior).

    # --- tenants ---
    op.execute("""
        CREATE TABLE tenants (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(200) NOT NULL,
            subdomain VARCHAR(100) NOT NULL UNIQUE,
            plan tenant_plan NOT NULL DEFAULT 'free',
            region tenant_region NOT NULL DEFAULT 'us',
            is_active BOOLEAN NOT NULL DEFAULT true,
            settings JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_tenants_subdomain ON tenants(subdomain)")

    # Seed the default tenant so existing data has a home
    op.execute(
        "INSERT INTO tenants (id, name, subdomain, plan, region) "
        "VALUES (gen_random_uuid(), 'Default', 'default', 'enterprise', 'us')"
    )

    # --- candidate_profiles ---
    op.execute("""
        CREATE TABLE candidate_profiles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            orcid_id VARCHAR(50) UNIQUE,
            email VARCHAR(255) NOT NULL,
            name VARCHAR(200) NOT NULL,
            institution VARCHAR(300),
            h_index INTEGER,
            research_areas TEXT[] DEFAULT '{}',
            bio TEXT,
            job_preferences JSONB DEFAULT '{}',
            is_public BOOLEAN NOT NULL DEFAULT true,
            orcid_verified BOOLEAN NOT NULL DEFAULT false,
            orcid_data JSONB,
            created_at TIMESTAMP DEFAULT now(),
            updated_at TIMESTAMP DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_candidate_profiles_tenant_id ON candidate_profiles(tenant_id)")
    op.execute("CREATE INDEX ix_candidate_profiles_email ON candidate_profiles(email)")

    # --- job_postings ---
    op.execute("""
        CREATE TABLE job_postings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            title VARCHAR(300) NOT NULL,
            institution VARCHAR(300) NOT NULL,
            department VARCHAR(200),
            position_type position_type NOT NULL,
            description TEXT NOT NULL,
            requirements JSONB DEFAULT '{}',
            salary_range JSONB,
            location VARCHAR(200),
            deadline DATE,
            created_by_email VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT now(),
            is_active BOOLEAN NOT NULL DEFAULT true
        )
    """)
    op.execute("CREATE INDEX ix_job_postings_tenant_id ON job_postings(tenant_id)")

    # --- job_applications ---
    op.execute("""
        CREATE TABLE job_applications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id),
            job_posting_id UUID NOT NULL REFERENCES job_postings(id),
            analysis_id UUID REFERENCES analyses(id),
            status application_status NOT NULL DEFAULT 'submitted',
            status_history JSONB DEFAULT '[]',
            cover_note TEXT,
            created_at TIMESTAMP DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_job_applications_candidate_profile_id ON job_applications(candidate_profile_id)")
    op.execute("CREATE INDEX ix_job_applications_job_posting_id ON job_applications(job_posting_id)")
    op.execute("CREATE INDEX ix_job_applications_analysis_id ON job_applications(analysis_id)")

    # --- developer_apps ---
    op.execute("""
        CREATE TABLE developer_apps (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID REFERENCES tenants(id),
            name VARCHAR(200) NOT NULL,
            description TEXT,
            developer_email VARCHAR(255) NOT NULL,
            api_key_hash VARCHAR(255) NOT NULL UNIQUE,
            api_key_prefix VARCHAR(8) NOT NULL,
            webhook_url VARCHAR(500),
            rate_limit_hour INTEGER DEFAULT 1000,
            category app_category NOT NULL DEFAULT 'other',
            is_active BOOLEAN NOT NULL DEFAULT true,
            is_marketplace_listed BOOLEAN NOT NULL DEFAULT false,
            total_requests INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT now(),
            last_used_at TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX ix_developer_apps_tenant_id ON developer_apps(tenant_id)")
    op.execute("CREATE INDEX ix_developer_apps_developer_email ON developer_apps(developer_email)")

    # --- webhook_events ---
    op.execute("""
        CREATE TABLE webhook_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            developer_app_id UUID NOT NULL REFERENCES developer_apps(id),
            event_type VARCHAR(100) NOT NULL,
            payload JSONB NOT NULL,
            delivered BOOLEAN NOT NULL DEFAULT false,
            attempts INTEGER DEFAULT 0,
            last_attempt_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_webhook_events_developer_app_id ON webhook_events(developer_app_id)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS webhook_events")
    op.execute("DROP TABLE IF EXISTS developer_apps")
    op.execute("DROP TABLE IF EXISTS job_applications")
    op.execute("DROP TABLE IF EXISTS job_postings")
    op.execute("DROP TABLE IF EXISTS candidate_profiles")
    op.execute("DROP TABLE IF EXISTS tenants")

    conn = op.get_bind()
    postgresql.ENUM(name='app_category').drop(conn, checkfirst=True)
    postgresql.ENUM(name='application_status').drop(conn, checkfirst=True)
    postgresql.ENUM(name='position_type').drop(conn, checkfirst=True)
    postgresql.ENUM(name='tenant_region').drop(conn, checkfirst=True)
    postgresql.ENUM(name='tenant_plan').drop(conn, checkfirst=True)
