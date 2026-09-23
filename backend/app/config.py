from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables (or a local .env)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Full SQLAlchemy URL, e.g. postgresql+psycopg://user:pass@host:5432/dbname
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/monolith"

    # Comma-separated list of origins allowed by CORS.
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
