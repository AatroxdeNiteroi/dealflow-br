"""Settings via env vars (.env opcional)."""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="DEALFLOW_")

    parquet_path: Path = Path("../data/estimates_final.parquet")
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]


settings = Settings()
