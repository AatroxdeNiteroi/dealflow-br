"""Loader do parquet `estimates_final` + queries com filtros completos."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import polars as pl


# ── Escopo de produto ──────────────────────────────────────────────
# Decisão de produto: o universo do DealFlow é Ltda. pura (natureza
# jurídica 2062) OU empresa com receita estimada ≤ R$250M. Isso descarta
# 461 gigantes (S.A. abertas, holdings grandes) que não são o público-alvo
# do produto de M&A médio porte.
LTDA_NATUREZA = "2062"
RECEITA_TETO_BRL = 250_000_000.0


def _apply_scope(df: pl.DataFrame) -> pl.DataFrame:
    return df.filter(
        (pl.col("natureza_juridica") == LTDA_NATUREZA)
        | (pl.col("receita_point_brl") <= RECEITA_TETO_BRL)
    )


@lru_cache(maxsize=1)
def load_estimates(path: Path | None = None) -> pl.DataFrame:
    from ..settings import settings

    target = path or settings.parquet_path
    if not target.exists():
        raise FileNotFoundError(
            f"Parquet não encontrado em {target}. "
            "Rode `uv run python scripts/export_estimates_to_parquet.py` na raiz do repo."
        )
    return _apply_scope(pl.read_parquet(target))


def query_estimates(
    *,
    uf: list[str] | None = None,
    confidence: list[str] | None = None,
    archetype: list[str] | None = None,
    cnae_secao: list[str] | None = None,
    razao_precision: list[str] | None = None,
    match_tier: str | None = None,
    receita_min_brl: float | None = None,
    receita_max_brl: float | None = None,
    headcount_min: int | None = None,
    headcount_max: int | None = None,
    idade_min: int | None = None,
    idade_max: int | None = None,
    capital_min_brl: float | None = None,
    capital_max_brl: float | None = None,
    n_socios_min: int | None = None,
    n_socios_max: int | None = None,
    n_socios_pj_min: int | None = None,
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
    if cnae_secao:
        df = df.filter(pl.col("cnae_secao").is_in(cnae_secao))
    if razao_precision:
        df = df.filter(pl.col("razao_precision").is_in(razao_precision))
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
    if idade_min is not None:
        df = df.filter(pl.col("idade_empresa_anos") >= idade_min)
    if idade_max is not None:
        df = df.filter(pl.col("idade_empresa_anos") <= idade_max)
    if capital_min_brl is not None:
        df = df.filter(pl.col("capital_social") >= capital_min_brl)
    if capital_max_brl is not None:
        df = df.filter(pl.col("capital_social") <= capital_max_brl)
    if n_socios_min is not None:
        df = df.filter(pl.col("n_socios") >= n_socios_min)
    if n_socios_max is not None:
        df = df.filter(pl.col("n_socios") <= n_socios_max)
    if n_socios_pj_min is not None:
        df = df.filter(pl.col("n_socios_pj") >= n_socios_pj_min)
    if search:
        s = search.strip().lower()
        df = df.filter(
            pl.col("razao_social").cast(pl.Utf8).str.to_lowercase().str.contains(s, literal=True)
            | pl.col("cnpj").cast(pl.Utf8).str.contains(s, literal=True)
        )

    total = len(df)
    # Ordenação: alta confiança primeiro, depois média, baixa, sem_benchmark.
    # Dentro de cada bucket, receita DESC. Garante que os primeiros N
    # resultados sejam sempre os mais confiáveis disponíveis no recorte.
    df = (
        df.with_columns(
            pl.when(pl.col("confidence") == "alta").then(0)
            .when(pl.col("confidence") == "media").then(1)
            .when(pl.col("confidence") == "baixa").then(2)
            .otherwise(3)
            .alias("__conf_rank")
        )
        .sort(["__conf_rank", "receita_point_brl"], descending=[False, True], nulls_last=True)
        .drop("__conf_rank")
        .slice(offset, limit)
    )
    return df.to_dicts(), total


def filter_domains() -> dict:
    df = load_estimates()
    return {
        "ufs": sorted(df["sigla_uf"].drop_nulls().unique().to_list()),
        "confidences": sorted(df["confidence"].drop_nulls().unique().to_list()),
        "archetypes": sorted(df["archetype"].drop_nulls().unique().to_list()),
        "cnae_secoes": sorted(df["cnae_secao"].drop_nulls().unique().to_list()),
        "razao_precisions": sorted(df["razao_precision"].drop_nulls().unique().to_list()),
        "tiers": ["Tier 1", "Tier 2"],
        "total_empresas": len(df),
        "ranges": {
            "headcount":     {"min": int(df["headcount"].min() or 0),
                              "max": int(df["headcount"].max() or 0)},
            "idade_empresa": {"min": int(df["idade_empresa_anos"].min() or 0),
                              "max": int(df["idade_empresa_anos"].max() or 0)},
            "capital_social":{"min": 0.0,
                              "max": float(df["capital_social"].max() or 0)},
            "n_socios":      {"min": 0,
                              "max": int(df["n_socios"].max() or 0)},
            "receita":       {"min": 0.0,
                              "max": float(df["receita_point_brl"].max() or 0)},
        },
    }


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
    df = load_estimates()
    n = len(df)

    receita_hist = []
    for lo, hi, label in _RECEITA_BUCKETS:
        c = int(df.filter(pl.col("receita_point_brl").is_between(lo, hi)).height)
        receita_hist.append({"bucket": label, "n": c, "lo": lo, "hi": hi})

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
    by_conf = (
        df.group_by("confidence")
        .agg(pl.len().alias("n"))
        .sort("n", descending=True)
        .to_dicts()
    )
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
