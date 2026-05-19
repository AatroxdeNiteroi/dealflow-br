"""Loader do parquet `estimates_final` + queries com filtros completos."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import polars as pl


# ── Escopo de produto ──────────────────────────────────────────────
# Decisão de produto: o universo do Genesis Radar é Ltda. pura (natureza
# jurídica 2062) com receita estimada ≤ R$250M, EXCLUINDO holdings e
# empresas em recuperação judicial declarada no razão social.
#
# Holdings (archetype='holding_structure') foram removidas após validação
# vs DRE pública mostrar erro mediano > 75% nesse arquétipo.
#
# Empresas com "EM RECUPERACAO JUDICIAL" no razão social têm operação
# degradada — estimativa de receita por folha não reflete realidade.
LTDA_NATUREZA = "2062"
RECEITA_TETO_BRL = 250_000_000.0
ARCHETYPES_EXCLUIDOS = ("holding_structure",)
# Regex case-insensitive · cobre variações "EM RECUPERAÇÃO", "EM RECUPERACAO",
# "- EM RECUP" (forma abreviada do RFB). Não pega "FENIX RECUPERACAO DE
# PLASTICOS" (recuperação de plástico, falso positivo) pois exige "EM" antes.
PATTERN_RJ_RAZAO = r"(?i)em\s+recuperac?[aã]o"


def _apply_scope(df: pl.DataFrame) -> pl.DataFrame:
    return df.filter(
        (pl.col("natureza_juridica") == LTDA_NATUREZA)
        & (pl.col("receita_point_brl") <= RECEITA_TETO_BRL)
        & (~pl.col("archetype").is_in(ARCHETYPES_EXCLUIDOS))
        & (~pl.col("razao_social").str.contains(PATTERN_RJ_RAZAO))
    )


# ── Pós-processamento: calibração de incerteza ─────────────────────
# O parquet upstream produz intervalo low/high muito apertado (mediana
# ±10%) que NÃO reflete a incerteza real medida em validação (±20%
# mediano, com cauda em arquétipos específicos). Aplicamos aqui:
#
# (a) Alargamento do intervalo por confidence — multiplicador sobre
#     o gap (point - low) e (high - point). Calibrado contra validação
#     n=125 vs DRE pública.
# (b) Rebaixamento de confidence em casos onde o modelo carrega viés
#     residual conhecido (capital_intensive midcap 100-500 funcs).
#
# Aplicado em query_estimates antes de retornar pra API. Não muda
# valores no parquet (mantém integridade do dado bruto).
INTERVAL_WIDEN_FACTOR = {
    "alta": 1.4,          # erro real ~12%, intervalo nominal ±5% → ×1.4
    "media": 1.8,         # erro real ~22%, intervalo nominal ±10% → ×1.8
    "baixa": 2.5,         # erro real ~35%, intervalo nominal ±15% → ×2.5
    "sem_benchmark": 3.0,
}


def _apply_uncertainty_calibration(df: pl.DataFrame) -> pl.DataFrame:
    """Alarga intervalo low/high por confidence + rebaixa confidence em
    casos de alto risco. Recalcula folha low/high consistentemente."""
    # Mapeamento confidence → fator (expressão Polars)
    fator = (
        pl.when(pl.col("confidence") == "alta").then(INTERVAL_WIDEN_FACTOR["alta"])
        .when(pl.col("confidence") == "media").then(INTERVAL_WIDEN_FACTOR["media"])
        .when(pl.col("confidence") == "baixa").then(INTERVAL_WIDEN_FACTOR["baixa"])
        .otherwise(INTERVAL_WIDEN_FACTOR["sem_benchmark"])
    )

    df = df.with_columns([
        # Alarga intervalo de receita preservando o point
        (pl.col("receita_point_brl") - (pl.col("receita_point_brl") - pl.col("receita_low_brl")) * fator).alias("receita_low_brl"),
        (pl.col("receita_point_brl") + (pl.col("receita_high_brl") - pl.col("receita_point_brl")) * fator).alias("receita_high_brl"),
        # Alarga intervalo de folha consistentemente
        (pl.col("folha_low_brl") / fator).alias("folha_low_brl"),
        (pl.col("folha_high_brl") * fator).alias("folha_high_brl"),
    ])

    # Rebaixa confidence em capital_intensive midcap 100-500 funcs
    # (PIA 1839 estratifica até 500; midcaps puxados por gigantes
    # capital-intensivos causam viés +35-40% sistemático)
    df = df.with_columns(
        pl.when(
            (pl.col("archetype") == "capital_intensive")
            & (pl.col("headcount").is_between(100, 500))
            & (pl.col("confidence").is_in(["alta", "media"]))
        )
        .then(pl.lit("baixa"))
        .otherwise(pl.col("confidence"))
        .alias("confidence")
    )
    return df


# ── Segunda estimativa via PIA receita-por-pessoa ──────────────────
# Lê tabela data/reference/receita_por_pessoa_2023.csv (gerada por
# scripts/build_receita_por_pessoa.py) e aplica fórmula alternativa:
#
#   receita_pia_brl = receita_por_pessoa_setorial × headcount
#
# Cruza-se com a estimativa principal (folha/razão). Convergência forte
# (diff < 25%) → confidence sobe um nível. Divergência forte (>50%) →
# confidence rebaixada e flag visível no produto.

_RPP_TABLE_PATH = Path(__file__).resolve().parents[4] / "data" / "reference" / "receita_por_pessoa_2023.csv"


@lru_cache(maxsize=1)
def _load_receita_por_pessoa() -> pl.DataFrame | None:
    if not _RPP_TABLE_PATH.exists():
        return None
    # cnae_2d e cnae_4d são string no parquet upstream — forçar mesma dtype
    return pl.read_csv(
        _RPP_TABLE_PATH,
        schema_overrides={
            "cnae_2d": pl.Utf8,
            "cnae_4d": pl.Utf8,
        },
    )


# Fator de correção pessoal ocupado total/assalariado (CEMPRE 6449).
# Conserta a inconsistência de unidade da fórmula PIA: receita_por_pessoa
# usa pessoal ocupado TOTAL (inclui sócios), mas o headcount da RAIS é só
# CLT. headcount × fator_pessoal ≈ pessoal ocupado real.
_CEMPRE_TABLE_PATH = (
    Path(__file__).resolve().parents[4]
    / "data" / "reference" / "fator_pessoal_cempre_2021.csv"
)


@lru_cache(maxsize=1)
def _load_fator_pessoal() -> pl.DataFrame | None:
    if not _CEMPRE_TABLE_PATH.exists():
        return None
    return pl.read_csv(
        _CEMPRE_TABLE_PATH,
        schema_overrides={"cnae_2d": pl.Utf8, "cnae_4d": pl.Utf8},
    )


def _apply_pia_second_estimate(df: pl.DataFrame) -> pl.DataFrame:
    """Adiciona colunas receita_pia_brl + convergencia_pct + sinal de
    divergência. Não altera receita_point_brl (preserva fórmula original).
    """
    rpp = _load_receita_por_pessoa()
    if rpp is None:
        return df.with_columns([
            pl.lit(None, dtype=pl.Float64).alias("receita_pia_brl"),
            pl.lit(None, dtype=pl.Float64).alias("convergencia_pct"),
            pl.lit("indisponivel", dtype=pl.Utf8).alias("convergencia_flag"),
        ])

    # Prepara lookup CNAE 4d → receita_por_pessoa
    rpp_4d = rpp.filter(pl.col("source_precision") == "alta").select([
        "cnae_4d", pl.col("receita_por_pessoa_brl").alias("rpp_4d_brl")
    ])
    rpp_2d = rpp.filter(pl.col("source_precision") == "media").select([
        pl.col("cnae_2d"),
        pl.col("receita_por_pessoa_brl").alias("rpp_2d_brl"),
    ])

    df = df.join(rpp_4d, left_on="cnae_4d", right_on="cnae_4d", how="left")
    df = df.with_columns(pl.col("cnae_4d").str.slice(0, 2).alias("_cnae_2d"))
    df = df.join(rpp_2d, left_on="_cnae_2d", right_on="cnae_2d", how="left")

    # Fator CEMPRE: corrige headcount CLT → pessoal ocupado total estimado.
    # Lookup por CNAE 4d, fallback por divisão 2d, default 1.0 (sem correção).
    fator_tbl = _load_fator_pessoal()
    if fator_tbl is not None:
        fator_4d = fator_tbl.select([
            "cnae_4d", pl.col("fator_pessoal").alias("_fator_4d")
        ])
        fator_2d = (
            fator_tbl.group_by("cnae_2d")
            .agg(pl.col("fator_pessoal").mean().alias("_fator_2d"))
        )
        df = df.join(fator_4d, on="cnae_4d", how="left")
        df = df.join(fator_2d, left_on="_cnae_2d", right_on="cnae_2d", how="left")
        df = df.with_columns(
            pl.coalesce([
                pl.col("_fator_4d"), pl.col("_fator_2d"), pl.lit(1.0)
            ]).alias("fator_pessoal")
        )
    else:
        df = df.with_columns(pl.lit(1.0).alias("fator_pessoal"))

    # receita_pia: receita_por_pessoa × pessoal ocupado estimado
    #   (headcount CLT × fator CEMPRE). Prefere 4d (PIA alta), fallback 2d.
    df = df.with_columns(
        pl.coalesce([
            pl.col("rpp_4d_brl") * pl.col("headcount") * pl.col("fator_pessoal"),
            pl.col("rpp_2d_brl") * pl.col("headcount") * pl.col("fator_pessoal"),
        ]).alias("receita_pia_brl")
    )

    # convergência = |1 - receita_pia/receita_point| × 100
    df = df.with_columns(
        pl.when(
            pl.col("receita_pia_brl").is_not_null()
            & (pl.col("receita_point_brl") > 0)
        )
        .then(
            (
                (pl.col("receita_pia_brl") - pl.col("receita_point_brl")).abs()
                / pl.col("receita_point_brl")
                * 100
            )
        )
        .otherwise(None)
        .alias("convergencia_pct")
    )

    # Flag binário: convergente (PIA bate a folha até 25%) ou não.
    # Decisão de produto: convergência só ADICIONA confiança — não há
    # categoria "divergente" exposta ao cliente (sem selo de desconfiança).
    df = df.with_columns(
        pl.when(pl.col("convergencia_pct").is_null())
        .then(pl.lit("sem_pia"))
        .when(pl.col("convergencia_pct") <= 25)
        .then(pl.lit("convergente"))
        .otherwise(pl.lit("nao_convergente"))
        .alias("convergencia_flag")
    )

    # Convergência = sinal de confiança ADITIVO. Decisão de produto: a PIA
    # nunca rebaixa confidence — ela só CONFIRMA. Quando as duas fórmulas
    # independentes batem (≤25%), promove um nível. Divergência não penaliza
    # (a folha continua sendo a estimativa de referência — tem evidência de
    # ser mais precisa, mediana 22.8% vs PIA 42.3% em n=125).
    df = df.with_columns(
        pl.when(
            (pl.col("convergencia_flag") == "convergente")
            & (pl.col("confidence") == "media")
        )
        .then(pl.lit("alta"))
        .when(
            (pl.col("convergencia_flag") == "convergente")
            & (pl.col("confidence") == "baixa")
        )
        .then(pl.lit("media"))
        .otherwise(pl.col("confidence"))
        .alias("confidence")
    )

    # Limpa colunas temporárias (mantém fator_pessoal — útil pra inspeção)
    temp = ["rpp_4d_brl", "rpp_2d_brl", "_cnae_2d", "_fator_4d", "_fator_2d"]
    return df.drop([c for c in temp if c in df.columns])


# ── Alavanca 2: piso de receita por contratos federais ─────────────
# Lê data/contratos_federais_por_cnpj.json (gerado por
# scripts/active_validation/scrape_portal_transparencia.py).
# Empresa que fornece ao governo federal tem valor de contrato anual
# declarado oficialmente — é PISO de receita real.
#
# Quando piso_federal_anual > estimativa do motor, há subestimação
# comprovada por dado oficial → confidence rebaixada + flag visível.

_FEDERAL_PATH = Path(__file__).resolve().parents[4] / "data" / "contratos_federais_por_cnpj.json"


@lru_cache(maxsize=1)
def _load_federal_floor() -> pl.DataFrame | None:
    import json
    if not _FEDERAL_PATH.exists():
        return None
    try:
        records = json.loads(_FEDERAL_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    if not records:
        return None
    rows = [
        {
            "cnpj": r["cnpj"],
            "piso_federal_anual_brl": r.get("piso_minimo_anual_brl"),
            "n_contratos_federais": r.get("n_contratos"),
        }
        for r in records
        if r.get("cnpj")
    ]
    if not rows:
        return None
    return pl.DataFrame(rows)


def _apply_federal_floor(df: pl.DataFrame) -> pl.DataFrame:
    """Adiciona piso_federal_anual_brl + flag_subestimacao_federal.
    Graceful: se JSON ausente/vazio, colunas ficam nulas/False."""
    federal = _load_federal_floor()
    if federal is None:
        return df.with_columns([
            pl.lit(None, dtype=pl.Float64).alias("piso_federal_anual_brl"),
            pl.lit(None, dtype=pl.Int64).alias("n_contratos_federais"),
            pl.lit(False).alias("flag_subestimacao_federal"),
        ])

    df = df.join(federal, on="cnpj", how="left")
    df = df.with_columns(
        (
            pl.col("piso_federal_anual_brl").is_not_null()
            & (pl.col("piso_federal_anual_brl") > pl.col("receita_point_brl"))
        ).alias("flag_subestimacao_federal")
    )
    # Onde há subestimação comprovada por dado oficial, rebaixa confidence
    df = df.with_columns(
        pl.when(pl.col("flag_subestimacao_federal") & (pl.col("confidence") != "baixa"))
        .then(pl.lit("baixa"))
        .otherwise(pl.col("confidence"))
        .alias("confidence")
    )
    return df


@lru_cache(maxsize=1)
def load_estimates(path: Path | None = None) -> pl.DataFrame:
    from ..settings import settings

    target = path or settings.parquet_path
    if not target.exists():
        raise FileNotFoundError(
            f"Parquet não encontrado em {target}. "
            "Rode `uv run python scripts/export_estimates_to_parquet.py` na raiz do repo."
        )
    df = _apply_scope(pl.read_parquet(target))
    df = _apply_uncertainty_calibration(df)
    df = _apply_pia_second_estimate(df)
    df = _apply_federal_floor(df)
    return df


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


# ── Histórico headcount ─────────────────────────────────────────────


@lru_cache(maxsize=1)
def load_history() -> pl.DataFrame:
    from ..settings import settings

    target = settings.history_parquet_path
    if not target.exists():
        return pl.DataFrame(schema={"cnpj": pl.Utf8, "ano": pl.Int64, "headcount": pl.Int64})
    return pl.read_parquet(target)


def get_history(cnpj: str) -> list[dict]:
    df = load_history()
    return (
        df.filter(pl.col("cnpj") == cnpj)
        .sort("ano")
        .select(["ano", "headcount"])
        .to_dicts()
    )


# ── Sócios · mapa de grupo ──────────────────────────────────────────


@lru_cache(maxsize=1)
def load_socios() -> pl.DataFrame:
    from ..settings import settings

    target = settings.socios_parquet_path
    if not target.exists():
        return pl.DataFrame(schema={
            "socio_key": pl.Utf8,
            "cnpj_basico": pl.Utf8,
            "iniciais": pl.Utf8,
            "tipo": pl.Utf8,
            "qualificacao": pl.Utf8,
        })
    return pl.read_parquet(target)


def get_socios_da_empresa(cnpj: str) -> list[dict]:
    """Sócios de uma empresa + quantas outras empresas cada sócio aparece."""
    socios_df = load_socios()
    estimates_df = load_estimates()

    # Map cnpj → cnpj_basico
    row = estimates_df.filter(pl.col("cnpj") == cnpj).select("cnpj_basico")
    if row.height == 0:
        return []
    cnpj_basico = row.item(0, 0)

    da_empresa = socios_df.filter(pl.col("cnpj_basico") == cnpj_basico)
    if da_empresa.height == 0:
        return []

    # Para cada sócio, conta em quantas empresas do universo aparece
    contagem = (
        socios_df.group_by("socio_key")
        .agg(pl.len().alias("n_empresas"))
    )
    return (
        da_empresa.join(contagem, on="socio_key", how="left")
        .select(["socio_key", "iniciais", "tipo", "qualificacao", "n_empresas"])
        .to_dicts()
    )


# ── Contato (endereço · telefones · email) ──────────────────────────


@lru_cache(maxsize=1)
def load_contato() -> pl.DataFrame:
    from ..settings import settings

    target = settings.contato_parquet_path
    if not target.exists():
        return pl.DataFrame(schema={"cnpj": pl.Utf8})
    return pl.read_parquet(target)


def get_contato(cnpj: str) -> dict | None:
    df = load_contato().filter(pl.col("cnpj") == cnpj)
    if df.height == 0:
        return None
    row = df.to_dicts()[0]
    # Normaliza valores vazios para None
    return {k: (v if v not in (None, "", "NaN") else None) for k, v in row.items()}


def get_empresas_do_socio(socio_key: str) -> list[dict]:
    """Empresas (do universo) que compartilham um sócio."""
    socios_df = load_socios()
    estimates_df = load_estimates()

    cnpj_basicos = (
        socios_df.filter(pl.col("socio_key") == socio_key)
        .select("cnpj_basico")
        .unique()
    )
    if cnpj_basicos.height == 0:
        return []

    return (
        estimates_df.filter(pl.col("cnpj_basico").is_in(cnpj_basicos["cnpj_basico"].to_list()))
        .select([
            "cnpj", "razao_social", "sigla_uf", "cnae_secao",
            "receita_point_brl", "headcount", "archetype", "confidence",
        ])
        .sort("receita_point_brl", descending=True, nulls_last=True)
        .to_dicts()
    )
