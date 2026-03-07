from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.database import Analysis
import json
from typing import List

class AnalysisRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(self, analysis_data: dict) -> Analysis:
        # Convert nested dicts to JSON serialization for JSONB storage where needed
        analysis = Analysis(**analysis_data)
        self.session.add(analysis)
        await self.session.commit()
        await self.session.refresh(analysis)
        return analysis
    
    async def get_by_id(self, analysis_id: str) -> Analysis | None:
        result = await self.session.execute(
            select(Analysis).where(Analysis.id == analysis_id)
        )
        return result.scalar_one_or_none()
    
    async def get_batch_summaries(self, batch_id: str, limit: int = 50) -> List[dict]:
        from sqlalchemy import text
        query = """
            SELECT 
                id, candidate_name, overall_aqs, research_score,
                education_score, teaching_score, recommendation,
                h_index, institution, pub_count, created_at
            FROM candidate_summaries
            WHERE batch_id = :batch_id
            ORDER BY overall_aqs DESC NULLS LAST
            LIMIT :limit
        """
        result = await self.session.execute(
            text(query),
            {"batch_id": batch_id, "limit": limit}
        )
        return [dict(row._mapping) for row in result]

    async def get_by_batch_id(self, batch_id: str) -> List[Analysis]:
        result = await self.session.execute(
            select(Analysis).where(Analysis.batch_id == batch_id).order_by(Analysis.overall_aqs.desc())
        )
        return result.scalars().all()
