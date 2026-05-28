# Skills

Skills do Claude Code coletadas da máquina principal pra sincronizar com outro
laptop. Cada subpasta é um skill com `SKILL.md` (e opcionalmente arquivos
auxiliares) — o formato padrão que o Claude Code procura.

## Instalar no laptop novo

O Claude Code carrega skills de `~/.claude/skills/` (Linux/macOS) ou
`%USERPROFILE%\.claude\skills\` (Windows). Basta copiar o conteúdo desta pasta
pra lá.

**Windows (PowerShell):**
```powershell
New-Item -ItemType Directory -Path "$env:USERPROFILE\.claude\skills" -Force
Copy-Item -Path .\skills\* -Destination "$env:USERPROFILE\.claude\skills\" -Recurse -Force
```

**macOS / Linux:**
```bash
mkdir -p ~/.claude/skills
cp -R skills/* ~/.claude/skills/
```

Reinicie o Claude Code e os skills aparecem na lista (`/help` → seção de skills,
ou são invocáveis via `Skill` tool).

## Conteúdo (32 skills)

- **brandkit** — image gen para brand guidelines / logo systems
- **design-taste-frontend** — UI/UX engineer com regras métricas
- **frontend-design** — componentes/páginas premium (Apache 2.0)
- **full-output-enforcement** — anti-truncation
- **gpt-taste** — UX/UI + GSAP avançado (AIDA, bento, scroll)
- **gsap-{core,frameworks,performance,plugins,react,scrolltrigger,timeline,utils}** — pacote oficial GSAP
- **high-end-visual-design** — fontes/spacing/shadows tipo agência
- **image-to-code** — design image → código
- **imagegen-frontend-{mobile,web}** — mocks de tela para mobile/web
- **industrial-brutalist-ui** — estética declassified blueprint
- **minimalist-ui** — editorial monochrome
- **redesign-existing-projects** — upgrade de sites existentes
- **stitch-design-taste** — DESIGN.md para Google Stitch
- **threejs-{animation,fundamentals,geometry,interaction,lighting,loaders,materials,postprocessing,shaders,textures}** — pacote Three.js
- **vercel-react-best-practices** — perf React/Next da engenharia Vercel

## Origem

Esses skills vinham de `~/.agents/skills/` na máquina principal (Claude Code
usa junctions de `~/.claude/skills/` apontando pra lá). Foram copiados aqui
em <!--date--> apenas para transporte entre máquinas.

Licenças individuais (quando presentes) ficam dentro de cada subpasta.
