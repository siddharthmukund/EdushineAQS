import json
from typing import Dict, Any, Optional
import litellm
import os
from app.config import settings
from app.utils.prompt_loader import load_iccv_prompt
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

class LLMServiceError(Exception):
    pass

class LLMService:
    def __init__(self, default_model: Optional[str] = None):
        self.default_model = default_model or settings.LLM_MODEL
        self.system_prompt = load_iccv_prompt()

        # Litellm automatically picks up api keys from env vars
        # but just in case, let's map settings securely
        if settings.ANTHROPIC_API_KEY:
            os.environ["ANTHROPIC_API_KEY"] = settings.ANTHROPIC_API_KEY
        if settings.OPENAI_API_KEY:
            os.environ["OPENAI_API_KEY"] = settings.OPENAI_API_KEY
        if settings.GEMINI_API_KEY:
            os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY

    # Retry automatically on API rate limits or transient network errors
    @retry(
        wait=wait_exponential(multiplier=1, min=2, max=10),
        stop=stop_after_attempt(5),
        reraise=True
    )
    async def analyze(self, cv_text: str, jd: Optional[str] = None, model: Optional[str] = None) -> Dict[str, Any]:
        """Analyze CV using litellm with smart prompt caching."""
        target_model = model or self.default_model
        
        is_anthropic = "anthropic" in target_model or "claude" in target_model
        is_production = settings.ENVIRONMENT == "production"

        # Build multi-tier cached system prompt for Anthropic
        if is_anthropic:
            # Tier 1 — static system prompt: always cache (both dev + prod)
            tier1 = {
                "type": "text",
                "text": self.system_prompt,
                "cache_control": {"type": "ephemeral"},
            }

            # Tier 2 — constraints / scoring rubric section: cache in production only
            # We reuse the same prompt block but add a placeholder that varies in dev
            tier2_text = (
                "Scoring constraints: apply rubric strictly as defined above."
                if is_production
                else f"[dev-{target_model}] Apply rubric as defined above."
            )
            tier2: dict = {"type": "text", "text": tier2_text}
            if is_production:
                tier2["cache_control"] = {"type": "ephemeral"}

            # Tier 3 — JD block: always cache (per-batch cache hit when same JD is reused)
            tier3 = {
                "type": "text",
                "text": f"Job Requirements Context:\n{jd or 'N/A'}",
                "cache_control": {"type": "ephemeral"},
            }

            system_content = [tier1, tier2, tier3]
            user_message = f"CV:\n{cv_text}\n\nExecute full analysis."
        else:
            # Standard string fallback for other models
            system_content = self.system_prompt
            user_message = f"CV:\n{cv_text}\n\nJD:\n{jd or 'N/A'}\n\nExecute full analysis."
        
        messages = [
            {
                "role": "system",
                "content": system_content
            },
            {
                "role": "user",
                "content": user_message
            }
        ]

        try:
            response = await litellm.acompletion(
                model=target_model,
                messages=messages,
                temperature=0,
                max_tokens=8000
            )

            raw_content = response.choices[0].message.content
            result = self._parse_json(raw_content)
            
            # Add metadata about tokens
            usage = response.usage
            result["metadata"] = {
                "tokens_used": {
                    "input": getattr(usage, "prompt_tokens", 0),
                    "output": getattr(usage, "completion_tokens", 0),
                    "total": getattr(usage, "total_tokens", 0)
                },
                "model_used": target_model
            }
            
            return result
            
        except litellm.ContextWindowExceededError as e:
            # Don't retry if the input is simply too large
            raise LLMServiceError(f"Context window exceeded calling {target_model}: {str(e)}")
        except Exception as e:
            raise LLMServiceError(f"Unexpected error calling LLM {target_model}: {str(e)}")
            
    def _parse_json(self, text: str) -> Dict[str, Any]:
        """Safely extract and parse JSON from the response."""
        if "```json" in text:
            start = text.find("```json") + 7
            end = text.rfind("```")
            text = text[start:end].strip()
        elif "```" in text:
            start = text.find("```") + 3
            end = text.rfind("```")
            text = text[start:end].strip()
            
        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            raise LLMServiceError(f"Failed to parse LLM output as JSON: {str(e)}\nRaw output: {text[:200]}...")
