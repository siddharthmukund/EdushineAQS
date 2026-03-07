import json
import uuid
import time
from typing import Optional
from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.domain import AnalysisResponse, AnalysisResponseData, ScoresModel
from app.services.llm_service import LLMService
from app.services.pdf_parser import PDFParser, PDFParserError
from app.services.scoring_service import ScoringService
from app.services.interview_generator import InterviewGenerator
from app.repositories.analysis_repo import AnalysisRepository
from app.api.deps import get_llm_service, get_analysis_repo, verify_api_key

router = APIRouter(prefix="/analyze", tags=["Analysis"])

@router.post("", response_model=AnalysisResponse)
async def analyze_cv_file(
    cv_file: UploadFile = File(...),
    job_description: Optional[str] = Form(None),
    model: Optional[str] = Form(None),
    llm_service: LLMService = Depends(get_llm_service),
    analysis_repo: AnalysisRepository = Depends(get_analysis_repo),
    api_key: str = Depends(verify_api_key)
):
    """Analyze a single academic CV from a file upload."""
    
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
        
        overall_aqs = enriched_result.get("scores", {}).get("overall_aqs", 0)
        research = enriched_result.get("scores", {}).get("research", {}).get("total", 0)
        education = enriched_result.get("scores", {}).get("education", {}).get("total", 0)
        teaching = enriched_result.get("scores", {}).get("teaching", {}).get("total", 0)
        recommendation = enriched_result.get("recommendation", "Need More Info")
        
        # In a real app we would query the price per token properly
        mock_cost = 0.05
        
        db_analysis = await analysis_repo.create({
            "candidate_name": cv_file.filename.replace(".pdf", ""),
            "overall_aqs": float(overall_aqs) if isinstance(overall_aqs, (int, float)) else 0.0,
            "research_score": float(research) if isinstance(research, (int, float)) else 0.0,
            "education_score": float(education) if isinstance(education, (int, float)) else 0.0,
            "teaching_score": float(teaching) if isinstance(teaching, (int, float)) else 0.0,
            "recommendation": recommendation,
            "result_json": json.dumps(enriched_result),
            "processing_time_ms": processing_time_ms,
            "api_key_hash": api_key, # Usually hashed
            "cost_usd": mock_cost
        })
        
        # Create response data
        scores = ScoresModel(
            overall_aqs=float(overall_aqs) if isinstance(overall_aqs, (int, float)) else 0.0,
            research=float(research) if isinstance(research, (int, float)) else 0.0,
            education=float(education) if isinstance(education, (int, float)) else 0.0,
            teaching=float(teaching) if isinstance(teaching, (int, float)) else 0.0
        )
        # Re-apply additional dictionary structure if needed
        scores_extra = dict(scores)
        scores_extra.update(enriched_result.get("scores", {}))
        
        response_data = AnalysisResponseData(
            id=db_analysis.id,
            candidate_name=db_analysis.candidate_name,
            scores=ScoresModel(**scores_extra),
            fitment=enriched_result.get("fitment", {}),
            validation=enriched_result.get("validation", {}),
            recommendation=db_analysis.recommendation,
            metadata=enriched_result.get("metadata", {}),
            created_at=db_analysis.created_at
        )
        
        return AnalysisResponse(
            status="success",
            data=response_data,
            meta={
                "timestamp": time.time(),
                "request_id": str(uuid.uuid4())
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")

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
