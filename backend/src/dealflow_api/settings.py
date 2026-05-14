"""Settings via env vars (.env opcional)."""

from __future__ import annotations

from pathlib import Path

from pydantic import field_validator
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

    # CORS · whitelist por env (CSV ou JSON). Default dev-only.
    # Prod: DEALFLOW_CORS_ORIGINS="https://app.dealflowbr.com.br,https://staging.dealflowbr.com.br"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # ── Segurança ─────────────────────────────────────────────────
    # API key compartilhada (header X-Api-Key). Sem ela, autenticação
    # fica DESLIGADA (modo dev). Em produção SEMPRE definir.
    api_key: str | None = None
    # Rate-limit · req/min por IP. 0 desativa.
    rate_limit_per_min: int = 60
    # Audit log: caminho de arquivo JSONL. Se None → loga em stderr.
    audit_log_path: Path | None = None

    # ── AI Search ────────────────────────────────────────────────
    # API key para AI Search (POST /search/ai). Sem ela, o endpoint retorna 503.
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-haiku-4-5-20251001"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_csv(cls, v: object) -> object:
        """Aceita 'a,b,c' (env var CSV) além do default list/JSON."""
        if isinstance(v, str):
            stripped = v.strip()
            # Se for JSON-array, deixa Pydantic processar
            if stripped.startswith("["):
                return v
            return [s.strip() for s in stripped.split(",") if s.strip()]
        return v


settings = Settings()
