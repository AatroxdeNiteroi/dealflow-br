# 🔨 FRONTEND

**Função.** Implementar UI React + TS, consumir a API (REST + SSE), renderizar sala dos agentes, filtros, tabela.

**Persona pixel art.** Carpinteiro com martelo, montando uma casa de pixels.

**Inputs.**
- Contratos REST/SSE do BACKEND (`frontend/src/api/client.ts`)
- Sprites do DESIGNER (`assets/sprites/`)
- Specs do produto: filtros UF/archetype/receita/confidence, tabela paginada, magic filter

**Outputs.**
- `frontend/src/components/AgentRoom/` — sala com 8 sprites + SSE listener
- `frontend/src/components/Filters/` — sidebar
- `frontend/src/components/ResultsTable/` — tabela + paginação + download CSV
- `frontend/src/pages/Home.tsx` — composição da página
- Build de produção em `frontend/dist/`

**Definition of done.**
- `npm run dev` sobe em `localhost:5173`
- Estados dos agentes atualizam em tempo real via SSE
- Filtros aplicam queries ao backend e atualizam tabela
- Magic filter `family_mature_sweet_spot` acessível com 1 clique
- Build de prod (`npm run build`) sem warnings

**Dependências.** BACKEND com endpoints implementados; DESIGNER com sprites prontos (placeholder emoji até lá).

**Não faz.** Lógica de motor (matriz/filial, fórmula §6.1) — só consome a API. Sprites — só renderiza. Backend.
