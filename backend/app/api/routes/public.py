"""Public developer API — rate-limited, API-key authenticated."""
import uuid
from typing import Optional

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.config import settings
from app.repositories.developer_repo import DeveloperRepository
from app.repositories.analysis_repo import AnalysisRepository

router = APIRouter(prefix="/api/v1/public", tags=["public-api"])

_RATE_WINDOW = 3600  # 1 hour in seconds


async def _get_redis() -> aioredis.Redis:
    return aioredis.from_url(settings.REDIS_URL, decode_responses=True)


async def _resolve_app(x_api_key: str = Header(...), db: AsyncSession = Depends(get_db)):
    """Dependency: resolves and rate-limits the calling developer app."""
    repo = DeveloperRepository(db)
    app = await repo.get_app_by_key(x_api_key)
    if not app:
        raise HTTPException(status_code=401, detail="Invalid API key")

    redis = await _get_redis()
    rate_key = f"pub_rate:{app.api_key_prefix}"
    count = await redis.incr(rate_key)
    if count == 1:
        await redis.expire(rate_key, _RATE_WINDOW)
    if count > app.rate_limit_hour:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    await repo.increment_requests(str(app.id))
    return app


# --- Rate-limited analysis reads ---

@router.get("/analyses/{analysis_id}")
async def get_analysis(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
    _app=Depends(_resolve_app),
):
    """Read an analysis result via developer API key."""
    repo = AnalysisRepository(db)
    result = await repo.get_by_id(uuid.UUID(analysis_id))
    if not result:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return {
        "status": "success",
        "analysis": {
            "id": str(result.id),
            "candidate_name": result.candidate_name,
            "overall_aqs": float(result.overall_aqs) if result.overall_aqs else None,
            "recommendation": result.recommendation,
            "created_at": result.created_at.isoformat() if result.created_at else None,
        },
    }


@router.get("/analyses/{analysis_id}/scores")
async def get_scores(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
    _app=Depends(_resolve_app),
):
    """Return only the scores block for an analysis."""
    repo = AnalysisRepository(db)
    result = await repo.get_by_id(uuid.UUID(analysis_id))
    if not result:
        raise HTTPException(status_code=404, detail="Analysis not found")
    scores = result.result_json.get("scores", {}) if result.result_json else {}
    return {"status": "success", "analysis_id": analysis_id, "scores": scores}


# --- Webhook test ---

@router.post("/apps/{app_id}/webhook-test")
async def test_webhook(
    app_id: str,
    app=Depends(_resolve_app),
    db: AsyncSession = Depends(get_db),
):
    if str(app.id) != app_id:
        raise HTTPException(status_code=403, detail="Cannot test webhook for a different app")
    if not app.webhook_url:
        raise HTTPException(status_code=400, detail="No webhook URL configured for this app")

    from app.services.webhook_service import WebhookService
    svc = WebhookService(db)
    await svc._deliver(
        str(app.id), "test-event-id", app.webhook_url,
        {"event_type": "webhook.test", "message": "This is a test from AQS Developer Platform"},
    )
    return {"status": "success", "message": f"Test webhook dispatched to {app.webhook_url}"}
