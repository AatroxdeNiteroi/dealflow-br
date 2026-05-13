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
    history_parquet_path: Path = _REPO_ROOT / "data" / "headcount_history.parquet"
    socios_parquet_path: Path = _REPO_ROOT / "data" / "socios_index.parquet"
    contato_parquet_path: Path = _REPO_ROOT / "data" / "contato.parquet"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    # API key para AI Search (POST /search/ai). Sem ela, o endpoint retorna 503.
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-haiku-4-5-20251001"


settings = Settings()
