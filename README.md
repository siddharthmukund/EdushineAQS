# AQS Analyzer — Academic Hiring Intelligence Platform

> A full-stack Progressive Web App that parses academic CVs, scores them with an **Academic Quality Score (AQS)**, and supports the entire academic hiring lifecycle — from single candidate review to committee deliberation.

Powered by **Edushine** | Built on FastAPI + React 19 + Multi-provider LLM (Claude / GPT / Gemini)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Docker Compose (Recommended)](#docker-compose-recommended)
  - [Local Development](#local-development)
- [LLM Configuration](#llm-configuration)
- [Authentication & Roles](#authentication--roles)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Frontend Routes](#frontend-routes)
- [Project Structure](#project-structure)

---

## Overview

AQS Analyzer automates the most time-consuming parts of academic faculty hiring. Upload a PDF CV (or a batch of CVs), and the platform uses large language models to generate structured scores across **Research**, **Education**, and **Teaching** dimensions, predict candidate success, flag publication gaps, surface fitment signals against a job description, and generate ready-to-use interview questions — all in seconds.

The platform also supports collaborative committee review with real-time voting, a self-serve candidate portal with ORCID verification, multi-tenant operation for multiple institutions, and a full enterprise auth layer including TOTP MFA and OAuth SSO.

---

## Key Features

### CV Analysis
- **Single CV Analysis** — Upload a PDF CV (up to 10 MB); the system extracts text, runs it through the configured LLM, and returns a full AQS breakdown
- **Batch Analysis** — Upload multiple CVs; processed in the background via Celery workers with real-time WebSocket progress updates
- **Job Description Fitment** — Paste or upload a JD (PDF or DOCX) to get candidate-to-role fitment signals alongside the AQS
- **AQS Score Breakdown** — Overall AQS plus per-dimension scores (Research, Education, Teaching) with detailed sub-breakdowns
- **Radar Chart Visualisation** — Interactive Recharts radar chart comparing all dimensions
- **Validation Report** — Automatically flags unverifiable claims and publication inconsistencies
- **Success Prediction** — ML-style scoring model predicting long-term academic success
- **Interview Prep** — Auto-generated, role-aware interview questions categorised by research, teaching, service, and identified gaps

### Batch & Committee Workflow
- **Celery/Redis Queue** — Background processing with configurable concurrency (default: 2 workers)
- **Real-time Progress** — WebSocket feed for live batch job status (`/ws/batch/{id}`)
- **Committee Review** — Invite evaluators to a shared committee session; each member votes (shortlist / reject / hold), leaves threaded comments, and the system tallies results in real time via WebSocket (`/ws/committee/{id}`)
- **Diversity Dashboard** — Aggregate diversity metrics across a batch with visual breakdowns

### Candidate Portal
- **Candidate Profiles** — Self-service profile creation with institution, research areas, and bio
- **ORCID Verification** — Live verification via `pub.orcid.org/v3.0` with Redis-cached h-index pull
- **Job Board** — Browse active postings; one-click apply links a CV analysis to the application
- **Application Tracking** — Full status history (`submitted → reviewing → shortlisted → interviewed → offered/rejected`)

### Enterprise Auth
- **JWT RBAC** — Seven roles: `super_admin`, `admin`, `committee_chair`, `committee_member`, `analyst`, `observer`, `viewer`
- **TOTP MFA** — QR-code setup with recovery codes; enforced during login and after OAuth
- **OAuth SSO** — Google and Microsoft SSO with CSRF-safe state validation and MFA gate
- **User Invitations** — Admins invite users by email with role pre-assignment and expiry
- **Session Management** — View and revoke active sessions from the Settings page
- **Audit Logs** — Immutable log of all sensitive actions (admin-visible)

### Multi-tenancy
- **Header-based tenant resolution** — `X-Tenant-ID` or `X-Tenant-Subdomain`
- **Per-tenant plans** — `free`, `pro`, `enterprise`
- **Per-tenant settings** — JSON settings blob; region-aware (`us`, `eu`, `ap`)

### PWA / Offline
- **Installable PWA** — Vite PWA plugin + Workbox service worker
- **Offline caching** — Dexie (IndexedDB) stores recent analyses for offline review
- **In-app LLM setup wizard** — First-run wizard lets users configure API keys without touching `.env`

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS, Zustand, Recharts |
| **Routing** | React Router v6 |
| **Offline** | Dexie (IndexedDB), Workbox service worker |
| **Backend** | FastAPI (async), Pydantic v2, SQLAlchemy 2 (asyncpg) |
| **LLM** | litellm — Claude 3.5 Sonnet, OpenAI GPT, Google Gemini |
| **Queue** | Celery 5 + Redis 7 |
| **Database** | PostgreSQL 16 |
| **Auth** | python-jose (JWT), passlib/bcrypt, pyotp (TOTP), authlib (OAuth) |
| **PDF Parsing** | pypdf, pdfplumber |
| **Migrations** | Alembic |
| **Containerisation** | Docker Compose (5 services) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│  React 19 PWA (Vite)  ←→  Zustand  ←→  Dexie (IDB)    │
└───────────────┬─────────────────────────────────────────┘
                │ HTTP / WebSocket
┌───────────────▼─────────────────────────────────────────┐
│              FastAPI  (port 8000)                        │
│  ┌──────────┐ ┌───────────┐ ┌───────────┐ ┌──────────┐  │
│  │ Analyze  │ │   Batch   │ │ Committee │ │  Auth /  │  │
│  │ /analyze │ │ /batch    │ │ /committee│  │  Users   │  │
│  └──────────┘ └───────────┘ └───────────┘ └──────────┘  │
│  ┌──────────┐ ┌───────────┐ ┌───────────┐ ┌──────────┐  │
│  │Candidate │ │  Tenant   │ │  Admin    │ │  Config  │  │
│  │ /candidat│ │ /tenant   │ │ /admin    │  │ /config  │  │
│  └──────────┘ └───────────┘ └───────────┘ └──────────┘  │
│  TenantMiddleware  │  JWT auth                           │
└──────┬────────────┬────────────────────────────────────-─┘
       │            │
┌──────▼──┐   ┌────▼──────┐   ┌──────────────┐
│Postgres │   │  Redis 7  │   │  litellm     │
│   16    │   │  (queue + │   │  (Claude /   │
│         │   │   cache)  │   │  GPT/Gemini) │
└─────────┘   └─────┬─────┘   └──────────────┘
                    │
              ┌─────▼─────┐
              │  Celery   │
              │  Workers  │
              └───────────┘
```

### Key Design Decisions

- **Repository pattern** — `analysis_repo`, `batch_repo`, `committee_repo`, `tenant_repo`, `candidate_repo`
- **Async-first** — all DB queries use asyncpg; no synchronous ORM calls in the request path
- **3-tier prompt caching** — static system prompt + production ephemeral cache + per-batch JD cache, yielding up to 65% cost reduction on Claude
- **Score shape normalisation** — `_extract_score()` helper handles both scalar floats (Claude/OpenAI) and breakdown dicts `{"total": n, "breakdown": {...}}` (Gemini), allowing the frontend `ScoreCard` to render rich breakdowns regardless of provider
- **OAuth token delivery via URL fragment** — access tokens delivered in `#access_token=…` (never sent to the server in `Referer` or logs); MFA temp tokens use query params (short-lived, non-sensitive)

---

## Getting Started

### Prerequisites

| Tool | Minimum Version |
|---|---|
| Docker + Docker Compose | 24+ / 2.20+ |
| Node.js (local dev only) | 18+ |
| Python (local dev only) | 3.11+ |

An API key for at least one LLM provider is required to run analyses (see [LLM Configuration](#llm-configuration)).

---

### Environment Variables

Create `backend/.env` (copy from the template below). Only `JWT_SECRET_KEY` and one LLM key are strictly required to start.

```dotenv
# ── LLM (at least one required) ──────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AI...

# Which model to use (litellm provider/model string)
LLM_MODEL=anthropic/claude-3-5-sonnet-20241022

# ── Security ──────────────────────────────────────────────────────
JWT_SECRET_KEY=change-me-in-production-use-a-long-random-string
# Optional: Fernet key for MFA secret encryption (auto-derived from JWT_SECRET_KEY if blank)
MFA_ENCRYPTION_KEY=

# ── OAuth SSO (optional) ──────────────────────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# ── URLs (override for production) ───────────────────────────────
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000
```

> **Note:** `DATABASE_URL` and `REDIS_URL` are injected by Docker Compose and do not need to be set in `.env` for the Docker workflow.

---

### Docker Compose (Recommended)

```bash
# Clone the repo
git clone https://github.com/siddharthmukund/EdushineAQS.git
cd EdushineAQS

# Create backend env file
cp backend/.env.example backend/.env   # then fill in your API keys

# Build and start all 5 services (db, redis, backend, celery, frontend)
docker compose up -d --build

# Run database migrations
docker compose exec backend alembic upgrade head
```

| Service | URL |
|---|---|
| Frontend (React PWA) | http://localhost:3000 |
| Backend (FastAPI) | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| API Docs (ReDoc) | http://localhost:8000/redoc |

To tail logs:
```bash
docker compose logs -f backend celery
```

---

### Local Development

#### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Start PostgreSQL and Redis (or use Docker for just the infra services)
docker compose up -d db redis

# Run migrations
alembic upgrade head

# Start the API server
uvicorn app.main:app --reload --port 8000
```

#### Celery Worker (for batch jobs)

```bash
# In a separate terminal, with the venv activated
celery -A app.workers.celery_app worker --loglevel=info --concurrency=2
```

#### Frontend

```bash
cd frontend
npm install
npm run dev       # Vite dev server at http://localhost:5173
```

#### Tests

```bash
cd backend
pytest -v
```

---

## LLM Configuration

The platform supports **three LLM providers** via [litellm](https://github.com/BerriAI/litellm). Switch between them by changing `LLM_MODEL` in `backend/.env`:

| Provider | `LLM_MODEL` value | Key variable |
|---|---|---|
| Anthropic Claude | `anthropic/claude-3-5-sonnet-20241022` | `ANTHROPIC_API_KEY` |
| OpenAI GPT-4o | `openai/gpt-4o` | `OPENAI_API_KEY` |
| Google Gemini | `gemini/gemini-1.5-pro` | `GEMINI_API_KEY` |

**In-app setup:** Authenticated users can configure their API key directly from the UI via the **"Set up LLM"** wizard in the header — no need to restart the server.

> Gemini returns scores as rich dict objects `{"total": n, "breakdown": {...}}`; the backend normalises these automatically so the frontend always receives a consistent structure.

---

## Authentication & Roles

### Roles (highest → lowest privilege)

| Role | Description |
|---|---|
| `super_admin` | Full platform access including tenant management |
| `admin` | User management, invitations, audit logs |
| `committee_chair` | Create and manage committees |
| `committee_member` | Vote and comment in assigned committees |
| `analyst` | Run analyses and batch jobs |
| `observer` | Read-only access to results |
| `viewer` | Read-only access to specific shared resources |

### Auth Methods

- **Email + Password** — bcrypt-hashed, JWT issued on success
- **TOTP MFA** — Optional second factor; QR code setup in Settings; recovery codes provided
- **OAuth SSO** — Google and Microsoft; state parameter validated via Redis (10-min TTL); MFA enforced post-OAuth if enabled
### OAuth Setup (once per provider)

**Google:**
1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → Create OAuth 2.0 Client ID
2. Authorised redirect URI: `http://localhost:8000/auth/oauth/google/callback`
3. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `backend/.env`

**Microsoft:**
1. [Azure Portal](https://portal.azure.com) → App registrations → New registration
2. Redirect URI (Web): `http://localhost:8000/auth/oauth/microsoft/callback`
3. Add `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` to `backend/.env`

---

## API Reference

Full interactive docs available at `/docs` (Swagger UI) and `/redoc`.

### Analysis

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/analyze` | Optional | Upload a CV PDF (+ optional JD); returns full AQS analysis |
| `GET` | `/api/analyze/{id}` | Optional | Retrieve a saved analysis by ID |
| `GET` | `/api/analyze/{id}/interview-prep` | JWT | Generate interview questions for a candidate |

### Batch

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/batch` | JWT | Start a batch job (multipart: multiple CVs + optional JD) |
| `GET` | `/api/batch/{id}` | JWT | Poll batch job status |
| `GET` | `/api/batch/{id}/results` | JWT | Retrieve all results for a completed batch |
| `WS` | `/ws/batch/{id}` | JWT | Real-time progress stream |

### Analytics

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/analytics/candidate/{id}/success-prediction` | JWT | Candidate success probability |
| `GET` | `/api/analytics/batch/{id}/diversity` | JWT | Diversity metrics for a batch |

### Committee

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/committee` | JWT | Create a committee for a batch |
| `GET` | `/api/committee/{id}` | JWT | Get committee details |
| `POST` | `/api/committee/{id}/join` | Session token | Join as a member |
| `POST` | `/api/committee/{id}/vote` | Session token | Cast a vote on a candidate |
| `GET` | `/api/committee/{id}/votes/{cid}` | Session token | Get vote tally |
| `POST` | `/api/committee/{id}/comment` | Session token | Post a comment |
| `GET` | `/api/committee/{id}/comments/{cid}` | Session token | Get comment thread |
| `GET` | `/api/committee/{id}/summary` | JWT | Get committee summary |
| `WS` | `/ws/committee/{id}` | Session token | Real-time vote/comment feed |

### Auth & Users

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | — | Create a new account |
| `POST` | `/auth/login` | — | Login; returns JWT or MFA challenge |
| `GET` | `/auth/me` | JWT | Get current user profile |
| `POST` | `/auth/mfa/setup` | JWT | Initiate TOTP MFA setup |
| `POST` | `/auth/mfa/verify` | JWT | Verify TOTP code and activate MFA |
| `POST` | `/auth/mfa/complete` | Temp token | Complete MFA during login |
| `GET` | `/auth/oauth/{provider}` | — | Get OAuth redirect URL (google / microsoft) |
| `GET` | `/auth/oauth/{provider}/callback` | — | OAuth callback (backend-handled) |
| `GET` | `/api/users/me` | JWT | Full user profile |
| `PUT` | `/api/users/me` | JWT | Update profile |
| `GET` | `/api/users/me/sessions` | JWT | List active sessions |
| `DELETE` | `/api/users/me/sessions/{id}` | JWT | Revoke a session |
| `PUT` | `/api/users/me/notifications` | JWT | Update notification preferences |

### Admin

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/users` | admin+ | List all users |
| `PUT` | `/api/admin/users/{id}` | admin+ | Update user role / status |
| `GET` | `/api/admin/audit-logs` | admin+ | View audit log |
| `POST` | `/api/admin/invitations` | admin+ | Invite a user by email |
| `GET` | `/api/admin/invitations` | admin+ | List pending invitations |

### Candidate Platform

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/candidate/profile` | JWT | Create candidate profile |
| `GET` | `/api/candidate/profile/me` | JWT | Get own profile |
| `PUT` | `/api/candidate/profile/{id}` | JWT | Update profile |
| `POST` | `/api/candidate/profile/{id}/verify-orcid` | JWT | Verify ORCID and pull h-index |
| `GET` | `/api/candidate/jobs` | JWT | Browse active job postings |
| `POST` | `/api/candidate/jobs` | admin+ | Create a job posting |
| `POST` | `/api/candidate/jobs/{id}/apply` | JWT | Apply to a posting |
| `GET` | `/api/candidate/applications` | JWT | List own applications |
| `PUT` | `/api/candidate/applications/{id}/status` | admin+ | Update application status |

### Multi-tenancy & Config

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/tenants/current` | JWT | Get current tenant info |
| `POST` | `/api/tenants` | super_admin | Create tenant |
| `GET` | `/api/config/llm` | JWT | Get LLM provider config status |
| `POST` | `/api/config/llm` | JWT | Save an LLM API key |

### Health

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | — | Health check |

---

## Database Schema

Five Alembic migrations; 12 tables total.

| Migration | Tables Added |
|---|---|
| `d77b2abbac8d` — init | `analyses`, `batch_jobs`, `api_keys` |
| `916615dcd8ef` — views | `candidate_summaries` (materialized view) |
| `a3f8c2d1e4b5` — auth & committees | `users`, `committees`, `committee_members`, `candidate_votes`, `candidate_comments` |
| `b4c9d3e2f5a1` — platform | `tenants`, `candidate_profiles`, `job_postings`, `job_applications` |
| `c5d8e9f1a2b3` — enterprise auth | `user_sessions`, `audit_logs`, `user_invitations` |

Apply all migrations:
```bash
alembic upgrade head
```

---

## Frontend Routes

| Route | Page | Access |
|---|---|---|
| `/` | Single CV Analysis | Public (guest trial mode) |
| `/batch` | Batch Analysis | Authenticated |
| `/candidate` | Candidate Dashboard | Authenticated |
| `/dashboard` | Analytics Dashboard | Authenticated |
| `/settings` | Profile & Settings (lazy) | Authenticated |
| `/admin` | Admin Panel (lazy) | admin+ |
| `/login` | Login (email + MFA + OAuth) | Guest |
| `/register` | Register (email + OAuth) | Guest |
| `/auth/callback` | OAuth Callback | — |

---

## Project Structure

```
cv-analyzer/
├── backend/
│   ├── app/
│   │   ├── api/routes/         # FastAPI route handlers (16 modules)
│   │   │   ├── analyze.py      # Single CV analysis
│   │   │   ├── batch.py        # Batch job management
│   │   │   ├── auth.py         # Auth, OAuth, MFA
│   │   │   ├── user.py         # User profile & sessions
│   │   │   ├── admin.py        # Admin panel endpoints
│   │   │   ├── committee.py    # Committee REST API
│   │   │   ├── committee_ws.py # Committee WebSocket
│   │   │   ├── candidate.py    # Candidate platform
│   │   │   ├── tenant.py       # Multi-tenancy
│   │   │   ├── config.py       # LLM key configuration
│   │   │   ├── analytics.py    # Success & diversity analytics
│   │   │   └── ...
│   │   ├── models/
│   │   │   ├── database.py     # SQLAlchemy ORM models (14 tables)
│   │   │   └── domain.py       # Pydantic request/response schemas
│   │   ├── services/           # Business logic (16 services)
│   │   │   ├── llm_service.py  # 3-tier prompt caching + litellm
│   │   │   ├── auth_service.py # JWT + bcrypt
│   │   │   ├── mfa_service.py  # TOTP setup & verification
│   │   │   ├── oauth_service.py# Google / Microsoft OAuth
│   │   │   ├── orcid_service.py# ORCID API integration
│   │   │   ├── interview_generator.py
│   │   │   ├── diversity_analytics.py
│   │   │   ├── success_predictor.py
│   │   │   └── ...
│   │   ├── middleware/
│   │   │   └── tenant_middleware.py
│   │   ├── workers/
│   │   │   └── celery_app.py
│   │   ├── config.py           # Pydantic settings (reads backend/.env)
│   │   └── main.py             # FastAPI app + router registration
│   ├── alembic/versions/       # 5 migration files
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── pages/              # 8 page components
│   │   │   ├── SingleAnalysis.tsx
│   │   │   ├── BatchAnalysis.tsx
│   │   │   ├── CandidateDashboard.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── AdminPanel.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   └── RegisterPage.tsx
│   │   ├── components/
│   │   │   ├── analysis/       # ScoreCard, RadarChart, FitmentAnalysis, InterviewPrep, ...
│   │   │   ├── batch/          # BatchProgress
│   │   │   ├── committee/      # CommitteeView, VotingPanel, CommentThread
│   │   │   ├── candidate/      # ProfileCard, JobMatchCard, ApplicationStatusCard
│   │   │   ├── analytics/      # SuccessPredictionCard, DiversityDashboard
│   │   │   ├── comparison/     # SwipeableCard, CandidateTable
│   │   │   ├── upload/         # CVUploader, BatchUploader, JDInput, JDUploader
│   │   │   ├── auth/           # MFASetup
│   │   │   └── common/         # Header, ApiSetupWizard, GuestTrialModal, ...
│   │   ├── services/
│   │   │   └── api.ts          # All API calls (typed with Axios)
│   │   ├── stores/
│   │   │   ├── authStore.ts    # Zustand auth state
│   │   │   └── analysisStore.ts
│   │   ├── hooks/
│   │   │   └── useConfigStatus.ts
│   │   ├── types/
│   │   │   └── api.ts          # TypeScript interfaces for all API types
│   │   ├── workers/            # Web workers (CV parser, JD parser)
│   │   └── App.tsx             # Router, ProtectedRoute, OAuthCallback
│   └── Dockerfile
│
├── prompts/
│   └── academic_cv_analyzer_v2.md  # LLM system prompt
├── docker-compose.yml
└── README.md
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes and add tests where applicable
4. Ensure `pytest -v` passes in the `backend/` directory
5. Submit a pull request

---

*Powered by Edushine © 2025*
