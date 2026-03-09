import uuid
from datetime import datetime
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import CandidateProfile, JobPosting, JobApplication


class CandidateRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # --- CandidateProfile ---

    async def create_profile(
        self, tenant_id: str, email: str, name: str,
        institution: str | None = None, orcid_id: str | None = None,
        h_index: int | None = None, research_areas: list[str] | None = None,
        bio: str | None = None, job_preferences: dict | None = None,
    ) -> CandidateProfile:
        profile = CandidateProfile(
            tenant_id=uuid.UUID(str(tenant_id)),
            email=email,
            name=name,
            institution=institution,
            orcid_id=orcid_id,
            h_index=h_index,
            research_areas=research_areas or [],
            bio=bio,
            job_preferences=job_preferences or {},
        )
        self.db.add(profile)
        await self.db.commit()
        await self.db.refresh(profile)
        return profile

    async def get_profile_by_id(self, profile_id: str) -> CandidateProfile | None:
        result = await self.db.execute(
            select(CandidateProfile).where(CandidateProfile.id == uuid.UUID(str(profile_id)))
        )
        return result.scalar_one_or_none()

    async def get_profile_by_email(self, tenant_id: str, email: str) -> CandidateProfile | None:
        result = await self.db.execute(
            select(CandidateProfile).where(
                CandidateProfile.tenant_id == uuid.UUID(str(tenant_id)),
                CandidateProfile.email == email,
            )
        )
        return result.scalar_one_or_none()

    async def update_profile(self, profile_id: str, **fields) -> CandidateProfile | None:
        fields['updated_at'] = datetime.utcnow()
        await self.db.execute(
            update(CandidateProfile)
            .where(CandidateProfile.id == uuid.UUID(str(profile_id)))
            .values(**fields)
        )
        await self.db.commit()
        return await self.get_profile_by_id(profile_id)

    async def verify_orcid(self, profile_id: str, orcid_id: str, orcid_data: dict) -> CandidateProfile | None:
        return await self.update_profile(
            profile_id,
            orcid_id=orcid_id,
            orcid_verified=True,
            orcid_data=orcid_data,
        )

    # --- JobPosting ---

    async def create_job_posting(
        self, tenant_id: str, title: str, institution: str, position_type: str,
        description: str, created_by_email: str, department: str | None = None,
        requirements: dict | None = None, salary_range: dict | None = None,
        location: str | None = None, deadline=None,
    ) -> JobPosting:
        posting = JobPosting(
            tenant_id=uuid.UUID(str(tenant_id)),
            title=title,
            institution=institution,
            department=department,
            position_type=position_type,
            description=description,
            requirements=requirements or {},
            salary_range=salary_range,
            location=location,
            deadline=deadline,
            created_by_email=created_by_email,
        )
        self.db.add(posting)
        await self.db.commit()
        await self.db.refresh(posting)
        return posting

    async def list_job_postings(
        self, tenant_id: str, active_only: bool = True, position_type: str | None = None
    ) -> list[JobPosting]:
        stmt = select(JobPosting).where(JobPosting.tenant_id == uuid.UUID(str(tenant_id)))
        if active_only:
            stmt = stmt.where(JobPosting.is_active == True)
        if position_type:
            stmt = stmt.where(JobPosting.position_type == position_type)
        stmt = stmt.order_by(JobPosting.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_job_posting(self, posting_id: str) -> JobPosting | None:
        result = await self.db.execute(
            select(JobPosting).where(JobPosting.id == uuid.UUID(str(posting_id)))
        )
        return result.scalar_one_or_none()

    # --- JobApplication ---

    async def apply_to_job(
        self, candidate_profile_id: str, job_posting_id: str,
        analysis_id: str | None = None, cover_note: str | None = None,
    ) -> JobApplication:
        application = JobApplication(
            candidate_profile_id=uuid.UUID(str(candidate_profile_id)),
            job_posting_id=uuid.UUID(str(job_posting_id)),
            analysis_id=uuid.UUID(str(analysis_id)) if analysis_id else None,
            cover_note=cover_note,
            status_history=[{'status': 'submitted', 'changed_at': datetime.utcnow().isoformat(), 'note': 'Application submitted'}],
        )
        self.db.add(application)
        await self.db.commit()
        await self.db.refresh(application)
        return application

    async def get_applications_for_candidate(self, candidate_profile_id: str) -> list[JobApplication]:
        result = await self.db.execute(
            select(JobApplication)
            .where(JobApplication.candidate_profile_id == uuid.UUID(str(candidate_profile_id)))
            .order_by(JobApplication.created_at.desc())
        )
        return list(result.scalars().all())

    async def update_application_status(
        self, application_id: str, new_status: str, note: str | None = None
    ) -> JobApplication | None:
        result = await self.db.execute(
            select(JobApplication).where(JobApplication.id == uuid.UUID(str(application_id)))
        )
        app = result.scalar_one_or_none()
        if not app:
            return None

        history = list(app.status_history or [])
        history.append({'status': new_status, 'changed_at': datetime.utcnow().isoformat(), 'note': note or ''})

        await self.db.execute(
            update(JobApplication)
            .where(JobApplication.id == uuid.UUID(str(application_id)))
            .values(status=new_status, status_history=history)
        )
        await self.db.commit()
        await self.db.refresh(app)
        return app
