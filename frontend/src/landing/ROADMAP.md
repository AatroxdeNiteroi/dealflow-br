# Genesis Radar — Landing · Roadmap & Handoff

> **Estado:** 2026-05-22 · **Retomar em: depoimentos reais do Cap. 7 + "A prova" (validação CVM).**
> Landing cinematográfica do produto Genesis Radar — uma viagem de câmera
> única, dirigida por scroll, sobre um campo WebGL.

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
- ⚠️ **Preços PLACEHOLDER** — `CH5_PLANS` em `Landing.tsx` (Sinal R$ 149,
  Varredura R$ 389, Mesa R$ 899/mês na base). Trocar pelos valores reais.
- Os 3 CTAs dos cards são placeholders — aguardam o fluxo de cadastro/
  checkout (ainda não existe).
- Em tela ≤720px ou `reduced-motion` o capítulo deixa de ser cena fixa e
  vira seção estática rolável (cards empilhados); a coreografia de scroll
  só roda em tela larga (`wideViewport`).

### Capítulo 6 — Como funciona
Primeira seção em **fluxo normal de scroll** — não é cena fixa: rola de
verdade entre header e footer fixos. Vem logo após os planos.

- `z-index` acima das cenas fixas (z 20) e abaixo de header/footer
  (z 65) — a tela desliza entre eles, que nunca saem. Fundo de papel
  com grade fina de instrumento.
- Apresentação do produto em **3 passos** (`CH6_STEPS`): Fontes públicas
  oficiais · Cruzamento independente · Estimativa auditável. Cada card
  com marcas de canto, ícone em disco dourado, numeral e descrição.
- Termos que passam confiabilidade **sem expor o método** — a fórmula
  não aparece. Desfecho: *"Você vê a origem e a margem de cada
  estimativa — o cálculo fino é o nosso ofício."*
- Revelação por `gsap.from` ao entrar na viewport (sem scrub, sem pin).

### Capítulo 7 — Quem usa o radar
Segunda seção em fluxo normal — depoimentos. Fecha a landing.

- 3 cards de depoimento (`CH7_VOICES`): aspa decorativa, citação em
  Playfair, régua, avatar de iniciais + nome/cargo.
- Desfecho com CTA "Conhecer os planos" que rola de volta ao Cap. 5.
- ⚠️ **Conteúdo PLACEHOLDER** — os depoimentos são ILUSTRATIVOS, não são
  de clientes reais; os avatares são iniciais, não fotos. Substituir por
  depoimentos reais e autorizados ANTES de publicar: depoimento
  fabricado em site no ar é publicidade enganosa (CDC art. 37) e
  contradiz o posicionamento de honestidade do produto. Ver o aviso em
  `CH7_VOICES` (`Landing.tsx`).

## Arquitetura

| Arquivo | Papel |
|---|---|
| `landing.html` | entry Vite (multi-page; app em `index.html`) |
| `main.tsx` | monta `<App/>` |
| `App.tsx` | fases: `gateway → entering → radar` |
| `Gateway.tsx` · `gateway.css` | o portal |
| `GenesisRadarLogo.tsx` | logo do produto, nativa em SVG |
| `Landing.tsx` · `landing.css` | a experiência do radar + a jornada de scroll |
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
  seguem placeholder — aguardam o fluxo de cadastro/checkout.
- **Planos (Cap. 5)** — preços PLACEHOLDER em `CH5_PLANS` (`Landing.tsx`);
  descontos de ciclo 0/15/25%. Trocar pelos valores reais. O mobile do
  Cap. 5 é seção estática (sem a coreografia) — revisar quando estabilizar.
- **Cap. 6 / 7** — seções em fluxo normal (não cenas fixas), z 20, rolam
  entre header/footer fixos. Cap. 7 com depoimentos PLACEHOLDER
  (ilustrativos; avatares de iniciais, não fotos) — trocar por reais e
  autorizados antes de publicar. O CTA "Conhecer os planos" do Cap. 7 e
  o "Ver planos" de canto rolam até o fim do Cap. 5 (`goToPlans`).
- **Header + footer** — faixas brancas (`.lp-nav` / `.lp-footer`), borda
  que corta o campo de pontos. Header = marca + Fazer login · Criar conta
  · Nossa história (botões com ícone, marrons no hover; placeholders —
  não funcionam). Footer = controlador + Política de Privacidade · Termos
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
