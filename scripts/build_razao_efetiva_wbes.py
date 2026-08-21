"""Constrói a tabela de RAZÃO EFETIVA (folha-base/receita) por setor × porte a
partir do WBES Brazil 2025 — insumo da calibração blend do motor.

razão efetiva = n2a / d2 (folha base real / receita real). Agregada por
setor WBES × banda de porte (derivada do headcount l1, mesmos cortes que serão
aplicados no universo do produto). Guarda mediana (ponto) + p25/p75 (intervalo
empírico, que substitui o intervalo de encargos) + n.

Saída: data/reference/razao_efetiva_setor_porte.csv
  Linhas por (setor × porte) + uma linha porte='ALL' por setor (fallback p/
  célula rala).

NÃO toca no pipeline. Só lê o CSV do WBES. É o artefato do Passo 1.

Uso:
    uv run python scripts/build_razao_efetiva_wbes.py \
        --wbes "C:/Users/rafae/Downloads/brazil_enterprise_surveys_2025_raw.csv"
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import polars as pl

REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "data" / "reference" / "razao_efetiva_setor_porte.csv"

# Setor WBES (a4a) → rótulo. (mesmo do crosswalk do backtest)
WBES_SECTORS: dict[int, str] = {
    1: "Food", 2: "Garments", 3: "Rubber & Plastics", 4: "Basic metals",
    5: "Motor Vehicles", 6: "Other Manufacturing", 7: "Construction",
    8: "Wholesale", 9: "Retail", 10: "Transport, Storage & Comm",
    11: "Hotels", 12: "IT & IT Services", 13: "Professional Activities",
    14: "Other Services",
}
# Bandas de porte por headcount: (nome, hc_min inclusive, hc_max exclusive)
PORTE_BANDS: tuple[tuple[str, int, int], ...] = (
    ("Small", 1, 20),
    ("Medium", 20, 100),
    ("Large", 100, 300),
    ("XL", 300, 10_000_000),
)


def porte_band(hc: float) -> str | None:
    for name, lo, hi in PORTE_BANDS:
        if lo <= hc < hi:
            return name
    return None


def w_quantile(values: np.ndarray, weights: np.ndarray, q: float) -> float:
    """Quantil ponderado."""
    order = np.argsort(values)
    v, w = values[order], weights[order]
    cw = np.cumsum(w) - 0.5 * w
    cw /= w.sum()
    return float(np.interp(q, cw, v))


def load_wbes_razao(path: Path) -> pl.DataFrame:
    """WBES limpo com razao_real e banda de porte (por l1)."""
    SENTINEL = 2_147_483_647
    raw = pl.read_csv(path, infer_schema_length=2000, ignore_errors=True)
    df = raw.select(
        pl.col("a4a").cast(pl.Int64, strict=False),
        pl.col("l1").cast(pl.Float64, strict=False),
        pl.col("n2a").cast(pl.Float64, strict=False),
        pl.col("d2").cast(pl.Float64, strict=False),
        pl.col("wmedian").cast(pl.Float64, strict=False),
    ).filter(
        (pl.col("d2") > 0) & (pl.col("d2") < SENTINEL)
        & (pl.col("n2a") > 0) & (pl.col("n2a") < SENTINEL)
        & (pl.col("l1") > 0) & (pl.col("l1") < SENTINEL)
        & pl.col("wmedian").is_not_null()
        & pl.col("a4a").is_in(list(WBES_SECTORS))
    ).with_columns(
        (pl.col("n2a") / pl.col("d2")).alias("razao_real"),
        pl.col("l1").map_elements(porte_band, return_dtype=pl.Utf8).alias("porte"),
    ).filter(
        (pl.col("razao_real") > 0.005) & (pl.col("razao_real") < 2.0)
        & pl.col("porte").is_not_null()
    )
    return df


def build_table(df: pl.DataFrame) -> pl.DataFrame:
    """Tabela (setor × porte) + linha porte='ALL' por setor. Ponderada."""
    hc_bounds = {n: (lo, hi) for n, lo, hi in PORTE_BANDS}
    rows = []
    for code, name in WBES_SECTORS.items():
        sec = df.filter(pl.col("a4a") == code)
        # células por porte
        for pname, lo, hi in PORTE_BANDS:
            cell = sec.filter(pl.col("porte") == pname)
            rows.append(_row(code, name, pname, lo, hi, cell))
        # fallback pooled (todo o setor)
        rows.append(_row(code, name, "ALL", 1, 10_000_000, sec))
    return pl.DataFrame(rows)


def _row(code, name, pname, lo, hi, cell) -> dict:
    n = cell.height
    if n == 0:
        return dict(wbes_code=code, wbes_name=name, porte=pname, hc_min=lo, hc_max=hi,
                    n=0, razao_efetiva=None, razao_p25=None, razao_p75=None)
    v = cell["razao_real"].to_numpy()
    w = cell["wmedian"].to_numpy()
    return dict(
        wbes_code=code, wbes_name=name, porte=pname, hc_min=lo, hc_max=hi, n=n,
        razao_efetiva=round(w_quantile(v, w, 0.50), 4),
        razao_p25=round(w_quantile(v, w, 0.25), 4),
        razao_p75=round(w_quantile(v, w, 0.75), 4),
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--wbes", required=True, type=Path)
    args = ap.parse_args()

    df = load_wbes_razao(args.wbes)
    tbl = build_table(df)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    tbl.write_csv(OUT)

    print(f"WBES limpo: {df.height} firmas · tabela: {tbl.height} linhas → {OUT}\n")
    print(f"{'Setor':26s} {'porte':>7s} {'n':>4s} {'razão':>7s} {'p25':>6s} {'p75':>6s}")
    print("-" * 62)
    for r in tbl.iter_rows(named=True):
        if r["porte"] == "ALL":
            continue
        re = f"{r['razao_efetiva']:.3f}" if r["razao_efetiva"] is not None else "—"
        p25 = f"{r['razao_p25']:.3f}" if r["razao_p25"] is not None else "—"
        p75 = f"{r['razao_p75']:.3f}" if r["razao_p75"] is not None else "—"
        flag = " ⚠n<8" if 0 < r["n"] < 8 else ""
        print(f"{r['wbes_name']:26s} {r['porte']:>7s} {r['n']:>4d} {re:>7s} {p25:>6s} {p75:>6s}{flag}")


if __name__ == "__main__":
    main()
