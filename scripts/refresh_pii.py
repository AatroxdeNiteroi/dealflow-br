"""Regenera os 3 parquets de PII do BigQuery em sequência — um comando só.

Faz `export_headcount_history`, `export_socios_index` e `export_contato`
em ordem. Cada um lê do BigQuery (precisa de `gcloud auth application-
default login` + IAM no projeto `the-dumbers`) e salva em `data/`.

A `DEALFLOW_SOCIOS_SALT` é carregada automaticamente do `.env.local`
(via python-dotenv adicionado no extra `export`).

Uso:
    uv sync --extra export             # primeira vez
    gcloud auth application-default login   # primeira vez (ou expirado)
    gcloud config set project the-dumbers   # primeira vez
    uv run python scripts/refresh_pii.py

Resultado (gitignored — ficam só na sua máquina):
    data/headcount_history.parquet
    data/socios_index.parquet
    data/contato.parquet

Reinicie o backend para invalidar o `lru_cache` do loader.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

# carrega .env.local da raiz
from dotenv import load_dotenv  # noqa: E402
load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")

# Necessário para os imports relativos dos scripts funcionarem
sys.path.insert(0, str(Path(__file__).resolve().parent))


def run(module_name: str, label: str) -> int:
    print()
    print("=" * 64)
    print(f"  {label}")
    print("=" * 64)
    try:
        mod = importlib.import_module(module_name)
    except Exception as exc:  # noqa: BLE001
        print(f"ERRO ao importar {module_name}: {exc}", file=sys.stderr)
        return 1
    if not hasattr(mod, "main"):
        print(f"ERRO: {module_name} não expõe main()", file=sys.stderr)
        return 1
    return mod.main()


def main() -> int:
    print("=" * 64)
    print("  Refresh dos parquets de PII (BigQuery → data/*.parquet)")
    print("=" * 64)

    # Aviso útil se gcloud não está configurado — falha rápida
    import shutil
    if shutil.which("gcloud") is None:
        print(
            "AVISO: `gcloud` não encontrado no PATH.\n"
            "       Instale o Cloud SDK (winget install Google.CloudSDK)\n"
            "       e rode `gcloud auth application-default login`.",
            file=sys.stderr,
        )
        # não aborta — google-cloud-bigquery pode achar ADC via env var

    rc = 0
    rc |= run("export_headcount_history", "1/3 · headcount_timeseries_v1")
    rc |= run("export_socios_index",      "2/3 · socios_index_v1")
    rc |= run("export_contato",           "3/3 · contato_v1")

    print()
    if rc == 0:
        print("✓ Tudo OK. Reinicie o backend (touch backend/src/dealflow_api/main.py")
        print("  ou Ctrl+C + uvicorn de novo) para invalidar o lru_cache do loader.")
    else:
        print("✗ Pelo menos um export falhou — veja as mensagens acima.")
    return rc


if __name__ == "__main__":
    sys.exit(main())
