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

A UI abre em `http://localhost:8501` lendo `data/estimates_v3.parquet` (~70k grupos Tier 1 já calculados, com agregação multi-plant). Filtros disponíveis na sidebar: UF, confiança, faixa de receita estimada, archetype, headcount, idade da empresa, capital social mínimo, estrutura do grupo (single-plant / multi-plant / interestadual), busca por razão social/CNPJ.

## O que está dentro

| Caminho | Conteúdo |
|---|---|
| `app.py` | UI Streamlit — filtros de produto + tabela + download CSV |
| `data/estimates_v3.parquet` | **69.941 grupos** com receita agregada multi-plant + archetype + sinais Receita |
| `docs/architecture.md` | Metodologia v3.1 (canônica) — §6 fórmula, §6.5 archetypes, §10 estado atual |
| `src/dealflow/` | Lógica Python pura (formula §6.1, lookups, types) |
| `scripts/` | Builders (razão folha/receita do IBGE) + exporter (BQ → parquet) |
| `data/reference/` | Tabelas curadas (razão folha/receita, faixa pessoal PIA 1839) |

## Distribuição empírica (snapshot 2026-05-11, estimates_v3)

| Recorte | N grupos |
|---|---|
| Tier 1 total (matriz RJ/SP confirmada) | 69.941 |
| **Multi-plant (matriz + filiais BR)** | **12.931 (18,5%)** |
| Multi-plant com filial fora de RJ/SP | 4.163 |
| Confiança alta + média | 40.598 |
| `archetype = family_mature_sweet_spot` (magic filter) | ~8.000 |
| `archetype = labor_intensive_midcap` | ~8.100 |
| `archetype = standard` | ~42.000 |

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
