from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, verify_api_key
from app.repositories.candidate_repo import CandidateRepository
from app.services.orcid_service import ORCIDService

router = APIRouter(prefix="/api/candidate", tags=["candidate"])
_orcid = ORCIDService()


# --- Request/Response models ---

class ProfileCreate(BaseModel):
    email: str
    name: str
    institution: Optional[str] = None
    orcid_id: Optional[str] = None
    h_index: Optional[int] = None
    research_areas: list[str] = []
    bio: Optional[str] = None
    job_preferences: dict = {}


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    institution: Optional[str] = None
    h_index: Optional[int] = None
    research_areas: Optional[list[str]] = None
    bio: Optional[str] = None
    job_preferences: Optional[dict] = None
    is_public: Optional[bool] = None


class ORCIDVerifyRequest(BaseModel):
    orcid_id: str


class JobPostingCreate(BaseModel):
    title: str
    institution: str
    position_type: str
    description: str
    department: Optional[str] = None
    requirements: dict = {}
    salary_range: Optional[dict] = None
    location: Optional[str] = None
    deadline: Optional[str] = None
    created_by_email: str


class ApplyRequest(BaseModel):
    candidate_profile_id: str
    analysis_id: Optional[str] = None
    cover_note: Optional[str] = None


class StatusUpdateRequest(BaseModel):
    status: str
    note: Optional[str] = None


def _profile_to_dict(p) -> dict:
    return {
        "id": str(p.id),
        "tenant_id": str(p.tenant_id),
        "email": p.email,
        "name": p.name,
        "institution": p.institution,
        "orcid_id": p.orcid_id,
        "orcid_verified": p.orcid_verified,
        "h_index": p.h_index,
        "research_areas": p.research_areas or [],
        "bio": p.bio,
        "job_preferences": p.job_preferences or {},
        "is_public": p.is_public,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def _posting_to_dict(j) -> dict:
    return {
        "id": str(j.id),
        "tenant_id": str(j.tenant_id),
        "title": j.title,
        "institution": j.institution,
        "department": j.department,
        "position_type": j.position_type,
        "description": j.description,
        "requirements": j.requirements or {},
        "salary_range": j.salary_range,
        "location": j.location,
        "deadline": j.deadline.isoformat() if j.deadline else None,
        "created_by_email": j.created_by_email,
        "created_at": j.created_at.isoformat() if j.created_at else None,
        "is_active": j.is_active,
    }


def _application_to_dict(a) -> dict:
    return {
        "id": str(a.id),
        "candidate_profile_id": str(a.candidate_profile_id),
        "job_posting_id": str(a.job_posting_id),
        "analysis_id": str(a.analysis_id) if a.analysis_id else None,
        "status": a.status,
        "status_history": a.status_history or [],
        "cover_note": a.cover_note,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


# --- Profile endpoints ---

@router.post("/profile", status_code=201)
async def create_profile(body: ProfileCreate, request: Request, db: AsyncSession = Depends(get_db)):
    tenant_id = request.state.tenant["id"]
    repo = CandidateRepository(db)
    existing = await repo.get_profile_by_email(tenant_id, body.email)
    if existing:
        raise HTTPException(status_code=409, detail="Profile already exists for this email in this tenant")
    profile = await repo.create_profile(
        tenant_id=tenant_id, email=body.email, name=body.name,
        institution=body.institution, orcid_id=body.orcid_id, h_index=body.h_index,
        research_areas=body.research_areas, bio=body.bio, job_preferences=body.job_preferences,
    )
    return {"status": "success", "profile": _profile_to_dict(profile)}


@router.get("/profile/me")
async def get_my_profile(
    email: str = Query(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    tenant_id = request.state.tenant["id"]
    repo = CandidateRepository(db)
    profile = await repo.get_profile_by_email(tenant_id, email)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"status": "success", "profile": _profile_to_dict(profile)}


@router.get("/profile/{profile_id}")
async def get_profile(profile_id: str, db: AsyncSession = Depends(get_db)):
    repo = CandidateRepository(db)
    profile = await repo.get_profile_by_id(profile_id)
    if not profile or not profile.is_public:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"status": "success", "profile": _profile_to_dict(profile)}


@router.put("/profile/{profile_id}")
async def update_profile(
    profile_id: str, body: ProfileUpdate, db: AsyncSession = Depends(get_db)
):
    repo = CandidateRepository(db)
    existing = await repo.get_profile_by_id(profile_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Profile not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    profile = await repo.update_profile(profile_id, **updates)
    return {"status": "success", "profile": _profile_to_dict(profile)}


@router.post("/profile/{profile_id}/verify-orcid")
async def verify_orcid(
    profile_id: str, body: ORCIDVerifyRequest, db: AsyncSession = Depends(get_db)
):
    repo = CandidateRepository(db)
    existing = await repo.get_profile_by_id(profile_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Profile not found")

    raw = await _orcid.fetch_profile(body.orcid_id)
    parsed = _orcid.parse_profile(raw)

    profile = await repo.verify_orcid(profile_id, body.orcid_id, raw)
    return {
        "status": "success",
        "profile": _profile_to_dict(profile),
        "orcid_parsed": parsed,
    }


# --- Job posting endpoints ---

@router.get("/jobs")
async def list_jobs(
    request: Request,
    position_type: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = request.state.tenant["id"]
    repo = CandidateRepository(db)
    postings = await repo.list_job_postings(tenant_id, active_only=active_only, position_type=position_type)
    return {"status": "success", "jobs": [_posting_to_dict(p) for p in postings]}


@router.post("/jobs", status_code=201)
async def create_job(
    body: JobPostingCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _key=Depends(verify_api_key),
):
    tenant_id = request.state.tenant["id"]
    repo = CandidateRepository(db)
    posting = await repo.create_job_posting(
        tenant_id=tenant_id, title=body.title, institution=body.institution,
        position_type=body.position_type, description=body.description,
        created_by_email=body.created_by_email, department=body.department,
        requirements=body.requirements, salary_range=body.salary_range,
        location=body.location,
        deadline=date.fromisoformat(body.deadline) if body.deadline else None,
    )
    return {"status": "success", "job": _posting_to_dict(posting)}


@router.get("/jobs/{job_id}")
async def get_job(job_id: str, db: AsyncSession = Depends(get_db)):
    repo = CandidateRepository(db)
    posting = await repo.get_job_posting(job_id)
    if not posting:
        raise HTTPException(status_code=404, detail="Job posting not found")
    return {"status": "success", "job": _posting_to_dict(posting)}


# --- Application endpoints ---

@router.post("/jobs/{job_id}/apply", status_code=201)
async def apply_to_job(job_id: str, body: ApplyRequest, db: AsyncSession = Depends(get_db)):
    repo = CandidateRepository(db)
    posting = await repo.get_job_posting(job_id)
    if not posting or not posting.is_active:
        raise HTTPException(status_code=404, detail="Job posting not found or closed")
    application = await repo.apply_to_job(
        candidate_profile_id=body.candidate_profile_id,
        job_posting_id=job_id,
        analysis_id=body.analysis_id,
        cover_note=body.cover_note,
    )
    return {"status": "success", "application": _application_to_dict(application)}


@router.get("/applications")
async def get_applications(
    email: str = Query(...),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    tenant_id = request.state.tenant["id"]
    repo = CandidateRepository(db)
    profile = await repo.get_profile_by_email(tenant_id, email)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    applications = await repo.get_applications_for_candidate(str(profile.id))
    return {"status": "success", "applications": [_application_to_dict(a) for a in applications]}


@router.put("/applications/{application_id}/status")
async def update_application_status(
    application_id: str,
    body: StatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _key=Depends(verify_api_key),
):
    valid_statuses = {"submitted", "reviewing", "shortlisted", "interviewed", "offered", "rejected"}
    if body.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    repo = CandidateRepository(db)
    app = await repo.update_application_status(application_id, body.status, body.note)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"status": "success", "application": _application_to_dict(app)}
