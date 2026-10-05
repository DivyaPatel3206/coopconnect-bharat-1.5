import os

class Settings:
    APP_NAME = "CoopConnect Bharat API"
    # Defaults to a local SQLite file so the project runs with zero setup.
    # Swap DATABASE_URL for a Postgres URL (see docker-compose.yml) for a
    # closer-to-production setup.
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./coopconnect.db")
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me-in-production")
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

settings = Settings()
