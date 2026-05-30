"""Demo dos dois motores de estimativa com validação contra ground truth.

Inputs:
    data/sample/matches_validation_batch.csv  — CNPJ + CNAE + headcount
                                               Coluna opcional: receita_verdadeira_brl
                                               (tem prioridade sobre o join fuzzy)
    data/cvm_cache/handcurated_dre.json       — receita ground truth por nome (fallback)
    data/reference/benchmark_salarial.csv     — salário médio CNAE × município

Fluxo por empresa:
    1. Lookup benchmark salarial (municipio → fallback CNAE nacional)
    2. estimate_revenue()       → Step 1 (folha ÷ razão)
    3. fuse_estimates()         → Step 2 (distribuição Lorenz)
    4. Ground truth: coluna receita_verdadeira_brl → fallback join fuzzy com DRE

Rodar:
    uv run python scripts/dev/demo_two_layers.py
    uv run python scripts/dev/demo_two_layers.py shadow   # sem override Step 2
"""

from __future__ import annotations

import csv
import json
import os
import sys
from pathlib import Path
from statistics import median

from dealflow.domain import CNAE, CNPJ, MatchConfidence, MatchResult
from dealflow.estimator import estimate_revenue
from dealflow.sector_bands import fuse_estimates

_ROOT = Path(__file__).resolve().parents[2]

BENCHMARK_PATH = _ROOT / "data/reference/benchmark_salarial.csv"
BATCH_PATH     = _ROOT / "data/sample/matches_validation_batch.csv"
DRE_PATH       = _ROOT / "data/cvm_cache/handcurated_dre.json"


# ── loaders ─────────────────────────────────────────────────────────────────

def load_benchmark() -> tuple[dict[tuple[str, str], float], dict[str, float]]:
    """Retorna (por_celula, por_cnae).

    por_celula: (cnae_7d, id_municipio) → salario_medio_brl
    por_cnae:   cnae_7d → média nacional do salário (fallback quando município ausente)
    """
    acc_cell: dict[tuple[str, str], list[float]] = {}
    acc_cnae: dict[str, list[float]] = {}

    with BENCHMARK_PATH.open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            s = float(row["salario_medio_brl"])
            acc_cell.setdefault((row["cnae_2_subclasse"], row["id_municipio"]), []).append(s)
            acc_cnae.setdefault(row["cnae_2_subclasse"], []).append(s)

    por_celula = {k: sum(v) / len(v) for k, v in acc_cell.items()}
    por_cnae   = {k: sum(v) / len(v) for k, v in acc_cnae.items()}
    return por_celula, por_cnae


def load_ground_truth() -> dict[str, float]:
    """nome_normalizado → receita_brl (para join fuzzy)."""
    entries = json.loads(DRE_PATH.read_text(encoding="utf-8"))
    return {_norm(e["nome_busca"]): e["receita_brl"] for e in entries}


# ── nome normalization & fuzzy match ────────────────────────────────────────

_STRIP = [" S.A.", " S/A", " SA ", " LTDA.", " LTDA", " ME ", " EIRELI",
          " IND.", " IND ", " COM.", " COM ", " E COMERCIO", " INDUSTRIA E COMERCIO"]


def _norm(name: str) -> str:
    n = name.upper().strip()
    for s in _STRIP:
        n = n.replace(s, " ")
    return " ".join(n.split())


def fuzzy_revenue(razao_social: str, gt: dict[str, float]) -> float | None:
    """Retorna receita_brl por interseção de palavras; evita falsos-positivos de substring.

    Requer que >= 80% das palavras do nome menor estejam no nome maior,
    com mínimo de 2 palavras em comum (ou match exato de 1 palavra >= 8 chars).
    """
    name_words = set(_norm(razao_social).split())
    for gt_name, revenue in gt.items():
        gt_words = set(gt_name.split())
        if not gt_words:
            continue
        short, long_ = (
            (gt_words, name_words) if len(gt_words) <= len(name_words)
            else (name_words, gt_words)
        )
        overlap = short & long_
        if not overlap:
            continue
        coverage = len(overlap) / len(short)
        # Aceita se >= 80% das palavras do nome menor batem E
        # há pelo menos 2 palavras em comum OU 1 palavra longa (>= 8 chars)
        if coverage >= 0.8 and (
            len(overlap) >= 2
            or any(len(w) >= 8 for w in overlap)
            or (len(short) == 1 and len(overlap) == 1)  # exact single-token match
        ):
            return revenue
    return None


# ── main ────────────────────────────────────────────────────────────────────

def demo(mode: str = "active") -> None:
    os.environ["SECTOR_BANDS_MODE"] = mode

    bench_cell, bench_cnae = load_benchmark()
    ground_truth = load_ground_truth()

    with BATCH_PATH.open(encoding="utf-8") as fh:
        batch = list(csv.DictReader(fh))

    # Cabeçalho
    W = 172
    print(f"\n{'=' * W}")
    print(f"  DEMO DOIS MOTORES -- modo: {mode.upper()}")
    print(f"{'=' * W}")
    print(
        f"  {'Empresa':<36} {'HC':>4}  "
        f"{'Step1 R$M':>10} {'Step2 p50':>10} {'Recom. R$M':>10}  "
        f"{'GT R$M':>8} {'Err S1%':>7} {'Err Rec%':>8}  "
        f"{'Diagnostic':<16} {'Tier':<7} {'S2 pior?':<8}"
    )
    print(f"  {'-' * (W - 4)}")

    validated: list[dict] = []

    for row in batch:
        cnae_str  = row["cnae_2_subclasse"]
        municipio = row["id_municipio"]
        headcount = int(row["headcount"])
        razao     = row["razao_social"]

        # Benchmark: municipio → fallback CNAE nacional
        salary = bench_cell.get((cnae_str, municipio)) or bench_cnae.get(cnae_str)
        if salary is None:
            print(f"  [SEM BENCHMARK] {razao}")
            continue

        match = MatchResult(
            cnpj=CNPJ(row["cnpj"]),
            rais_estab_index=None,
            headcount=headcount,
            confidence=MatchConfidence.MEDIUM,
            n_candidates=1,
            rationale="demo",
        )
        cnae = CNAE(cnae_str)

        # ── Step 1 ──────────────────────────────────────────────────────
        est = estimate_revenue(
            match=match,
            cnae=cnae,
            salario_medio_mensal_brl=salary,
            n_vinculos_benchmark=50,
        )

        # ── Step 2 ──────────────────────────────────────────────────────
        fusion = fuse_estimates(
            revenue_step1=est.point_brl,
            cnae=cnae_str,
            headcount=headcount,
        )

        # Ground truth: coluna inline tem prioridade sobre fuzzy match
        _gt_inline = row.get("receita_verdadeira_brl", "").strip()
        if _gt_inline:
            try:
                truth = float(_gt_inline)
            except ValueError:
                truth = fuzzy_revenue(razao, ground_truth)
        else:
            truth = fuzzy_revenue(razao, ground_truth)

        s1_m   = est.point_brl / 1e6
        s2_m   = (fusion.revenue_step2_p50 / 1e6) if fusion.revenue_step2_p50 else None
        rec_m  = fusion.recommended_revenue / 1e6
        tier = fusion.step2_granularity_tier or "n/a"

        s2_str = f"{s2_m:>10.0f}" if s2_m is not None else "       n/a"

        if truth:
            gt_m      = truth / 1e6
            err_s1    = (s1_m  - gt_m) / gt_m * 100
            err_rec   = (rec_m - gt_m) / gt_m * 100
            s2_pior   = (abs(err_rec) > abs(err_s1) + 5)  # step2 piorou >= 5pp
            gt_str    = f"{gt_m:>8.0f}"
            err_s1_str = f"{err_s1:>+7.0f}%"
            err_rec_str = f"{err_rec:>+8.0f}%"
            pior_str  = "PIOR" if s2_pior else "    "
            validated.append({
                "razao":   razao,
                "s1":      s1_m,
                "s2":      s2_m,
                "rec":     rec_m,
                "truth":   gt_m,
                "err_s1":  abs(err_s1),
                "err_rec": abs(err_rec),
                "s2_pior": s2_pior,
            })
        else:
            gt_str = "     n/a"
            err_s1_str = "    n/a"
            err_rec_str = "     n/a"
            pior_str = "    "

        print(
            f"  {razao:<36} {headcount:>4}  "
            f"{s1_m:>10.0f} {s2_str:>10} {rec_m:>10.0f}  "
            f"{gt_str} {err_s1_str} {err_rec_str}  "
            f"{fusion.fusion_diagnostic:<16} {tier:<7} {pior_str}"
        )

    # ── Métricas de validação ────────────────────────────────────────────
    if not validated:
        print("\n  [Nenhuma empresa com ground truth encontrada]")
        return

    n = len(validated)
    mape_s1  = sum(v["err_s1"] for v in validated) / n
    mape_rec = sum(v["err_rec"] for v in validated) / n
    med_rec  = median(v["err_rec"] for v in validated)
    within_2x = sum(1 for v in validated if v["err_rec"] <= 100) / n * 100
    within_3x = sum(1 for v in validated if v["err_rec"] <= 200) / n * 100

    print(f"\n  {'-' * (W - 4)}")
    print(f"  RESUMO DE VALIDACAO -- {n} empresas com ground truth")
    print(f"  {'-' * 40}")
    print(f"  {'MAPE Step 1':30} {mape_s1:>6.0f}%")
    print(f"  {'MAPE Recomendado':30} {mape_rec:>6.0f}%")
    print(f"  {'Mediana erro abs. (Recom.)':30} {med_rec:>6.0f}%")
    print(f"  {'Empresas dentro de 2× (±100%)':30} {within_2x:>6.0f}%")
    print(f"  {'Empresas dentro de 3× (±200%)':30} {within_3x:>6.0f}%")
    print(f"{'=' * W}\n")


if __name__ == "__main__":
    mode_arg = sys.argv[1] if len(sys.argv) > 1 else "active"
    demo(mode=mode_arg)
