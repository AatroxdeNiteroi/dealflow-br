"""Gera data/contratos_federais_por_cnpj.json a partir do cache parcial.

O scraper scrape_portal_transparencia.py só escreve o JSON final ao
terminar a rodada completa (~4h). Este script lê o cache incremental
(data/cvm_cache/portal_transparencia/<cnpj>.json) e gera o dataset
agregado a qualquer momento — útil pra ver o piso federal funcionando
no produto antes da rodada terminar.

Uso:
    uv run python scripts/active_validation/build_federal_from_cache.py
"""

from __future__ import annotations

import json
import sys
from dataclasses import asdict
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import polars as pl

sys.path.insert(0, str(Path(__file__).parent))
from scrape_portal_transparencia import ContratoFederal, aggregate  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
CACHE_DIR = REPO / "data" / "cvm_cache" / "portal_transparencia"
PARQUET = REPO / "data" / "estimates_final.parquet"
OUT_PATH = REPO / "data" / "contratos_federais_por_cnpj.json"


def main() -> int:
    if not CACHE_DIR.exists():
        print(f"Sem cache em {CACHE_DIR}", file=sys.stderr)
        return 1

    # Mapa cnpj → (razao_social, receita estimada) do parquet
    df = pl.read_parquet(PARQUET).select(["cnpj", "razao_social", "receita_point_brl"])
    info = {r["cnpj"]: r for r in df.iter_rows(named=True)}

    resultados: list[ContratoFederal] = []
    cache_files = list(CACHE_DIR.glob("*.json"))
    com_contrato = 0

    for cf in cache_files:
        cnpj = cf.stem
        try:
            contratos = json.loads(cf.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue  # arquivo sendo escrito pelo scraper · pula
        if not contratos:
            continue
        com_contrato += 1

        agg = aggregate(contratos)
        n_anos = (
            max(1, (agg["ano_max"] or 0) - (agg["ano_min"] or 0) + 1)
            if agg["ano_min"]
            else 1
        )
        piso_anual = agg["valor_total_brl"] / n_anos
        row = info.get(cnpj, {})
        estimativa = row.get("receita_point_brl") or 0.0

        resultados.append(ContratoFederal(
            cnpj=cnpj,
            razao_social_motor=row.get("razao_social", ""),
            n_contratos=agg["n_contratos"],
            valor_total_brl=agg["valor_total_brl"],
            contratos_vigentes=agg["contratos_vigentes"],
            ano_min=agg["ano_min"],
            ano_max=agg["ano_max"],
            estimativa_motor_brl=estimativa,
            piso_minimo_anual_brl=piso_anual,
            flag_subestimacao=piso_anual > estimativa if estimativa else False,
        ))

    OUT_PATH.write_text(
        json.dumps([asdict(r) for r in resultados], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    subest = sum(1 for r in resultados if r.flag_subestimacao)
    print(f"Cache lido:           {len(cache_files):,} CNPJs", file=sys.stderr)
    print(f"Com contratos:        {com_contrato:,}", file=sys.stderr)
    print(f"Subestimadas (piso>estimativa): {subest}", file=sys.stderr)
    print(f"Saída: {OUT_PATH}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
