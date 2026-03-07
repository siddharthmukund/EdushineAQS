from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.database import BatchJob
from datetime import datetime
from decimal import Decimal

class BatchRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(self, cv_count: int, status: str = "queued") -> BatchJob:
        batch = BatchJob(cv_count=cv_count, status=status, completed_count=0)
        self.session.add(batch)
        await self.session.commit()
        await self.session.refresh(batch)
        return batch
    
    async def get_by_id(self, batch_id: str) -> BatchJob | None:
        result = await self.session.execute(
            select(BatchJob).where(BatchJob.id == batch_id)
        )
        return result.scalar_one_or_none()
        
    async def update_progress(self, batch_id: str, completed: int, status: str) -> BatchJob | None:
        batch = await self.get_by_id(batch_id)
        if batch:
            batch.completed_count = completed
            batch.status = status
            await self.session.commit()
            await self.session.refresh(batch)
        return batch
    
    async def update(self, batch_id: str, updates: dict) -> BatchJob | None:
        """Update batch job with arbitrary fields."""
        batch = await self.get_by_id(batch_id)
        if batch:
            for key, value in updates.items():
                if hasattr(batch, key):
                    setattr(batch, key, value)
            await self.session.commit()
            await self.session.refresh(batch)
        return batch
