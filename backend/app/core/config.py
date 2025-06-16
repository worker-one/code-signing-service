import os
from datetime import timedelta

class Settings:
    PROJECT_NAME: str = "Code Signing Service"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./code_signing.db")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change_this_in_production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    
    # File Upload
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE: int = 100 * 1024 * 1024  # 100 MB
    
    # Azure Configuration
    AZURE_TENANT_ID: str = os.getenv("AZURE_TENANT_ID", "")
    AZURE_CLIENT_ID: str = os.getenv("AZURE_CLIENT_ID", "")
    AZURE_CLIENT_SECRET: str = os.getenv("AZURE_CLIENT_SECRET", "")
    
    # Superuser credentials
    SUPERUSER_USERNAME: str = os.getenv("SUPERUSER_USERNAME", "adm")
    SUPERUSER_PASSWORD: str = os.getenv("SUPERUSER_PASSWORD", "KUyhgvuhisidijkm!=")
    
    API_V1_STR: str = "/api/v1"

    class Config:
        case_sensitive = True

settings = Settings()