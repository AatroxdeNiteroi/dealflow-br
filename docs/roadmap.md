# Roadmap · Genesis Radar

## Concluído

### Fase 5 (2026-05-13)
- **Histórico / série temporal real** · sparkline de headcount ano-a-ano no DetailModal
- **Mapa de grupo · sócios em comum** · SociosPanel + GroupModal, descoberta de holdings
- **AI search · busca em linguagem natural** · Claude Haiku 4.5 com tool-use forçado

### Fase 6 (2026-05-13)
- **Contato oficial · endereço + telefones + email** · ContatoPanel no DetailModal com links rápidos (tel:, mailto:, Google Maps, LinkedIn search, Google search)
- **Watchlist funcional** · localStorage CRUD, header desbloqueado com contador
- **Status workflow M&A** · Lead → Contatado → NDA → DD → Walk-away com modal de transição
- **Histórico de contato** · ao passar para Contatado, registra canal (telefone/email/LinkedIn/apresentação/outro) + data + nota livre

### Fase 7 (2026-05-13)
- **Universo expandido · Tier 2 high-confidence** · `matches_universe_v1` (Tier 1 + Tier 2 score 3/3) é nova fonte unificada; Tier 2 score 2/3 removidos por design; ~+10k empresas com history/socios/contato
- **Export CSV refinado** · `utils/csv.ts` com separador `;`, BOM UTF-8 (Excel pt-BR), CRLF, headers em pt-BR, números formatados, CNPJ máscara
- **Export PDF one-pager** · `utils/pdf.ts` com jsPDF + autoTable; botão no DetailModal gera PDF premium com KPIs, timeline real, contato e quadro societário

### Fase 8 — Landing pública (2026-05-22 / 23)
- **Portal Genesis Radar** · Gateway com logo SVG nativo + véu + CTA "Quero conhecer o produto" sobre o campo WebGL persistente
- **Capítulo 1 · Hero do radar** · campo de ~2.772 pontos, varredura instrumento, hover de cursor, jornada de scroll de 760vh dirigindo `PointField.setJourney`
- **Capítulo 2 · Convergência** · dossiê + enxame de motes públicos convergindo, legenda "Fontes públicas oficiais", desfecho reforçado
- **Capítulo 3 · A estimativa** · faixa de ±15% (mín · estimativa · máx), selo "Fonte pública oficial · auditável", desfecho com claim de unicidade
- **Capítulo 4 · O universo** · recuo de câmera, contagem `46.255` em count-up, header/footer ressurgem
- **Capítulo 5 · Os planos** · alternador mensal/semestral/anual (desconto progressivo 0/15/25%) + 3 cards que caem de cima (bento: barato e caro ladeiam, intermediário em destaque cai por último). Preços PLACEHOLDER
- **Capítulo 6 · Como funciona** · infográfico de 3 colunas (grade de wordmarks IBGE/RFB/CVM/CAGED/Portal da Transparência/Comex Stat → instrumento radar com sweep → mini-dossiê de saída com selo de confiança), setas douradas conectando
- **Capítulo 7 · Quem usa o radar** · bento de depoimentos (1 grande + 2 pequenos). Conteúdo PLACEHOLDER — trocar por reais antes de publicar (CDC art. 37)
- **Capítulo 8 · Perguntas frequentes** · FAQ accordion nativo `<details>` em 2 colunas, 6 perguntas honestas ancoradas em `methodology.md`
- **Header da landing** · marca + Ver planos (primário, scrolla para os planos) + Boletim (placeholder p/ captura de e-mail) + Nossa história + Criar conta + Fazer login. Footer com legal + Fale conosco
- **Notificação de entrada** redesenhada (cartão escuro, marcas de instrumento nos cantos, mensagem clara de "role até o fim", saída rápida)
- Arquitetura completa em `frontend/src/landing/ROADMAP.md` · diário de tarefas em `to-do-lists/`

## Planejado

### Fase 9 — Auth + paywall
- Stack: roll-your-own no FastAPI com `fastapi-users[sqlalchemy]` + JWT em cookie HTTP-only + SQLite (early) → Postgres. Email transacional via Resend. Stripe Checkout + Customer Portal para pagamentos (Fase D)
- Plano detalhado e fases A/B/C/D em **`docs/site-architecture.md`** (doc-first: toda mudança no sistema deve passar por esse documento)

## Backlog avaliado · não priorizado

- **Confidence drill-down clicável** — modal pequeno mostrando os 3 sinais
  (identidade Tier, benchmark, granularidade) quando clica na pill. Cumpre a
  promessa de "rastreabilidade institucional" da página de Metodologia.
  Custo baixo, ganho médio em credibilidade.

- **Watchlist server-side** — hoje é localStorage. Para multi-device ou
  multi-user, precisa Postgres + auth. Próximo salto quando houver mais
  de um usuário ativo.

- **Export PDF/teaser one-pager** — gerar PDF formatado da empresa
  selecionada para enviar a investidores/clientes. Polimento.

- **Alertas/triggers** — notificação quando empresa muda de capital,
  novo sócio, etc. Demanda backend complexo de monitoramento.

## Backlog rejeitado · vanity

- Universe view bubble chart gigante — bonito em demo, raramente vira
  ferramenta de trabalho.
- Activity feed estilo SaaS B2C — engagement dopamine, M&A boutique não
  precisa.
- Sistema de envio de email pelo app — Salesforce-clone, profissional
  usa email próprio.
- Templates / mail merge — idem.
- Campos custom / tags — over-engineering pra produto enxuto.
