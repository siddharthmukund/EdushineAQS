from celery import Celery
import os

# Configure Celery using environment variables with defaults
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")

celery_app = Celery(
    "cvanalyzer_workers",
    broker=redis_url,
    backend=redis_url,
    include=["app.workers.tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)
