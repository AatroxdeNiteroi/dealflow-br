"""Reconstrói o pipeline BigQuery inteiro, do zero, em escopo NACIONAL (27 UFs).

QUANDO USAR
-----------
O projeto `the-dumbers` está em BigQuery **sandbox** (billing desabilitado), o
que força expiração de 60 dias em TODA tabela do dataset. Quando as tabelas
caírem, o produto continua no ar normalmente — ele lê os parquets locais, não o
BigQuery. O que se perde é a capacidade de regenerar. Este script devolve ela.

Próxima queda prevista: **2026-11-08**.

    uv sync --extra export          # uma vez
    uv run python scripts/rebuild_pipeline.py

POR QUE ESTE SCRIPT EXISTE (a armadilha que ele fecha)
------------------------------------------------------
Duas tabelas de referência do IBGE não têm SQL — são upload de CSV, e expiram
junto com o resto. O repo versiona DUAS versões da razão folha/receita:

  * `razao_folha_receita_2023_maio.csv`  (308 linhas) ← EM USO no produto
  * `razao_folha_receita_2023.csv`       (409 linhas) ← recalibração B3/DVA
                                                        (`ed5e8a0`), FORA de uso

Carregar a segunda por engano faz o pipeline rodar sem erro nenhum e devolver
um produto silenciosamente diferente: construtoras com faturamento ~3,6x maior
(seção F, razão 0,20 → 0,0553). Por isso o caminho do CSV é fixo aqui em código
— não é uma escolha de quem roda. Se um dia a decisão de metodologia mudar,
troque RAZAO_CSV e o motivo fica no diff.

SEGURANÇA
---------
O parquet do produto NÃO é sobrescrito direto. O fluxo é:

    BigQuery → arquivo .new → conferência de não-regressão → promoção

Se o recorte de controle divergir do parquet atual além da tolerância, o script
ABORTA com o diagnóstico e deixa o .new no disco para inspeção. Rebuild ruim
falha alto em vez de virar produto.

Custo medido (2026-09-10, nacional, 11 passos): 17,5 GB · ~7 min · US$ 0,00
(sandbox: free tier de 1 TB/mês, consumo ≈ 1,7%). Sem billing habilitado não há
caminho para gerar fatura — se a cota estourar, a query é recusada.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

REPO = Path(__file__).resolve().parents[1]
SQL = REPO / "scripts" / "sql"

PROJECT = "the-dumbers"
DATASET = "dealflow"

# ── Tabelas de referência (upload de CSV — não têm SQL) ────────────────
# CAMINHO FIXO POR DESIGN. Ver docstring: trocar isto muda o produto.
RAZAO_CSV = REPO / "data" / "reference" / "razao_folha_receita_2023_maio.csv"
BY_SIZE_CSV = REPO / "data" / "reference" / "razao_by_size_2023.csv"

RAZAO_SCHEMA = [
    ("cnae_2d", "STRING"), ("cnae_4d", "STRING"),
    ("razao_folha_receita", "FLOAT64"), ("source_table", "STRING"),
    ("source_category_code", "STRING"), ("source_category_name", "STRING"),
    ("source_precision", "STRING"), ("ano", "INT64"),
]
BY_SIZE_SCHEMA = [
    ("tipo_industria", "STRING"), ("faixa_label", "STRING"),
    ("razao_folha_receita", "FLOAT64"), ("receita_brl_mil", "FLOAT64"),
    ("salarios_brl_mil", "FLOAT64"), ("ano", "INT64"),
]

# ── Ordem de execução ─────────────────────────────────────────────────
# UDFs primeiro: routines NÃO expiram, então normalmente já estão lá — mas
# recriar é idempotente e barato, e cobre o caso de projeto novo.
UDFS = ["cnae_secao.sql", "encargos.sql", "faixa_pessoal.sql", "tamanho_for_headcount.sql"]

# Caminho do produto: só o que `estimates_final` precisa. Os passos 06/07/08/
# 09_grupos/10_estimates_v3 são das linhagens v1/v2/v3 (multi-plant), que o
# produto não consome — ficam de fora de propósito.
STEPS_PRODUTO = [
    "01_receita_universe.sql",
    "02_rais_universe.sql",
    "03_matches.sql",
    "04b_benchmark_salarial_v2.sql",  # NACIONAL. O 04 (v1) é RJ/SP e não é usado.
    "05_socios_summary.sql",
    "11_matches_tier2.sql",
    "13_matches_universe.sql",
    "12_estimates_final.sql",
]

STEPS_PII = [
    "10_socios_index.sql",
    "11_contato_v1.sql",
    "09_headcount_timeseries.sql",  # o mais pesado: RAIS 2018-2024 nacional
]

# ── Parquets ──────────────────────────────────────────────────────────
PARQUET_PRODUTO = REPO / "data" / "estimates_final_br_razao_maio.parquet"
EXPORTS_PII = [
    ("scripts/export_contato.py", REPO / "data" / "contato.parquet"),
    ("scripts/export_headcount_history.py", REPO / "data" / "headcount_history.parquet"),
    ("scripts/export_socios_index.py", REPO / "data" / "socios_index.parquet"),
]

# Conferência de não-regressão: quanto da receita por CNPJ pode divergir do
# parquet atual antes de considerarmos o rebuild suspeito. Um rebuild fiel dá
# ~100%; a folga cobre `idade_empresa_anos`, que usa CURRENT_DATE() e move
# alguns archetypes de lugar conforme o tempo passa.
TOLERANCIA_IDENTICAS = 0.98


def _client():
    try:
        from google.cloud import bigquery
    except ImportError:
        sys.exit("google-cloud-bigquery não instalado. Rode: uv sync --extra export")
    return bigquery.Client(project=PROJECT)


def _carregar_csv(client, csv_path: Path, tabela: str, schema) -> int:
    from google.cloud import bigquery as bq

    if not csv_path.exists():
        sys.exit(f"ERRO · CSV de referência não encontrado: {csv_path}")
    cfg = bq.LoadJobConfig(
        schema=[bq.SchemaField(n, t) for n, t in schema],
        skip_leading_rows=1,
        source_format=bq.SourceFormat.CSV,
        write_disposition="WRITE_TRUNCATE",
    )
    ref = f"{PROJECT}.{DATASET}.{tabela}"
    with open(csv_path, "rb") as fh:
        client.load_table_from_file(fh, ref, job_config=cfg).result()
    return client.get_table(ref).num_rows


def _rodar_sql(client, caminho: Path, label: str) -> None:
    from google.cloud import bigquery as bq

    sql = caminho.read_text(encoding="utf-8")
    t0 = time.time()
    job = client.query(sql, job_config=bq.QueryJobConfig(use_query_cache=False))
    job.result()
    gb = (job.total_bytes_billed or 0) / 1e9
    n = ""
    if job.destination:
        try:
            n = f"{client.get_table(job.destination).num_rows:>12,} linhas"
        except Exception:
            pass
    print(f"  {label:32s} OK {n:>20}  {gb:6.1f} GB  {time.time() - t0:6.1f}s", flush=True)


def _exportar_produto(destino: Path) -> None:
    r = subprocess.run(
        [sys.executable, str(REPO / "scripts" / "export_estimates_to_parquet.py"), str(destino)],
        cwd=REPO, capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    if r.returncode != 0:
        print(r.stdout, r.stderr, file=sys.stderr)
        sys.exit("ERRO · export do parquet do produto falhou")
    print("  " + (r.stdout.strip().splitlines() or ["exportado"])[-1])


def _conferir(novo: Path, atual: Path) -> bool:
    """Compara receita por CNPJ entre o parquet novo e o em produção.

    Agrega por CNPJ de propósito: ~4% dos CNPJs aparecem em mais de uma linha
    (empresa casando com mais de um estabelecimento RAIS), e comparar linha a
    linha cruzaria duplicatas diferentes nos dois arquivos, produzindo
    divergência falsa.
    """
    import polars as pl

    if not atual.exists():
        print(f"  (sem parquet anterior em {atual.name} — conferência pulada)")
        return True

    a = pl.read_parquet(atual).group_by("cnpj").agg(pl.col("receita_point_brl").sum().alias("r"))
    b = pl.read_parquet(novo).group_by("cnpj").agg(pl.col("receita_point_brl").sum().alias("r"))
    j = a.join(b, on="cnpj", how="inner", suffix="_novo")
    if len(j) == 0:
        print("  FALHOU · nenhum CNPJ em comum entre o parquet novo e o atual")
        return False

    dif = (pl.col("r_novo") - pl.col("r")).abs() / pl.when(pl.col("r") > 0).then(pl.col("r")).otherwise(1)
    iguais = len(j.filter(dif < 1e-9))
    frac = iguais / len(j)
    print(f"  CNPJs em comum {len(j):>8,} · receita idêntica {iguais:>8,} ({frac:.2%})")
    print(f"  cobertura: {len(b):,} CNPJs no novo vs {len(a):,} no atual")

    if frac < TOLERANCIA_IDENTICAS:
        mud = j.filter(dif >= 1e-9).with_columns(dif.alias("d"))
        print(f"\n  FALHOU · esperado ≥ {TOLERANCIA_IDENTICAS:.0%} idênticas.")
        print(f"  {len(mud):,} CNPJs mudaram · mediana {mud['d'].median():.1%}")
        print("\n  Causa mais provável: tabela de referência errada. Confira que")
        print(f"  {RAZAO_CSV.name} tem 308 linhas (e não 409, que é a B3/DVA).")
        return False
    return True


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--skip-pii", action="store_true",
                    help="não reconstrói sócios/contato/histórico (só o caminho do produto)")
    ap.add_argument("--force", action="store_true",
                    help="promove o parquet mesmo se a conferência de não-regressão falhar")
    args = ap.parse_args()

    client = _client()
    t_inicio = time.time()

    print(f"\n▶ Tabelas de referência (IBGE · caminho fixo por design)")
    n = _carregar_csv(client, RAZAO_CSV, "razao_folha_receita_v1", RAZAO_SCHEMA)
    print(f"  razao_folha_receita_v1  {n:>4} linhas  ← {RAZAO_CSV.name}")
    if n != 308:
        print(f"  ⚠  esperado 308 linhas. {n} sugere CSV trocado — ver docstring.")
    n = _carregar_csv(client, BY_SIZE_CSV, "razao_by_size_v1", BY_SIZE_SCHEMA)
    print(f"  razao_by_size_v1        {n:>4} linhas  ← {BY_SIZE_CSV.name}")

    print(f"\n▶ UDFs (idempotente — routines não expiram)")
    for f in UDFS:
        _rodar_sql(client, SQL / "udfs" / f, f)

    print(f"\n▶ Caminho do produto")
    for f in STEPS_PRODUTO:
        _rodar_sql(client, SQL / f, f)

    print(f"\n▶ Parquet do produto (para .new — ainda não promovido)")
    novo = PARQUET_PRODUTO.with_suffix(".parquet.new")
    _exportar_produto(novo)

    print(f"\n▶ Conferência de não-regressão vs {PARQUET_PRODUTO.name}")
    ok = _conferir(novo, PARQUET_PRODUTO)
    if not ok and not args.force:
        print(f"\n✗ ABORTADO. O parquet em produção NÃO foi tocado.")
        print(f"  Candidato preservado para inspeção: {novo}")
        print(f"  Para promover assim mesmo: --force")
        return 1
    novo.replace(PARQUET_PRODUTO)
    print(f"  promovido → {PARQUET_PRODUTO.name}")

    if not args.skip_pii:
        print(f"\n▶ Tabelas de PII")
        for f in STEPS_PII:
            _rodar_sql(client, SQL / f, f)

        print(f"\n▶ Parquets de PII (sobrescrevem — são derivados, ver dossiê LGPD §5)")
        for script, destino in EXPORTS_PII:
            r = subprocess.run([sys.executable, str(REPO / script)], cwd=REPO,
                               capture_output=True, text=True, encoding="utf-8", errors="replace")
            if r.returncode != 0:
                print(r.stdout, r.stderr, file=sys.stderr)
                print(f"  ✗ {script} falhou (DEALFLOW_SOCIOS_SALT definida no .env.local?)")
                return 1
            print(f"  {destino.name:28s} {destino.stat().st_size / 1e6:6.1f} MB")

    print(f"\n✓ Pipeline reconstruído em {time.time() - t_inicio:.0f}s.")
    print(f"  Lembrete: em sandbox estas tabelas expiram de novo em 60 dias.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
