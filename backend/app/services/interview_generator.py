"""LLM-powered personalized interview question generator."""
import json
import hashlib
from typing import Optional
from datetime import datetime

from app.services.llm_service import LLMService, LLMServiceError
from app.services.cache_service import CacheService


INTERVIEW_PROMPT = """\
You are an expert academic hiring consultant generating tailored interview questions.

Based on the candidate profile and job requirements provided, generate exactly 12 interview \
questions split across 4 categories:
- research (4 questions): deep-dive into publications, methodology, and future research agenda
- teaching (3 questions): pedagogical approach, course development, student engagement
- service (2 questions): departmental citizenship, collaboration, administration
- gaps (3 questions): probe specific weaknesses or gaps identified in the CV vs the JD

Return ONLY a JSON object matching this schema, no markdown, no preamble:
{
  "research": [
    {"question": "...", "purpose": "...", "follow_up": "..."}
  ],
  "teaching": [
    {"question": "...", "purpose": "...", "follow_up": "..."}
  ],
  "service": [
    {"question": "...", "purpose": "..."}
  ],
  "gaps": [
    {"question": "...", "purpose": "...", "follow_up": "..."}
  ]
}
"""


class InterviewGenerator:
    def __init__(self):
        self._llm = LLMService()
        self._cache = CacheService()

    async def generate(
        self,
        analysis_id: str,
        candidate_profile: dict,
        jd_text: Optional[str] = None,
    ) -> dict:
        cache_key = f"interview:{analysis_id}"
        cached = await self._cache.get(cache_key)
        if cached:
            return cached

        prompt_body = self._build_prompt(candidate_profile, jd_text)
        questions = await self._call_llm(prompt_body)

        result = {
            "analysis_id": analysis_id,
            "questions": questions,
            "generated_at": datetime.utcnow().isoformat(),
        }
        await self._cache.set(cache_key, result, ttl=3600)
        return result

    def _build_prompt(self, profile: dict, jd_text: Optional[str]) -> str:
        scores = profile.get("scores", {})
        fitment = profile.get("fitment", {})
        validation = profile.get("validation", {})

        pubs = validation.get("publications", [])
        top_pubs = [p.get("title", "") for p in pubs[:3] if p.get("title")]

        gaps = fitment.get("gaps", [])
        strengths = fitment.get("strengths", [])
        interview_topics = fitment.get("interview_topics", [])

        lines = [
            "=== CANDIDATE PROFILE ===",
            f"Overall AQS: {scores.get('overall_aqs', 'N/A')} / 100",
            f"Research score: {scores.get('research', {}).get('total', 'N/A') if isinstance(scores.get('research'), dict) else scores.get('research', 'N/A')} / 40",
            f"Education score: {scores.get('education', {}).get('total', 'N/A') if isinstance(scores.get('education'), dict) else scores.get('education', 'N/A')} / 30",
            f"Teaching score: {scores.get('teaching', {}).get('total', 'N/A') if isinstance(scores.get('teaching'), dict) else scores.get('teaching', 'N/A')} / 30",
            f"Top publications: {', '.join(top_pubs) or 'N/A'}",
            f"Identified strengths: {json.dumps(strengths)}",
            f"Identified gaps: {json.dumps(gaps)}",
            f"Suggested interview topics from fitment: {json.dumps(interview_topics)}",
            "",
            "=== JOB REQUIREMENTS ===",
            jd_text or "Not provided",
        ]
        return "\n".join(lines)

    async def _call_llm(self, prompt_body: str) -> dict:
        import litellm
        from app.config import settings

        try:
            response = await litellm.acompletion(
                model=settings.LLM_MODEL,
                messages=[
                    {"role": "system", "content": INTERVIEW_PROMPT},
                    {"role": "user", "content": prompt_body},
                ],
                temperature=0.7,
                max_tokens=3000,
            )
            raw = response.choices[0].message.content
            return self._parse_json(raw)
        except Exception as e:
            raise LLMServiceError(f"Interview generation failed: {e}")

    def _parse_json(self, text: str) -> dict:
        if "```json" in text:
            text = text[text.find("```json") + 7: text.rfind("```")].strip()
        elif "```" in text:
            text = text[text.find("```") + 3: text.rfind("```")].strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {"research": [], "teaching": [], "service": [], "gaps": [], "raw": text}
