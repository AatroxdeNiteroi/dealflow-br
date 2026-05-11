# DealFlow BR

Motor de estimativa de faturamento para Ltdas de médio porte em **RJ/SP**, baseado em cruzamento das bases públicas Receita Federal CNPJ + RAIS (Estabelecimentos + Vínculos) + IBGE PIA/PAC/PAS. Metodologia canônica em [`docs/architecture.md`](docs/architecture.md) (v3.1).

> Por que existe: empresas Ltda. brasileiras não publicam faturamento (sigilo fiscal, art. 198 CTN), e bureaus pagos entregam faixas opacas. Este motor reconstrói a estimativa a partir de fontes públicas, com metodologia auditável — cada número rastreável até a fonte primária.

## Quickstart (rodar a UI localmente)

```bash
git clone <repo>
cd the-dumbers-edition
uv sync
uv run streamlit run app.py
```

A UI abre em `http://localhost:8501` lendo `data/estimates_final.parquet` (~60k empresas single-plant, Tier 1 + Tier 2 desempatado, com filtros de plausibilidade). Filtros disponíveis na sidebar: UF, confiança, faixa de receita estimada, archetype, headcount, idade da empresa, capital social mínimo, tier de identificação (Tier 1 / Tier 2), busca por razão social/CNPJ.

## O que está dentro

| Caminho | Conteúdo |
|---|---|
| `app.py` | UI Streamlit — filtros de produto + tabela + download CSV |
| `data/estimates_final.parquet` | **59.807 empresas single-plant** (Tier 1 + Tier 2) com receita + archetype + sinais Receita |
| `docs/architecture.md` | Metodologia v3.1 (canônica) — §6 fórmula, §6.5 archetypes, §10 estado atual |
| `src/dealflow/` | Lógica Python pura (formula §6.1, lookups, types) |
| `scripts/` | Builders (razão folha/receita do IBGE) + exporter (BQ → parquet) |
| `data/reference/` | Tabelas curadas (razão folha/receita, faixa pessoal PIA 1839) |

## Distribuição empírica (snapshot 2026-05-11, estimates_final)

| Recorte | N empresas |
|---|---|
| **Total single-plant (Tier 1 + Tier 2)** | **59.807** |
| ↳ Tier 1 (chave única) | 52.290 |
| ↳ Tier 2 (desempate cascata §4.4) | 7.517 |
| Confiança alta + média | 35.963 |
| `archetype = family_mature_sweet_spot` (magic filter) | 5.886 |
| `archetype = labor_intensive_midcap` | 5.356 |
| Mediana receita estimada | R$ 7.6M |

**Validação âncora (vs DRE pública):** HAGA −5% · VIDROPORTO ±1% (alta confiança).

Validação empírica vs DRE público de S.A. abertas in-scope: ±20% em casos com headcount >500 (HAGA 0%, VIDROPORTO ±0%, ROMI −18%); +35-40% em midcaps 100-500 funcs em CNAEs dominados por gigantes capital-intensivos (viés residual conhecido, calibração via Compartilha RFB §7.3).

## Stack

- **Streamlit** — UI local
- **Polars + DuckDB** — manipulação tabular em memória/laptop
- **BigQuery** (`the-dumbers.dealflow.*`) — onde o motor materializa as 9 tabelas do pipeline (§10.1). Você só precisa do BQ para **regenerar** o parquet; rodar a UI é offline.

## Regenerar o parquet a partir do BigQuery (desenvolvedor)

A UI lê um snapshot estático versionado no repo. Para atualizar (e.g. quando RAIS 2025 sair):

```bash
gcloud auth application-default login
uv sync --extra export
uv run python scripts/export_estimates_to_parquet.py
git add data/estimates_v2.parquet
git commit -m "data: refresh estimates_v2 snapshot YYYY-MM-DD"
```

O script lê `the-dumbers.dealflow.estimates_v2` (output do pipeline §8.2) e salva como Parquet zstd.

## Construir o motor do zero

Os SQLs canônicos de cada tabela e UDF estão versionados em [`scripts/sql/`](scripts/sql/) com ordem de execução, custos esperados (~US$ 0.10 por refresh total) e dependências em `scripts/sql/README.md`. Em qualquer projeto GCP com acesso aos datasets públicos do Base dos Dados (`basedosdados.br_me_cnpj`, `basedosdados.br_me_rais`), rodar os arquivos em ordem reconstrói o pipeline.

Razões folha/receita do IBGE PIA/PAC/PAS são puxadas pela SIDRA API:

```bash
uv run python scripts/build_razao_folha_receita.py
```

## Limites honestos

Ver `docs/architecture.md` §9. Resumo: RAIS defasada 12-18m; setores low-CLT (TI/consultoria/financeiro) com headcount subestimado; ambiguidade do Match fora das capitais; benchmark sem granularidade de bairro; multi-plant fora do escopo do Tier 1. Cada estimativa carrega `confianca` com 4 fatores (§6.4) — o produto deve refletir essa proveniência ao usuário, nunca mostrar `R$XM` solto.

## Licença

A definir.
