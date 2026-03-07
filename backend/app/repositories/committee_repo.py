"""Data access layer for committee collaboration."""
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import Committee, CommitteeMember, CandidateVote, CandidateComment


class CommitteeRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    # ------------------------------------------------------------------
    # Committee CRUD
    # ------------------------------------------------------------------

    async def create_committee(
        self, batch_id: str, name: str, creator_name: str, creator_email: str
    ) -> Committee:
        committee = Committee(
            id=uuid.uuid4(),
            batch_id=uuid.UUID(batch_id),
            name=name,
            created_by_name=creator_name,
            created_by_email=creator_email,
        )
        self.session.add(committee)

        # Auto-add creator as chair
        chair = CommitteeMember(
            id=uuid.uuid4(),
            committee_id=committee.id,
            name=creator_name,
            email=creator_email,
            role="chair",
        )
        self.session.add(chair)

        await self.session.commit()
        await self.session.refresh(committee)
        return committee

    async def get_committee(self, committee_id: str) -> Optional[Committee]:
        result = await self.session.execute(
            select(Committee).where(Committee.id == uuid.UUID(committee_id))
        )
        return result.scalar_one_or_none()

    async def get_members(self, committee_id: str) -> list[dict]:
        result = await self.session.execute(
            select(CommitteeMember).where(
                CommitteeMember.committee_id == uuid.UUID(committee_id)
            )
        )
        members = result.scalars().all()
        return [
            {
                "id": str(m.id),
                "name": m.name,
                "email": m.email,
                "role": m.role,
                "joined_at": m.joined_at.isoformat(),
            }
            for m in members
        ]

    async def add_member(
        self, committee_id: str, name: str, email: str, role: str = "member"
    ) -> CommitteeMember:
        # Prevent duplicates by email
        existing = await self.session.execute(
            select(CommitteeMember).where(
                CommitteeMember.committee_id == uuid.UUID(committee_id),
                CommitteeMember.email == email,
            )
        )
        member = existing.scalar_one_or_none()
        if member:
            return member

        member = CommitteeMember(
            id=uuid.uuid4(),
            committee_id=uuid.UUID(committee_id),
            name=name,
            email=email,
            role=role,
        )
        self.session.add(member)
        await self.session.commit()
        await self.session.refresh(member)
        return member

    # ------------------------------------------------------------------
    # Voting
    # ------------------------------------------------------------------

    async def submit_vote(
        self,
        committee_id: str,
        candidate_id: str,
        member_name: str,
        member_email: str,
        vote: str,
        comment: Optional[str] = None,
    ) -> CandidateVote:
        # Upsert: replace previous vote by same member on same candidate
        existing = await self.session.execute(
            select(CandidateVote).where(
                CandidateVote.committee_id == uuid.UUID(committee_id),
                CandidateVote.candidate_id == uuid.UUID(candidate_id),
                CandidateVote.member_email == member_email,
            )
        )
        existing_vote = existing.scalar_one_or_none()
        if existing_vote:
            existing_vote.vote = vote
            existing_vote.comment = comment
            existing_vote.voted_at = datetime.utcnow()
            await self.session.commit()
            await self.session.refresh(existing_vote)
            return existing_vote

        new_vote = CandidateVote(
            id=uuid.uuid4(),
            committee_id=uuid.UUID(committee_id),
            candidate_id=uuid.UUID(candidate_id),
            member_name=member_name,
            member_email=member_email,
            vote=vote,
            comment=comment,
        )
        self.session.add(new_vote)
        await self.session.commit()
        await self.session.refresh(new_vote)
        return new_vote

    async def get_votes(self, committee_id: str, candidate_id: str) -> dict:
        result = await self.session.execute(
            select(CandidateVote).where(
                CandidateVote.committee_id == uuid.UUID(committee_id),
                CandidateVote.candidate_id == uuid.UUID(candidate_id),
            )
        )
        votes = result.scalars().all()
        tally: dict[str, int] = {
            "strong_yes": 0, "yes": 0, "maybe": 0, "no": 0, "strong_no": 0
        }
        details = []
        for v in votes:
            tally[v.vote] = tally.get(v.vote, 0) + 1
            details.append({
                "member_name": v.member_name,
                "member_email": v.member_email,
                "vote": v.vote,
                "comment": v.comment,
                "voted_at": v.voted_at.isoformat(),
            })
        return {"tally": tally, "total": len(votes), "details": details}

    async def get_all_votes(self, committee_id: str) -> list[dict]:
        """Vote tally for every candidate in the committee (for summary view)."""
        result = await self.session.execute(
            select(CandidateVote).where(
                CandidateVote.committee_id == uuid.UUID(committee_id)
            )
        )
        votes = result.scalars().all()
        per_candidate: dict[str, dict] = {}
        for v in votes:
            cid = str(v.candidate_id)
            if cid not in per_candidate:
                per_candidate[cid] = {
                    "candidate_id": cid,
                    "tally": {"strong_yes": 0, "yes": 0, "maybe": 0, "no": 0, "strong_no": 0},
                    "total": 0,
                }
            per_candidate[cid]["tally"][v.vote] += 1
            per_candidate[cid]["total"] += 1
        return list(per_candidate.values())

    # ------------------------------------------------------------------
    # Comments
    # ------------------------------------------------------------------

    async def add_comment(
        self,
        committee_id: str,
        candidate_id: str,
        author_name: str,
        author_email: str,
        comment: str,
        parent_id: Optional[str] = None,
    ) -> CandidateComment:
        c = CandidateComment(
            id=uuid.uuid4(),
            committee_id=uuid.UUID(committee_id),
            candidate_id=uuid.UUID(candidate_id),
            author_name=author_name,
            author_email=author_email,
            comment=comment,
            parent_id=uuid.UUID(parent_id) if parent_id else None,
        )
        self.session.add(c)
        await self.session.commit()
        await self.session.refresh(c)
        return c

    async def get_comments(self, committee_id: str, candidate_id: str) -> list[dict]:
        result = await self.session.execute(
            select(CandidateComment)
            .where(
                CandidateComment.committee_id == uuid.UUID(committee_id),
                CandidateComment.candidate_id == uuid.UUID(candidate_id),
            )
            .order_by(CandidateComment.created_at)
        )
        comments = result.scalars().all()
        return [
            {
                "id": str(c.id),
                "author_name": c.author_name,
                "author_email": c.author_email,
                "comment": c.comment,
                "parent_id": str(c.parent_id) if c.parent_id else None,
                "created_at": c.created_at.isoformat(),
            }
            for c in comments
        ]
