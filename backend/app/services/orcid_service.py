"""ORCID public API integration for profile verification and enrichment."""
import json
import logging
from typing import Any

import httpx
import redis.asyncio as aioredis
from fastapi import HTTPException

from app.config import settings

logger = logging.getLogger(__name__)

ORCID_BASE = "https://pub.orcid.org/v3.0"
CACHE_TTL = 60 * 60 * 24  # 24 hours


class ORCIDService:
    def __init__(self):
        self._redis: aioredis.Redis | None = None

    def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    async def fetch_profile(self, orcid_id: str) -> dict[str, Any]:
        """Fetch and cache raw ORCID record. Raises HTTPException on failure."""
        cache_key = f"orcid:{orcid_id}"
        redis = self._get_redis()

        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)

        url = f"{ORCID_BASE}/{orcid_id}/record"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers={"Accept": "application/json"})
        except httpx.RequestError as exc:
            logger.warning("ORCID API request error for %s: %s", orcid_id, exc)
            raise HTTPException(status_code=502, detail="ORCID API unreachable")

        if resp.status_code == 404:
            raise HTTPException(status_code=404, detail=f"ORCID ID {orcid_id!r} not found")
        if resp.status_code != 200:
            logger.warning("ORCID API returned %d for %s", resp.status_code, orcid_id)
            raise HTTPException(status_code=502, detail="ORCID API error")

        raw = resp.json()
        await redis.setex(cache_key, CACHE_TTL, json.dumps(raw))
        return raw

    def parse_profile(self, raw: dict[str, Any]) -> dict[str, Any]:
        """Extract structured fields from a raw ORCID /record response."""
        try:
            person = raw.get("person", {})
            name_block = person.get("name", {}) or {}
            given = (name_block.get("given-names") or {}).get("value", "")
            family = (name_block.get("family-name") or {}).get("value", "")
            full_name = f"{given} {family}".strip()

            # biography
            bio_block = person.get("biography", {}) or {}
            bio = bio_block.get("content") if bio_block else None

            # primary affiliation — take the first employment
            activities = raw.get("activities-summary", {})
            employments = (activities.get("employments") or {}).get("affiliation-group", [])
            institution = None
            if employments:
                summaries = employments[0].get("summaries", [])
                if summaries:
                    org = summaries[0].get("employment-summary", {}).get("organization", {})
                    institution = org.get("name")

            # works count as a proxy for h-index (ORCID doesn't expose h-index directly)
            works_group = (activities.get("works") or {}).get("group", [])
            h_index_proxy = len(works_group)

            # keywords as research areas
            keywords_block = person.get("keywords", {}) or {}
            keywords = keywords_block.get("keyword", [])
            research_areas = [k.get("content", "") for k in keywords if k.get("content")]

        except Exception as exc:
            logger.warning("ORCID parse error: %s", exc)
            return {"name": None, "institution": None, "h_index_proxy": 0, "research_areas": [], "bio": None}

        return {
            "name": full_name or None,
            "institution": institution,
            "h_index_proxy": h_index_proxy,
            "research_areas": research_areas[:10],
            "bio": bio,
        }
