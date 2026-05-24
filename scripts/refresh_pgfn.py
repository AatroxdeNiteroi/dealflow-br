"""Processa os 3 datasets públicos da PGFN — Dívida Ativa da União —
e gera `data/pgfn_divida_ativa.parquet` agregado por CNPJ no escopo.

Fonte: https://dadosabertos.pgfn.gov.br/ (público, LAI).

Os ZIPs devem estar em `data/raw/pgfn/` (baixados manualmente OU
pelos commands no header do script — ver `--download`). São ~1.3 GB
comprimidos totais; descomprimidos chegam a 6–10 GB. O processamento
é feito com Polars lazy scan + filter pushdown (não carrega tudo na
RAM), e só os CNPJs do escopo do produto sobrevivem ao filtro.

Uso:
    # 1ª vez (baixar): ~5–15 min no link da PGFN
    uv run python scripts/refresh_pgfn.py --download

    # subsequentes (reprocessar com ZIPs já em data/raw/pgfn/)
    uv run python scripts/refresh_pgfn.py

Output:
    data/pgfn_divida_ativa.parquet
        cnpj · valor_total_brl · n_inscricoes · n_ajuizadas
        · tem_fgts · tem_previdenciaria · tem_tributaria
        · receita_principal_mais_comum

Reinicie o backend depois (lru_cache).
"""

from __future__ import annotations

import argparse
import shutil
import sys
import urllib.request
import zipfile
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

import polars as pl

ESTIMATES = Path("data/estimates_final.parquet")
RAW_DIR = Path("data/raw/pgfn")
OUT = Path("data/pgfn_divida_ativa.parquet")

# Trimestre atual da PGFN. Atualizar 4× ao ano.
BASE_URL = "https://dadosabertos.pgfn.gov.br/2026_trimestre_01"

ZIPS = [
    ("Dados_abertos_FGTS.zip", "FGTS"),
    ("Dados_abertos_Previdenciario.zip", "Previdenciario"),
    ("Dados_abertos_Nao_Previdenciario.zip", "Nao_Previdenciario"),
]


def download_all() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for zip_name, _label in ZIPS:
        dest = RAW_DIR / zip_name
        if dest.exists() and dest.stat().st_size > 0:
            print(f"  • {zip_name} já existe ({dest.stat().st_size / 1024 / 1024:.0f} MB), pulando.")
            continue
        url = f"{BASE_URL}/{zip_name}"
        print(f"  ↓ {url}")
        urllib.request.urlretrieve(url, dest)
        print(f"    salvo: {dest} ({dest.stat().st_size / 1024 / 1024:.0f} MB)")


def process() -> int:
    if not ESTIMATES.exists():
        print(f"ERRO: {ESTIMATES} não existe.", file=sys.stderr)
        return 1
    if not RAW_DIR.exists() or not any(RAW_DIR.glob("*.zip")):
        print(
            f"ERRO: nenhum ZIP encontrado em {RAW_DIR}.\n"
            f"      Rode com --download primeiro.",
            file=sys.stderr,
        )
        return 1

    print("=" * 64)
    print("PGFN Dívida Ativa — refresh")
    print("=" * 64)

    scope_cnpjs = pl.read_parquet(ESTIMATES)["cnpj"].to_list()
    scope_set = set(scope_cnpjs)
    print(f"Escopo: {len(scope_set):,} CNPJs do estimates_final\n")

    all_matches: list[pl.DataFrame] = []
    extract_dir = RAW_DIR / "_extracted"
    if extract_dir.exists():
        shutil.rmtree(extract_dir)
    extract_dir.mkdir()

    for zip_name, label in ZIPS:
        zip_path = RAW_DIR / zip_name
        if not zip_path.exists():
            print(f"\n[{label}] pulando — {zip_path} não existe")
            continue
        print(
            f"\n[{label}] processando {zip_path.name} "
            f"({zip_path.stat().st_size / 1024 / 1024:.0f} MB)..."
        )

        with zipfile.ZipFile(zip_path) as zf:
            csv_files = sorted(n for n in zf.namelist() if n.endswith(".csv"))
            print(f"  {len(csv_files)} CSV(s) no zip")
            for csv_name in csv_files:
                zf.extract(csv_name, extract_dir)

        for csv_name in csv_files:
            csv_path = extract_dir / csv_name
            try:
                lf = pl.scan_csv(
                    csv_path,
                    separator=";",
                    encoding="utf8-lossy",
                    schema_overrides={
                        "CPF_CNPJ": pl.Utf8,
                        "VALOR_CONSOLIDADO": pl.Utf8,
                        "TIPO_PESSOA": pl.Utf8,
                        "INDICADOR_AJUIZADO": pl.Utf8,
                        "RECEITA_PRINCIPAL": pl.Utf8,
                        "SITUACAO_INSCRICAO": pl.Utf8,
                    },
                    truncate_ragged_lines=True,
                    ignore_errors=True,
                )
                df = (
                    lf.filter(pl.col("TIPO_PESSOA").str.contains("(?i)jur"))
                    .with_columns(
                        pl.col("CPF_CNPJ").str.replace_all(r"[^\d]", "").alias("cnpj"),
                        pl.col("VALOR_CONSOLIDADO")
                        .str.replace(",", ".")
                        .cast(pl.Float64, strict=False)
                        .alias("valor"),
                    )
                    .filter(pl.col("cnpj").is_in(scope_cnpjs))
                    .select(
                        [
                            "cnpj",
                            "valor",
                            pl.col("INDICADOR_AJUIZADO").alias("ajuizado"),
                            pl.col("RECEITA_PRINCIPAL").alias("receita"),
                            pl.col("SITUACAO_INSCRICAO").alias("situacao"),
                        ]
                    )
                    .with_columns(pl.lit(label).alias("dataset"))
                    .collect()
                )
                if df.height:
                    all_matches.append(df)
                    accum = sum(d.height for d in all_matches)
                    print(f"  {csv_name}: +{df.height:,} (acumulado {accum:,})")
                else:
                    print(f"  {csv_name}: 0")
            except Exception as exc:  # noqa: BLE001
                print(f"  ERRO em {csv_name}: {exc}", file=sys.stderr)

    if not all_matches:
        print("\nNenhuma dívida encontrada para CNPJs do escopo.")
        shutil.rmtree(extract_dir, ignore_errors=True)
        return 0

    print(f"\n→ Agregando {sum(d.height for d in all_matches):,} linhas brutas...")

    all_df = pl.concat(all_matches)

    agg = (
        all_df.group_by("cnpj")
        .agg(
            [
                pl.col("valor").sum().alias("valor_total_brl"),
                pl.len().alias("n_inscricoes"),
                (pl.col("ajuizado") == "SIM").sum().alias("n_ajuizadas"),
                (pl.col("dataset") == "FGTS").any().alias("tem_fgts"),
                (pl.col("dataset") == "Previdenciario").any().alias("tem_previdenciaria"),
                (pl.col("dataset") == "Nao_Previdenciario").any().alias("tem_tributaria"),
                pl.col("receita").mode().first().alias("receita_principal_mais_comum"),
                pl.col("situacao").mode().first().alias("situacao_mais_comum"),
            ]
        )
        .sort("valor_total_brl", descending=True)
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    agg.write_parquet(OUT, compression="zstd")

    print(f"\n✓ {OUT} ({OUT.stat().st_size / 1024 / 1024:.2f} MB)")
    print(f"  CNPJs com dívida: {agg.height:,} de {len(scope_set):,} no escopo")
    print(f"  % do escopo: {agg.height / len(scope_set) * 100:.1f}%")
    print(f"  Valor total agregado: R$ {agg['valor_total_brl'].sum():,.2f}")
    print()
    print("  Top 10 maiores devedores no escopo:")
    print(
        agg.head(10).select(
            ["cnpj", "valor_total_brl", "n_inscricoes", "n_ajuizadas"]
        )
    )

    # cleanup CSVs extraídos (mantém os zips)
    shutil.rmtree(extract_dir, ignore_errors=True)
    print(f"\nReinicie o backend para invalidar o lru_cache.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--download", action="store_true", help="baixa os ZIPs antes de processar")
    args = ap.parse_args()

    if args.download:
        print("=" * 64)
        print("Baixando ZIPs da PGFN...")
        print("=" * 64)
        download_all()
        print()

    return process()


if __name__ == "__main__":
    sys.exit(main())
