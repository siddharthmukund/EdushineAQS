"""Lightweight webhook dispatch service for developer ecosystem events."""
import asyncio
import hashlib
import hmac
import json
import logging
from datetime import datetime

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.developer_repo import DeveloperRepository

logger = logging.getLogger(__name__)

# Used to sign outgoing webhook payloads
_WEBHOOK_SECRET = "aqs-webhook-secret"  # In production read from settings


def _sign_payload(payload_str: str) -> str:
    sig = hmac.new(_WEBHOOK_SECRET.encode(), payload_str.encode(), hashlib.sha256).hexdigest()
    return f"sha256={sig}"


class WebhookService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = DeveloperRepository(db)

    async def dispatch(self, event_type: str, payload: dict) -> None:
        """Create webhook events for all registered apps and fire delivery in background."""
        apps = await self.repo.get_apps_with_webhook()
        for app in apps:
            try:
                event = await self.repo.create_webhook_event(str(app.id), event_type, payload)
                asyncio.create_task(self._deliver(str(app.id), str(event.id), app.webhook_url, payload))
            except Exception as exc:
                logger.warning("Failed to queue webhook for app %s: %s", app.id, exc)

    async def _deliver(self, app_id: str, event_id: str, webhook_url: str, payload: dict) -> None:
        payload_str = json.dumps(payload, default=str)
        signature = _sign_payload(payload_str)
        headers = {
            "Content-Type": "application/json",
            "X-AQS-Signature": signature,
            "X-AQS-Event": payload.get("event_type", "unknown"),
            "User-Agent": "AQS-Webhooks/1.0",
        }
        success = False
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(webhook_url, content=payload_str, headers=headers)
                success = resp.status_code < 400
                if not success:
                    logger.warning("Webhook delivery to %s returned %d", webhook_url, resp.status_code)
        except httpx.RequestError as exc:
            logger.warning("Webhook delivery error to %s: %s", webhook_url, exc)

        try:
            await self.repo.mark_webhook_delivered(event_id, success)
        except Exception as exc:
            logger.warning("Failed to update webhook delivery status: %s", exc)
