#!/bin/bash
set -e

echo "==> Running Alembic migrations..."
alembic upgrade head && echo "==> Migrations done." || echo "==> Migration failed (continuing anyway)."

PORT="${PORT:-8000}"
echo "==> Starting Uvicorn on 0.0.0.0:${PORT}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT}"
