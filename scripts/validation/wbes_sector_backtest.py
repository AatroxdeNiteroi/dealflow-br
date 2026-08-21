"""Backtest do motor de faturamento contra o World Bank Enterprise Survey (WBES)
Brazil 2025 — VALIDAÇÃO OFFLINE, fora do pipeline do produto.

Ideia (decidida com o dono do produto):
  O motor é fino (CNAE 4d × município); o WBES é grosso (14 setores, nacional,
  sem CNPJ/CNAE/município). Em vez de brigar com o descasamento de resolução,
  AGREGAMOS os parâmetros do motor até a resolução do WBES e testamos a fórmula
  PONTA A PONTA contra faturamento real:

      receita_pred = headcount_real(WBES) × salário_setor × 12 × encargos_setor
                     ÷ razão_setor

  - headcount_real (l1) e faturamento real (d2) vêm do WBES.
  - salário/razão/encargos por setor = média das saídas do motor (estimates_final)
    sobre os CNAEs daquele setor. A média do salário sobre municípios implementa
    a regra "usar a média entre os municípios".
  - A conta em si é feita pela função REAL do motor (dealflow.estimator.estimate_revenue),
    com a razão passada como override (= razão agregada do setor).

Saída: por setor, o viés mediano (pred/real), %±25% e n — ponderado pelos pesos
amostrais do WBES (wmedian). O viés mediano É o fator de correção por setor.

NÃO toca em nada do produto. Só lê data/estimates_final.parquet + o CSV do WBES.

Uso:
    uv run python scripts/validation/wbes_sector_backtest.py \
        --wbes "C:/Users/rafae/Downloads/brazil_enterprise_surveys_2025_raw.csv"
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import polars as pl

# importa a FÓRMULA REAL do motor (pacote em src/, pythonpath via pyproject)
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
from dealflow.domain import CNPJ, CNAE, MatchConfidence, MatchResult  # noqa: E402
from dealflow.estimator import estimate_revenue  # noqa: E402
from dealflow.multipliers import encargos_range_for  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
ESTIMATES = REPO / "data" / "estimates_final.parquet"

# ── Crosswalk: setor WBES (a4a) → divisões CNAE 2.0 ────────────────────────
# (código a4a): (rótulo, [divisões CNAE], baixa_confiança?)
# "baixa_confiança" = balde heterogêneo ("Other …") — reportado à parte.
CROSSWALK: dict[int, tuple[str, list[int], bool]] = {
    1:  ("Food",                    [10, 11], False),
    2:  ("Garments",                [14], False),
    3:  ("Rubber & Plastics",       [22], False),
    4:  ("Basic metals",            [24], False),
    5:  ("Motor Vehicles",          [29], False),
    6:  ("Other Manufacturing",     [13, 15, 16, 17, 18, 19, 20, 21, 23,
                                     25, 26, 27, 28, 30, 31, 32, 33], True),
    7:  ("Construction",            [41, 42, 43], False),
    8:  ("Wholesale",               [46], False),
    9:  ("Retail",                  [47], False),
    10: ("Transport, Storage & Comm", [49, 50, 51, 52, 53], False),
    11: ("Hotels",                  [55, 56], False),
    12: ("IT & IT Services",        [62, 63], False),
    13: ("Professional Activities", [69, 70, 71, 72, 73, 74, 75], False),
    14: ("Other Services",          [58, 59, 60, 61, 68, 77, 78, 79, 80, 81, 82,
                                     85, 86, 87, 88, 90, 91, 92, 93, 94, 95, 96], True),
}
DIV_TO_WBES: dict[int, int] = {
    div: code for code, (_, divs, _) in CROSSWALK.items() for div in divs
}
# CNAE representativo por setor (só p/ o motor pegar a SEÇÃO → encargos certos).
REP_CNAE: dict[int, str] = {code: f"{divs[0]:02d}00000" for code, (_, divs, _) in CROSSWALK.items()}


def weighted_median(values: np.ndarray, weights: np.ndarray) -> float:
    """Mediana ponderada."""
    order = np.argsort(values)
    v, w = values[order], weights[order]
    cw = np.cumsum(w)
    cutoff = w.sum() / 2.0
    return float(v[np.searchsorted(cw, cutoff)])


def build_sector_profiles() -> dict[int, dict]:
    """Perfil por setor WBES: média (salário, razão_final) sobre estimates_final."""
    df = pl.read_parquet(ESTIMATES).filter(
        pl.col("salario_medio_brl").is_not_null()
        & pl.col("razao_final").is_not_null()
        & (pl.col("salario_medio_brl") > 0)
        & (pl.col("razao_final") > 0)
    )
    div = pl.col("cnae_2_subclasse").str.slice(0, 2).cast(pl.Int32, strict=False)
    df = df.with_columns(
        div.replace_strict(DIV_TO_WBES, default=None).alias("wbes")
    ).filter(pl.col("wbes").is_not_null())

    agg = df.group_by("wbes").agg(
        pl.col("salario_medio_brl").mean().alias("salario"),
        pl.col("razao_final").mean().alias("razao"),
        pl.len().alias("n_profile"),
    )
    return {r["wbes"]: r for r in agg.to_dicts()}


def load_wbes(path: Path) -> pl.DataFrame:
    """Carrega + limpa o WBES: d2>0, l1>0, sem sentinelas INT32."""
    raw = pl.read_csv(path, infer_schema_length=2000, ignore_errors=True)
    SENTINEL = 2_147_483_647
    return raw.select(
        pl.col("a4a").cast(pl.Int64, strict=False),
        pl.col("d2").cast(pl.Float64, strict=False),
        pl.col("l1").cast(pl.Float64, strict=False),
        pl.col("n2a").cast(pl.Float64, strict=False),  # folha base real (p/ diagnóstico)
        pl.col("wmedian").cast(pl.Float64, strict=False),
    ).filter(
        (pl.col("d2") > 0) & (pl.col("d2") < SENTINEL)
        & (pl.col("l1") > 0) & (pl.col("l1") < SENTINEL)
        & pl.col("wmedian").is_not_null()
        & pl.col("a4a").is_in(list(CROSSWALK.keys()))
    )


def predict(headcount: int, salario: float, razao: float, rep_cnae: str) -> float:
    """Chama a fórmula REAL do motor; devolve o ponto central da receita."""
    match = MatchResult(
        cnpj=CNPJ("00000000000000"),
        rais_estab_index=None,
        headcount=headcount,
        confidence=MatchConfidence.HIGH,
        n_candidates=1,
        rationale="wbes-backtest",
    )
    est = estimate_revenue(
        match=match,
        cnae=CNAE(rep_cnae),
        salario_medio_mensal_brl=salario,
        n_vinculos_benchmark=100,
        razao_folha_receita=razao,  # override = razão agregada do setor
    )
    return est.point_brl


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--wbes", required=True, type=Path)
    args = ap.parse_args()

    profiles = build_sector_profiles()
    wbes = load_wbes(args.wbes)

    rows = []
    diag = []  # viés usando FOLHA REAL (n2a) — isola a metade folha→receita
    all_ratio, all_w, all_flag = [], [], []
    for code, (name, _divs, low_conf) in CROSSWALK.items():
        prof = profiles.get(code)
        firms = wbes.filter(pl.col("a4a") == code)
        if prof is None or firms.height == 0:
            rows.append((name, firms.height, prof["n_profile"] if prof else 0,
                         None, None, None, low_conf))
            diag.append((name, None, None))
            continue

        enc_lo, enc_hi = encargos_range_for(CNAE(REP_CNAE[code]))
        enc_point = (enc_lo + enc_hi) / 2

        ratio, w = [], []
        dr, dw = [], []  # ratio/peso do diagnóstico (folha real)
        for f in firms.iter_rows(named=True):
            pred = predict(int(f["l1"]), prof["salario"], prof["razao"], REP_CNAE[code])
            ratio.append(pred / f["d2"])
            w.append(f["wmedian"])
            if f["n2a"] is not None and f["n2a"] > 0:
                pred_folha_real = f["n2a"] * enc_point / prof["razao"]
                dr.append(pred_folha_real / f["d2"])
                dw.append(f["wmedian"])
        ratio_a, w_a = np.array(ratio), np.array(w)

        med = weighted_median(ratio_a, w_a)
        within = float(w_a[np.abs(ratio_a - 1.0) <= 0.25].sum() / w_a.sum())
        rows.append((name, firms.height, prof["n_profile"], med, within,
                     float(np.median(np.abs(ratio_a - 1.0))), low_conf))
        if dr:
            dr_a, dw_a = np.array(dr), np.array(dw)
            diag.append((name, weighted_median(dr_a, dw_a),
                         float(dw_a[np.abs(dr_a - 1.0) <= 0.25].sum() / dw_a.sum())))
        else:
            diag.append((name, None, None))

        all_ratio.extend(ratio); all_w.extend(w); all_flag.extend([low_conf] * len(ratio))

    # ── Relatório ──────────────────────────────────────────────────────────
    print("\n" + "=" * 84)
    print("BACKTEST WBES × MOTOR — viés por setor (pred/real). >1 super, <1 subestima.")
    print("=" * 84)
    hdr = f"{'Setor':26s} {'nWBES':>6s} {'nPerf':>6s} {'viés med':>9s} {'%±25%':>7s} {'|erro|med':>9s}"
    print(hdr); print("-" * 84)
    for name, n_w, n_p, med, within, aerr, low in rows:
        flag = " ⚠" if low else ""
        if med is None:
            print(f"{name:26s} {n_w:>6d} {n_p:>6d} {'—':>9s} {'—':>7s} {'—':>9s}{flag}")
        else:
            print(f"{name:26s} {n_w:>6d} {n_p:>6d} {med:>9.2f} {within*100:>6.0f}% {aerr*100:>8.0f}%{flag}")
    print("-" * 84)

    r, w, fl = np.array(all_ratio), np.array(all_w), np.array(all_flag)
    for label, mask in [("TODOS os setores", np.ones(len(r), bool)),
                        ("Só setores limpos (sem ⚠)", ~fl)]:
        rm, wm = r[mask], w[mask]
        med = weighted_median(rm, wm)
        within = wm[np.abs(rm - 1.0) <= 0.25].sum() / wm.sum()
        print(f"{label:34s} n={mask.sum():>5d}  viés med={med:.2f}  %±25%={within*100:.0f}%")
    print("=" * 84)
    print("⚠ = balde heterogêneo (Other Manufacturing/Services) — leitura de baixa confiança.")
    print("Perfil de setor vem de estimates_final (RJ/SP); WBES é nacional — descasamento é ruído.\n")

    # ── Diagnóstico: viés usando FOLHA REAL (n2a) ───────────────────────────
    # Isola a metade folha→receita (encargos × razão). Se ainda superestima,
    # a culpa é do motor (razão/encargos); se ~1.0, era o lado salário×headcount.
    print("=" * 84)
    print("DIAGNÓSTICO — viés com FOLHA REAL (n2a × encargos ÷ razão_setor). Isola razão/encargos.")
    print("=" * 84)
    print(f"{'Setor':26s} {'viés(headcount)':>16s} {'viés(folha real)':>18s}")
    print("-" * 84)
    for (name, _n_w, _n_p, med_hc, _wi, _ae, _lo), (_dn, med_fr, _fw) in zip(rows, diag):
        hc = f"{med_hc:.2f}" if med_hc is not None else "—"
        fr = f"{med_fr:.2f}" if med_fr is not None else "—"
        print(f"{name:26s} {hc:>16s} {fr:>18s}")
    print("=" * 84 + "\n")


if __name__ == "__main__":
    main()
