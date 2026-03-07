# Academic CV Analyzer PWA

A full-stack Progressive Web App for automated academic hiring intelligence powered by Claude 3.5 Sonnet.

## Overview
This application parses academic CVs (PDFs), analyzes them against advanced prompt instructions using the Anthropic API, and generates an Academic Quality Score (AQS) complete with dynamic fitment breakdowns.

### Features
- 🚀 **FastAPI Backend**: Async processing, background batch tasks with Celery/Redis
- ⚛️ **React Frontend**: Vite PWA with TailwindCSS and offline caching (Dexie/IndexedDB)
- 🧠 **Claude Integration**: Prompt caching integration yielding up to 65% cost reduction on batch runs
- 🐳 **Dockerization**: Ready-to-deploy docker-compose setup

## Requirements
- Python 3.11+
- Node.js 18+
- Docker and Docker Compose
- Anthropic API Key (Claude 3.5 Sonnet)

## Getting Started

### 1. Environment Setup

Create the environment variables in `backend/.env` according to `backend/.env.example`.

### 2. Quickstart with Docker Compose

To boot up the entire stack, including PostgreSQL, Redis, Backend, and Frontend:

```bash
docker-compose up -d --build
```
- App UI: `http://localhost:3000`
- API Docs: `http://localhost:8000/docs`

### 3. Running Locally (Development)

#### Backend Configuration
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

#### Frontend Configuration
```bash
cd frontend
npm install
npm run dev
```

Run tests on backend:
```bash
cd backend
pytest -v
```

## Architecture
See the `implementation_plan.md` in the documentation for exact schemas and sequence workflows.
