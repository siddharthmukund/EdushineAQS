import json
import redis.asyncio as redis
from typing import Any, Optional
from app.config import settings

class CacheService:
    def __init__(self):
        self.redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
        self.ttl = settings.CACHE_TTL_SECONDS
        
    async def get(self, key: str) -> Optional[Any]:
        """Get parsed JSON value from Redis."""
        try:
            val = await self.redis.get(key)
            if val:
                return json.loads(val)
            return None
        except Exception:
            return None
            
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Store value as JSON in Redis with TTL."""
        try:
            await self.redis.set(
                key, 
                json.dumps(value), 
                ex=ttl or self.ttl
            )
            return True
        except Exception:
            return False
            
    async def ping(self) -> bool:
        """Check if Redis is responsive."""
        try:
            return await self.redis.ping()
        except Exception:
            return False
