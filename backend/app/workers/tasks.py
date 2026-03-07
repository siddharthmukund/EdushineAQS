from app.workers.celery_app import celery_app
import asyncio
import json
import logging
from datetime import datetime
from decimal import Decimal

logger = logging.getLogger(__name__)

async def publish_progress(batch_id: str, progress_data: dict):
    """Publish progress update to Redis for WebSocket broadcasting."""
    import redis.asyncio as redis
    import os
    
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    redis_client = redis.from_url(redis_url)
    
    try:
        channel = f"batch:{batch_id}:progress"
        await redis_client.publish(channel, json.dumps(progress_data))
    except Exception as e:
        logger.error(f"Failed to publish progress: {e}")
    finally:
        await redis_client.close()

@celery_app.task(bind=True, name="process_batch_task")
def process_batch_task(self, batch_id: str, saved_files: list, jd: str, llm_provider: str):
    """
    Process batch of CVs asynchronously.
    
    Args:
        batch_id: UUID of batch job
        saved_files: [{"original_filename": str, "file_path": str}, ...]
        jd: Job description
        llm_provider: claude | gpt4o | gemini
    """
    
    try:
        # Use asyncio.run directly to avoid leaking loops
        asyncio.run(_process_batch_async(batch_id, saved_files, jd, llm_provider))
    except Exception as e:
        logger.error(f"Top-level celery task error: {e}")

async def process_single_cv(sem, idx, cv_data, batch_id, total, jd, llm_provider, llm_service, analysis_repo):
    """Helper coroutine for analyzing a single CV within a semaphore lock"""
    import os
    from app.services.pdf_parser import PDFParser
    from decimal import Decimal

    async with sem:
        try:
            # Publish parsing status
            await publish_progress(batch_id, {
                "stage": "parsing",
                "current": idx + 1,
                "total": total,
                "current_filename": cv_data["original_filename"],
                "percentage": ((idx + 1) / total) * 100
            })

            # Read file from disk
            file_path = cv_data["file_path"]
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"File not found on worker disk: {file_path}")
            
            # Since PDFParser is async but expects an UploadFile/Spooled interface,
            # We will read its bytes and mock it for extract_text if needed, or bypass.
            # Usually we use a local utility. Here, we'll read bytes into memory for the parser.
            # But the PDFParser expects `read()`.
            with open(file_path, "rb") as f:
                class MockUploadFile:
                    def __init__(self, f): self.file = f
                    def read(self): return self.file.read()
                
                text = await PDFParser.extract_text(MockUploadFile(f))
            
            # Analyze CV (uses litellm with caching)
            result = await llm_service.analyze(
                cv_text=text,
                jd=jd,
                model=llm_provider
            )
            
            # Extract scores from result
            scores = result.get("scores", {})
            fitment = result.get("fitment", {})
            
            # Calculate cost (rough estimate based on tokens)
            tokens = result.get("metadata", {}).get("tokens_used", {})
            cost = _estimate_cost(tokens, llm_provider)
            
            # Save to database
            await analysis_repo.create({
                "batch_id": batch_id,
                "filename": cv_data["original_filename"],
                "candidate_name": result.get("basic_info", {}).get("name", "Unknown"),
                "result_json": result,
                "overall_aqs": Decimal(str(scores.get("overall_aqs", 0))),
                "research_score": Decimal(str(scores.get("research_score", 0))),
                "education_score": Decimal(str(scores.get("education_score", 0))),
                "teaching_score": Decimal(str(scores.get("teaching_score", 0))),
                "fitment_score": Decimal(str(fitment.get("fitment_score", 0))),
                "recommendation": fitment.get("recommendation", "Unknown"),
                "cost_usd": cost
            })
            
            return {"success": True, "cost": cost, "filename": cv_data["original_filename"]}
        except Exception as e:
            logger.error(f"Failed to process {cv_data['original_filename']}: {e}")
            return {"success": False, "error": str(e), "filename": cv_data["original_filename"]}


async def _process_batch_async(batch_id: str, saved_files: list, jd: str, llm_provider: str):
    """Async implementation of batch processing using Semaphores."""
    from app.services.llm_service import LLMService
    from app.repositories.batch_repo import BatchRepository
    from app.repositories.analysis_repo import AnalysisRepository
    from app.services.storage import StorageService
    from app.dependencies import get_db_session
    
    logger.info(f"Starting batch processing for {batch_id}")
    
    # Get async DB session
    async for session in get_db_session():
        try:
            # Initialize services
            llm_service = LLMService(default_model=llm_provider)
            batch_repo = BatchRepository(session)
            analysis_repo = AnalysisRepository(session)
            
            # Update status to processing
            await batch_repo.update(batch_id, {"status": "processing"})
            
            total_cost = Decimal(0)
            completed = 0
            total = len(saved_files)
            
            # Concurrency Semaphore: max 5 concurrent requests to avoid rate limits / OOM
            sem = asyncio.Semaphore(5)
            
            # Start parallel chunk parsing
            tasks = [
                process_single_cv(sem, idx, cv_data, batch_id, total, jd, llm_provider, llm_service, analysis_repo)
                for idx, cv_data in enumerate(saved_files)
            ]
            
            for coro in asyncio.as_completed(tasks):
                res = await coro
                if res["success"]:
                    completed += 1
                    total_cost += res["cost"]
                    
                    # Update batch progress periodically
                    await batch_repo.update(batch_id, {
                        "completed_count": completed,
                        "total_cost_usd": total_cost
                    })

            # Cleanup disk payload
            StorageService.cleanup_batch(batch_id)
            
            # Mark complete
            await batch_repo.update(batch_id, {
                "status": "complete",
                "completed_at": datetime.utcnow()
            })
            
            # Publish final status
            await publish_progress(batch_id, {
                "stage": "complete",
                "percentage": 100,
                "current": total,
                "total": total,
                "total_cost": float(total_cost)
            })
            
            logger.info(f"Batch {batch_id} completed. Processed {completed}/{total} CVs. Total cost: ${total_cost}")
            
        except Exception as e:
            logger.error(f"Batch processing failed: {e}")
            await batch_repo.update(batch_id, {"status": "failed"})
            await publish_progress(batch_id, {
                "stage": "failed",
                "error": str(e)
            })
        finally:
            await session.close()
            break

def _estimate_cost(tokens: dict, provider: str) -> Decimal:
    """Estimate API cost based on token usage and provider."""
    input_tokens = tokens.get("input", 0)
    output_tokens = tokens.get("output", 0)
    
    # Cost per million tokens
    costs = {
        "claude-3-5-sonnet-20241022": {"input": 3.0, "output": 15.0},
        "gpt-4o": {"input": 5.0, "output": 15.0},
        "gemini-2.0-flash-exp": {"input": 0.3, "output": 1.2}
    }
    
    # Default to Claude costs
    cost_config = costs.get(provider, costs["claude-3-5-sonnet-20241022"])
    
    cost = (input_tokens * cost_config["input"] / 1_000_000) + \
           (output_tokens * cost_config["output"] / 1_000_000)
    
    return Decimal(str(round(cost, 4)))
