# DealFlow BR — backend

FastAPI envelopando o motor (`core/`) e expondo:
- REST: `/api/v1/empresas`, `/api/v1/filtros`, `/api/v1/health`
- SSE: `/api/v1/agents/stream` — eventos de status dos agentes do motor

## Agentes residentes aqui

- 🕵️ MATCHER — `src/dealflow_api/agents/matcher.py`
- 🧮 ESTIMATOR — `src/dealflow_api/agents/estimator.py`
- 🦉 ARCHETYPIST — `src/dealflow_api/agents/archetypist.py`

Cartilhas: `docs/agents/<nome>.md`.

## Dev local

```bash
cd backend
uv sync
uv run uvicorn dealflow_api.main:app --reload --port 8000
```
