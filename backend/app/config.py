from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # App Settings
    PROJECT_NAME: str = "Academic CV Analyzer API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = "development"
    
    # DB & Redis
    DATABASE_URL: str = "postgresql+asyncpg://cvanalyzer:devpassword@localhost:5432/cvanalyzer"
    REDIS_URL: str = "redis://localhost:6379"
    
    # Auth & API
    JWT_SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # LLM settings
    LLM_MODEL: str = "anthropic/claude-3-5-sonnet-20241022" 
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    
    # Processing Limits
    MAX_UPLOAD_SIZE_MB: int = 10
    CACHE_TTL_SECONDS: int = 300

    # OAuth 2.0 / SSO (ICCV #3)
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    MICROSOFT_CLIENT_ID: Optional[str] = None
    MICROSOFT_CLIENT_SECRET: Optional[str] = None
    FRONTEND_URL: str = "http://localhost:3000"
    # MFA encryption key (Fernet); auto-derived from JWT_SECRET_KEY if empty
    MFA_ENCRYPTION_KEY: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=True, extra="ignore")

settings = Settings()
