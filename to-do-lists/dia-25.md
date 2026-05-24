# Dia 25 — 25 de maio de 2026

> Tarefas mapeadas na sessão do dia 24 para a próxima sessão.
> Tema: fechar o ciclo de sinais de risco e levar o argumento competitivo para a landing.
> Contexto: ver `docs/methodology.md` §3-ter (sinais de risco) e `docs/site-architecture.md`.

Na sessão do dia 24 foi entregue a camada de sinais de risco com fontes
públicas oficiais, em paridade com o produto Consulta Completa do Serasa:

- ✅ **PGFN Dívida Ativa** (federal): 22.845 LTDAs com dívida (39,9% do escopo),
  R$ 112,9 bi agregados, painel `DividaAtivaPanel` com bandeira de gravidade.
- ✅ **Datajud agregado** por UF (RJ/Falência/Extrajudicial, janela atual vs
  anterior, trend %), painel `RiscoContextoPanel`.
- ✅ **Querido Diário on-demand** (menções em DOs municipais), painel
  `DiarioOficialPanel`.
- ⏸️ **DJEN per-CNPJ** e **SEFAZs estaduais** ficaram deferred — bloqueio
  externo (API frágil / sem bulk download estadual).

A próxima sessão deve atacar **duas** frentes.

## 1 · Protestos em cartórios (a seção 3 que ficou para depois)

A seção 3 do mapeamento original (consulta a CENPROT e IEPTB) foi deixada
para depois por inviabilidade de batch — captcha em cada consulta. Hora de
fazer da forma certa: **on-demand**, com o mesmo padrão arquitetural do
Querido Diário, e com solver de captcha pago.

**Fazer:**

- **Investigar o estado atual do CENPROT** (`cenprot.org.br`) — verificar
  se há API institucional via parceria, ou se segue só consulta web com
  captcha. Tentar também IEPTB-SP (`ieptb.org.br`) e os IEPTBs estaduais
  maiores (RJ, MG).
- **Se permanecer só consulta com captcha:**
  - Integrar um serviço de captcha solver — **2Captcha** ou **Anti-Captcha**
    (~US$ 2 / 1.000 captchas resolvidos). Conta separada, chave em
    `.env.local` (`CAPTCHA_API_KEY`).
  - Implementar `scripts/consulta_cenprot.py` (callable function, não batch)
    que recebe um CNPJ, resolve captcha, faz scrape do resultado da CENPROT.
  - Endpoint `GET /api/v1/empresas/{cnpj}/protestos` (sempre 200, com
    `disponivel: false` quando o solver falha).
  - Painel `ProtestosPanel.tsx` no DetailModal — mesma estética dos demais
    paineis de risco (bandeira verde/amarela/laranja/vermelha por valor
    protestado ou número de protestos).
  - Cache no backend via `lru_cache` para não pagar 2× o mesmo CNPJ.
- **Considerações de custo:** com cache, ~R$ 0,01 por consulta nova.
  Sustentável para o produto. Documentar em `docs/methodology.md` §3-ter
  como "✅ on-demand (custo por consulta nova)".
- Atualizar `docs/methodology.md` §3-ter substituindo a linha ⏳ muito
  depois por ✅ em produção.

## 2 · Incorporar os sinais de risco na landing

A landing atual fecha o argumento de produto em estimativa de faturamento
(Cap. 1–5) e mostra como funciona o cruzamento (Cap. 6). Mas **não menciona
em lugar algum a nova camada de risco** que cobre o que o Serasa cobra
R$ 45 por consulta. É a peça que falta para o argumento competitivo direto.

**Fazer:** uma nova seção/capítulo na landing apresentando os sinais de
risco, com comparativo direto (sem citar marca por compliance).

**Decisões de design a tomar:**

- **Onde inserir?** Três opções:
  1. **Novo capítulo cinematográfico** entre Cap. 4 (O universo) e Cap. 5
     (Os planos) — heavy lift (GSAP timeline + stage fixo, padrão dos
     Cap. 2–4).
  2. **Nova seção em fluxo normal** entre Cap. 6 (Como funciona) e Cap. 7
     (Quem usa) — mais leve, casa com o tom dos Cap. 6/7/8.
  3. **Expansão do Cap. 6** — adicionar uma 4ª coluna *"Sinais de risco"*
     ao infográfico atual.
  
  **Recomendação:** opção 2 (seção em fluxo normal) — quebra menos a
  cinematografia e permite layout mais informativo (tabela comparativa
  + 3 cards de sinal).

- **Conteúdo da seção:**
  - **Eyebrow** + **título** + **subtítulo** (padrão dos Cap. 6/7/8).
  - **3 cards de sinal** — mesma linguagem dos painéis do app:
    1. *Dívida ativa federal (PGFN)* — número grande: "39,9% das LTDAs
       têm dívida ativa · R$ 112,9 bi agregados".
    2. *Recuperações e falências (Datajud)* — número grande: "1.300+ novas
       RJs/falências no Brasil em 12 meses · variação por UF".
    3. *Menções em Diários Oficiais (Querido Diário)* — número grande: ou
       qualitativo: "Cada empresa monitorada nos DOs municipais que
       importam".
  - **Tabela comparativa edge-to-edge** (sem citar marca) com 2 colunas:
    
    | | Consulta avulsa do mercado | Genesis Radar |
    |---|---|---|
    | Cobertura por empresa | R$ 45/consulta | Ilimitado no plano |
    | Fonte | Bureau privado | 100% pública oficial |
    | Auditabilidade | Caixa-preta | Rastreável até a fonte |
    | Volume de varredura | Inviável (R$ 4.500 para 100 empresas) | Padrão (R$ 389/mês ilimitado) |
  
  - **Desfecho** (Playfair italic, padrão): *"O mesmo dado que o mercado
    cobra por consulta — auditável, no plano mensal, ilimitado."*
  
  - **Header e footer permanecem fixos** (regra estabelecida da Cap. 6/7/8).

- **Aproveitar a imagem de referência** em `fotos referencia/` para
  confirmar o que o produto avulso oferece (já mapeado item a item na
  conversa do dia 22).

- **Atualizar:**
  - `frontend/src/landing/ROADMAP.md` — novo capítulo (Cap. 6½ ou Cap. 7,
    renumerando os atuais Cap. 7/8 se for o caso).
  - `docs/roadmap.md` — Fase 8 (landing) ganha o item "Cap. de sinais
    de risco".
  - `docs/site-architecture.md` se o caminho do CTA mudar.

- **Possível ajuste na cópia do Cap. 5 (Os planos):** ao mencionar o
  plano *Varredura* e *Mesa*, incluir bullet *"+ painel de risco fiscal e
  judicial"* — vincula a nova camada à oferta paga.
