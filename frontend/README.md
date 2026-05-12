# DealFlow BR — frontend (React + Vite + TS)

UI do produto. Consome o `backend/` via REST + SSE.

## Agentes residentes aqui

- 🎨 **DESIGNER** — sprites, paleta, layout
- 🔨 **FRONTEND** — implementação React/TS

Cartilhas: `docs/agents/{designer,frontend}.md`.

## Dev local

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Proxy automático pra `http://localhost:8000` em `/api/*` (ver `vite.config.ts`).

## Estrutura

- `src/api/` — cliente HTTP + SSE
- `src/components/AgentRoom/` — sala pixel art com 8 agentes
- `src/components/Filters/` — sidebar de filtros (UF, archetype, etc.)
- `src/components/ResultsTable/` — tabela das empresas
- `src/components/ui/` — primitives (Button, Card...)
- `src/hooks/` — `useAgentStatus`, `useEmpresas`
- `src/types/api.ts` — contratos TypeScript com backend
- `src/pages/Home.tsx` — página principal
