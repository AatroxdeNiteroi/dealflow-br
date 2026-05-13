# Roadmap · DealFlow BR

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
