"""Exporta `contato_v1` do BigQuery para Parquet local."""

from __future__ import annotations

import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

PROJECT_ID = "the-dumbers"
DATASET = "dealflow"
TABLE = "contato_v1"

OUT_PATH = Path("data/contato.parquet")


def main() -> int:
    try:
        from google.cloud import bigquery
    except ImportError:
        print("google-cloud-bigquery não instalado. Rode `uv sync --extra export`.", file=sys.stderr)
        return 1

    client = bigquery.Client(project=PROJECT_ID)
    full_table = f"{PROJECT_ID}.{DATASET}.{TABLE}"
    print(f"Baixando {full_table} ...")

    df = client.query(f"SELECT * FROM `{full_table}`").to_dataframe(
        create_bqstorage_client=True,
    )

    print(f"Linhas: {len(df):,}")
    print(f"Com telefone_1: {df['telefone_1'].notna().sum():,}")
    print(f"Com email:      {df['email'].notna().sum():,}")
    print(f"Com municipio:  {df['municipio_nome'].notna().sum():,}")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUT_PATH, compression="zstd", index=False)
    size_mb = OUT_PATH.stat().st_size / 1024 / 1024
    print(f"Salvo: {OUT_PATH} ({size_mb:.2f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
