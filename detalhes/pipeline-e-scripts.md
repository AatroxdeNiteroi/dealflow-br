# Pipeline e scripts

O pipeline BigQuery que constrói os dados e o inventário de todos os
scripts Python.

---

## Pipeline BigQuery (`the-dumbers.dealflow.*`)

Executado uma vez por ano-base RAIS (anual) + snapshot Receita (mensal).
Custo: ~US$ 0,10 por refresh total. SQLs canônicos em `scripts/sql/`.

### Ordem de execução

```
01_receita_universe   ─┐
02_rais_universe      ─┤
                       ├─► 03_matches ──┐
04_benchmark_salarial ─┤                │
05_socios_summary     ─┘                ├─► 06_estimates_v1 ─► 07_estimates_v2
                                        │                       (+ archetype)
razao_folha_receita ───────────────────┘
                                        │
11_matches_tier2 ───────────────────────┤
13_matches_universe ────────────────────┘
                                        │
                                        ▼
                            12_estimates_final  ◄── produto final
```

### Tabelas BigQuery principais

| Tabela | Linhas | Conteúdo |
|---|---|---|
| `receita_universe_v1` | ~1,6M | Universo Receita filtrado (ativa, RJ/SP, matriz, não-Simples) |
| `rais_universe_v1` | ~179.566 | Universo RAIS Estab filtrado (5+ funcs) |
| `matches_v1` | ~72.813 | Tier 1 — chave composta única |
| `matches_tier2_v1` | ~9.345 | Tier 2 — desempate por cascata |
| `benchmark_salarial_v1` | ~70.000 | Salário CNAE×município RJ/SP |
| `razao_folha_receita_v1` | 308 | 3 camadas L1/L2/L3 |
| `razao_by_size_v1` | 24 | Faixa de pessoal (PIA 1839) |
| `socios_summary_v1` | por cnpj_basico | Agregados de sócios |
| **`estimates_final`** | **59.807** | **Produto final · single-plant Tier 1+2 + plausibilidade** |

> `estimates_v3` (multi-plant) existe como artefato exploratório mas
> **não faz parte do produto** — a agregação multi-plant falhou na
> validação (erro >100%).

### UDFs BigQuery

| UDF | Retorna |
|---|---|
| `cnae_secao(cnae)` | seção A-U |
| `faixa_pessoal(headcount)` | label da faixa PIA 1839 |
| `encargos_low(secao)` / `encargos_high(secao)` | multiplicadores de encargo |
| `tamanho_for_headcount(headcount)` | código RAIS de tamanho |

## Scripts Python

### Build / export (`scripts/`)

| Script | Função |
|---|---|
| `build_razao_folha_receita.py` | Constrói `razao_folha_receita_2023.csv` via SIDRA |
| `build_receita_por_pessoa.py` | Constrói `receita_por_pessoa_2023.csv` (alavanca 1) via SIDRA |
| `export_estimates_to_parquet.py` | BigQuery `estimates_final` → parquet local |
| `export_socios_index.py` | BigQuery → `socios_index.parquet` (HMAC dos sócios) |
| `export_contato.py` | BigQuery → `contato.parquet` |
| `export_headcount_history.py` | BigQuery → `headcount_history.parquet` |
| `estimate_sample.py` | Roda a fórmula numa amostra (debug) |
| `plot_match_tiers.py` | Visualização da distribuição de tiers |

### Validação (`scripts/validation/`)

| Script | Função |
|---|---|
| `validate_final_vs_dre.py` | 104 cases hand-curated vs motor |
| `validate_sa_abertas_vs_cvm.py` | SAs Abertas vs DRE CVM 2024 |
| `validate_consolidado_vs_motor.py` | Agrega hand-curated + CVM, MOTOR vs PRODUTO |
| `validate_v3_vs_dre.py` | Validação da v3 multi-plant (legado) |

### Validação ativa (`scripts/active_validation/`)

| Script | Função |
|---|---|
| `scrape_cvm_fato_relevante.py` | Scraper de Fatos Relevantes CVM (aquisições M&A) |
| `match_active_with_tier1.py` | Cruza ground truths com Tier 1 |
| `scrape_portal_transparencia.py` | **Alavanca 2** — contratos federais por CNPJ |
| `build_federal_from_cache.py` | Gera JSON federal do cache incremental |
| `scrape_comex_stat.py` | **Alavanca 3** — exposição exportadora |
| `teste_final.py` | Teste consolidado · 3 fontes → lista NOME-% |

### Pipeline SQL (`scripts/sql/`)

13 arquivos numerados `01`–`13` + pasta `udfs/` + pasta `diagnostics/`.
`scripts/sql/README.md` documenta a ordem e custos.

## Backend (FastAPI)

`backend/src/dealflow_api/`:

| Módulo | Função |
|---|---|
| `main.py` | App FastAPI + middlewares |
| `api/routes.py` | Endpoints REST (`/empresas`, `/stats`, `/filtros`, `/socios`…) |
| `data/loader.py` | **Coração runtime** — carrega parquet, aplica escopo, calibração de incerteza, alavanca PIA, piso federal |
| `agents/ai_search.py` | Busca com IA (tradução de prompt → filtros via Claude) |
| `settings.py` | Configuração via env vars (prefixo `DEALFLOW_`) |
| `security.py` | Middleware de API key + rate-limit |

### Ordem de processamento no `loader.py`

```
load_estimates():
  1. _apply_scope()                  → filtra universo do produto
  2. _apply_uncertainty_calibration()→ alarga intervalo + ajusta confidence
  3. _apply_pia_second_estimate()    → alavanca 1 (selo de convergência)
  4. _apply_federal_floor()          → alavanca 2 (piso de contratos)
```

## Frontend (React + Vite)

`frontend/src/` — React 18 + Vite 5 + Framer Motion + Recharts.
Consome a API REST do backend. Componentes principais: dashboard, screener,
watchlist, modais de detalhe/legal, busca com IA.
