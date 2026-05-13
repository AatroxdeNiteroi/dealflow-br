# Roadmap · DealFlow BR

## Em curso · Fase 5

Três features escolhidas em 2026-05-13 (ordem de execução):

1. **Histórico / série temporal real**
   Substituir o Fingerprint sintético no `DetailModal` por sparkline real de
   headcount ano-a-ano. Sinal crítico de M&A — crescimento operacional é o
   diferencial de qualquer thesis. Depende de série temporal estar disponível
   no parquet (a investigar).

2. **Mapa de grupo · sócios em comum**
   Descobrir holdings escondidas e grupos familiares espalhados em CNPJs
   distintos. Num drill-down de empresa, mostrar "esse sócio aparece em N
   outras empresas — clique para ver o grupo". Requer tabela de sócios e
   endpoint de graph traversal.

3. **AI search · busca em linguagem natural**
   Campo único onde o usuário digita "fabricantes de embalagens em Diadema
   com 50-100 funcionários e dono próximo da aposentadoria", a IA traduz em
   filtros e dispara a query. Usa Claude API com tool-use.

## Próxima fase · Fase 6

4. **Watchlist funcional + status workflow**
   Hoje o link está no header como placeholder. Salvar lista por usuário com
   status (Lead → Contatado → NDA → DD → Walk-away) + notas livres.
   Persistência inicial em localStorage (entrega em 1 dia); server-side
   quando houver multi-device/multi-user.

   _Adiada por decisão do dono em 2026-05-13: essencial, mas o salto de
   valor depende de implementar primeiro as três features acima._

## Backlog avaliado · não priorizado

- **Confidence drill-down clicável** — modal pequeno mostrando os 3 sinais
  (identidade Tier, benchmark, granularidade) quando clica na pill. Cumpre a
  promessa de "rastreabilidade institucional" da página de Metodologia.
  Custo baixo, ganho médio em credibilidade.

## Backlog rejeitado · vanity

- Universe view bubble chart gigante — bonito em demo, raramente vira
  ferramenta de trabalho.
- Activity feed estilo SaaS B2C — engagement dopamine, M&A boutique não
  precisa.
