import hashlib
import json
import uuid
import time
from typing import Any, Optional
import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.domain import AnalysisResponse, AnalysisResponseData
from app.services.llm_service import LLMService
from app.services.pdf_parser import PDFParser, PDFParserError
from app.services.scoring_service import ScoringService
from app.services.interview_generator import InterviewGenerator
from app.repositories.analysis_repo import AnalysisRepository
from app.api.deps import get_llm_service, get_analysis_repo, verify_api_key, get_redis

# Guest trial: 1 free analysis per guest token (24 h TTL in Redis)
GUEST_TRIAL_LIMIT = 1
GUEST_TRIAL_TTL = 86_400  # 24 hours

router = APIRouter(prefix="/analyze", tags=["Analysis"])

@router.post("", response_model=AnalysisResponse)
async def analyze_cv_file(
    cv_file: UploadFile = File(...),
    job_description: Optional[str] = Form(None),
    model: Optional[str] = Form(None),
    x_guest_token: Optional[str] = Header(None, alias="x-guest-token"),
    llm_service: LLMService = Depends(get_llm_service),
    analysis_repo: AnalysisRepository = Depends(get_analysis_repo),
    api_key: str = Depends(verify_api_key),
    redis_client: aioredis.Redis = Depends(get_redis),
):
    """Analyze a single academic CV. Authenticated users have no limit; guests
    get one free trial analysis identified by X-Guest-Token header."""

    # ── Guest trial enforcement ──────────────────────────────────────────────
    # verify_api_key returns "development-key" when no valid auth is provided.
    is_guest = (api_key == "development-key")
    new_guest_token: Optional[str] = None

    if is_guest:
        if x_guest_token:
            redis_key = f"guest_trial:{x_guest_token}"
            count = await redis_client.get(redis_key)
            if count and int(count) >= GUEST_TRIAL_LIMIT:
                raise HTTPException(
                    status_code=429,
                    detail="guest_limit_reached",
                    headers={"X-Guest-Limit-Reached": "true"},
                )
        else:
            # First visit — generate a fresh guest token
            new_guest_token = str(uuid.uuid4())
    # ────────────────────────────────────────────────────────────────────────

    start_time = time.time()

    try:
        # Extract Text
        try:
            cv_text = await PDFParser.extract_text(cv_file)
        except PDFParserError as e:
            raise HTTPException(status_code=400, detail=f"PDF parsing error: {e}")
            
        if len(cv_text) < 100:
            raise HTTPException(status_code=400, detail="CV text too short or unreadable")
            
        # Process via LLM
        llm_result = await llm_service.analyze(
            cv_text=cv_text,
            jd=job_description,
            model=model
        )
        
        # Enrich Scores
        enriched_result = ScoringService.enrich_scores(llm_result)
        
        # Save to DB
        processing_time_ms = int((time.time() - start_time) * 1000)

        def _extract_score(v: Any) -> float:
            """Handle both plain float (Claude/OpenAI) and dict-with-total (Gemini)."""
            if isinstance(v, dict):
                return float(v.get("total", v.get("score", 0.0)))
            try:
                return float(v)
            except (TypeError, ValueError):
                return 0.0

        scores_raw = enriched_result.get("scores", {})
        overall_aqs = _extract_score(scores_raw.get("overall_aqs", 0))
        research    = _extract_score(scores_raw.get("research", 0))
        education   = _extract_score(scores_raw.get("education", 0))
        teaching    = _extract_score(scores_raw.get("teaching", 0))
        recommendation = enriched_result.get("recommendation", "Need More Info")

        # Hash the API key / JWT so it always fits in VARCHAR(64)
        api_key_hash = hashlib.sha256(api_key.encode()).hexdigest() if api_key else None

        # In a real app we would query the price per token properly
        mock_cost = 0.05

        db_analysis = await analysis_repo.create({
            "candidate_name": cv_file.filename.replace(".pdf", ""),
            "overall_aqs": overall_aqs,
            "research_score": research,
            "education_score": education,
            "teaching_score": teaching,
            "recommendation": recommendation,
            "result_json": enriched_result,   # pass dict; SQLAlchemy JSONB handles serialisation
            "processing_time_ms": processing_time_ms,
            "api_key_hash": api_key_hash,
            "cost_usd": mock_cost
        })
        
        # Build response scores: use the FULL enriched dict so the frontend
        # ScoreCard receives breakdown sub-objects (research.total, research.breakdown …).
        # overall_aqs is always a scalar float; other sub-scores keep their dict form.
        response_scores = dict(enriched_result.get("scores", {}))
        response_scores["overall_aqs"] = overall_aqs  # guarantee scalar

        response_data = AnalysisResponseData(
            id=db_analysis.id,
            candidate_name=db_analysis.candidate_name,
            scores=response_scores,
            fitment=enriched_result.get("fitment", {}),
            validation=enriched_result.get("validation", {}),
            recommendation=db_analysis.recommendation,
            metadata=enriched_result.get("metadata", {}),
            created_at=db_analysis.created_at
        )
        
        # ── Record guest usage in Redis ───────────────────────────────────────
        if is_guest:
            token_to_record = x_guest_token or new_guest_token
            if token_to_record:
                redis_key = f"guest_trial:{token_to_record}"
                await redis_client.incr(redis_key)
                await redis_client.expire(redis_key, GUEST_TRIAL_TTL)
        # ─────────────────────────────────────────────────────────────────────

        response_meta: dict = {
            "timestamp": time.time(),
            "request_id": str(uuid.uuid4()),
        }
        if is_guest:
            response_meta["is_guest"] = True
            response_meta["trial_used"] = True
            if new_guest_token:
                response_meta["guest_token"] = new_guest_token

        return AnalysisResponse(
            status="success",
            data=response_data,
            meta=response_meta,
        )

    except HTTPException:
        raise
    except Exception as e:
        err_str = str(e)
        err_lower = err_str.lower()
        # Surface missing / invalid API key as a clear 503 instead of opaque 500
        if any(kw in err_lower for kw in ("authentication", "api key", "apikey", "unauthorized", "auth_error", "no api key", "api_key_invalid", "invalid api key")):
            raise HTTPException(
                status_code=503,
                detail="LLM API key is not configured or is invalid. Use the setup wizard to add a valid key.",
            )
        # Rate limit / quota exhausted — surface as 429 with a friendly message
        if any(kw in err_lower for kw in ("rate limit", "ratelimit", "quota", "resource_exhausted", "too many requests", "429")):
            raise HTTPException(
                status_code=429,
                detail=(
                    "LLM rate limit exceeded. "
                    "Please wait a moment and try again, or select a different model."
                ),
            )
        # Model not found (e.g. deprecated Gemini model name)
        if any(kw in err_lower for kw in ("not found", "notfounderror", "model_not_found", "404", "not supported")):
            raise HTTPException(
                status_code=422,
                detail=(
                    "The selected LLM model was not found or is no longer supported. "
                    "Try switching to a different model (e.g. Gemini 2.0 Flash or Claude 3.5 Sonnet)."
                ),
            )
        raise HTTPException(status_code=500, detail=f"Processing error: {err_str}")

@router.get("/{id}/interview-prep")
async def get_interview_prep(
    id: str,
    analysis_repo: AnalysisRepository = Depends(get_analysis_repo),
    _: str = Depends(verify_api_key),
):
    """Generate (or return cached) personalized interview questions for a candidate."""
    analysis = await analysis_repo.get_by_id(id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    generator = InterviewGenerator()
    result = await generator.generate(
        analysis_id=id,
        candidate_profile=analysis.result_json or {},
        jd_text=None,
    )
    return result


@router.get("/{id}", response_model=AnalysisResponse)
async def get_analysis_by_id(
    id: str,
    analysis_repo: AnalysisRepository = Depends(get_analysis_repo)
):
    """Get full details of a single analysis by ID."""
    analysis = await analysis_repo.get_by_id(id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    enriched_result = analysis.result_json or {}
    
    scores = ScoresModel(
        overall_aqs=float(analysis.overall_aqs) if analysis.overall_aqs else 0.0,
        research=float(analysis.research_score) if analysis.research_score else 0.0,
        education=float(analysis.education_score) if analysis.education_score else 0.0,
        teaching=float(analysis.teaching_score) if analysis.teaching_score else 0.0
    )
    scores_extra = dict(scores)
    scores_extra.update(enriched_result.get("scores", {}))

    response_data = AnalysisResponseData(
        id=analysis.id,
        candidate_name=analysis.candidate_name,
        scores=ScoresModel(**scores_extra),
        fitment=enriched_result.get("fitment", {}),
        validation=enriched_result.get("validation", {}),
        recommendation=analysis.recommendation,
        metadata=enriched_result.get("metadata", {}),
        created_at=analysis.created_at
    )
    
    return AnalysisResponse(
        status="success",
        data=response_data,
        meta={
            "timestamp": time.time(),
            "request_id": str(uuid.uuid4())
        }
    )
