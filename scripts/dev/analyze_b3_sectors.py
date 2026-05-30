"""Step 1 vs Step 2 validation para todas as empresas B3.

Roda os dois motores SEPARADAMENTE (sem fusão) e reporta mediana de erro
absoluto por setor (até 20 setores).

Inputs:
    data/sample/matches_validation_batch.csv  — CNPJ + CNAE + headcount + receita_verdadeira_brl
    data/reference/benchmark_salarial.csv     — salário médio CNAE × município
    /tmp/cad_cia_aberta.csv                   — catálogo CVM com SETOR_ATIV

Uso:
    uv run python scripts/dev/analyze_b3_sectors.py
"""

from __future__ import annotations

import csv
import os
import sys
from pathlib import Path
from statistics import median

_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ROOT / "src"))

BENCHMARK_PATH = _ROOT / "data/reference/benchmark_salarial.csv"
BATCH_PATH = _ROOT / "data/sample/matches_validation_batch.csv"
_TEMP = Path(os.environ.get("TEMP", os.environ.get("TMP", "/tmp")))
CVM_CAD_PATH = _TEMP / "cad_cia_aberta.csv"

from dealflow.domain import CNAE, CNPJ, MatchConfidence, MatchResult
from dealflow.estimator import estimate_revenue
from dealflow.sector_bands.lookup import lookup_classification
from dealflow.sector_bands.bands import get_revenue_band


# ── sector normalization ──────────────────────────────────────────────────────

_SECTOR_MAP: dict[str, str] = {
    # Energia / utilities
    "energia elétrica": "Energia Elétrica",
    "petróleo e gás": "Petróleo & Gás",
    "gás": "Petróleo & Gás",
    "saneamento": "Saneamento & Água",
    "água": "Saneamento & Água",
    # Indústria
    "metalurgia": "Metalurgia",
    "mineração": "Mineração",
    "minerais": "Mineração",
    "papel e celulose": "Papel & Celulose",
    "petroquímica": "Química & Petroquímica",
    "química": "Química & Petroquímica",
    "têxtil": "Têxtil & Vestuário",
    "vestuário": "Têxtil & Vestuário",
    "alimentos": "Alimentos & Bebidas",
    "bebidas": "Alimentos & Bebidas",
    "carne": "Alimentos & Bebidas",
    "agro": "Agronegócio",
    "açúcar": "Agronegócio",
    "celulose": "Papel & Celulose",
    "construção": "Construção & Real Estate",
    "real estate": "Construção & Real Estate",
    "incorpora": "Construção & Real Estate",
    # Serviços
    "transporte": "Transporte & Logística",
    "logística": "Transporte & Logística",
    "aéreo": "Transporte & Logística",
    "portuário": "Transporte & Logística",
    "telecomunicações": "Telecom",
    "telecom": "Telecom",
    "saúde": "Saúde",
    "hospital": "Saúde",
    "farmacêutico": "Farmácia & Saúde",
    "educação": "Educação",
    # Finanças
    "banco": "Bancos & Seguros",
    "bancos": "Bancos & Seguros",
    "seguro": "Bancos & Seguros",
    "crédito": "Bancos & Seguros",
    "financeiro": "Bancos & Seguros",
    # Comércio / Consumo
    "comércio": "Comércio & Varejo",
    "varejo": "Comércio & Varejo",
    "supermercado": "Comércio & Varejo",
    # Tecnologia
    "tecnologia": "Tecnologia",
    "software": "Tecnologia",
    "ti ": "Tecnologia",
    # Holdings
    "participações": "Holdings",
    "holding": "Holdings",
}


def _normalize_sector(setor_raw: str) -> str:
    s = setor_raw.lower().strip()
    for key, label in _SECTOR_MAP.items():
        if key in s:
            return label
    return setor_raw.title() if setor_raw else "Outros"


# ── loaders ──────────────────────────────────────────────────────────────────

def load_benchmark() -> tuple[dict[tuple[str, str], float], dict[str, float]]:
    acc_cell: dict[tuple[str, str], list[float]] = {}
    acc_cnae: dict[str, list[float]] = {}
    with BENCHMARK_PATH.open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            s = float(row["salario_medio_brl"])
            acc_cell.setdefault((row["cnae_2_subclasse"], row["id_municipio"]), []).append(s)
            acc_cnae.setdefault(row["cnae_2_subclasse"], []).append(s)
    por_celula = {k: sum(v) / len(v) for k, v in acc_cell.items()}
    por_cnae = {k: sum(v) / len(v) for k, v in acc_cnae.items()}
    return por_celula, por_cnae


def load_cvm_sectors() -> dict[str, str]:
    """CNPJ (digits-only) → SETOR_ATIV normalizado."""
    if not CVM_CAD_PATH.exists():
        return {}
    result: dict[str, str] = {}
    with CVM_CAD_PATH.open(encoding="latin-1") as fh:
        reader = csv.DictReader(fh, delimiter=";")
        for row in reader:
            cnpj_raw = row.get("CNPJ_CIA", "")
            setor = row.get("SETOR_ATIV", "").strip()
            cnpj_digits = "".join(c for c in cnpj_raw if c.isdigit())
            if cnpj_digits and setor:
                result[cnpj_digits] = _normalize_sector(setor)
    return result


# ── analysis ─────────────────────────────────────────────────────────────────

def main() -> None:
    os.environ["SECTOR_BANDS_MODE"] = "shadow"

    bench_cell, bench_cnae = load_benchmark()
    cvm_sectors = load_cvm_sectors()
    if not cvm_sectors:
        print("AVISO: /tmp/cad_cia_aberta.csv não encontrado. Setores serão marcados como 'Desconhecido'.")

    with BATCH_PATH.open(encoding="utf-8") as fh:
        batch = list(csv.DictReader(fh))

    # ── per-company results ───────────────────────────────────────────────────
    records: list[dict] = []
    skipped_no_hc = 0
    skipped_no_gt = 0
    skipped_no_bench = 0

    for row in batch:
        cnpj_str = row["cnpj"]
        razao = row["razao_social"]
        cnae_str = row["cnae_2_subclasse"]
        municipio = row["id_municipio"]
        headcount = int(row["headcount"] or 0)
        gt_str = (row.get("receita_verdadeira_brl") or "").strip()

        if headcount <= 0:
            skipped_no_hc += 1
            continue
        if not gt_str:
            skipped_no_gt += 1
            continue

        try:
            truth = float(gt_str)
        except ValueError:
            skipped_no_gt += 1
            continue

        if truth <= 0:
            skipped_no_gt += 1
            continue

        salary = bench_cell.get((cnae_str, municipio)) or bench_cnae.get(cnae_str)
        if salary is None:
            skipped_no_bench += 1
            continue

        # sector
        cnpj_digits = "".join(c for c in cnpj_str if c.isdigit()).zfill(14)
        sector = cvm_sectors.get(cnpj_digits, "Outros")

        # ── Step 1 ───────────────────────────────────────────────────────────
        match = MatchResult(
            cnpj=CNPJ(cnpj_str),
            rais_estab_index=None,
            headcount=headcount,
            confidence=MatchConfidence.MEDIUM,
            n_candidates=1,
            rationale="analyze_b3",
        )
        est = estimate_revenue(
            match=match,
            cnae=CNAE(cnae_str),
            salario_medio_mensal_brl=salary,
            n_vinculos_benchmark=50,
        )
        s1_brl = est.point_brl
        err_s1 = abs(s1_brl - truth) / truth * 100

        # ── Step 2 (direto, sem fusão) ────────────────────────────────────────
        hit = lookup_classification(cnae_str)
        s2_brl: float | None = None
        s2_status = hit.coverage_status
        extrapolated = False

        if hit.survey_classification_code:
            band = get_revenue_band(hit.survey_classification_code, headcount)
            if band and band.p50 is not None:
                s2_brl = band.p50
                extrapolated = band.extrapolated

        err_s2 = abs(s2_brl - truth) / truth * 100 if s2_brl is not None else None
        signed_s1 = (s1_brl - truth) / truth * 100
        signed_s2 = (s2_brl - truth) / truth * 100 if s2_brl is not None else None

        records.append({
            "razao": razao,
            "sector": sector,
            "cnae": cnae_str,
            "headcount": headcount,
            "truth_m": truth / 1e6,
            "s1_m": s1_brl / 1e6,
            "s2_m": s2_brl / 1e6 if s2_brl else None,
            "err_s1": err_s1,
            "err_s2": err_s2,
            "signed_s1": signed_s1,
            "signed_s2": signed_s2,
            "s2_status": s2_status,
            "extrapolated": extrapolated,
        })

    print(f"\nEstatísticas de cobertura:")
    print(f"  Total no batch:           {len(batch)}")
    print(f"  Sem headcount:            {skipped_no_hc}")
    print(f"  Sem ground truth:         {skipped_no_gt}")
    print(f"  Sem benchmark salarial:   {skipped_no_bench}")
    print(f"  Analisados:               {len(records)}")
    s2_covered = [r for r in records if r["err_s2"] is not None]
    s2_extrap = [r for r in records if r["extrapolated"]]
    print(f"  Com Step 2 (p50):         {len(s2_covered)}")
    print(f"  Step 2 extrapolado:       {len(s2_extrap)}")

    # ── overall MAPE ─────────────────────────────────────────────────────────
    if records:
        all_s1_errs = [r["err_s1"] for r in records]
        all_s2_errs = [r["err_s2"] for r in s2_covered]
        s2_no_extrap = [r for r in s2_covered if not r["extrapolated"]]
        s2_errs_no_extrap = [r["err_s2"] for r in s2_no_extrap]
        print(f"\nResultados globais:")
        print(f"  MAPE Step 1  (n={len(all_s1_errs)}):             {sum(all_s1_errs)/len(all_s1_errs):.0f}%  |  mediana: {median(all_s1_errs):.0f}%")
        if all_s2_errs:
            print(f"  MAPE Step 2  (n={len(all_s2_errs)}, com extrap): {sum(all_s2_errs)/len(all_s2_errs):.0f}%  |  mediana: {median(all_s2_errs):.0f}%")
        if s2_errs_no_extrap:
            print(f"  MAPE Step 2  (n={len(s2_errs_no_extrap)}, sem extrap): {sum(s2_errs_no_extrap)/len(s2_errs_no_extrap):.0f}%  |  mediana: {median(s2_errs_no_extrap):.0f}%")

    # ── por setor ─────────────────────────────────────────────────────────────
    sector_data: dict[str, list[dict]] = {}
    for r in records:
        sector_data.setdefault(r["sector"], []).append(r)

    # Sort sectors by count descending
    sorted_sectors = sorted(sector_data.items(), key=lambda x: -len(x[1]))

    # Collapse past top-19 into "Outros"
    if len(sorted_sectors) > 20:
        top19 = sorted_sectors[:19]
        rest = sorted_sectors[19:]
        rest_flat: list[dict] = []
        for _, rows in rest:
            rest_flat.extend(rows)
        sorted_sectors = top19 + [("Outros (agrupado)", rest_flat)]  # type: ignore[assignment]

    def _bias(signed_med: float) -> str:
        if signed_med > 15:
            return "superestima"
        if signed_med < -15:
            return "subestima"
        return "neutro"

    W = 130
    print(f"\n{'=' * W}")
    print(f"  ERROS POR SETOR  (mediana com sinal: + = superestima, - = subestima)")
    print(f"{'=' * W}")
    print(
        f"  {'Setor':<32} {'N':>4}  {'N S2':>5}  "
        f"{'MdE S1':>7}  {'Viés S1':<12}  "
        f"{'MdE S2':>7}  {'Viés S2':<12}  "
        f"{'Cob S2':>6}"
    )
    print(f"  {'-' * (W - 4)}")

    for sector, rows in sorted_sectors:
        n = len(rows)
        s2_rows = [r for r in rows if r["signed_s2"] is not None]
        n_s2 = len(s2_rows)

        signed_s1_vals = [r["signed_s1"] for r in rows]
        med_s1 = median(signed_s1_vals)
        bias_s1 = _bias(med_s1)

        if s2_rows:
            signed_s2_vals = [r["signed_s2"] for r in s2_rows]
            med_s2 = median(signed_s2_vals)
            bias_s2 = _bias(med_s2)
            cov = n_s2 / n * 100
            s2_med_str = f"{med_s2:>+7.0f}%"
            s2_bias_str = bias_s2
            cov_str = f"{cov:>5.0f}%"
        else:
            s2_med_str = "    n/a"
            s2_bias_str = "n/a"
            cov_str = "    0%"

        print(
            f"  {sector:<32} {n:>4}  {n_s2:>5}  "
            f"{med_s1:>+7.0f}%  {bias_s1:<12}  "
            f"{s2_med_str}  {s2_bias_str:<12}  "
            f"{cov_str}"
        )

    print(f"{'=' * W}")

    # ── worst Step 2 offenders ────────────────────────────────────────────────
    if s2_covered:
        print(f"\nPiores erros Step 2 (top 15):")
        worst = sorted(s2_covered, key=lambda r: -r["err_s2"])[:15]
        for r in worst:
            flag = " [extrap]" if r["extrapolated"] else ""
            print(
                f"  {r['razao']:<40} HC={r['headcount']:>5}  "
                f"GT={r['truth_m']:>8.0f}M  S2={r['s2_m']:>8.0f}M  "
                f"err={r['err_s2']:>+.0f}%{flag}"
            )

    print()


if __name__ == "__main__":
    main()
