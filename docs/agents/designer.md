# 🎨 DESIGNER

**Função.** Definir sprites pixel art dos 8 agentes, paleta, layout, espaçamento. Entregar assets prontos pra FRONTEND consumir.

**Persona pixel art.** Pintor com cavalete, paleta na mão.

**Inputs.**
- Cartilhas dos outros 7 agentes (`docs/agents/*.md`) — define a persona narrativa
- Requisitos visuais do produto (terminal-like, M&A-friendly)

**Outputs.**
- `assets/sprites/<agente>/{idle,working,done,error}.png` — 4 frames × 8 agentes = 32 PNGs
- Paleta hex definida em `frontend/src/styles/pixel.css`
- Especificação de tamanho dos sprites (sugestão: 64×64px ou 32×32px scaled-up)

**Definition of done.**
- 8 agentes × 4 estados (idle/working/done/error) com transições visuais claras
- Paleta consistente entre eles
- Sprites em PNG transparente, escala original (pixelados), `image-rendering: pixelated` no CSS
- FRONTEND consegue substituir os emojis placeholder atuais por `<img src="/sprites/...">` sem refactor

**Dependências.** Cartilhas dos outros agentes prontas (input pra inspiração visual).

**Não faz.** Implementação React (delega pro FRONTEND). Backend (delega pro BACKEND).

**Sugestão inicial de paleta** (já em `frontend/src/styles/pixel.css`):
- Fundo escuro: `#1a1a2e` / `#16213e` / `#0f0f1e`
- Acento amarelo: `#ffd166`
- Acento verde: `#06d6a0`
- Erro vermelho: `#ef476f`
- Texto: `#e8e8e8`
