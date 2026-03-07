# Batch Analysis Feature - Setup & Testing Guide

## Overview

The batch analysis feature allows users to upload and analyze 5-50 CVs simultaneously with real-time progress tracking via WebSockets.

## Architecture

### Backend Components

1. **API Endpoint**: `POST /api/batch`
   - Accepts multiple PDF files
   - Creates batch job in database
   - Queues Celery task for async processing

2. **Celery Worker**: `process_batch_task`
   - Processes CVs asynchronously
   - Publishes progress to Redis pub/sub
   - Saves results to PostgreSQL

3. **WebSocket Endpoint**: `WS /ws/batch/{batch_id}`
   - Real-time progress updates
   - Subscribes to Redis channel
   - Auto-closes on completion/failure

4. **Results Endpoint**: `GET /api/batch/{batch_id}/results`
   - Returns ranked candidate list
   - Sorted by AQS score (descending)

### Frontend Components

1. **BatchUploader** - Multi-file drag-drop upload
2. **BatchProgress** - Real-time progress with WebSocket
3. **BatchAnalysis** - Main page orchestrating workflow
4. **CandidateTable** - Ranked results display

## Setup Instructions

### 1. Database Migration

Run the Alembic migration to add batch columns:

```bash
cd backend
docker-compose exec backend alembic upgrade head
```

This adds:
- `analyses.batch_id` (UUID, foreign key to batch_jobs)
- `analyses.filename` (VARCHAR 255)

### 2. Install Dependencies

Backend dependencies are already in requirements.txt:
```
redis>=5.0.3
celery>=5.3.6
websockets>=12.0
```

### 3. Start Services

```bash
docker-compose up
```

Ensure these services are running:
- **PostgreSQL** (port 5432)
- **Redis** (port 6379)
- **FastAPI** (port 8000)
- **Celery Worker** (background)
- **Frontend** (port 5173)

### 4. Verify Celery Worker

Check that Celery worker is running:

```bash
docker-compose logs -f celery
```

Expected output:
```
[tasks]
  . process_batch_task
```

## Testing the Feature

### Manual Test Flow

#### Step 1: Upload CVs

1. Navigate to http://localhost:5173/batch
2. Drag & drop 3-5 PDF CVs
3. Enter job description:
   ```
   Position: Associate Professor of Finance
   Requirements: PhD in Finance, 8+ Q1 publications, h-index ≥15
   ```
4. Select AI model (default: Claude 3.5 Sonnet)
5. Click "Analyze X CVs"

#### Step 2: Monitor Progress

WebSocket should connect and show:
- Current file being processed
- Progress bar (0-100%)
- Estimated time remaining

Example WebSocket messages:
```json
{
  "stage": "processing",
  "current": 2,
  "total": 5,
  "percentage": 40.0,
  "current_filename": "john_doe_cv.pdf"
}
```

#### Step 3: View Results

After completion:
- Candidates ranked by AQS score
- Each row shows: Name, AQS, Recommendation
- Click row to view details (coming soon)

### Backend API Tests

#### Test 1: Batch Upload

```bash
curl -X POST http://localhost:8000/api/batch \
  -F "cv_files=@cv1.pdf" \
  -F "cv_files=@cv2.pdf" \
  -F "job_description=Position: Assistant Professor" \
  -F "llm_provider=claude-3-5-sonnet-20241022"
```

Expected response:
```json
{
  "batch_id": "uuid-here",
  "cv_count": 2,
  "status": "queued",
  "estimated_completion_minutes": 0.6,
  "websocket_url": "ws://localhost:8000/ws/batch/uuid-here"
}
```

#### Test 2: Batch Status

```bash
curl http://localhost:8000/api/batch/{batch_id}
```

Expected response:
```json
{
  "batch_id": "uuid",
  "cv_count": 2,
  "completed_count": 2,
  "status": "complete",
  "total_cost_usd": 0.10,
  "created_at": "2026-03-03T10:00:00",
  "completed_at": "2026-03-03T10:01:30"
}
```

#### Test 3: Batch Results

```bash
curl http://localhost:8000/api/batch/{batch_id}/results
```

Expected response:
```json
{
  "batch_id": "uuid",
  "status": "complete",
  "cv_count": 2,
  "completed_count": 2,
  "total_cost_usd": 0.10,
  "results": [
    {
      "id": "uuid",
      "candidate_name": "John Doe",
      "filename": "john_doe_cv.pdf",
      "scores": {
        "overall_aqs": 87.5,
        "research": 90.0,
        "education": 85.0,
        "teaching": 88.0
      },
      "recommendation": "Strong Fit",
      "created_at": "2026-03-03T10:01:00"
    }
  ]
}
```

### WebSocket Test

Using browser console:

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/batch/YOUR_BATCH_ID');

ws.onopen = () => console.log('Connected');
ws.onmessage = (event) => console.log('Progress:', JSON.parse(event.data));
ws.onerror = (error) => console.error('Error:', error);
ws.onclose = () => console.log('Disconnected');
```

Expected messages:
```javascript
// Progress updates every ~18 seconds per CV
{ stage: "processing", current: 1, total: 5, percentage: 20, current_filename: "cv1.pdf" }
{ stage: "processing", current: 2, total: 5, percentage: 40, current_filename: "cv2.pdf" }
...
{ stage: "complete", percentage: 100, total_cost: 0.50 }
```

## Troubleshooting

### Issue: WebSocket won't connect

**Symptoms**: Progress bar stays at 0%, "Connection error" message

**Solutions**:
1. Check Redis is running: `docker-compose ps redis`
2. Check WebSocket URL in browser console
3. Verify CORS settings in `backend/app/main.py`

### Issue: Celery task not processing

**Symptoms**: Batch stays in "queued" status

**Solutions**:
1. Check Celery logs: `docker-compose logs celery`
2. Verify Redis connection: `docker-compose exec redis redis-cli ping`
3. Restart Celery: `docker-compose restart celery`

### Issue: Database errors

**Symptoms**: `batch_id` column doesn't exist

**Solutions**:
1. Run migration: `docker-compose exec backend alembic upgrade head`
2. Check migration status: `docker-compose exec backend alembic current`

## Performance Benchmarks

| CVs | Processing Time | Estimated Cost (Claude) |
|-----|----------------|------------------------|
| 5   | ~1.5 minutes   | $0.25                  |
| 10  | ~3 minutes     | $0.50                  |
| 25  | ~7.5 minutes   | $1.25                  |
| 50  | ~15 minutes    | $2.50                  |

*With 65% prompt caching savings after first CV*

## Next Steps

### Enhancements to Implement

1. **Pause/Resume**: Allow users to pause batch processing
2. **Export Results**: CSV/PDF export of ranked candidates
3. **Email Notifications**: Send email when batch completes
4. **Retry Failed CVs**: Automatically retry failed analyses
5. **Batch History**: View past batch jobs
6. **Cost Tracking**: Dashboard showing cumulative costs

### Code Locations

- Backend Routes: `backend/app/api/routes/batch.py`, `websocket.py`
- Celery Tasks: `backend/app/workers/tasks.py`
- Frontend Components: `frontend/src/components/upload/BatchUploader.tsx`, `batch/BatchProgress.tsx`
- Main Page: `frontend/src/pages/BatchAnalysis.tsx`
- API Client: `frontend/src/services/api.ts`

## Success Criteria Checklist

- [x] Can upload 10 CVs via drag-drop UI
- [x] WebSocket shows real-time progress per file
- [x] Celery worker processes all CVs
- [x] Database stores analyses with `batch_id` foreign key
- [x] Can switch LLM provider (Claude/GPT-4o/Gemini) in UI
- [x] Results sortable by AQS, research score, fitment
- [ ] Cost summary shows actual spend with caching savings (TODO: enhance cost tracking)
- [ ] Can pause/resume batch job (TODO: future feature)
- [ ] Offline viewing in IndexedDB (TODO: integrate with offlineStorage.ts)

## API Documentation

Full API documentation available at: http://localhost:8000/docs
