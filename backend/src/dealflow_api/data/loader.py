"""Loader do parquet `estimates_final` (lido pelo BACKEND, cacheado em memória)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import polars as pl


@lru_cache(maxsize=1)
def load_estimates(path: Path | None = None) -> pl.DataFrame:
    """Carrega estimates_final.parquet uma vez por processo."""
    from ..settings import settings

    target = path or settings.parquet_path
    if not target.exists():
        raise FileNotFoundError(
            f"Parquet não encontrado em {target}. "
            "Rode `uv run python scripts/export_estimates_to_parquet.py` na raiz do repo."
        )
    return pl.read_parquet(target)


def query_estimates(
    *,
    uf: list[str] | None = None,
    confidence: list[str] | None = None,
    archetype: list[str] | None = None,
    match_tier: str | None = None,
    receita_min_brl: float | None = None,
    receita_max_brl: float | None = None,
    headcount_min: int | None = None,
    headcount_max: int | None = None,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[dict], int]:
    """Aplica filtros e devolve (items, total_filtrado)."""
    df = load_estimates()

    if uf:
        df = df.filter(pl.col("sigla_uf").is_in(uf))
    if confidence:
        df = df.filter(pl.col("confidence").is_in(confidence))
    if archetype:
        df = df.filter(pl.col("archetype").is_in(archetype))
    if match_tier:
        if match_tier == "Tier 1":
            df = df.filter(pl.col("match_tier") == "Tier 1")
        elif match_tier == "Tier 2":
            df = df.filter(pl.col("match_tier").str.starts_with("Tier 2"))
    if receita_min_brl is not None:
        df = df.filter(pl.col("receita_point_brl") >= receita_min_brl)
    if receita_max_brl is not None:
        df = df.filter(pl.col("receita_point_brl") <= receita_max_brl)
    if headcount_min is not None:
        df = df.filter(pl.col("headcount") >= headcount_min)
    if headcount_max is not None:
        df = df.filter(pl.col("headcount") <= headcount_max)
    if search:
        s = search.strip().lower()
        df = df.filter(
            pl.col("razao_social").cast(pl.Utf8).str.to_lowercase().str.contains(s, literal=True)
            | pl.col("cnpj").cast(pl.Utf8).str.contains(s, literal=True)
        )

    total = len(df)

    df = (
        df.sort("receita_point_brl", descending=True, nulls_last=True)
        .slice(offset, limit)
    )

    return df.to_dicts(), total


def filter_domains() -> dict:
    """Domínios disponíveis (pra popular dropdowns na UI)."""
    df = load_estimates()
    return {
        "ufs": sorted(df["sigla_uf"].drop_nulls().unique().to_list()),
        "confidences": sorted(df["confidence"].drop_nulls().unique().to_list()),
        "archetypes": sorted(df["archetype"].drop_nulls().unique().to_list()),
        "tiers": ["Tier 1", "Tier 2"],
        "total_empresas": len(df),
    }
