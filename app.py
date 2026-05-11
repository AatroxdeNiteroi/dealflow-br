"""DealFlow BR — UI Streamlit local.

Lê ``data/estimates_v2.parquet`` (output do motor §6, exportado do BigQuery
via ``scripts/export_estimates_to_parquet.py``) e expõe os filtros de produto
descritos em ``docs/architecture.md`` §8.3.

Rodar:
    uv run streamlit run app.py
"""

from __future__ import annotations

from pathlib import Path

import polars as pl
import streamlit as st

PARQUET_PATH = Path("data/estimates_v2.parquet")

# Colunas candidatas para receita estimada (ordem de preferência).
REVENUE_COL_CANDIDATES = (
    "receita_point_brl",
    "receita_estimada_brl",
    "receita_brl",
)

# Coluna de confiança no schema atual.
CONF_COL_CANDIDATES = ("confidence", "confianca")

# Coluna de idade.
IDADE_COL_CANDIDATES = ("idade_empresa_anos", "idade_anos")

# Coluna de capital social.
CAPITAL_COL_CANDIDATES = ("capital_social", "capital_social_brl")

# Defaults sensíveis para a UI inicial.
DEFAULT_REVENUE_RANGE_M = (5.0, 100.0)
DEFAULT_HEADCOUNT_RANGE = (5, 1000)
DEFAULT_CONF_PREFERRED = ("alta", "media", "high", "medium")

st.set_page_config(
    page_title="DealFlow BR — Triagem M&A RJ/SP",
    page_icon="📊",
    layout="wide",
)


@st.cache_data(show_spinner="Carregando estimates_v2.parquet ...")
def load_estimates(path: Path) -> pl.DataFrame | None:
    if not path.exists():
        return None
    return pl.read_parquet(path)


def find_first_column(df: pl.DataFrame, candidates: tuple[str, ...]) -> str | None:
    for col in candidates:
        if col in df.columns:
            return col
    return None


def format_brl(value: float | int | None) -> str:
    if value is None:
        return "—"
    v = float(value)
    if v >= 1e9:
        return f"R${v / 1e9:.2f}B"
    if v >= 1e6:
        return f"R${v / 1e6:.1f}M"
    if v >= 1e3:
        return f"R${v / 1e3:.0f}k"
    return f"R${v:.0f}"


df = load_estimates(PARQUET_PATH)

if df is None:
    st.error(f"`{PARQUET_PATH}` não encontrado.")
    st.markdown(
        """
        Esta UI consome o output do motor (`estimates_v2`) materializado como
        parquet local. Para gerar:

        ```bash
        gcloud auth application-default login
        uv sync --extra export
        uv run python scripts/export_estimates_to_parquet.py
        ```

        Veja `docs/architecture.md` §10 para o inventário das tabelas BigQuery
        e §8 para a lógica do pipeline.
        """
    )
    st.stop()

total_universe = len(df)
revenue_col = find_first_column(df, REVENUE_COL_CANDIDATES)
conf_col = find_first_column(df, CONF_COL_CANDIDATES)
idade_col = find_first_column(df, IDADE_COL_CANDIDATES)
capital_col = find_first_column(df, CAPITAL_COL_CANDIDATES)

# ---- Sidebar ----------------------------------------------------------------

st.sidebar.title("Filtros de produto")
st.sidebar.caption(
    "Camada de dados é fixa (motor §6); estes filtros são definidos pelo cliente."
)

if "sigla_uf" in df.columns:
    ufs = sorted(df["sigla_uf"].drop_nulls().unique().to_list())
    sel_uf = st.sidebar.multiselect("UF", ufs, default=ufs)
    if sel_uf:
        df = df.filter(pl.col("sigla_uf").is_in(sel_uf))

if conf_col:
    confs = sorted(df[conf_col].drop_nulls().unique().to_list())
    default_confs = [c for c in confs if c in DEFAULT_CONF_PREFERRED] or confs
    sel_conf = st.sidebar.multiselect("Confiança", confs, default=default_confs)
    if sel_conf:
        df = df.filter(pl.col(conf_col).is_in(sel_conf))

if revenue_col:
    full_max_m = float(df[revenue_col].max() or 100e6) / 1e6
    slider_max = float(max(100, round(full_max_m + 1)))
    sel_rev_m = st.sidebar.slider(
        "Receita estimada (R$ milhões)",
        min_value=0.0,
        max_value=slider_max,
        value=DEFAULT_REVENUE_RANGE_M,
        step=1.0,
    )
    df = df.filter(
        pl.col(revenue_col).is_between(sel_rev_m[0] * 1e6, sel_rev_m[1] * 1e6)
    )

if "archetype" in df.columns:
    archs = sorted(df["archetype"].drop_nulls().unique().to_list())
    sel_arch = st.sidebar.multiselect("Archetype", archs, default=archs)
    if sel_arch:
        df = df.filter(pl.col("archetype").is_in(sel_arch))

if "headcount" in df.columns:
    hc_max = int(df["headcount"].max() or 1000)
    sel_hc = st.sidebar.slider(
        "Headcount",
        min_value=0,
        max_value=max(1000, hc_max),
        value=DEFAULT_HEADCOUNT_RANGE,
        step=5,
    )
    df = df.filter(pl.col("headcount").is_between(sel_hc[0], sel_hc[1]))

if idade_col:
    idade_max = int(df[idade_col].max() or 100)
    sel_idade = st.sidebar.slider(
        "Idade da empresa (anos)",
        min_value=0,
        max_value=max(50, idade_max),
        value=(0, max(50, idade_max)),
    )
    df = df.filter(pl.col(idade_col).is_between(sel_idade[0], sel_idade[1]))

if capital_col:
    sel_cap_k = st.sidebar.number_input(
        "Capital social mínimo (R$ mil)", min_value=0, value=0, step=100
    )
    if sel_cap_k > 0:
        df = df.filter(pl.col(capital_col) >= sel_cap_k * 1000)

if "cnae_secao" in df.columns:
    secoes = sorted(df["cnae_secao"].drop_nulls().unique().to_list())
    sel_secao = st.sidebar.multiselect("Seção CNAE", secoes, default=secoes)
    if sel_secao:
        df = df.filter(pl.col("cnae_secao").is_in(sel_secao))

if "razao_precision" in df.columns:
    precisions = sorted(df["razao_precision"].drop_nulls().unique().to_list())
    sel_prec = st.sidebar.multiselect(
        "Precisão da razão folha/receita",
        precisions,
        default=precisions,
        help="alta=PIA 4d (indústria) | media=PAS/PAC sub-agrup | baixa=fallback seção",
    )
    if sel_prec:
        df = df.filter(pl.col("razao_precision").is_in(sel_prec))

search = st.sidebar.text_input("Buscar razão social ou CNPJ").strip().lower()
if search:
    text_cols = [c for c in ("razao_social", "cnpj", "nome_fantasia") if c in df.columns]
    if text_cols:
        mask = pl.lit(False)
        for c in text_cols:
            mask = mask | pl.col(c).cast(pl.Utf8).str.to_lowercase().str.contains(search, literal=True)
        df = df.filter(mask)

# ---- Main -------------------------------------------------------------------

st.title("DealFlow BR — Triagem M&A médio porte RJ/SP")
st.caption(
    "Estimativa pública de faturamento via Match RAIS + IBGE PIA/PAC/PAS. "
    "Metodologia: `docs/architecture.md` v3.1."
)

c1, c2, c3, c4 = st.columns(4)
c1.metric("Empresas no recorte", f"{len(df):,}")
c2.metric("Universo total", f"{total_universe:,}")

if revenue_col and len(df) > 0:
    c3.metric("Mediana receita", format_brl(df[revenue_col].median()))
    c4.metric("Soma receita estimada", format_brl(df[revenue_col].sum()))

if len(df) == 0:
    st.warning("Nenhuma empresa bate com o recorte atual. Relaxe os filtros na barra lateral.")
    st.stop()

# ---- Distribuições ----------------------------------------------------------

dist_col, conf_col_block = st.columns(2)

with dist_col:
    if "archetype" in df.columns:
        by_arch = (
            df.group_by("archetype")
            .agg(pl.len().alias("n"))
            .sort("n", descending=True)
        )
        st.subheader("Por archetype")
        st.bar_chart(by_arch.to_pandas().set_index("archetype")["n"], height=260)

with conf_col_block:
    if conf_col:
        by_conf = (
            df.group_by(conf_col)
            .agg(pl.len().alias("n"))
            .sort("n", descending=True)
        )
        st.subheader("Por confiança")
        st.bar_chart(by_conf.to_pandas().set_index(conf_col)["n"], height=260)

# ---- Tabela -----------------------------------------------------------------

st.subheader("Empresas")

display_cols_order = [
    "cnpj",
    "razao_social",
    "sigla_uf",
    "id_municipio",
    "bairro",
    "cnae_2_subclasse",
    "cnae_secao",
    "headcount",
    idade_col,
    capital_col,
    "capital_por_funcionario",
    revenue_col,
    "receita_low_brl",
    "receita_high_brl",
    conf_col,
    "razao_precision",
    "archetype",
    "n_socios",
    "n_socios_pf",
    "n_socios_pj",
]
display_cols = [c for c in display_cols_order if c and c in df.columns]

if revenue_col:
    df_sorted = df.sort(revenue_col, descending=True, nulls_last=True)
else:
    df_sorted = df

st.dataframe(df_sorted.select(display_cols), use_container_width=True, height=520)

# ---- Download ---------------------------------------------------------------

csv_bytes = df_sorted.write_csv().encode("utf-8")
st.download_button(
    "Baixar recorte (.csv)",
    data=csv_bytes,
    file_name="dealflow_recorte.csv",
    mime="text/csv",
)

st.caption(
    "Snapshot: Receita 2024-12-18 · RAIS 2024 · IBGE PIA/PAS/PAC 2023. "
    "Cada número é auditável a partir das fontes em §2 da metodologia."
)
