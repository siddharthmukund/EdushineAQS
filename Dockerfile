# Root-level Dockerfile for Railway (build context = repo root)
# backend/Dockerfile is used by Docker Compose (build context = backend/)
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    postgresql-client \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY prompts/ prompts/

RUN chmod +x start.sh

CMD ["./start.sh"]
