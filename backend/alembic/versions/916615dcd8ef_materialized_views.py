"""materialized_views

Revision ID: 916615dcd8ef
Revises: d77b2abbac8d
Create Date: 2026-03-06 14:23:23.677652

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '916615dcd8ef'
down_revision: Union[str, Sequence[str], None] = 'd77b2abbac8d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
        CREATE MATERIALIZED VIEW candidate_summaries AS
        SELECT 
            id,
            candidate_name,
            overall_aqs,
            research_score,
            education_score,
            teaching_score,
            recommendation,
            created_at,
            batch_id,
            -- Pre-compute frequently accessed fields
            NULLIF((result_json->'research'->'metrics'->>'h_index'), '')::int as h_index,
            (result_json->'education'->0->>'institution') as institution,
            jsonb_array_length(COALESCE(result_json->'research'->'publications', '[]'::jsonb)) as pub_count
        FROM analyses;
    """)

    op.execute("CREATE UNIQUE INDEX idx_summaries_id ON candidate_summaries(id);")
    op.execute("CREATE INDEX idx_summaries_aqs ON candidate_summaries(overall_aqs DESC);")
    op.execute("CREATE INDEX idx_summaries_batch ON candidate_summaries(batch_id);")
    op.execute("CREATE INDEX idx_summaries_recommendation ON candidate_summaries(recommendation);")

    op.execute("""
        CREATE OR REPLACE FUNCTION refresh_candidate_summaries()
        RETURNS TRIGGER AS $$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY candidate_summaries;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER trigger_refresh_summaries
        AFTER INSERT OR UPDATE ON analyses
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_candidate_summaries();
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP TRIGGER IF EXISTS trigger_refresh_summaries ON analyses;")
    op.execute("DROP FUNCTION IF EXISTS refresh_candidate_summaries();")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS candidate_summaries;")
