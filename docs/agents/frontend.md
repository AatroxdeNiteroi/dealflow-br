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

---

## Sub-experiência: landing pública

O frontend agora hospeda duas experiências distintas no mesmo bundle Vite multi-page:

| Entry          | Pasta                                | Linguagem visual                                         |
|----------------|--------------------------------------|----------------------------------------------------------|
| `index.html`   | `frontend/src/` (fora de `landing/`) | App de M&A (filtros, tabela, modais) — registro pixel/HUD. |
| `landing.html` | `frontend/src/landing/`              | Landing cinematográfica — editorial/instrumento (Playfair + Inter + Plex Mono + paleta paper/marrom/dourado). |

A landing é **uma jornada de scroll em 8 capítulos sobre um campo WebGL persistente** (GSAP + ScrollTrigger + Lenis + Three.js). Arquitetura, decisões de design e tarefas em curso vivem em **`frontend/src/landing/ROADMAP.md`** — esse é o doc de cabeceira ao mexer na landing.

**Quando mexer:**
- Em qualquer mudança visível na landing, leia o `ROADMAP.md` da landing antes.
- Em mudança de auth, rotas, gate de acesso ao app, ou modelo de monetização, leia/atualize `docs/site-architecture.md` (doc-first).
- Tarefas mapeadas entre sessões estão em `to-do-lists/dia-N.md`.
