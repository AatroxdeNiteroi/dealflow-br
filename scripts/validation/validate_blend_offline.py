"""Passo 1 — validação OFFLINE do blend WBES. NÃO toca no pipeline.

Duas provas:

(A) OUT-OF-SAMPLE: calibra a razão efetiva em metade do WBES, testa na outra
    metade. Para cada firma de teste: receita_pred = n2a / razao_efetiva
    (folha REAL — isola a razão). Compara viés(novo blend) vs viés(motor atual)
    por setor. Se o novo ~1.0 e generaliza fora da amostra, a calibração presta.

(B) RECOMPUTE DO UNIVERSO: aplica o blend às 46k empresas do produto (offline,
    sem BigQuery) e mede quanto a receita muda vs a atual. Só mostra magnitude —
    não grava nada.

Blend por tier:
  - Indústria (B/C):        efetiva = razao_final (IBGE base × size_factor); encargos fora
  - Low-CLT (J/M, hc<20):   efetiva = razao_base (IBGE); WBES fora (é artefato de headcount)
  - Comércio/serviços:      efetiva = razão WBES[setor×porte] (fallback setor-ALL, depois razao_base)

Uso:
    uv run python scripts/validation/validate_blend_offline.py \
        --wbes "C:/Users/rafae/Downloads/brazil_enterprise_surveys_2025_raw.csv"
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import polars as pl

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # scripts/
from build_razao_efetiva_wbes import (  # noqa: E402
    PORTE_BANDS, WBES_SECTORS, build_table, load_wbes_razao, porte_band,
)
from wbes_sector_backtest import DIV_TO_WBES, weighted_median  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
ESTIMATES = REPO / "data" / "estimates_final.parquet"
N_MIN = 8            # célula setor×porte só vale com n>=N_MIN, senão cai no setor-ALL
INDUSTRY = {"B", "C"}
LOW_CLT = {"J", "M"}


def make_lookup(tbl: pl.DataFrame):
    """(code, porte) -> razão, com fallback pro setor-ALL. Célula rala (n<N_MIN) ignorada."""
    cell, allrow = {}, {}
    for r in tbl.iter_rows(named=True):
        if r["razao_efetiva"] is None:
            continue
        if r["porte"] == "ALL":
            allrow[r["wbes_code"]] = r["razao_efetiva"]
        elif r["n"] >= N_MIN:
            cell[(r["wbes_code"], r["porte"])] = r["razao_efetiva"]

    def lookup(code: int, porte: str) -> float | None:
        return cell.get((code, porte)) or allrow.get(code)

    return lookup


def blend_efetiva(secao, wbes_code, porte, razao_base, razao_final, wbes_lookup) -> float | None:
    """Razão efetiva do blend para uma firma."""
    if secao in INDUSTRY:
        return razao_final
    if secao in LOW_CLT:  # low-CLT tratado à parte (headcount, não razão)
        return razao_base
    if wbes_code is not None:
        r = wbes_lookup(wbes_code, porte)
        if r is not None:
            return r
    return razao_base  # fallback


# ─── (A) Out-of-sample ────────────────────────────────────────────────


def old_efetiva_by_sector() -> dict[int, float]:
    """Razão efetiva ATUAL do motor por setor WBES = mediana(razao_final/encargos)."""
    df = pl.read_parquet(ESTIMATES)
    enc = (pl.col("encargos_low") + pl.col("encargos_high")) / 2
    div = pl.col("cnae_2_subclasse").str.slice(0, 2).cast(pl.Int32, strict=False)
    df = df.with_columns(
        div.replace_strict(DIV_TO_WBES, default=None).alias("wbes"),
        (pl.col("razao_final") / enc).alias("ef_old"),
    ).filter(pl.col("wbes").is_not_null() & pl.col("ef_old").is_not_null())
    return {r["wbes"]: r["ef_old"] for r in df.group_by("wbes").agg(pl.col("ef_old").median()).iter_rows(named=True)}


def validate_oos(wbes_df: pl.DataFrame, seed: int = 7) -> None:
    n = wbes_df.height
    idx = np.arange(n)
    np.random.default_rng(seed).shuffle(idx)
    calib = wbes_df[idx[: n // 2]]
    test = wbes_df[idx[n // 2:]]
    lookup = make_lookup(build_table(calib))
    ef_old = old_efetiva_by_sector()

    print("\n" + "=" * 78)
    print("(A) OUT-OF-SAMPLE — viés (pred/real) com FOLHA REAL. novo=blend WBES, calibrado")
    print("    em metade, testado na outra. Alvo do novo: ~1.00.")
    print("=" * 78)
    print(f"{'Setor':26s} {'nTest':>5s} {'viés ATUAL':>11s} {'viés NOVO':>10s}")
    print("-" * 78)
    nv_all, nw_all, ov_all = [], [], []
    for code, name in WBES_SECTORS.items():
        sub = test.filter(pl.col("a4a") == code)
        if sub.height == 0:
            continue
        rn, ro, w = [], [], []
        for f in sub.iter_rows(named=True):
            enew = lookup(code, f["porte"])
            if enew is None:
                continue
            rn.append((f["n2a"] / enew) / f["d2"])
            eold = ef_old.get(code)
            ro.append((f["n2a"] / eold) / f["d2"] if eold else np.nan)
            w.append(f["wmedian"])
        if not rn:
            continue
        rn_a, ro_a, w_a = np.array(rn), np.array(ro), np.array(w)
        v_new = weighted_median(rn_a, w_a)
        ok = ~np.isnan(ro_a)
        v_old = weighted_median(ro_a[ok], w_a[ok]) if ok.any() else float("nan")
        print(f"{name:26s} {sub.height:>5d} {v_old:>11.2f} {v_new:>10.2f}")
        nv_all.extend(rn); nw_all.extend(w); ov_all.extend(ro)
    rn_a, ro_a, w_a = np.array(nv_all), np.array(ov_all), np.array(nw_all)
    ok = ~np.isnan(ro_a)
    print("-" * 78)
    print(f"{'GERAL (ponderado)':26s} {len(nv_all):>5d} "
          f"{weighted_median(ro_a[ok], w_a[ok]):>11.2f} {weighted_median(rn_a, w_a):>10.2f}")
    within = w_a[np.abs(rn_a - 1) <= 0.25].sum() / w_a.sum()
    print(f"{'%±25% (novo)':26s} {within*100:>40.0f}%")
    print("=" * 78)


# ─── (B) Recompute do universo ────────────────────────────────────────


def recompute_universe(wbes_full: pl.DataFrame) -> None:
    lookup = make_lookup(build_table(wbes_full))
    df = pl.read_parquet(ESTIMATES).filter(
        pl.col("salario_medio_brl").is_not_null() & (pl.col("receita_point_brl") > 0)
    )
    div_i = pl.col("cnae_2_subclasse").str.slice(0, 2).cast(pl.Int32, strict=False)
    df = df.with_columns(div_i.replace_strict(DIV_TO_WBES, default=None).alias("wbes"))

    ratios, secoes, tiers = [], [], []
    for f in df.iter_rows(named=True):
        porte = porte_band(f["headcount"]) or "Small"
        ef = blend_efetiva(f["cnae_secao"], f["wbes"], porte,
                           f["razao_base"], f["razao_final"], lookup)
        if ef is None or ef <= 0:
            continue
        folha_base = f["headcount"] * f["salario_medio_brl"] * 12
        receita_new = folha_base / ef
        ratios.append(receita_new / f["receita_point_brl"])
        secoes.append(f["cnae_secao"])
        tiers.append("Indústria" if f["cnae_secao"] in INDUSTRY
                     else "Low-CLT" if f["cnae_secao"] in LOW_CLT else "Comércio/serviços")

    r = np.array(ratios)
    print("\n" + "=" * 78)
    print("(B) RECOMPUTE DO UNIVERSO — receita_nova / receita_atual (offline, nada gravado)")
    print("=" * 78)
    print(f"  Empresas recomputadas: {len(r)}")
    print(f"  Mediana global nova/atual: {np.median(r):.2f}  (>1 sobe, <1 desce)")
    print(f"  Caem (receita menor): {(r < 1).mean()*100:.0f}%   Sobem: {(r > 1).mean()*100:.0f}%")
    print("\n  Por tier:")
    t = np.array(tiers)
    for tier in ["Indústria", "Comércio/serviços", "Low-CLT"]:
        m = t == tier
        if m.any():
            print(f"    {tier:20s} n={m.sum():>6d}  mediana nova/atual = {np.median(r[m]):.2f}")
    print("=" * 78)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--wbes", required=True, type=Path)
    args = ap.parse_args()
    wbes = load_wbes_razao(args.wbes)
    validate_oos(wbes)
    recompute_universe(wbes)


if __name__ == "__main__":
    main()
