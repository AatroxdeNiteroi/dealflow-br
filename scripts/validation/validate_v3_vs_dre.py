"""Validação sistemática estimates_v3 vs DRE pública de S.A. abertas multi-plant.

Pega ~20 empresas com receita bruta 2024 (ou líquida + ajuste) conhecida,
busca cada uma em `the-dumbers.dealflow.estimates_v3`, compara e calcula erro.

Saída: tabela com erro relativo + estratificação por archetype, seção,
single/multi-plant. Permite responder honestamente: "v3 ficou melhor?"

Caveat metodológico: nossa estimativa é receita BRUTA (via folha/razão IBGE
operacional). DREs costumam reportar receita LÍQUIDA. Quando só temos líquida,
estimamos bruta ≈ líquida × 1.15 (varia por setor).
"""

from __future__ import annotations

import sys
from dataclasses import dataclass

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from google.cloud import bigquery


@dataclass(frozen=True, slots=True)
class DRECase:
    """Empresa com DRE pública para comparação."""

    nome_busca: str  # LIKE %nome_busca%
    receita_bruta_brl: float  # 2024 (ou último ano disponível)
    fonte: str  # de onde veio o número
    setor: str  # rótulo amigável (não afeta cálculo)


# Receitas BRUTAS 2024 (ou líquida × ~1.15 quando indicado).
# Fontes: relatórios anuais, ITR/DFP da CVM, releases de IR.
# Quando "aprox" no campo fonte: número arredondado a partir de release público.
CASES: tuple[DRECase, ...] = (
    # Varejo
    DRECase("LOJAS RENNER",             14_000_000_000, "ITR Q4 2024 aprox bruta",       "varejo vestuário"),
    DRECase("MAGAZINE LUIZA",           41_000_000_000, "DFP 2023 aprox bruta",          "varejo eletro"),
    DRECase("VIA VAREJO",               31_000_000_000, "DFP 2023 bruta",                "varejo eletro (Casas Bahia)"),
    DRECase("RAIA DROGASIL",            37_000_000_000, "ITR Q4 2024 bruta",             "varejo farmácia"),
    DRECase("LOJAS RIACHUELO",           9_500_000_000, "DFP 2023 aprox bruta",          "varejo vestuário"),
    DRECase("ATACADAO",                115_000_000_000, "DFP 2024 bruta",                "atacarejo"),
    DRECase("SENDAS DISTRIBUIDORA",     74_000_000_000, "DFP 2024 bruta (Assaí)",        "atacarejo"),

    # Saúde
    DRECase("HAPVIDA",                  32_000_000_000, "DFP 2023 aprox bruta",          "saúde plano"),

    # Indústria
    DRECase("WEG ",                     38_000_000_000, "DFP 2024 bruta",                "indústria elétrica"),
    DRECase("MARFRIG",                 165_000_000_000, "DFP 2023 bruta",                "alimentos carne"),
    DRECase("KLABIN",                   22_000_000_000, "DFP 2023 aprox bruta",          "papel e celulose"),
    DRECase("SUZANO",                   42_000_000_000, "DFP 2023 bruta",                "papel e celulose"),
    DRECase("USIMINAS",                 32_000_000_000, "DFP 2023 aprox bruta",          "siderurgia"),
    DRECase("BLAU FARMACEUTICA",         1_900_000_000, "DFP 2023 aprox bruta",          "farmacêutica"),
    DRECase("WHIRLPOOL",                12_000_000_000, "estimativa pública BR",          "indústria linha branca"),

    # Serviços / Tech
    DRECase("LOCALIZA",                 35_000_000_000, "DFP 2024 bruta",                "aluguel veículos"),
    DRECase("TOTVS S.A.",                4_400_000_000, "DFP 2024 bruta",                "software (TI)"),

    # Casos in-scope conhecidos (single-plant, já validados antes)
    DRECase("HAGA S/A",                     62_000_000, "DFP 2023 aprox",                "indústria pequena (controle)"),
    DRECase("VIDROPORTO",                  850_000_000, "DFP 2023 aprox",                "indústria vidro (controle)"),
    DRECase("INDUSTRIAS ROMI",           1_220_000_000, "DFP 2023 bruta",                "indústria máquinas (controle)"),
    DRECase("NUTRIPLANT",                  180_000_000, "DFP 2023 aprox (midcap)",       "fertilizantes (controle)"),
)


def main() -> int:
    client = bigquery.Client(project="the-dumbers")

    print(f"Buscando {len(CASES)} casos no estimates_v3...")
    print()

    rows: list[dict] = []
    for case in CASES:
        sql = """
        SELECT
          razao_social,
          cnae_2_subclasse,
          cnae_secao,
          headcount,
          n_plantas,
          n_ufs,
          ufs_grupo,
          archetype,
          confidence,
          razao_precision,
          receita_low_brl,
          receita_high_brl,
          receita_point_brl
        FROM `the-dumbers.dealflow.estimates_v3`
        WHERE UPPER(razao_social) LIKE @pat
        ORDER BY receita_point_brl DESC NULLS LAST
        LIMIT 1
        """
        job = client.query(
            sql,
            job_config=bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("pat", "STRING", f"%{case.nome_busca.upper()}%")
                ]
            ),
        )
        results = list(job.result())
        if not results:
            rows.append({
                "busca": case.nome_busca,
                "razao_social": None,
                "real_M": case.receita_bruta_brl / 1e6,
                "est_M": None,
                "erro_pct": None,
                "n_plantas": None,
                "archetype": None,
                "confidence": None,
                "cnae_secao": None,
                "setor": case.setor,
                "fonte": case.fonte,
            })
            continue
        r = dict(results[0])
        est = r["receita_point_brl"]
        erro_pct = ((est - case.receita_bruta_brl) / case.receita_bruta_brl * 100) if est else None
        rows.append({
            "busca": case.nome_busca,
            "razao_social": r["razao_social"],
            "real_M": case.receita_bruta_brl / 1e6,
            "est_M": est / 1e6 if est else None,
            "erro_pct": erro_pct,
            "n_plantas": r["n_plantas"],
            "archetype": r["archetype"],
            "confidence": r["confidence"],
            "cnae_secao": r["cnae_secao"],
            "setor": case.setor,
            "fonte": case.fonte,
        })

    # Print tabela detalhada
    print(f"{'Busca':<25} {'Razão Social':<45} {'Real (M)':>12} {'Est (M)':>12} {'Erro %':>9} {'Plantas':>8} {'Conf':>8} {'Setor':<25}")
    print("─" * 160)
    for r in rows:
        razao = (r["razao_social"] or "(não encontrado)")[:43]
        real = f"{r['real_M']:>12,.0f}"
        est = f"{r['est_M']:>12,.0f}" if r["est_M"] else f"{'—':>12}"
        erro = f"{r['erro_pct']:>+9.1f}" if r["erro_pct"] is not None else f"{'—':>9}"
        plantas = f"{r['n_plantas']:>8}" if r["n_plantas"] else f"{'—':>8}"
        conf = (r["confidence"] or "—")[:8]
        setor = r["setor"][:24]
        print(f"{r['busca']:<25} {razao:<45} {real} {est} {erro} {plantas} {conf:>8} {setor:<25}")

    # Estatísticas agregadas (só casos encontrados)
    found = [r for r in rows if r["erro_pct"] is not None]
    if not found:
        print("\n(nenhum caso encontrado)")
        return 0

    erros = [r["erro_pct"] for r in found]
    abs_erros = [abs(e) for e in erros]

    print()
    print("=" * 80)
    print("ESTATÍSTICAS (n = casos encontrados)")
    print("=" * 80)
    print(f"  Casos encontrados: {len(found)} de {len(CASES)}")
    print(f"  Erro mediano:      {sorted(erros)[len(erros)//2]:+.1f}%")
    print(f"  Erro médio:        {sum(erros)/len(erros):+.1f}%")
    print(f"  |Erro| mediano:    {sorted(abs_erros)[len(abs_erros)//2]:.1f}%")
    print(f"  |Erro| médio:      {sum(abs_erros)/len(abs_erros):.1f}%")
    print(f"  Acertou ±20%:      {sum(1 for e in abs_erros if e <= 20)} ({sum(1 for e in abs_erros if e <= 20)*100/len(abs_erros):.0f}%)")
    print(f"  Acertou ±50%:      {sum(1 for e in abs_erros if e <= 50)} ({sum(1 for e in abs_erros if e <= 50)*100/len(abs_erros):.0f}%)")
    print(f"  Errou >100%:       {sum(1 for e in abs_erros if e > 100)}")

    # Por multi-plant vs single
    print()
    sp = [r for r in found if r["n_plantas"] == 1]
    mp = [r for r in found if (r["n_plantas"] or 0) > 1]
    if sp:
        print(f"  Single-plant ({len(sp)}):    erro médio {sum(r['erro_pct'] for r in sp)/len(sp):+.1f}%  |  |erro| médio {sum(abs(r['erro_pct']) for r in sp)/len(sp):.1f}%")
    if mp:
        print(f"  Multi-plant  ({len(mp)}):   erro médio {sum(r['erro_pct'] for r in mp)/len(mp):+.1f}%  |  |erro| médio {sum(abs(r['erro_pct']) for r in mp)/len(mp):.1f}%")

    # Por seção CNAE
    print()
    secoes = {}
    for r in found:
        secoes.setdefault(r["cnae_secao"], []).append(r["erro_pct"])
    for s, errs in sorted(secoes.items()):
        print(f"  Seção {s:<3} ({len(errs):>2}): erro médio {sum(errs)/len(errs):+.1f}%  |  |erro| médio {sum(abs(e) for e in errs)/len(errs):.1f}%")

    return 0


if __name__ == "__main__":
    sys.exit(main())
