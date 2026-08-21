"""Mede a razão folha-base/receita REAL do WBES por setor × porte — VALIDAÇÃO
OFFLINE, fora do pipeline. Objetivo: decidir o "empate" entre razao_base e
razao_final (com size_factor) do motor.

razão real = n2a / d2   (folha base real / receita real; ambos base — ver
diagnóstico anterior). Comparada, por setor, contra:
  - razao_base  (IBGE base, sem ajuste de porte)   ← motor "razao_base direto"
  - razao_final (razao_base × size_factor)         ← motor atual (indústria)

Duas perguntas:
  (1) NÍVEL: a razão real bate com razao_base ou razao_final?
  (2) GRADIENTE: a razão real CAI conforme o porte sobe? (se sim, ajuste de
      porte é legítimo — e deveria valer p/ TODO setor, não só indústria.)

Reusa o crosswalk do backtest (single source of truth). Só lê parquet + CSV.

Uso:
    uv run python scripts/validation/wbes_razao_sector_porte.py \
        --wbes "C:/Users/rafae/Downloads/brazil_enterprise_surveys_2025_raw.csv"
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import polars as pl

from wbes_sector_backtest import CROSSWALK, DIV_TO_WBES, weighted_median  # crosswalk único

REPO = Path(__file__).resolve().parents[2]
ESTIMATES = REPO / "data" / "estimates_final.parquet"
PORTE = {1: "Small", 2: "Medium", 3: "Large", 4: "XL"}


def engine_razoes() -> dict[int, dict]:
    """Por setor WBES: mediana de razao_base e razao_final do motor."""
    df = pl.read_parquet(ESTIMATES).filter(
        pl.col("razao_base").is_not_null() & pl.col("razao_final").is_not_null()
    )
    div = pl.col("cnae_2_subclasse").str.slice(0, 2).cast(pl.Int32, strict=False)
    df = df.with_columns(div.replace_strict(DIV_TO_WBES, default=None).alias("wbes")).filter(
        pl.col("wbes").is_not_null()
    )
    agg = df.group_by("wbes").agg(
        pl.col("razao_base").median().alias("razao_base"),
        pl.col("razao_final").median().alias("razao_final"),
    )
    return {r["wbes"]: r for r in agg.to_dicts()}


def load_wbes(path: Path) -> pl.DataFrame:
    SENTINEL = 2_147_483_647
    raw = pl.read_csv(path, infer_schema_length=2000, ignore_errors=True)
    df = raw.select(
        pl.col("a4a").cast(pl.Int64, strict=False),
        pl.col("a6a").cast(pl.Int64, strict=False),  # porte
        pl.col("d2").cast(pl.Float64, strict=False),
        pl.col("n2a").cast(pl.Float64, strict=False),
        pl.col("wmedian").cast(pl.Float64, strict=False),
    ).filter(
        (pl.col("d2") > 0) & (pl.col("d2") < SENTINEL)
        & (pl.col("n2a") > 0) & (pl.col("n2a") < SENTINEL)
        & pl.col("wmedian").is_not_null()
        & pl.col("a4a").is_in(list(CROSSWALK.keys()))
        & pl.col("a6a").is_in(list(PORTE.keys()))
    ).with_columns((pl.col("n2a") / pl.col("d2")).alias("razao_real"))
    # limpa razões implausíveis (erro de unidade / firma anômala)
    return df.filter((pl.col("razao_real") > 0.005) & (pl.col("razao_real") < 2.0))


def wmed(df: pl.DataFrame) -> tuple[float, int]:
    if df.height == 0:
        return (float("nan"), 0)
    return (weighted_median(df["razao_real"].to_numpy(), df["wmedian"].to_numpy()), df.height)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--wbes", required=True, type=Path)
    args = ap.parse_args()

    eng = engine_razoes()
    wbes = load_wbes(args.wbes)

    # ── Tabela 1: NÍVEL — razão real vs razao_base vs razao_final ───────────
    print("\n" + "=" * 92)
    print("RAZÃO REAL (n2a/d2) POR SETOR vs MOTOR — decide se bate com razao_base ou razao_final")
    print("=" * 92)
    print(f"{'Setor':26s} {'n':>4s} {'real':>7s} {'razao_base':>11s} {'razao_final':>12s}  veredito")
    print("-" * 92)
    for code, (name, _divs, low) in CROSSWALK.items():
        sub = wbes.filter(pl.col("a4a") == code)
        real, n = wmed(sub)
        e = eng.get(code)
        if e is None or n == 0:
            print(f"{name:26s} {n:>4d} {real:>7.3f} {'—':>11s} {'—':>12s}")
            continue
        rb, rf = e["razao_base"], e["razao_final"]
        # de qual está mais perto (em log, pra ser simétrico)
        d_base = abs(np.log(real / rb)) if rb > 0 else 9
        d_final = abs(np.log(real / rf)) if rf > 0 else 9
        verdict = "BASE" if d_base < d_final else "FINAL"
        flag = " ⚠" if low else ""
        print(f"{name:26s} {n:>4d} {real:>7.3f} {rb:>11.3f} {rf:>12.3f}  → {verdict}{flag}")
    print("-" * 92)

    # ── Tabela 2: GRADIENTE — razão real por setor × porte ─────────────────
    print("\n" + "=" * 92)
    print("RAZÃO REAL POR SETOR × PORTE — cai conforme o porte sobe? (gradiente = ajuste legítimo)")
    print("=" * 92)
    header = f"{'Setor':26s}" + "".join(f"{PORTE[p]:>10s}" for p in sorted(PORTE))
    print(header); print("-" * 92)
    for code, (name, _divs, low) in CROSSWALK.items():
        cells = []
        for p in sorted(PORTE):
            real, n = wmed(wbes.filter((pl.col("a4a") == code) & (pl.col("a6a") == p)))
            cells.append(f"{real:.3f}({n})" if n >= 3 else (f"·({n})" if n else "—"))
        flag = " ⚠" if low else ""
        print(f"{name:26s}" + "".join(f"{c:>10s}" for c in cells) + flag)
    print("=" * 92)
    print("Formato célula: razão(n). '·' = n<3 (não confiável). Gradiente descendente = porte importa.\n")


if __name__ == "__main__":
    main()
