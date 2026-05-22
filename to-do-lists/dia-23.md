# Dia 23 — 23 de maio de 2026

> Tarefas mapeadas na sessão do dia 22 para a próxima sessão.
> Tema: landing page (Genesis Radar) + estratégia de mercado.
> Contexto da landing: ver `frontend/src/landing/ROADMAP.md`.

Na sessão do dia 22 foram entregues o Capítulo 5 (Os planos) e os
Capítulos 6 (Como funciona) e 7 (Quem usa o radar), além do reforço
de unicidade e fontes oficiais nos Capítulos 2 e 3. A próxima sessão
deve atacar **duas** frentes.

## 1 · Popular visualmente os Capítulos 6 e 7

Os Capítulos 6 ("Como funciona") e 7 ("Quem usa o radar") já estão
construídos e estilizados, mas com conteúdo de exemplo. São seções em
fluxo normal de scroll, ao fim da landing, depois dos planos.

**Fazer:** dar vida visual e de conteúdo definitivo aos dois.

- **Cap. 6 — Como funciona.** Revisar e enriquecer os três passos
  (`CH6_STEPS` em `frontend/src/landing/Landing.tsx`) — ícones,
  títulos e descrições. Avaliar se cabe um quarto passo, uma
  ilustração ou um visual mais forte (ex.: um diagrama do fluxo
  fonte → cruzamento → estimativa). Manter a regra: passar
  confiabilidade **sem expor o método** (a fórmula não aparece).

- **Cap. 7 — Quem usa o radar.** Os depoimentos hoje são PLACEHOLDER
  ilustrativo (`CH7_VOICES` em `Landing.tsx`) e os avatares são
  iniciais, não fotos. Substituir por depoimentos **reais e
  autorizados** + fotos reais — depoimento fabricado em site no ar é
  publicidade enganosa (CDC art. 37) e contradiz o posicionamento de
  honestidade do produto. Se ainda não houver clientes reais,
  considerar trocar ou somar prova social verdadeira: números de
  validação reais (`docs/methodology.md`), instituições públicas de
  origem dos dados (IBGE, RFB, CVM), conformidade LGPD.

## 2 · Analisar competidores para estratégias

Mapear o mercado em que o Genesis Radar compete.

**Fazer:** levantar e analisar produtos e empresas concorrentes —
quem estima faturamento ou vende dados de empresas de capital
fechado no Brasil (e referências no exterior). Para cada um,
registrar: o que oferecem, fonte de dados, modelo de preços,
posicionamento, pontos fortes e fracos.

O objetivo é extrair estratégia: onde o Genesis Radar se diferencia
(fontes públicas oficiais, auditabilidade), quais são as lacunas do
mercado, e como isso informa preço, copy da landing e o roteiro do
produto. Serve também para **validar — ou calibrar** — a afirmação de
unicidade usada nos Capítulos 2 e 3 ("nenhum outro produto reconstrói
esse número assim"): se houver concorrente equivalente, a copy
precisa ser ajustada.
