from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import Optional
from core.database_url import validate_remote_database_url


class Settings(BaseSettings):
    """Application settings"""

    # Database
    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379"

    # API Keys
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None

    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # AWS S3
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_BUCKET_NAME: str = "fitpilot-videos"

    # Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"
    CORS_ALLOWED_ORIGINS: Optional[str] = None
    MOBILE_SCHEME: str = "fitpilot://"

    # Cross-service auth compatibility (Nutrition -> Training)
    NUTRITION_API_URL: Optional[str] = None
    NUTRITION_AUTH_ME_PATH: str = "/v1/auth/me"
    NUTRITION_AUTH_TIMEOUT_SECONDS: int = 8
    NUTRITION_AUTH_CACHE_TTL_SECONDS: int = 25

    # Exercise media storage (R2 only)
    R2_ENDPOINT: Optional[str] = None
    R2_REGION: str = "auto"
    R2_BUCKET: Optional[str] = None
    R2_ACCESS_KEY_ID: Optional[str] = None
    R2_SECRET_ACCESS_KEY: Optional[str] = None
    R2_PUBLIC_BASE_URL: Optional[str] = None

    # Ollama (LLM local para traducción)
    OLLAMA_HOST: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2:3b"

    # AI Optimization Settings
    AI_USE_PROMPT_CACHING: bool = True
    AI_USE_COMPRESSED_OUTPUT: bool = True
    AI_FILTER_CATALOG: bool = True
    AI_USE_PHASED_GENERATION: bool = True

    @field_validator("DATABASE_URL")
    @classmethod
    def database_url_must_be_remote(cls, value: str) -> str:
        return validate_remote_database_url(value)

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"  # allow keys in .env that we don't explicitly model
    )


settings = Settings()
