# scripts/sql — SQLs canônicas do motor BigQuery

Estes arquivos reconstroem o pipeline `the-dumbers.dealflow.*` do zero. Eles são a **fonte de verdade** do motor — a metodologia em prosa (`docs/architecture.md`) explica o porquê; estes arquivos são o **como** executável.

## Ordem de execução

Existem dependências entre as tabelas. Rode na ordem:

| # | Arquivo | Cria | Depende de | Custo BQ (aprox) |
|---|---|---|---|---|
| — | `udfs/cnae_secao.sql` | função `cnae_secao` | — | 0 |
| — | `udfs/faixa_pessoal.sql` | função `faixa_pessoal` | — | 0 |
| — | `udfs/encargos.sql` | funções `encargos_low/_high` | — | 0 |
| — | `udfs/tamanho_for_headcount.sql` | função `tamanho_for_headcount` | — | 0 |
| 01 | `01_receita_universe.sql` | `receita_universe_v1` (~1.6M) | base Receita pública (BD) | ~$0.05 |
| 02 | `02_rais_universe.sql` | `rais_universe_v1` (~180k) | base RAIS pública (BD) | ~$0.015 |
| 03 | `03_matches.sql` | `matches_v1` (~73k Tier 1) | 01 + 02 | ~$0.005 |
| 04 | `04_benchmark_salarial.sql` | `benchmark_salarial_v1` (~70k células) | base RAIS Vínculos (BD) | ~$0.007 |
| 05 | `05_socios_summary.sql` | `socios_summary_v1` (por raiz CNPJ) | base Receita.socios (BD) | ~$0.02 |
| 06 | `06_estimates_v1.sql` | `estimates_v1` (~73k) | 03 + 04 + razao_*_v1 + UDFs | ~$0.001 |
| 07 | `07_estimates_v2.sql` | `estimates_v2` (~73k) | 03 + 04 + 05 + 01 + razao_*_v1 + UDFs | ~$0.001 |
| 04b | `04b_benchmark_salarial_v2.sql` | `benchmark_salarial_v2` (259k células BR) | base RAIS Vínculos (BD) | ~$0.025 |
| 08 | `08_estabs_universe.sql` | `estabs_universe_v1` (~154k estabs) | 03 + RAIS BR + Receita BR com deflator §4.5 | ~$0.125 |
| 09 | `09_grupos_estabs.sql` | `grupos_estabs_v1` (~154k linhas com folha) | 08 + 04b + UDFs | ~$0.005 |
| 10 | `10_estimates_v3.sql` | `estimates_v3` (~70k grupos multi-plant) | 09 + 05 + razao_*_v1 + UDFs | ~$0.005 |

**Total v3: ~US$ 0.30 por refresh completo** (v1/v2 ~$0.10; multi-plant 04b+08-10 adiciona ~$0.16 — universo BR é mais caro). Com query cache, segundo refresh é grátis.

## Tabelas de referência (não-SQL)

Duas tabelas dependentes do pipeline são **populadas via upload de CSV** (não tem SQL aqui):

- `razao_folha_receita_v1` ← `data/reference/razao_folha_receita_2023.csv` (308 linhas, IBGE PIA/PAC/PAS)
- `razao_by_size_v1` ← `data/reference/razao_by_size_2023.csv` (24 linhas, PIA tabela 1839)

Esses CSVs são gerados pelo script `scripts/build_razao_folha_receita.py` (puxa do SIDRA API do IBGE). Para subir no BQ:

1. No BigQuery Studio, abra o dataset `dealflow`
2. Clique **CREATE TABLE** → Source: **Upload** → arquivo CSV → schema **Auto-detect**
3. Table name: `razao_folha_receita_v1` (ou `razao_by_size_v1`)
4. Confirme as colunas (especialmente `cnae_4d`, `cnae_2d`, `source_table`, `source_precision`)

## Como rodar

### Opção A — BigQuery Studio (web)

1. Abre https://console.cloud.google.com/bigquery
2. Copia o conteúdo de cada arquivo para o editor SQL
3. Roda em ordem (01 → 02 → 03 → ...). Não precisa esperar — cada um termina antes do próximo botão "Run".

### Opção B — `bq` CLI (em lote)

```bash
for f in scripts/sql/udfs/*.sql; do
  bq query --use_legacy_sql=false < "$f"
done

for f in scripts/sql/0*.sql; do
  echo "▶ $f"
  bq query --use_legacy_sql=false < "$f"
done
```

(Precisa de `gcloud auth application-default login` antes.)

## Versionamento de schema

Sufixo `_v1` reflete a **camada de dados**. Mudanças que alteram o conteúdo das tabelas devem criar uma nova versão (`_v2`, `_v3`) em vez de sobrescrever — assim os consumidores (UI, scripts, parquet local) podem migrar progressivamente.

A `estimates_v2` aqui é a **Opção A** — archetypes como metadado, receita numérica IGUAL à v1. Decisão pós-validação documentada em `07_estimates_v2.sql` e em `docs/architecture.md` §6.5.

## Quando regenerar

- **Anual:** quando o ano-base RAIS atualiza (geralmente Q4 do ano seguinte → ano-base 2025 sai em Q4 2026). Atualizar `WHERE ano = 2025` em `02_*` e `04_*`.
- **Quando IBGE PIA/PAC/PAS publica novo ano-base** (atualmente 2023): regerar CSVs via `scripts/build_razao_folha_receita.py` e reuploadar.
- **Quando snapshot Receita avança** (mensal): atualizar `DATE '2024-12-18'` em `01_*` e `05_*` para a partição mais recente. Conferir com `INFORMATION_SCHEMA.PARTITIONS` em `basedosdados.br_me_cnpj`.

Após qualquer regeneração das tabelas, rode `uv run python scripts/export_estimates_to_parquet.py` para atualizar `data/estimates_v2.parquet` consumido pela UI.
