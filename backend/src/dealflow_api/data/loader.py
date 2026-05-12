"""Loader do parquet `estimates_final` (lido pelo BACKEND, cacheado em memória)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import polars as pl


@lru_cache(maxsize=1)
def load_estimates(path: Path | None = None) -> pl.DataFrame:
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
    df = df.sort("receita_point_brl", descending=True, nulls_last=True).slice(offset, limit)
    return df.to_dicts(), total


def filter_domains() -> dict:
    df = load_estimates()
    return {
        "ufs": sorted(df["sigla_uf"].drop_nulls().unique().to_list()),
        "confidences": sorted(df["confidence"].drop_nulls().unique().to_list()),
        "archetypes": sorted(df["archetype"].drop_nulls().unique().to_list()),
        "tiers": ["Tier 1", "Tier 2"],
        "total_empresas": len(df),
    }


# ── Faixas de receita pra histogramas ──────────────────────────────────────
_RECEITA_BUCKETS = [
    (0, 1e6, "<R$1M"),
    (1e6, 5e6, "R$1-5M"),
    (5e6, 10e6, "R$5-10M"),
    (10e6, 25e6, "R$10-25M"),
    (25e6, 50e6, "R$25-50M"),
    (50e6, 100e6, "R$50-100M"),
    (100e6, 500e6, "R$100-500M"),
    (500e6, 1e9, "R$500M-1B"),
    (1e9, 1e15, "R$1B+"),
]


def market_stats() -> dict:
    """Agregados pra alimentar gráficos do front sem trafegar 60k linhas."""
    df = load_estimates()
    n = len(df)

    # Histograma de receita
    receita_hist = []
    for lo, hi, label in _RECEITA_BUCKETS:
        c = int(df.filter(pl.col("receita_point_brl").is_between(lo, hi)).height)
        receita_hist.append({"bucket": label, "n": c, "lo": lo, "hi": hi})

    # Por archetype
    by_arc = (
        df.group_by("archetype")
        .agg(
            pl.len().alias("n"),
            pl.median("receita_point_brl").alias("receita_mediana_brl"),
            pl.median("headcount").alias("headcount_mediano"),
        )
        .sort("n", descending=True)
        .to_dicts()
    )

    # Por UF
    by_uf = (
        df.group_by("sigla_uf")
        .agg(
            pl.len().alias("n"),
            pl.median("receita_point_brl").alias("receita_mediana_brl"),
            pl.sum("receita_point_brl").alias("receita_total_brl"),
        )
        .sort("n", descending=True)
        .to_dicts()
    )

    # Por confidence
    by_conf = (
        df.group_by("confidence")
        .agg(pl.len().alias("n"))
        .sort("n", descending=True)
        .to_dicts()
    )

    # Top setor (seção CNAE)
    by_secao = (
        df.group_by("cnae_secao")
        .agg(
            pl.len().alias("n"),
            pl.median("receita_point_brl").alias("receita_mediana_brl"),
        )
        .sort("n", descending=True)
        .to_dicts()
    )

    return {
        "total_empresas": n,
        "receita_hist": receita_hist,
        "by_archetype": by_arc,
        "by_uf": by_uf,
        "by_confidence": by_conf,
        "by_cnae_secao": by_secao,
        "receita_mediana_brl": float(df["receita_point_brl"].median() or 0),
        "receita_total_brl": float(df["receita_point_brl"].sum() or 0),
        "headcount_mediano": float(df["headcount"].median() or 0),
    }


def top_empresas(n: int = 20) -> list[dict]:
    """Top N empresas por receita com mais alta confiança (alimenta ticker)."""
    df = load_estimates()
    df = (
        df.filter(pl.col("confidence").is_in(["alta", "media"]))
        .filter(pl.col("receita_point_brl").is_not_null())
        .sort("receita_point_brl", descending=True)
        .head(n)
    )
    return df.select([
        "cnpj", "razao_social", "sigla_uf", "cnae_secao",
        "receita_point_brl", "headcount", "archetype", "confidence",
    ]).to_dicts()
