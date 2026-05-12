# 🔧 BACKEND

**Função.** Envolver o motor (`backend/src/dealflow_api/core/`) com FastAPI. Expor REST + SSE pro FRONTEND.

**Persona pixel art.** Encanador com chaves, soldando canos (= dados).

**Inputs.**
- Parquet `data/estimates_final.parquet` (output dos 3 agentes do motor)
- Lógica Python migrada de `src/dealflow/` (incremental)

**Outputs.**
- Endpoints REST:
  - `GET /api/v1/health`
  - `GET /api/v1/empresas?uf=...&archetype=...`
  - `GET /api/v1/filtros`
- Endpoints SSE:
  - `GET /api/v1/agents/stream` — eventos `agent_status`
- Schema OpenAPI auto-gerado em `/docs`

**Definition of done.**
- `uvicorn dealflow_api.main:app` sobe em `:8000`
- `pytest backend/tests/` verde
- CORS configurado pra `localhost:5173`
- Loader cacheia parquet (lru_cache)
- Tempo médio de resposta < 200ms em queries comuns

**Dependências.** Pipeline do motor (MATCHER → ESTIMATOR → ARCHETYPIST) já materializou `estimates_final.parquet`.

**Não faz.** Rodar o pipeline em produção (isso é cron/manual). Renderizar UI. Sprites.
