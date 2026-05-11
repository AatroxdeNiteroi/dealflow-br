"""Aplica a fórmula §6.1 em uma amostra de matches_v1 e mostra resultados.

Esta é a validação end-to-end do motor:
    1. Lê amostra de N empresas do CSV (gerado a partir de matches_v1 no BigQuery)
    2. Para cada empresa: lookup razão folha/receita + salário médio benchmark
    3. Aplica fórmula §6.1: Folha → Receita
    4. Imprime tabela legível com estimativas + confidence

Pré-requisitos:
    - data/reference/razao_folha_receita_2023.csv (já temos)
    - data/sample/matches_sample.csv (export do BigQuery, ver instruções)
    - data/reference/benchmark_salarial.csv (idem)

Uso:
    uv run python scripts/estimate_sample.py
"""

from __future__ import annotations

import csv
import sys
from dataclasses import dataclass
from pathlib import Path

# Force UTF-8 on Windows console.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from dealflow.domain import CNAE, CNPJ, MatchConfidence, MatchResult
from dealflow.estimator import estimate_revenue
from dealflow.multipliers import razao_folha_receita_for

SAMPLE_CSV = Path(
    "data/sample/" + (sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].endswith(".csv") else "matches_sample.csv")
)
BENCHMARK_CSV = Path("data/reference/benchmark_salarial.csv")


@dataclass(frozen=True, slots=True)
class SampleRow:
    """Linha do CSV exportado do BigQuery matches_v1."""

    cnpj: str
    razao_social: str
    cnae_2_subclasse: str
    id_municipio: str
    headcount: int


@dataclass(frozen=True, slots=True)
class BenchmarkEntry:
    salario_medio_brl: float
    n_vinculos: int


def load_sample(path: Path) -> list[SampleRow]:
    rows: list[SampleRow] = []
    with path.open(encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for r in reader:
            rows.append(
                SampleRow(
                    cnpj=r["cnpj"],
                    razao_social=r["razao_social"],
                    cnae_2_subclasse=r["cnae_2_subclasse"],
                    id_municipio=r["id_municipio"],
                    headcount=int(r["headcount"]),
                )
            )
    return rows


def load_benchmark(path: Path) -> dict[tuple[str, str], BenchmarkEntry]:
    """Carrega benchmark salarial em dict {(cnae_7d, id_municipio): entry}."""
    benchmark: dict[tuple[str, str], BenchmarkEntry] = {}
    with path.open(encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for r in reader:
            key = (r["cnae_2_subclasse"], r["id_municipio"])
            benchmark[key] = BenchmarkEntry(
                salario_medio_brl=float(r["salario_medio_brl"]),
                n_vinculos=int(r["n_vinculos"]),
            )
    return benchmark


def lookup_salario(
    benchmark: dict[tuple[str, str], BenchmarkEntry],
    cnae_7d: str,
    id_municipio: str,
) -> BenchmarkEntry | None:
    """Cascata de fallback: cnae7d×municipio → cnae4d×municipio → nada."""
    if entry := benchmark.get((cnae_7d, id_municipio)):
        return entry
    cnae_4d_prefix = cnae_7d[:4]
    for (cnae, mun), entry in benchmark.items():
        if cnae.startswith(cnae_4d_prefix) and mun == id_municipio:
            return entry
    return None


def fmt_brl(v: float) -> str:
    if v >= 1_000_000:
        return f"R${v / 1_000_000:.1f}M"
    if v >= 1_000:
        return f"R${v / 1_000:.0f}k"
    return f"R${v:.0f}"


def main() -> int:
    if not SAMPLE_CSV.exists():
        print(f"Sample CSV ausente: {SAMPLE_CSV}", file=sys.stderr)
        print(
            "Exporta 10-20 empresas de matches_v1 do BigQuery primeiro.\n"
            "Ex: SELECT cnpj, razao_social, cnae_2_subclasse, id_municipio, headcount "
            "FROM `the-dumbers.dealflow.matches_v1` ORDER BY RAND() LIMIT 20;",
            file=sys.stderr,
        )
        return 1

    if not BENCHMARK_CSV.exists():
        print(f"Benchmark CSV ausente: {BENCHMARK_CSV}", file=sys.stderr)
        print(
            "Exporta benchmark_salarial_v1 do BigQuery primeiro.\n"
            "Ex: SELECT cnae_2_subclasse, id_municipio, salario_medio_brl, n_vinculos "
            "FROM `the-dumbers.dealflow.benchmark_salarial_v1`;",
            file=sys.stderr,
        )
        return 1

    sample = load_sample(SAMPLE_CSV)
    benchmark = load_benchmark(BENCHMARK_CSV)

    print(f"Aplicando fórmula §6.1 em {len(sample)} empresas\n")
    print(
        f"{'CNPJ':<20} {'Razão Social':<40} {'Headcount':>9}  {'Salário':>10}  "
        f"{'Razão':>6}  {'Receita est.':>15}  {'Confiança':>10}"
    )
    print("─" * 120)

    for row in sample:
        bench = lookup_salario(benchmark, row.cnae_2_subclasse, row.id_municipio)
        if bench is None:
            print(f"{row.cnpj:<20} {row.razao_social[:38]:<40}  SEM BENCHMARK SALARIAL")
            continue

        cnae = CNAE(row.cnae_2_subclasse)
        razao_lookup = razao_folha_receita_for(cnae, headcount=row.headcount)

        match_result = MatchResult(
            cnpj=CNPJ(row.cnpj),
            rais_estab_index=None,
            headcount=row.headcount,
            confidence=MatchConfidence.HIGH,  # Tier 1 do matches_v1
            n_candidates=1,
            rationale="Tier 1",
        )

        try:
            estimate = estimate_revenue(
                match=match_result,
                cnae=cnae,
                salario_medio_mensal_brl=bench.salario_medio_brl,
                n_vinculos_benchmark=bench.n_vinculos,
            )
        except ValueError as exc:
            print(f"{row.cnpj:<20} {row.razao_social[:38]:<40}  ERRO: {exc}")
            continue

        print(
            f"{row.cnpj:<20} {row.razao_social[:38]:<40} {row.headcount:>9}  "
            f"{fmt_brl(bench.salario_medio_brl):>10}  "
            f"{razao_lookup.razao:>6.1%}  "
            f"{fmt_brl(estimate.low_brl)} – {fmt_brl(estimate.high_brl):<5}  "
            f"{estimate.confidence.value:>10}"
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
