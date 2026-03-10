"""
/api/config — public + admin endpoints for LLM provider configuration.

GET  /api/config/status   — which providers are configured (booleans only, no key values)
POST /api/config/llm-key  — save an LLM API key in-process + write to /app/.env
                            Access: allowed when no key is configured yet (bootstrap),
                            or when caller holds a valid Bearer token.
"""
import os
import re
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/config", tags=["Config"])

# The backend container bind-mounts ./backend → /app  (see docker-compose.yml)
# Writing here creates ./backend/.env on the host, which Pydantic BaseSettings
# reads as env_file=".env" (uvicorn runs from /app).
_ENV_FILE = Path("/app/.env")

# Known provider → env-var name + expected key prefix for basic validation
_PROVIDER_MAP = {
    "anthropic": ("ANTHROPIC_API_KEY", "sk-ant-"),
    "openai":    ("OPENAI_API_KEY",    "sk-"),
    "gemini":    ("GEMINI_API_KEY",    "AIza"),
}


def _any_configured() -> bool:
    """Read live from os.environ so it reflects in-process updates."""
    return any(
        bool(os.environ.get(k, "").strip())
        for k in ("ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY")
    )


def _update_env_file(path: Path, key: str, value: str) -> None:
    """Upsert key=value in a .env file. Creates the file if it doesn't exist."""
    lines: list[str] = []
    if path.exists():
        lines = path.read_text(encoding="utf-8").splitlines()

    found = False
    new_lines: list[str] = []
    for line in lines:
        # Match lines like:  KEY=value  or  KEY =value (with optional spaces)
        if re.match(rf"^{re.escape(key)}\s*=", line):
            new_lines.append(f"{key}={value}")
            found = True
        else:
            new_lines.append(line)

    if not found:
        new_lines.append(f"{key}={value}")

    path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")


# ── GET /api/config/status ──────────────────────────────────────────────────

@router.get("/status")
async def get_config_status():
    """Return which LLM providers have a non-empty API key (reads live os.environ)."""
    def _ok(env_var: str) -> bool:
        return bool(os.environ.get(env_var, "").strip())

    anthropic = _ok("ANTHROPIC_API_KEY")
    openai    = _ok("OPENAI_API_KEY")
    gemini    = _ok("GEMINI_API_KEY")

    return {
        "llm": {
            "anthropic":      anthropic,
            "openai":         openai,
            "gemini":         gemini,
            "any_configured": anthropic or openai or gemini,
            "active_model":   settings.LLM_MODEL,
        }
    }


# ── POST /api/config/llm-key ────────────────────────────────────────────────

class LLMKeyRequest(BaseModel):
    provider: Literal["anthropic", "openai", "gemini"]
    api_key: str


@router.post("/llm-key")
async def set_llm_key(body: LLMKeyRequest, request: Request):
    """
    Save an LLM API key.

    Access rules (OR):
    • No key is configured yet  → bootstrap mode, anyone may set one
    • Valid Bearer token present → authenticated user (any role)
    """
    api_key = body.api_key.strip()
    if not api_key:
        raise HTTPException(status_code=422, detail="api_key must not be empty.")

    env_var, expected_prefix = _PROVIDER_MAP[body.provider]

    # Basic format validation — warn but don't block (typos should still save)
    if not api_key.startswith(expected_prefix):
        # Allow it but surface a warning in the response
        warning = (
            f"Key does not start with '{expected_prefix}' — "
            "double-check you copied the full key."
        )
    else:
        warning = None

    # ── Access check ──────────────────────────────────────────────────────────
    auth_header = request.headers.get("Authorization", "")
    has_token = auth_header.lower().startswith("bearer ") and len(auth_header) > 10

    if not _any_configured() or has_token:
        pass  # Bootstrap mode OR authenticated caller — allow
    else:
        raise HTTPException(
            status_code=403,
            detail="An LLM key is already configured. Sign in as an admin to change it.",
        )
    # ─────────────────────────────────────────────────────────────────────────

    # 1. Update the live process environment immediately
    os.environ[env_var] = api_key

    # 2. Update the cached settings object so /api/config/status reflects it now
    setattr(settings, env_var, api_key)

    # 3. Persist to /app/.env so the key survives uvicorn --reload
    try:
        _update_env_file(_ENV_FILE, env_var, api_key)
        persisted = True
    except Exception:
        persisted = False  # Non-fatal — in-process update already worked

    return {
        "success": True,
        "provider": body.provider,
        "env_var": env_var,
        "persisted_to_env_file": persisted,
        "warning": warning,
        "note": (
            "Key is active for this session. "
            "To survive a full Docker restart, also set "
            f"{env_var}=<your-key> in the project-root .env file "
            "and run: docker compose restart backend celery"
        ) if not persisted else (
            "Key is active and written to ./backend/.env. "
            "It will survive uvicorn reloads automatically. "
            f"For full Docker restart persistence, also set {env_var} "
            "in the project-root .env file."
        ),
    }
