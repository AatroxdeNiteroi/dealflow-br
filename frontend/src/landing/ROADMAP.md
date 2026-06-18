# Genesis Radar — Landing · Roadmap & Handoff

> **Estado:** 2026-06-11 · **Retomar em: depoimentos reais do Cap. 7 + "A prova" (validação CVM).**
> Landing cinematográfica do produto Genesis Radar — uma viagem de câmera
> única, dirigida por scroll, sobre um campo WebGL.

## Upgrade cinematográfico — 2026-06-18 (branch `feature/landing-cinematic`)

Camada de polimento "instrumento de precisão" sobre TODA a landing, a partir
de um sistema de movimento único. Spec completo (auditoria + direção) salvo no
output do workflow `cinematic-landing-direction`.

**Sistema de movimento (fundação):** curvas fílmicas nomeadas em `tokens.css`
(`--ease-settle/glide/expo/io/exit/anticipate` + escada `--dur-1..6`); espelhos
GSAP `rk-settle/rk-glide/rk-expo` (ids não-colidentes — nunca `expo.out`);
tokens ESCOPADOS no `.landing/.gx-gate` (elevação quente, `--halo-gold`,
família `--gold-*`, `@property --reveal/--rx/--ry/--draw/--mx/--my`) sem tocar
os `--shadow-*` globais. Regra de ouro: sobre o papel claro, ouro-como-luz =
só a linha saturada do sweep + halos box-shadow (véu de baixa-alpha mancharia).

**Feito e verificado (tsc + screenshots Playwright):**
- Motor WebGL (`PointField`): sweep saturado com cintilação viva + flare de
  pulse (GL-01); rastro carregado em ouro nos pontos varridos (GL-02); brasa
  interna + veias + corona de atmosfera com GATE DE ESCURIDÃO na esfera-empresa
  (GL-04); batimento coerente (diástole radial) + throb de FOV via acumulador
  único `applyFov` (GL-05); plumbing `fieldRef` + driver de velocidade escopado
  + `setVel`/`pulse` (MS-04).
- Gateway: emblema reestruturado, boot cinematográfico (íris do véu, espiral
  desenha, agulha calibra, sparks, palavras sobem), mergulho de entrada,
  agulha espelha o bearing vivo do campo via `--sweep-bearing` + `--boot-swing`
  (pivô no hub 66/68px) (GW-01..04).
- Overlay de auth: focus-pull (blur + vinheta), card assenta, colchetes
  encaixam por último, glow dourado no input (AX-01); toast desliza (AX-02).
- Microinterações: CTA magnético + anel "armado" + press (CR-01); sublinhado
  dourado/ícone/foco-anel-duplo no nav+footer (CR-03); colchetes de registro
  por todo lugar (BR-01).
- Capítulos: títulos Playfair sobem palavra a palavra mascarados (CH-05);
  accordion de FAQ com altura suave + espinha dourada (CH-06); tilt 3D + brilho
  nos cards ch6/chsig/ch7 (CH-08); card Varredura à frente com halo + varredura
  de luz (CH-03).
- `reduced-motion`: estados finais/acesos p/ todo elemento novo + defaults dos
  drivers escopados (RM-01).

**2ª leva (2026-06-18, mesma branch):** CH-01 (a tarja do ch3 é VARRIDA por
clip-path deixando o número nítido + agulha com overshoot + selo stamp),
CH-02 (a contagem 46.255 vira ODÔMETRO de 5 rolos), CH-09 (preço/mês ROLA
ao trocar o ciclo), CH-07 parcial (bloom + reduced-guard no sweep do ch6 +
setas que se desenham).

**Ainda diferido (mais risco / iteração visual fina):** CH-04 (rack-focus +
parallax das cenas fixas ch2-4, gate wideViewport), CR-02 (cursor reticle),
CR-04 (value labels resolve-from-blur), GL-03 (DoF na mira), GL-06 (câmera
Catmull-Rom contínua). Todos especificados no spec; travas de risco lá.

> **⚠️ Dev gotcha (custou tempo):** havia `.js` compilados ANTIGOS em `src/`
> (de um `tsc -b`/`npm run build` anterior — 2026-06-15). O Vite resolve `.js`
> ANTES de `.tsx`, então passou a servir o código velho e ignorar os `.tsx`
> editados. Sintoma: edição não aparece no dev mas `npx tsc --noEmit` passa.
> Cura: `find src \( -name '*.js' -o -name '*.js.map' -o -name '*.d.ts' \) -delete`
> e reiniciar o Vite. Use SEMPRE `npx tsc --noEmit` no dev (nunca `npm run
> build`, que recria os `.js`).

## Rodar

```
cd dealflow-br/frontend
npm run dev
```

Abrir **http://localhost:5173/landing.html** (o app do produto segue em `/`).
Verificar tipos sem emitir lixo: `npx tsc --noEmit` (NÃO usar `npm run build`
durante o dev — o `tsc -b` cospe `.js` dentro de `src/`, que são gitignored
mas atrapalham o Vite; se aparecerem, apagar com `find src -name '*.js' -delete`).

## O que está pronto

### Portal de entrada (Gateway)
- Sem header próprio — o header da landing (faixa branca: marca + Fazer
  login · Criar conta · Nossa história) cobre a fase do Gateway. O
  Gateway é só o véu + o centro.
- Centro: logo Genesis Radar **replicada nativa em SVG** (`GenesisRadarLogo.tsx`)
  — emblema (espiral de radar + agulha + faíscas) + letreiro Playfair.
- Frase-âncora + CTA **Quero conhecer o produto**. Ao clicar, uma
  notificação de scroll surge e se esvai sozinha (~5s).
- Fundo: o campo de pontos do radar, vivo, com hover do cursor.

### Capítulo 1 — Hero do radar
- Campo de ~2.772 pontos (grade uniforme com jitter) sobre papel.
- Varredura de instrumento; pontos carregados batem como coração (lub-dub).
- Cursor revela pontos por proximidade (etiquetas R$ só dentro do radar).
- HUD de instrumento (azimute), moldura de registro e cue de scroll.
  Sem manchete própria — a frase-âncora vive no Gateway.

### A jornada (transição sem emenda)
Um scroll só dirige `PointField.setJourney(0..1)`:

| Trecho de `p` | Fase | O que acontece |
|---|---|---|
| 0.00–0.42 | Mergulho | câmera desce pelo campo; pontos viram esferas 3D |
| 0.42–0.70 | Mira | câmera se aproxima de UMA empresa (esfera escolhida) |
| 0.70–0.86 | Travessia | a esfera cresce e engole o quadro (o "wipe") |
| 0.86–1.00 | Interior | dentro da empresa; a esfera segura o preto enquanto as palavras do respiro surgem em fade escalonado, e só então o interior clareia para o papel |

Portal e radar compartilham o MESMO campo — entrar não troca de tela.

### Capítulo 2 — Convergência
Depois da jornada, um segundo trecho de scroll (`.ch2-track`, 780vh) com
timeline GSAP própria. O campo fica congelado no Interior, como pano de
fundo desfocado.

- Dossiê da empresa em papel — CNPJ tarjado, `FATURAMENTO` em tarja preta.
- Dado público **anônimo e tarjado** (enxame de ~26 fragmentos, `.ch2-mote`)
  converge sobre o dossiê de toda parte. **Decisão de design:** mostra-se
  QUE o dado se reúne, nunca o que ele é nem como entra na conta — o
  método (insumos, fórmula) não aparece na página.
- Sob o eyebrow, a legenda `.ch2-sources` ("Fontes públicas oficiais")
  nomeia a *natureza* do dado que converge — posicionamento, não método.
- Desfecho: *"Nenhuma base pública declara esse faturamento. / Mas
  dezenas de fontes públicas oficiais o cercam."* O faturamento segue
  oculto — gancho para o Capítulo 3.
- 100% beat de DOM (`.ch2-*`) + GSAP; o `PointField` não foi tocado.

### Capítulo 3 — A estimativa
Terceiro trecho de scroll (`.ch3-track`, 720vh), timeline própria. A cena
do Cap. 2 sai e a da estimativa entra.

- A tarja do `FATURAMENTO` (varrida por uma linha-instrumento) finalmente
  **resolve** — dissolve, e o número entra em foco.
- O número chega como faixa de **±15%**: estimativa em destaque
  (`R$ 24,3 mi`), ladeada por mínimo (`20,7`) e máximo (`27,9`) numa
  régua, com a marca no centro.
- A fórmula NÃO aparece — decisão de design (ver Cap. 2).
- Selo `.ch3-seal` ("Fonte pública oficial · auditável") carimba a
  procedência do número logo que ele resolve.
- Desfecho: *"A precisão do mercado de elite — só com fonte pública
  oficial. / Nenhum outro produto reconstrói esse número assim."*

**Decisão de design — fundo e leitura:** a textura de papel foi removida
(fundo liso). Como os pontos do campo atrapalham a leitura, todo título e
todo texto longo sobre o campo ganha um recipiente branco (`background:
var(--paper)` + borda + sombra). Regra geral para os próximos capítulos.
O respiro do Cap. 1 segue sem caixa (texto grande sobre campo desfocado).

### Capítulo 4 — O universo
Quarto trecho de scroll (`.ch4-track`, 900vh), timeline própria. A cena
do Cap. 3 sai e a câmera **recua** — do Interior de volta à vista geral.

- `PointField.setUniverse(0..1)` (novo) recua a câmera, tira o desfoco do
  Interior e dá presença plena ao campo: as ~46 mil empresas reveladas
  de uma vez. Fecha o arco do zoom-in do Cap. 1.
- Sobre o campo, um painel branco: a contagem **46.255** sobe (count-up
  escalonado pelo scroll).
- Desfecho: *"Você esteve dentro de uma delas. / As outras 46.254 já
  estão no radar — cada uma com seu número."*
- Primeiro capítulo a estender o `PointField` (Cap. 2 e 3 não tocaram).
- **Fecho do capítulo** (cauda do `.ch4-track`): ao fim, o conteúdo do
  universo recua e header/footer ressurgem — a jornada entrega o scroll
  ao Capítulo 5. O CTA de canto "Ver planos" segue fixo até lá.

### Capítulo 5 — Os planos
Quinto trecho de scroll (`.ch5-track`, 680vh), timeline própria. Sobre o
campo inteiro (parado na vista de universo), o convite final e a oferta.

- Eyebrow "Os planos" + o convite (`.ch5-lead`) — a frase do antigo
  finale do Cap. 4, agora abrindo o capítulo.
- Alternador de ciclo `.ch5-toggle` (mensal · semestral · anual) com
  indicador deslizante; desconto progressivo sobre o preço-base
  (0% / 15% / 25%). Estado React (`period`), independe do scroll.
- Três cards `.ch5-card` que **caem de cima**: o mais barato (`--a`,
  esquerda) e o mais caro (`--c`, direita) entram primeiro; o
  intermediário em destaque (`--b`, centro — fundo escuro + selo
  "Recomendado") cai por último no vão central.
- Beat de DOM puro; o `PointField` não foi tocado.
- **Preços decididos** (`docs/site-architecture.md`, Fase D): Sinal
  R$ 149/mês e Varredura R$ 389/mês são os valores finais, batendo com
  os preços do Stripe (`scripts/stripe_seed.py`). Só o display de Mesa
  (R$ 899/mês) segue a confirmar — venda assistida, sem checkout.
- Os 3 CTAs dos cards estão wired ao fluxo de cadastro/checkout — ver
  "Overlay de auth (conta e acesso)" abaixo.
- Em tela ≤720px ou `reduced-motion` o capítulo deixa de ser cena fixa e
  vira seção estática rolável (cards empilhados); a coreografia de scroll
  só roda em tela larga (`wideViewport`).

### Capítulo 6 — Como funciona
Primeira seção em **fluxo normal de scroll** — não é cena fixa: rola de
verdade entre header e footer fixos. Vem logo após os planos.

- `z-index` acima das cenas fixas (z 20) e abaixo de header/footer
  (z 65) — a tela desliza entre eles, que nunca saem. Fundo de papel
  com grade fina de instrumento.
- **Infográfico do fluxo** em 3 colunas (`.ch6-flow`), conectadas por
  setas douradas:
  - **01 — Fontes públicas oficiais.** Grade 2×3 de wordmarks
    (`CH6_SOURCES`): IBGE · RFB · CVM · CAGED · Portal da Transparência
    · Comex Stat. Materializa o claim "fontes oficiais".
  - **02 — Cruzamento independente.** Instrumento radar estilizado
    (concêntricos + crosshair + linha-varredura dourada girando).
  - **03 — Estimativa auditável.** Mini-régua de intervalo com mín ·
    estimativa (R$ 24,3 mi) · máx — eco direto do Cap. 3.
- Em mobile o fluxo empilha verticalmente; as setas viram chevrons.
- Termos que passam confiabilidade **sem expor o método** — a fórmula
  não aparece. Desfecho: *"Você vê a origem e a margem de cada
  estimativa — o cálculo fino é o nosso ofício."*
- Revelação por `gsap.from` ao entrar na viewport (sem scrub, sem pin).

### Capítulo 6½ — Inteligência de saúde
Seção em fluxo normal (`.chsig`) entre o Cap. 6 e o Cap. 7. Apresenta a
camada de risco/monitoramento **sempre pelo lado positivo**: é uma
capacidade do radar — "acompanhamos esses sinais por você" — nunca um
alarme. Sem estatística de medo (ex.: "X% têm dívida") e sem comparativo
agressivo com bureau.

- Cabeçalho: eyebrow "Inteligência de saúde" · título *"O radar também
  acompanha a solidez de cada empresa."* · subtítulo.
- **3 cards de capacidade** (`.chsig-cards`), cada um com ícone, título,
  texto e tag de fonte:
  1. **Saúde fiscal** — cruzamento com a Dívida Ativa da União (PGFN),
     selo verde automático para quem está em dia.
  2. **Estabilidade do setor** — termômetro de RJ/falências da região
     (CNJ Datajud), contexto para ler cada oportunidade.
  3. **Reputação pública** — menções em Diários Oficiais (Querido Diário)
     + protestos em cartório (CENPROT), sob demanda.
- **Faixa de valor** (`.chsig-strip`, fundo escuro + aro dourado):
  *Incluído no plano · 100% fonte pública · Auditável até a origem* —
  enquadra tudo como benefício já incluso, sem custo por consulta.
- Desfecho Playfair italic: *"Faturamento, saúde fiscal e reputação — o
  retrato inteiro de cada empresa, num só lugar."*
- Mobile: cards e faixa empilham em coluna. Revelação por `gsap.from` ao
  entrar na viewport (sem scrub/pin), igual aos Cap. 6/7.
- Reflexo nos planos (Cap. 5): Varredura ganha *"Monitor de saúde fiscal
  e judicial (PGFN · Datajud)"*; Mesa ganha *"Reputação pública sob
  demanda (Diários Oficiais · protestos)"*.

### Capítulo 7 — Quem usa o radar
Segunda seção em fluxo normal — depoimentos em **bento layout**.

- 3 cards de depoimento (`CH7_VOICES`) em `grid-template-areas`:
  1 grande à esquerda (`featured: true`, citação mais longa + tipografia
  maior + aro dourado) + 2 menores empilhados à direita. Em mobile
  empilha em uma coluna (featured no topo).
- Cada card: aspa decorativa em Playfair gold, citação em Playfair,
  régua, avatar de iniciais + nome/cargo.
- Desfecho com CTA "Conhecer os planos" que rola de volta ao Cap. 5.
- ⚠️ **Conteúdo PLACEHOLDER** — depoimentos ILUSTRATIVOS, não de
  clientes reais; avatares são iniciais, não fotos. Substituir por
  reais e autorizados ANTES de publicar: depoimento fabricado em site
  no ar é publicidade enganosa (CDC art. 37) e contradiz o
  posicionamento de honestidade do produto. Ver aviso em `CH7_VOICES`.

### Capítulo 8 — Perguntas frequentes
Terceira seção em fluxo normal — FAQ. Fecha a landing.

- 6 perguntas (`CH8_FAQ`) em 2 colunas (3 cada), accordion via
  `<details>`/`<summary>` nativo. Chevron rotaciona 180° ao abrir.
- Touch target ≥56px no summary; `:focus-visible` com anel dourado;
  cursor pointer. Acessibilidade default do `<details>` mantida.
- Respostas honestas ancoradas em `docs/methodology.md` (fontes,
  validação CVM, escopo das 46.255 LTDAs, faixa honesta, integração
  via API no Mesa, LGPD).
- Desfecho `.ch8-foot`: linha com `mailto:` para `contato@genesislabs`.
- Em mobile, FAQs em uma coluna só.

### Overlay de auth (conta e acesso)
Camada de conta sobre a landing (`AuthOverlay.tsx` + `auth-overlay.css`,
prefixo `ax-`) — coerente com a filosofia do Gateway: **sem troca de
tela**, um véu escuro + cartão de papel sobre o campo do radar.

- **Modos:** `login · signup · forgot · reset · verify-pending ·
  verify-confirm`. Deep-linkável via query string:
  `?auth=login|signup|verify|reset|plans` (+`token`, +`plan`, +`period`)
  — parse na montagem da `Landing`, query limpa com `replaceState`.
  `?checkout=cancelado` mostra aviso discreto (`.ax-toast`).
- **Header wired:** "Criar conta" / "Fazer login" abrem o overlay;
  com sessão aberta viram **"Abrir o radar"** (→ `/`) e **"Sair"**.
- **CTAs dos planos (Cap. 5):** Sinal/Varredura — anônimo abre signup
  com plano+ciclo pré-selecionados; autenticado e verificado vai direto
  ao checkout do Stripe; não-verificado cai em verify-pending. O plano
  pendente sobrevive ao reload do link de email via `localStorage`
  (`auth/pendingCheckout.ts`) e dispara o checkout após a verificação.
  Mesa = `mailto:` (venda assistida). Com `billing_enabled=false`
  (GET `/auth/config`), os CTAs avisam honestamente e não chamam o
  endpoint.
- **Estado de sessão:** `AuthProvider` (`src/auth/AuthContext.tsx`)
  envolve a landing em `main.tsx`; cliente tipado do contrato em
  `src/auth/api.ts` (erros → `AuthApiError` com mensagem pt-BR).
- Estética premium da casa: mono labels, cantoneiras douradas, entrada
  GSAP respeitando `prefers-reduced-motion`, Esc fecha, `role="dialog"`,
  validação inline pt-BR (email válido, senha ≥ 8).

## Arquitetura

| Arquivo | Papel |
|---|---|
| `landing.html` | entry Vite (multi-page; app em `index.html`) |
| `main.tsx` | monta `<AuthProvider><App/></AuthProvider>` |
| `App.tsx` | fases: `gateway → entering → radar` |
| `Gateway.tsx` · `gateway.css` | o portal |
| `GenesisRadarLogo.tsx` | logo do produto, nativa em SVG |
| `Landing.tsx` · `landing.css` | a experiência do radar + a jornada de scroll |
| `AuthOverlay.tsx` · `auth-overlay.css` | conta e acesso em overlay (login · cadastro · verificação · reset) |
| `three/PointField.ts` | motor WebGL — campo, varredura, esfera-empresa, câmera |

- Canvas WebGL **persistente** (`PointField`) — fundo do portal E do radar.
- `Landing` recebe `revealed`: falso = cromática do radar oculta + scroll
  travado (modo portal); verdadeiro = jornada liberada.
- Coreografia: **GSAP + ScrollTrigger** (scrub) + **Lenis** (smooth scroll).
- A distância de scroll vem do spacer `.lp-scroll` (760vh).
- Stack adicionada ao `package.json`: `gsap`, `three`, `lenis`.

## Onde retomar

Cap. 1–7 prontos. Dois fios em aberto:

**1 · Depoimentos reais (Cap. 7).** A seção está construída, mas com
depoimentos PLACEHOLDER (ilustrativos) e avatares de iniciais. Trocar
por depoimentos reais e autorizados — e por fotos reais — antes de
publicar (ver aviso em `CH7_VOICES`, `Landing.tsx`).

**2 · "A prova" (validação CVM).** Resta do roteiro original um capítulo
de prova: validar a estimativa contra quem publica balanço. Encaixa como
cena fixa entre o Cap. 4 e o Cap. 5, ou como seção em fluxo normal junto
do Cap. 6. Atenção ao conflito de números:

- A faixa de ±15% do Cap. 3 casa com o universo **real do produto** —
  `docs/methodology.md` §3.3: a mediana de erro do consolidado bruto é
  22,8%, mas inclui holdings/concessionárias/bancos já excluídos do
  produto; sem essa cauda a mediana cai para 12–15% e o Top 40
  operacional fica todo abaixo de ±15%. A prova deve mostrar a validação
  sobre o universo pós-exclusão — aí o ±15% se sustenta.

Padrão para encadear um capítulo novo (estabelecido nos Cap. 2–5):
1. Adicionar uma trilha de scroll própria (`.chN-track`) após a anterior.
2. Adicionar o palco fixo (`.chN-stage`) e seu beat de DOM no `Landing.tsx`.
3. Criar uma timeline GSAP própria, com ScrollTrigger na nova trilha
   (`start: "top bottom"` encosta no fim do capítulo anterior).
4. Estilos `.chN-*` em bloco próprio no fim de `landing.css`, com seus
   recortes de responsivo e `reduced-motion`.

Ação 3D nova (como o recuo do Cap. 4): um método no `PointField` dirigido
por um `onUpdate` do ScrollTrigger — o padrão de `setJourney`/`setUniverse`.

## Roteiro — capítulos restantes

Conceito desenhado no início do projeto; números reais em
`docs/methodology.md`. Cap. 1–7 concluídos (ver "O que está pronto").
O método de cálculo não é exposto, por decisão de design. Resta:

- **A prova.** Scatter da estimativa × DRE real de quem publica balanço
  (CVM). O erro mediano do consolidado bruto é 22,8% (n=125), mas a
  cauda é dominada por arquétipos já excluídos do produto; no universo
  pós-exclusão a mediana cai para 12–15% — coerente com o ±15% do
  Cap. 3. A prova deve usar os números do universo real (ver "Onde
  retomar"). Opcional: anexar a **rastreabilidade** — a linha que volta
  do número final até a fonte pública, fechando a auditabilidade.

## A calibrar (botões conhecidos)

- **CTA "Ver planos"** — botão fixo que surge quando a esfera clareia
  (journey ~0.93) e acompanha os capítulos. Agora rola até o Capítulo 5
  (os planos) e some quando eles entram. Os 3 CTAs dos cards de plano
  já estão wired ao fluxo de cadastro/checkout — ver "Overlay de auth
  (conta e acesso)".
- **Planos (Cap. 5)** — preços de Sinal/Varredura decididos (ver nota
  no capítulo); descontos de ciclo 0/15/25%. Só o display de Mesa
  (R$ 899) a confirmar. O mobile do Cap. 5 é seção estática (sem a
  coreografia) — revisar quando estabilizar.
- **Cap. 6 / 7 / 8** — seções em fluxo normal (não cenas fixas), z 20,
  rolam entre header/footer fixos. Cap. 6 é infográfico (3 colunas:
  fontes nomeadas → instrumento → faixa). Cap. 7 é bento (1 grande +
  2 pequenos) com depoimentos PLACEHOLDER (ilustrativos; avatares de
  iniciais, não fotos) — trocar por reais e autorizados antes de
  publicar. Cap. 8 é FAQ accordion (6 perguntas, 2 colunas). O CTA
  "Conhecer os planos" do Cap. 7 e o "Ver planos" de canto rolam até
  o fim do Cap. 5 (`goToPlans`).
- **Header + footer** — faixas brancas (`.lp-nav` / `.lp-footer`), borda
  que corta o campo de pontos. Header = marca + Fazer login · Criar conta
  · Nossa história (Fazer login/Criar conta abrem o overlay de auth;
  Boletim e Nossa história seguem placeholders). Footer = controlador +
  Política de Privacidade · Termos
  de Uso · Fale conosco. Aparecem no **Gateway** (antes do radar), somem
  ao entrar no radar e ressurgem no fim do Cap. 4 (efeito `[phase]` +
  timeline do ch4), ficando visíveis por todo o resto (Cap. 5–7). O
  Gateway perdeu o `.gx-head` próprio — esta chrome o
  substitui; o CSS `.gx-head*` em `gateway.css` ficou morto. Termos e
  Privacidade abrem os modais REAIS (`TermosModal`/`PrivacidadeModal`).
  "Fale conosco" é mailto para `contato@genesislabs.com.br` (confirmar).
- **Jornada** — limites das fases e posições de câmera em
  `PointField.applyJourney()` são primeiro rascunho.
- **Logo nativa** — `GenesisRadarLogo.tsx`: voltas da espiral, ângulo da
  agulha, cores do ouro, tamanho — tudo parametrizado.
- **Véu do portal** — `gateway.css .gx-gate__veil`: equilíbrio entre campo
  visível e legibilidade do texto central.
- **Performance** — o bundle da landing inclui Three.js (~640 kB).
  Otimizar depois (code-split / `manualChunks`).
- **reduced-motion** — caminho funcional, porém básico; revisar quando o
  conjunto estabilizar.
- **Assets** — `public/brand/*.png` (logos rasterizadas) já NÃO são usados
  (a logo virou SVG nativo); originais em `dealflow-br/logos/`.
