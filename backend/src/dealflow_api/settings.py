"""Settings via env vars (.env opcional)."""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Raiz do repo: backend/src/dealflow_api/settings.py → sobe 4 níveis
_REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="DEALFLOW_")

    repo_root: Path = _REPO_ROOT
    parquet_path: Path = _REPO_ROOT / "data" / "estimates_final.parquet"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]


settings = Settings()
