import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uuid

from app.config import settings
from app.api.routes import health, analyze, batch, status, websocket, analytics, auth, committee, committee_ws, tenant, candidate, public, config as config_routes
from app.api.routes import user as user_routes, admin as admin_routes
from app.middleware.tenant_middleware import TenantMiddleware

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="API for parsing and analyzing academic CVs using Claude AI",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tenant resolution middleware (runs after CORS)
app.add_middleware(TenantMiddleware, db_url=settings.DATABASE_URL)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred.",
                "details": str(exc)
            },
            "meta": {
                "timestamp": time.time(),
                "request_id": str(uuid.uuid4())
            }
        }
    )

# Routers
app.include_router(health.router)
app.include_router(analyze.router, prefix="/api")
app.include_router(batch.router, prefix="/api")
app.include_router(status.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(websocket.router)
app.include_router(auth.router)
app.include_router(committee.router, prefix="/api")
app.include_router(committee_ws.router)
app.include_router(tenant.router)
app.include_router(candidate.router)
app.include_router(public.router)
app.include_router(user_routes.router, prefix="/api")
app.include_router(admin_routes.router, prefix="/api")
app.include_router(config_routes.router, prefix="/api")

from app.api.routes import settings as settings_router
app.include_router(settings_router.router, prefix="/api")
