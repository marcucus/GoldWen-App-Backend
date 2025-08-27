import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_PREFIX: str = "/api/v1"
    
    DATABASE_URL: str = "postgresql://goldwen:goldwen_password@localhost:5432/goldwen_db"
    REDIS_URL: str = "redis://localhost:6379"
    
    MAIN_API_URL: str = "http://localhost:3000"
    API_KEY: str = "matching-service-secret-key"
    
    LOG_LEVEL: str = "INFO"
    
    # Algorithm parameters
    MIN_COMPATIBILITY_SCORE: float = 0.3
    DEFAULT_SELECTION_SIZE: int = 5
    MAX_SELECTION_SIZE: int = 10
    COMPATIBILITY_WEIGHTS_PERSONALITY: float = 0.6
    COMPATIBILITY_WEIGHTS_PREFERENCES: float = 0.4
    
    class Config:
        env_file = ".env"

settings = Settings()