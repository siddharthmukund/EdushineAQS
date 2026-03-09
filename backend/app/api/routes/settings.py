import os
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from typing import Optional
from dotenv import set_key

router = APIRouter(prefix="/settings", tags=["Settings"])

class ApiKeySettingsRequest(BaseModel):
    anthropic: Optional[str] = None
    openai: Optional[str] = None
    gemini: Optional[str] = None

@router.post("/keys")
async def update_api_keys(keys: ApiKeySettingsRequest):
    """
    Update LLM API keys dynamically.
    Writes to .env so keys persist across restarts, and updates OS environ 
    so current processes can use them immediately.
    """
    env_file = "/app/.env"
    
    try:
        if not os.path.exists(env_file):
            open(env_file, 'a').close()
            
        if keys.anthropic is not None and keys.anthropic.strip():
            set_key(env_file, "ANTHROPIC_API_KEY", keys.anthropic.strip())
            os.environ["ANTHROPIC_API_KEY"] = keys.anthropic.strip()
            
        if keys.openai is not None and keys.openai.strip():
            set_key(env_file, "OPENAI_API_KEY", keys.openai.strip())
            os.environ["OPENAI_API_KEY"] = keys.openai.strip()
            
        if keys.gemini is not None and keys.gemini.strip():
            set_key(env_file, "GEMINI_API_KEY", keys.gemini.strip())
            os.environ["GEMINI_API_KEY"] = keys.gemini.strip()

        return {"status": "success", "message": "API keys updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save API keys: {str(e)}")
