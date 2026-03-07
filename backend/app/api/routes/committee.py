"""Committee collaboration REST endpoints."""
import uuid
import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from app.api.deps import get_committee_repo, verify_api_key, get_committee_session
from app.repositories.committee_repo import CommitteeRepository
from app.services.auth_service import create_committee_session_token

router = APIRouter(prefix="/committee", tags=["Committee"])


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class CreateCommitteeRequest(BaseModel):
    batch_id: str
    name: str
    creator_name: str
    creator_email: EmailStr


class JoinCommitteeRequest(BaseModel):
    name: str
    email: EmailStr


class VoteRequest(BaseModel):
    candidate_id: str
    vote: str  # strong_yes | yes | maybe | no | strong_no
    comment: Optional[str] = None


class CommentRequest(BaseModel):
    candidate_id: str
    comment: str
    parent_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("", status_code=201)
async def create_committee(
    req: CreateCommitteeRequest,
    committee_repo: CommitteeRepository = Depends(get_committee_repo),
    _: str = Depends(verify_api_key),
):
    """Create a new hiring committee for a batch. Returns session token for the chair."""
    committee = await committee_repo.create_committee(
        batch_id=req.batch_id,
        name=req.name,
        creator_name=req.creator_name,
        creator_email=req.creator_email,
    )
    session_token = create_committee_session_token(
        committee_id=str(committee.id),
        member_name=req.creator_name,
        member_email=req.creator_email,
    )
    return {
        "committee_id": str(committee.id),
        "name": committee.name,
        "batch_id": str(committee.batch_id),
        "session_token": session_token,
        "created_at": committee.created_at.isoformat(),
    }


@router.get("/{committee_id}")
async def get_committee(
    committee_id: str,
    committee_repo: CommitteeRepository = Depends(get_committee_repo),
):
    """Get committee info and current member list."""
    committee = await committee_repo.get_committee(committee_id)
    if not committee:
        raise HTTPException(status_code=404, detail="Committee not found")
    members = await committee_repo.get_members(committee_id)
    return {
        "committee_id": str(committee.id),
        "name": committee.name,
        "batch_id": str(committee.batch_id),
        "created_by_name": committee.created_by_name,
        "created_at": committee.created_at.isoformat(),
        "members": members,
    }


@router.post("/{committee_id}/join")
async def join_committee(
    committee_id: str,
    req: JoinCommitteeRequest,
    committee_repo: CommitteeRepository = Depends(get_committee_repo),
):
    """Join a committee with name + email. Returns a session token."""
    committee = await committee_repo.get_committee(committee_id)
    if not committee:
        raise HTTPException(status_code=404, detail="Committee not found")

    await committee_repo.add_member(
        committee_id=committee_id,
        name=req.name,
        email=req.email,
    )
    session_token = create_committee_session_token(
        committee_id=committee_id,
        member_name=req.name,
        member_email=req.email,
    )
    return {"session_token": session_token, "committee_id": committee_id, "name": req.name}


@router.post("/{committee_id}/vote", status_code=201)
async def submit_vote(
    committee_id: str,
    req: VoteRequest,
    session: dict = Depends(get_committee_session),
    committee_repo: CommitteeRepository = Depends(get_committee_repo),
):
    """Submit (or update) a vote for a candidate."""
    valid_votes = {"strong_yes", "yes", "maybe", "no", "strong_no"}
    if req.vote not in valid_votes:
        raise HTTPException(status_code=400, detail=f"vote must be one of {valid_votes}")

    if session.get("committee_id") != committee_id:
        raise HTTPException(status_code=403, detail="Session not valid for this committee")

    vote = await committee_repo.submit_vote(
        committee_id=committee_id,
        candidate_id=req.candidate_id,
        member_name=session["name"],
        member_email=session["sub"],
        vote=req.vote,
        comment=req.comment,
    )
    return {
        "vote_id": str(vote.id),
        "vote": vote.vote,
        "voted_at": vote.voted_at.isoformat(),
    }


@router.get("/{committee_id}/votes/{candidate_id}")
async def get_votes(
    committee_id: str,
    candidate_id: str,
    committee_repo: CommitteeRepository = Depends(get_committee_repo),
):
    """Get vote tally and details for a candidate."""
    return await committee_repo.get_votes(committee_id, candidate_id)


@router.post("/{committee_id}/comment", status_code=201)
async def add_comment(
    committee_id: str,
    req: CommentRequest,
    session: dict = Depends(get_committee_session),
    committee_repo: CommitteeRepository = Depends(get_committee_repo),
):
    """Add a comment (or reply) on a candidate."""
    if session.get("committee_id") != committee_id:
        raise HTTPException(status_code=403, detail="Session not valid for this committee")

    comment = await committee_repo.add_comment(
        committee_id=committee_id,
        candidate_id=req.candidate_id,
        author_name=session["name"],
        author_email=session["sub"],
        comment=req.comment,
        parent_id=req.parent_id,
    )
    return {
        "comment_id": str(comment.id),
        "author_name": comment.author_name,
        "comment": comment.comment,
        "parent_id": str(comment.parent_id) if comment.parent_id else None,
        "created_at": comment.created_at.isoformat(),
    }


@router.get("/{committee_id}/comments/{candidate_id}")
async def get_comments(
    committee_id: str,
    candidate_id: str,
    committee_repo: CommitteeRepository = Depends(get_committee_repo),
):
    """Get threaded comments for a candidate."""
    return {"comments": await committee_repo.get_comments(committee_id, candidate_id)}


@router.get("/{committee_id}/summary")
async def get_summary(
    committee_id: str,
    committee_repo: CommitteeRepository = Depends(get_committee_repo),
):
    """Full committee decision summary: all candidates with vote tallies."""
    committee = await committee_repo.get_committee(committee_id)
    if not committee:
        raise HTTPException(status_code=404, detail="Committee not found")

    members = await committee_repo.get_members(committee_id)
    all_votes = await committee_repo.get_all_votes(committee_id)

    return {
        "committee_id": committee_id,
        "name": committee.name,
        "member_count": len(members),
        "candidates": all_votes,
        "generated_at": time.time(),
    }
