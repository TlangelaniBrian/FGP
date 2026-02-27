from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql://postgres:postgres@localhost:5432/postgres"
    redis_url: str = "redis://localhost:6379"
    tariff_year: int = 2026
    scraper_headless: bool = True


settings = Settings()
