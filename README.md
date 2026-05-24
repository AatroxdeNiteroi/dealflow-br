# Genesis Radar

> **Empresa**: Genesis Labs Ltda. · **Produto**: Genesis Radar.
> O repositório, o nome do pacote Python (`dealflow_api`), o diretório local
> (`dealflow-br/`) e o prefixo de variáveis de ambiente (`DEALFLOW_*`) foram
> mantidos com o nome antigo para evitar breaking changes em setups
> existentes. Branding visível, documentos legais e copy de produto já
> refletem o rebranding (commit `rename:` no histórico).

Motor de estimativa de faturamento para Ltdas de médio porte em **RJ/SP**,
baseado em cruzamento das bases públicas Receita Federal CNPJ + RAIS
(Estabelecimentos + Vínculos) + IBGE PIA/PAC/PAS. Metodologia canônica em
[`docs/architecture.md`](docs/architecture.md) (v3.1) + decisões aplicadas
e validação em [`docs/methodology.md`](docs/methodology.md).

> Por que existe: empresas Ltda. brasileiras não publicam faturamento (sigilo
> fiscal, art. 198 CTN), e bureaus pagos entregam faixas opacas. Este motor
> reconstrói a estimativa a partir de fontes públicas, com metodologia
> auditável — cada número rastreável até a fonte primária.

---

## Quickstart local · "um amigo clona e roda"

O produto tem dois processos: backend FastAPI (porta 8000) + frontend Vite
(porta 5173, faz proxy de `/api` pro backend).

### 1. Pré-requisitos

| Ferramenta | Para quê | Como instalar (Windows) |
|---|---|---|
| **uv** | Gerenciador Python | `winget install astral-sh.uv` ou `irm https://astral.sh/uv/install.ps1 \| iex` |
| **Node.js 20+** | Frontend Vite | `winget install OpenJS.NodeJS.LTS` |
| **gcloud SDK** | Acesso ao BigQuery (regenerar parquets) | `winget install Google.CloudSDK` |
| **Git** | Clone | `winget install Git.Git` |

macOS/Linux: `brew install uv node google-cloud-sdk git` ou equivalente.

### 2. Clonar e instalar dependências

```powershell
git clone https://github.com/AatroxdeNiteroi/dealflow-br.git
cd dealflow-br

# Backend (Python)
uv sync --extra export   # `--extra export` instala google-cloud-bigquery (necessário p/ regenerar dados)

# Frontend (Node)
cd frontend
npm install
cd ..
```

### 3. Autenticar no GCP (para regenerar dados privados)

```powershell
gcloud auth application-default login    # abre navegador
gcloud config set project the-dumbers
```

> ⚠️ Você precisa de acesso ao projeto BigQuery `the-dumbers`. Pedir o
> bind IAM ao DPO/owner. Sem isso, só o parquet versionado funciona — os
> dados de sócios/contato/headcount-histórico ficam vazios.

### 4. Configurar segredos locais

Crie `dealflow-br/.env.local` (ignorado pelo Git, linha 34 do `.gitignore`):

```env
# Salt persistente para HMAC-SHA256 dos socio_keys (LGPD).
# Gere com: openssl rand -hex 32 (ou PowerShell: ver step 5)
# ⚠️ Trocar invalida todos os socio_keys já gerados.
DEALFLOW_SOCIOS_SALT=<cole_a_salt_do_vault_aqui>
```

E `dealflow-br/backend/.env` (ignorado pela linha 33):

```env
# Chave Anthropic para a Busca com IA (POST /api/v1/search/ai)
# Pegue em console.anthropic.com → Settings → API Keys.
DEALFLOW_ANTHROPIC_API_KEY=sk-ant-...
```

### 5. Gerar a salt (se você não tem uma)

Se for o primeiro setup do projeto **na sua organização**, gere uma e guarde
no vault corporativo (1Password / Bitwarden / Secret Manager):

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$salt = ($bytes | ForEach-Object { '{0:x2}' -f $_ }) -join ''
$salt  # ← cole no vault E no .env.local acima
[Environment]::SetEnvironmentVariable("DEALFLOW_SOCIOS_SALT", $salt, "User")
```

Bash equivalente:
```bash
salt=$(openssl rand -hex 32)
echo $salt   # cole no vault E no .env.local
echo "export DEALFLOW_SOCIOS_SALT=$salt" >> ~/.zshrc   # ou ~/.bashrc
```

### 6. Gerar os parquets privados (uma vez)

Os parquets com PII (`socios_index`, `contato`, `headcount_history`) não vão
pro Git público. Gere localmente do BigQuery:

```powershell
$env:DEALFLOW_SOCIOS_SALT="<sua_salt>"   # carrega no shell atual

uv run python scripts/export_socios_index.py        # ~3 MB · sócios pseudonimizados
uv run python scripts/export_contato.py             # contato oficial (CNPJ)
uv run python scripts/export_headcount_history.py   # série de vínculos
```

Se você só quer ver a UI funcionando e não tem GCP, **pule este passo** — o
produto degrada bem: lista de empresas, KPIs, filtros e estimativas
funcionam todos com `data/estimates_final.parquet` (versionado no repo). Só
o painel de "Quadro societário", "Contato oficial" e o sparkline histórico
ficam vazios.

### 7. Subir os dois servidores

**Caminho fácil** (Windows · abre 2 janelas):
```powershell
.\start.bat
```

**Manual** (cada um no seu terminal):
```powershell
# Terminal 1 — backend
cd dealflow-br/backend
uv run python -m uvicorn dealflow_api.main:app --reload --port 8000

# Terminal 2 — frontend
cd dealflow-br/frontend
npm run dev
```

Abra **http://localhost:5173** no navegador. O Vite faz proxy de `/api`
para `http://localhost:8000` (config em `frontend/vite.config.ts`).

### 8. Verificar que tudo subiu

```powershell
# Backend
curl http://localhost:8000/api/v1/stats        # 200 + JSON com total_empresas, by_archetype etc

# Frontend
# Abra http://localhost:5173 — Dashboard deve mostrar contagem ~46.000 empresas,
# 4 KPIs preenchidos, donut de archetypes, e tabela "Resultados" com linhas.
```

---

## O que está dentro

| Caminho | Conteúdo |
|---|---|
| `backend/` | FastAPI · API REST consumida pelo frontend |
| `backend/src/dealflow_api/data/loader.py` | **Single source of truth do escopo** (Ltda + ≤250M + sem holdings) |
| `frontend/` | React + Vite multi-page · UI |
| `frontend/src/landing/` | Landing pública (`landing.html`) — jornada cinematográfica em 8 capítulos · ROADMAP próprio em `frontend/src/landing/ROADMAP.md` |
| `data/estimates_final.parquet` | Universo curado (46.255 LTDAs após escopo) |
| `data/reference/` | Tabelas curadas (razão folha/receita, faixa pessoal PIA, benchmarks salariais) |
| `data/sample/matches_sa_abertas.csv` | Amostra de validação contra DRE pública |
| `data/cvm_cache/handcurated_dre.json` | 104 cases hand-curated p/ validação consolidada |
| **`detalhes/`** | **Documentação técnica completa — fórmula, fontes, tabelas, classificações, alavancas, validação, glossário** |
| `docs/architecture.md` | Metodologia v3.1 (canônica) — fórmula, archetypes, estado |
| `docs/methodology.md` | Decisões aplicadas + validação medida + alavancas de precisão + sinais de risco (PGFN etc.) |
| `scripts/refresh_pgfn.py` | Baixa e processa Dívida Ativa da União (PGFN, trimestral, ~1.3GB). Gera `data/pgfn_divida_ativa.parquet`. |
| `docs/site-architecture.md` | **Arquitetura do site (landing + app + auth + paywall)** · doc-first: toda mudança aqui antes de subir |
| `docs/lgpd-context-dossier.md` | Contexto LGPD completo + DPO/Encarregado |
| `src/dealflow/` | Lógica Python pura (fórmula, lookups, types) |
| `scripts/sql/` | SQLs canônicos do pipeline BigQuery |
| `scripts/export_*.py` | Exportadores BQ → parquet |
| `scripts/validation/` | Validadores vs DRE pública (CVM + hand-curated) |

## Distribuição empírica (após escopo)

| Recorte | N empresas |
|---|---|
| **Universo do produto** (Ltda + ≤R$250M + sem holdings) | **46.255** |
| `archetype = standard` | 33.179 (71,7%) |
| `archetype = family_mature_sweet_spot` (magic filter) | 5.395 (11,7%) |
| `archetype = labor_intensive_midcap` | 4.702 (10,2%) |
| `archetype = partnership_heavy_services` | 1.607 (3,5%) |
| `archetype = recent_startup` | 697 (1,5%) |
| `archetype = financeiro_out_scope` | 485 (1,0%) |
| `archetype = capital_intensive` | 190 (0,4%) |

**Validação consolidada (vs DRE pública + CVM + hand-curated, n=125):**
mediana de erro **22,8%** · **54% dentro de ±25%**. Detalhes e cauda em
[`docs/methodology.md`](docs/methodology.md) §3.

## Stack

- **Backend**: FastAPI + Pydantic + Polars + Anthropic SDK (Busca com IA)
- **Frontend**: React 18 + Vite 5 + Framer Motion + Recharts
- **Dados**: Parquet (zstd) + BigQuery (`the-dumbers.dealflow.*`)
- **Auth**: API key via header `X-Api-Key` (opcional em dev) · ADC Google

## Regenerar o parquet principal a partir do BigQuery

```powershell
uv run python scripts/export_estimates_to_parquet.py
# data/estimates_final.parquet refresh
```

O script lê `the-dumbers.dealflow.estimates_final` (output do pipeline,
ver `scripts/sql/12_estimates_final.sql`) e salva como Parquet zstd.

## Construir o motor do zero (BigQuery)

SQLs canônicos em [`scripts/sql/`](scripts/sql/), com ordem de execução e
custos esperados (~US$ 0.10 por refresh total). Em qualquer projeto GCP com
acesso aos datasets do Base dos Dados (`basedosdados.br_me_cnpj`,
`basedosdados.br_me_rais`), rodar os arquivos em ordem reconstrói o
pipeline.

Razões folha/receita do IBGE PIA/PAC/PAS via SIDRA API:
```powershell
uv run python scripts/build_razao_folha_receita.py
```

## Validar contra DRE pública

```powershell
# SAs Abertas single-plant vs CVM DFP 2024 (50 empresas)
uv run python scripts/validation/validate_sa_abertas_vs_cvm.py

# Consolidado (hand-curated + CVM SA Aberta + SA Fechada) — n=125
uv run python scripts/validation/validate_consolidado_vs_motor.py
```

Lista NOME — % de desvio. Resultados detalhados em
[`docs/methodology.md`](docs/methodology.md) §3.

## Limites honestos

Ver `docs/architecture.md` §9 + `docs/methodology.md` §4. Resumo:

- RAIS defasada 12-18 meses
- Setores low-CLT (TI/consultoria/financeiro): headcount subestimado
- Ambiguidade do Match fora das capitais
- Multi-plant **fora do escopo** do Tier 1
- **Holdings excluídas do produto** após validação (erro mediano >75% no arquétipo) — single source of truth em `backend/src/dealflow_api/data/loader.py`

Cada estimativa carrega `confidence` com 4 fatores — o produto reflete essa
proveniência ao usuário, nunca mostra `R$XM` solto.

## Licença

Proprietária · todos os direitos reservados. Ver [`LICENSE`](LICENSE) — o uso
da interface hospedada é adicionalmente regido pelos Termos de Uso e pela
Política de Privacidade exibidos no rodapé do produto (LGPD art. 9º e 41).
