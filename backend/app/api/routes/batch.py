from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Request
from typing import List, Optional
import uuid
from app.repositories.batch_repo import BatchRepository
from app.repositories.analysis_repo import AnalysisRepository
from app.dependencies import get_db_session
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.storage import StorageService
from app.services.pdf_parser import PDFParser, PDFParserError
import logging

router = APIRouter(prefix="/batch", tags=["Batch"])
logger = logging.getLogger(__name__)

def get_batch_repo(db: AsyncSession = Depends(get_db_session)) -> BatchRepository:
    return BatchRepository(db)

def get_analysis_repo(db: AsyncSession = Depends(get_db_session)) -> AnalysisRepository:
    return AnalysisRepository(db)

@router.post("")
async def create_batch_job(
    request: Request,
    cv_files: List[UploadFile] = File(...),
    job_description: Optional[str] = Form(None),
    job_description_file: Optional[UploadFile] = File(None),
    llm_provider: str = Form("claude-3-5-sonnet-20241022"),
    batch_repo: BatchRepository = Depends(get_batch_repo)
):
    """
    Process multiple CVs in batch mode.
    
    Args:
        cv_files: List of PDF files (max 50)
        job_description: Single JD for all candidates
        llm_provider: Which LLM to use (affects cost calculation)
        
    Returns:
        {
            "batch_id": "uuid",
            "cv_count": 10,
            "status": "queued",
            "estimated_completion_minutes": 3,
            "websocket_url": "ws://api/ws/batch/{batch_id}"
        }
    """
    
    # Validation
    if len(cv_files) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 CVs per batch")
    
    if len(cv_files) == 0:
        raise HTTPException(status_code=400, detail="At least 1 CV file is required")
        
    final_jd_text = ""
    if job_description_file:
        try:
            final_jd_text = await PDFParser.extract_text(job_description_file)
        except Exception as e:
            logger.error(f"Failed to parse JD file: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to extract text from JD file: {str(e)}")
    elif job_description:
        final_jd_text = job_description
    else:
        raise HTTPException(status_code=400, detail="Either job_description text or job_description_file must be provided")
    
    # Create batch job
    batch_job = await batch_repo.create(cv_count=len(cv_files))
    batch_id = str(batch_job.id)
    
    logger.info(f"Created batch job {batch_id} with {len(cv_files)} CVs")
    
    # Offload parsing - just save to temp disk directly
    saved_files = await StorageService.save_uploads(batch_id, cv_files)
    
    if len(saved_files) == 0:
        raise HTTPException(status_code=500, detail="Failed to save uploaded files")
    
    # Queue batch processing task, passing only file paths (slimmer payload)
    from app.workers.tasks import process_batch_task
    process_batch_task.delay(
        batch_id=batch_id,
        saved_files=saved_files,
        jd=final_jd_text,
        llm_provider=llm_provider
    )
    
    # Construct WebSocket URL
    ws_scheme = "wss" if request.url.scheme == "https" else "ws"
    ws_url = f"{ws_scheme}://{request.url.netloc}/ws/batch/{batch_id}"
    
    return {
        "batch_id": batch_id,
        "cv_count": len(saved_files),
        "status": "queued",
        "estimated_completion_minutes": round(len(saved_files) * 5 / 60, 1),
        "websocket_url": ws_url
    }

@router.get("/{batch_id}")
async def get_batch_status(
    batch_id: str,
    batch_repo: BatchRepository = Depends(get_batch_repo)
):
    """Get the current status of a batch job."""
    batch = await batch_repo.get_by_id(batch_id)
    
    if not batch:
        raise HTTPException(status_code=404, detail="Batch job not found")
    
    return {
        "batch_id": str(batch.id),
        "cv_count": batch.cv_count,
        "completed_count": batch.completed_count,
        "status": batch.status,
        "total_cost_usd": float(batch.total_cost_usd) if batch.total_cost_usd else 0,
        "created_at": batch.created_at.isoformat(),
        "completed_at": batch.completed_at.isoformat() if batch.completed_at else None
    }

@router.get("/{batch_id}/results")
async def get_batch_results(
    batch_id: str,
    batch_repo: BatchRepository = Depends(get_batch_repo),
    analysis_repo: AnalysisRepository = Depends(get_analysis_repo)
):
    """Get all analysis results for a batch job."""
    batch = await batch_repo.get_by_id(batch_id)
    
    if not batch:
        raise HTTPException(status_code=404, detail="Batch job not found")
    
    # Get all analyses for this batch using materialized view
    analyses = await analysis_repo.get_batch_summaries(batch_id)
    
    # Convert to response format
    results = []
    for analysis in analyses:
        results.append({
            "id": str(analysis["id"]),
            "candidate_name": analysis["candidate_name"],
            "filename": "",
            "scores": {
                "overall_aqs": float(analysis["overall_aqs"]) if analysis["overall_aqs"] else 0,
                "research": float(analysis["research_score"]) if analysis["research_score"] else 0,
                "education": float(analysis["education_score"]) if analysis["education_score"] else 0,
                "teaching": float(analysis["teaching_score"]) if analysis["teaching_score"] else 0,
            },
            "fitment": {},
            "validation": {},
            "recommendation": analysis["recommendation"],
            "metadata": {
                "h_index": analysis["h_index"],
                "institution": analysis["institution"],
                "pub_count": analysis["pub_count"]
            },
            "created_at": analysis["created_at"].isoformat() if analysis["created_at"] else None
        })
    
    return {
        "batch_id": str(batch.id),
        "status": batch.status,
        "cv_count": batch.cv_count,
        "completed_count": batch.completed_count,
        "total_cost_usd": float(batch.total_cost_usd) if batch.total_cost_usd else 0,
        "results": results
    }
