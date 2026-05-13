"""Exporta `socios_index_v1` do BigQuery enriquecendo com:
- `socio_key` — chave estável para agrupar o mesmo sócio em múltiplas empresas.
- `iniciais` — versão privacy-friendly do nome (PF) para exibição no front.

Uso:
    uv sync --extra export
    uv run python scripts/export_socios_index.py
"""

from __future__ import annotations

import hashlib
import sys
import unicodedata
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

PROJECT_ID = "the-dumbers"
DATASET = "dealflow"
TABLE = "socios_index_v1"

OUT_PATH = Path("data/socios_index.parquet")

# Stopwords portuguesas para iniciais
_STOPWORDS = {
    "DA", "DE", "DO", "DOS", "DAS", "DEL", "LA", "EL",
    "E", "Y", "VAN", "VON", "DE'", "D'", "DI",
}


def _normalize(name: str) -> str:
    """Remove acentos e uppercase, normaliza espaços."""
    nfkd = unicodedata.normalize("NFKD", name)
    no_accent = "".join(c for c in nfkd if not unicodedata.combining(c))
    return " ".join(no_accent.upper().split())


def _iniciais(name: str, max_initials: int = 4) -> str:
    """Converte 'João Maria da Silva' → 'J. M. S.'"""
    norm = _normalize(name)
    tokens = [t for t in norm.split() if t and t not in _STOPWORDS]
    if not tokens:
        return "—"
    letters = [t[0] for t in tokens[:max_initials]]
    return ". ".join(letters) + "."


def _socio_key(tipo: str, nome: str, documento: str | None) -> str:
    """Chave estável para agrupar o mesmo sócio em múltiplas empresas.

    - PF (tipo='2'): sha1(nome_normalizado + documento_mascarado)
    - PJ (tipo='1'): 'PJ:' + documento (CNPJ completo)
    - Estrangeiro (tipo='3'): 'EXT:' + sha1(nome_normalizado)
    """
    if tipo == "1":  # PJ
        return f"PJ:{documento or ''}"
    norm = _normalize(nome)
    if tipo == "3":  # estrangeiro
        return "EXT:" + hashlib.sha1(norm.encode("utf-8")).hexdigest()[:16]
    # PF (tipo='2' ou outros)
    seed = (norm + "|" + (documento or "")).encode("utf-8")
    return "PF:" + hashlib.sha1(seed).hexdigest()[:16]


def _tipo_label(tipo: str) -> str:
    return {"1": "PJ", "2": "PF", "3": "Estrangeiro"}.get(tipo, "PF")


def main() -> int:
    try:
        from google.cloud import bigquery
    except ImportError:
        print("google-cloud-bigquery não instalado. Rode `uv sync --extra export`.", file=sys.stderr)
        return 1

    import polars as pl

    client = bigquery.Client(project=PROJECT_ID)
    full_table = f"{PROJECT_ID}.{DATASET}.{TABLE}"
    print(f"Baixando {full_table} ...")

    df = client.query(
        f"""
        SELECT cnpj_basico, tipo, nome, documento, qualificacao, data_entrada_sociedade
        FROM `{full_table}`
        ORDER BY cnpj_basico, nome
        """
    ).to_dataframe(create_bqstorage_client=True)

    print(f"Linhas brutas: {len(df):,}")

    # Enriquecer com socio_key + iniciais
    socio_keys = []
    iniciais = []
    tipo_labels = []
    for tipo, nome, documento in zip(df["tipo"], df["nome"], df["documento"], strict=False):
        nome_s = nome or ""
        socio_keys.append(_socio_key(tipo or "", nome_s, documento))
        # Para PJ mostramos o nome integral (razão social é público), para PF iniciais
        if tipo == "1":
            iniciais.append(nome_s.title()[:48] or "—")
        else:
            iniciais.append(_iniciais(nome_s))
        tipo_labels.append(_tipo_label(tipo or ""))

    out = pl.DataFrame({
        "socio_key": socio_keys,
        "cnpj_basico": df["cnpj_basico"].tolist(),
        "iniciais": iniciais,
        "tipo": tipo_labels,
        "qualificacao": df["qualificacao"].fillna("").tolist(),
    })

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    out.write_parquet(OUT_PATH, compression="zstd")

    size_mb = OUT_PATH.stat().st_size / 1024 / 1024
    print(f"Linhas: {out.height:,}")
    print(f"Sócios únicos: {out['socio_key'].n_unique():,}")
    print(f"Salvo: {OUT_PATH} ({size_mb:.2f} MB)")

    # Quantos sócios aparecem em múltiplas empresas?
    multi = (
        out.group_by("socio_key")
        .agg(pl.col("cnpj_basico").n_unique().alias("n_empresas"))
        .filter(pl.col("n_empresas") > 1)
    )
    print(f"Sócios em múltiplas empresas: {multi.height:,}")
    print(f"  ├ em 2 empresas:     {multi.filter(pl.col('n_empresas') == 2).height:,}")
    print(f"  ├ em 3 empresas:     {multi.filter(pl.col('n_empresas') == 3).height:,}")
    print(f"  └ em 4+ empresas:    {multi.filter(pl.col('n_empresas') >= 4).height:,}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
