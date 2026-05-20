# Genesis Radar — Landing · Roadmap & Handoff

> **Estado:** 2026-05-20 · **Retomar em: Capítulo 2.**
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
- Header real: marca **GenesisLabs** à esquerda; **Fazer login** / **Criar
  conta** à direita (recipientes no estilo `.header-btn` da interface, hover
  marrom). Login/conta ainda são placeholders — sem função.
- Centro: logo Genesis Radar **replicada nativa em SVG** (`GenesisRadarLogo.tsx`)
  — emblema (espiral de radar + agulha + faíscas) + letreiro Playfair.
- Frase-âncora + CTA **Quero conhecer o produto**.
- Fundo: o campo de pontos do radar, vivo, com hover do cursor.

### Capítulo 1 — Hero do radar
- Campo de ~2.772 pontos (grade uniforme com jitter) sobre papel.
- Varredura de instrumento; pontos carregados batem como coração (lub-dub).
- Cursor revela pontos por proximidade (etiquetas R$ só dentro do radar).
- Manchete *"Elas não contam / Nós calculamos"*.

### A jornada (transição sem emenda)
Um scroll só dirige `PointField.setJourney(0..1)`:

| Trecho de `p` | Fase | O que acontece |
|---|---|---|
| 0.00–0.42 | Mergulho | câmera desce pelo campo; pontos viram esferas 3D |
| 0.42–0.70 | Mira | câmera se aproxima de UMA empresa (esfera escolhida) |
| 0.70–0.86 | Travessia | a esfera cresce e engole o quadro (o "wipe") |
| 0.86–1.00 | Interior | dentro da empresa; campo vira fundo distante e desfocado; a frase do respiro se escreve palavra a palavra |

Portal e radar compartilham o MESMO campo — entrar não troca de tela.

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
- A distância de scroll vem do spacer `.lp-scroll` (560vh).
- Stack adicionada ao `package.json`: `gsap`, `three`, `lenis`.

## Onde retomar — Capítulo 2

A jornada hoje termina no "Interior" + a frase do respiro. **O próximo passo
é o Capítulo 2**, que acontece DENTRO da empresa em que a câmera entrou.

Para encadear um capítulo novo:
1. Aumentar a altura de `.lp-scroll` em `landing.css` (mais jornada).
2. Estender `PointField.applyJourney()` (novo trecho de `p`) e/ou adicionar
   elementos à cena 3D.
3. Adicionar o beat de DOM dentro de `.lp-stage` no `Landing.tsx`.
4. Amarrar no `master` timeline (ScrollTrigger scrub) do `Landing.tsx`.

## Roadmap dos capítulos 2–7

Conceito desenhado no início do projeto. Números reais em
`dealflow-br/docs/methodology.md` e `dealflow-br/README.md`.

- **Cap. 2 — Convergência das fontes.** Dentro da empresa, três bases
  públicas convergem sobre ela: Receita Federal (CNPJ), RAIS (vínculos),
  IBGE (PIA/PAC/PAS). A empresa começa "tarjada" — `FATURAMENTO ▓▓▓`.
- **Cap. 3 — A fórmula se monta.** A fórmula se escreve:
  `folha = headcount × salário mediano setorial × 12 × encargos`;
  `receita = folha ÷ razão folha/receita setorial`. A estimativa
  materializa — nunca solta: chega como `low · point · high`.
- **Cap. 4 — O intervalo honesto.** Os 4 fatores de confiança; o selo de
  validação cruzada (convergência com a 2ª fórmula, via PIA).
- **Cap. 5 — O universo.** Zoom out: 46.255 Ltdas, os 7 arquétipos
  (donut de distribuição).
- **Cap. 6 — A prova.** Scatter estimativa × DRE real (CVM): mediana de
  erro 22,8%, 54% dentro de ±25%, n=125.
- **Cap. 7 — Rastreabilidade + CTA.** Linha que volta do número final até
  a fonte pública; CTA *Entrar no Radar*.

## A calibrar (botões conhecidos)

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
