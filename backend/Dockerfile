# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies needed for python packages like asyncpg
RUN apt-get update && apt-get install -y \
    postgresql-client \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Make startup script executable
RUN chmod +x start.sh

# Run migrations and start uvicorn via startup script
CMD ["./start.sh"]
