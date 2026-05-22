# Genesis Radar — Landing · Roadmap & Handoff

> **Estado:** 2026-05-22 · **Retomar em: Capítulo 5.**
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
  método (fontes nomeadas, insumos, fórmula) não aparece na página.
- Desfecho: o faturamento segue oculto — gancho para o Capítulo 3.
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
- Desfecho (tom de marketing): *"A precisão do mercado de elite, sobre
  cada empresa fechada do país. / Estudo financeiro caso a caso,
  auditável, para estimativa real."*

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
- **Convite final** (`.ch4-finale`): ao fim do capítulo, o conteúdo do
  universo recua, o CTA de canto sai e um convite é jogado ao centro —
  botão "Ver planos" grande + frase ("Seu próximo negócio está em um
  destes 46.255 pontos").

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

## Onde retomar — Capítulo 5

O Cap. 4 fechou o arco do zoom (entrou numa empresa, recuou para as
46.255). Restam do roteiro: **a prova** (validar a estimativa contra
quem publica balanço) e o **fechamento + CTA**. Atenção: se a prova
citar erro real, os números têm de casar com a faixa de ±15% do Cap. 3.

Padrão para encadear um capítulo novo (estabelecido nos Cap. 2–4):
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
`docs/methodology.md`. Cap. 1–4 concluídos (ver "O que está pronto") —
o "O universo" do roteiro original foi entregue como o Cap. 4. O método
de cálculo não é exposto, por decisão de design. Restam:

- **A prova.** Scatter da estimativa × DRE real de quem publica balanço
  (CVM). Roteiro original: erro mediano 22,8%, 54% dentro de ±25%,
  n=125. ⚠️ Conflito a resolver: esses números contradizem a faixa de
  ±15% fixada no Cap. 3 — ou a prova usa números coerentes com ±15%, ou
  revê-se o ±15%.
- **Rastreabilidade.** A linha que volta do número final até a fonte
  pública — fecha o argumento de auditabilidade. (O convite final já
  foi entregue no fim do Cap. 4; falta só o destino do CTA — a página
  de planos ainda não existe.)

## A calibrar (botões conhecidos)

- **CTA "Ver planos"** — botão fixo que surge quando a esfera clareia
  (journey ~0.93) e acompanha os capítulos seguintes. Placeholder: falta
  o destino (página de planos/preços ainda não existe).
- **Header + footer** — faixas brancas (`.lp-nav` / `.lp-footer`), borda
  que corta o campo de pontos. Header = marca + Fazer login · Criar conta
  · Nossa história (botões com ícone, marrons no hover; placeholders —
  não funcionam). Footer = controlador + Política de Privacidade · Termos
  de Uso · Fale conosco. Aparecem no **Gateway** (antes do radar), somem
  ao entrar no radar e ressurgem no fim do Cap. 4 (efeito `[phase]` +
  timeline do ch4). O Gateway perdeu o `.gx-head` próprio — esta chrome o
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
