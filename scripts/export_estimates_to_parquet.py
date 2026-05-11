"""Exporta `the-dumbers.dealflow.estimates_v2` do BigQuery para Parquet local.

O parquet vai versionado no repo (`data/estimates_v2.parquet`) — assim
qualquer um que clona o repo roda a UI sem precisar de credencial GCP.
Regenerar é responsabilidade do dev (snapshot anual, alinhado ao ano-base RAIS).

Uso:
    # 1. autenticar uma vez (abre browser):
    gcloud auth application-default login

    # 2. rodar export (com extra opcional):
    uv sync --extra export
    uv run python scripts/export_estimates_to_parquet.py
"""

from __future__ import annotations

import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

PROJECT_ID = "the-dumbers"
DATASET = "dealflow"
TABLE = "estimates_v2"

OUT_PATH = Path("data/estimates_v2.parquet")


def main() -> int:
    try:
        from google.cloud import bigquery
    except ImportError:
        print(
            "google-cloud-bigquery não instalado. Rode:\n"
            "    uv sync --extra export",
            file=sys.stderr,
        )
        return 1

    client = bigquery.Client(project=PROJECT_ID)
    full_table = f"{PROJECT_ID}.{DATASET}.{TABLE}"
    print(f"Baixando {full_table} ...")

    df = client.query(f"SELECT * FROM `{full_table}`").to_dataframe(
        create_bqstorage_client=True,
    )

    print(f"Linhas: {len(df):,}")
    print(f"Colunas ({len(df.columns)}): {list(df.columns)}")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUT_PATH, compression="zstd", index=False)

    size_mb = OUT_PATH.stat().st_size / 1024 / 1024
    print(f"Salvo: {OUT_PATH} ({size_mb:.1f} MB)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
