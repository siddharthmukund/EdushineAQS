"""Public developer API — rate-limited, API-key authenticated."""
import uuid
from typing import Optional

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Header, Query
from pydantic import BaseModel
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


# --- Registration (open, no auth) ---

class AppRegisterRequest(BaseModel):
    name: str
    developer_email: str
    description: Optional[str] = None
    webhook_url: Optional[str] = None
    category: str = "other"


@router.post("/apps/register", status_code=201, include_in_schema=True)
async def register_app(body: AppRegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new developer app and receive a one-time API key."""
    repo = DeveloperRepository(db)
    app, raw_key = await repo.register_app(
        name=body.name,
        developer_email=body.developer_email,
        description=body.description,
        webhook_url=body.webhook_url,
        category=body.category,
    )
    return {
        "status": "success",
        "app_id": str(app.id),
        "api_key_prefix": app.api_key_prefix,
        "api_key": raw_key,  # Only returned once — must be saved by developer
        "warning": "Save this API key now — it will not be shown again.",
    }


@router.get("/apps/me")
async def get_my_app(app=Depends(_resolve_app)):
    """Return info about the calling developer app."""
    return {
        "status": "success",
        "app": {
            "id": str(app.id),
            "name": app.name,
            "description": app.description,
            "developer_email": app.developer_email,
            "api_key_prefix": app.api_key_prefix,
            "category": app.category,
            "rate_limit_hour": app.rate_limit_hour,
            "total_requests": app.total_requests,
            "is_marketplace_listed": app.is_marketplace_listed,
            "created_at": app.created_at.isoformat() if app.created_at else None,
        },
    }


# --- Public marketplace listing (no auth) ---

@router.get("/marketplace")
async def list_marketplace(
    category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    repo = DeveloperRepository(db)
    apps = await repo.list_marketplace_apps(category=category)
    return {
        "status": "success",
        "apps": [
            {
                "id": str(a.id),
                "name": a.name,
                "description": a.description,
                "developer_email": a.developer_email,
                "category": a.category,
                "total_requests": a.total_requests,
            }
            for a in apps
        ],
    }


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
