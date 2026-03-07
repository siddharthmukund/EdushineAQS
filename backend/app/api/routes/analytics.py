from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
from app.api.deps import get_analysis_repo, verify_api_key
from app.repositories.analysis_repo import AnalysisRepository
from app.services.success_predictor import SuccessPredictor
from app.services.diversity_analytics import DiversityAnalytics

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/candidate/{analysis_id}/success-prediction")
async def get_success_prediction(
    analysis_id: str,
    analysis_repo: AnalysisRepository = Depends(get_analysis_repo),
    api_key: str = Depends(verify_api_key)
) -> Dict[str, Any]:
    """
    Get ML success prediction for a specific candidate based on AQS scores.
    """
    analysis = await analysis_repo.get_by_id(analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Candidate analysis not found")
        
    # We use the raw float scores from DB
    scores_dict = {
        "overall_aqs": float(analysis.overall_aqs) if analysis.overall_aqs else 0.0,
        "research_score": float(analysis.research_score) if analysis.research_score else 0.0,
        "education_score": float(analysis.education_score) if analysis.education_score else 0.0,
        "teaching_score": float(analysis.teaching_score) if analysis.teaching_score else 0.0
    }
    
    prediction = SuccessPredictor.predict_success_probability(scores_dict)
    
    return {
        "status": "success",
        "candidate_id": analysis_id,
        "candidate_name": analysis.candidate_name,
        "prediction": prediction
    }

@router.get("/batch/{batch_id}/diversity")
async def get_diversity_analytics(
    batch_id: str,
    analysis_repo: AnalysisRepository = Depends(get_analysis_repo),
    api_key: str = Depends(verify_api_key)
) -> Dict[str, Any]:
    """
    Get diversity and inclusion analytics for a candidate batch.
    """
    # Materialized view summary returns metadata mapping implicitly. Let's use it for aggregate stats.
    analyses = await analysis_repo.get_batch_summaries(batch_id, limit=500)
    
    if not analyses:
        raise HTTPException(status_code=404, detail="No candidates found for this batch")
        
    diversity_report = DiversityAnalytics.analyze_batch(analyses)
    
    return {
        "status": "success",
        "batch_id": batch_id,
        "analytics": diversity_report
    }
