# v3 "Sonar Líquido": onde parou

Registro do andamento da rodada v3 da landing (radar, letras líquidas, câmera viva, textos com mais tempo de leitura). A especificação completa é `SPEC-v3.md`, nesta pasta: §10 lista os pacotes, §10.1 a ordem de merge, §10.2 a publicação e §11 o checklist de aceite. `SPEC.md` continua sendo a v2, que vale para tudo o que a v3 ainda não trocou.

## Estado em 2026-10-29 19:25 (America/Sao_Paulo)

**Publicação 3 da v3 (publicação 2 + direção de arte, rodada 1 do radar e rodada 1 da fluidez): tsc, build e smoke aprovados. Em seguida vêm o merge em `main` e a tentativa de deploy.** O resultado fica em "Registro da publicação 3", abaixo. Se esse registro ainda disser "em andamento", confira `git -C genesis-open log --oneline -3` e `ssh deploy@137.184.138.199 "sudo -u genesis git -C /opt/genesis log --oneline -1"` para saber até onde chegou.

- **Desde a publicação 2,** entraram três commits em `feature/landing-plano-sequencia`: 6f43a38 (radar, rodada 1), 7661526 (fluidez, WIP com a página funcionando) e ae5fbd8 (fluidez, rodada 1). São 18 arquivos de código em `frontend/`, com +387/−108 linhas, e nenhum deles é do Ch5 em diante (em `landing.css`, só o bloco das trilhas e o espelho de toque).
- **No ar:** às 19:20 o servidor ainda estava em 44e879b, a v2. As publicações 1 e 2 nunca chegaram ao ar, porque a permissão do Claude Code negou o deploy as duas vezes. O próximo `deploy.sh` leva as publicações 1, 2 e 3 juntas.
- **Atenção: o chunk da landing continua acima do teto.** Ficou em 344,09 kB gzip, contra o teto de 320 kB e a meta de 291 kB (276 + 15). É +1,7 kB sobre a publicação 2, que já está em `main`. Segui com a publicação pelo mesmo motivo da publicação 2: o usuário pediu para publicar, e o excesso só pesa no carregamento inicial, não na fluidez. A divisão do chunk continua pendente (ver "O que ainda NÃO foi feito").
- **As duas rodadas de direção de arte ainda não foram aprovadas.** Ambas saíram com o veredito "ajustar": o radar com notas 6/6/6 e a fluidez com 6,5/8,5/5,5. Os ajustes pedidos foram aplicados, mas o diretor de arte ainda não deu nota à versão nova.

### O que a publicação 3 contém

**Tudo da publicação 2:**

- playhead líquido com dilatação dos trechos escritos (WP1);
- câmera viva (WP4);
- radar sonar: feixe de fósforo, contas de tinta, pings com brilho residual, caça com iscas, captura, universo oculto (WP2 + WP3);
- letras líquidas INK, LIGHT e EVAPORATE (WP5);
- Ch1 e RIG: respiro em glifos, cápsulas, HUD, chips de eco, retículo (WP6);
- dossiê e Ch4 líquidos (WP7);
- dock líquido com imperativos e medidor de leitura (WP8);
- as costuras das integrações A e B.

O detalhe está no histórico do git deste arquivo (faf7de8).

**Radar, rodada 1 (6f43a38).** O diretor de arte deu 6/6/6 e pediu oito ajustes, todos aplicados:

- **P1, lente do cursor no menisco capturado** (`three/shaders/points.ts`, só no programa SONAR):
  - `mouseResolved *= 1 − 0,85·uCapture`;
  - o ganho de tamanho de `resolved` e `vThrob` vai de 1,05 a 0,35 com `uCapture`;
  - a covinha passa a 9 px·(1 − uCapture);
  - `uCapture = s.capture·sonarJ`, exatamente 0 a partir de 398.
- **P2, primeiro quadro pintado** (`three/field/beam.ts`, `three/field/sonar.ts`):
  - com o sonar ligado, a cunha de boot da v2 tem ganho 0, e o feixe v3 entra com o próprio ganho;
  - enquanto o programa SONAR ainda está linkando, a carga dourada do substituto v2 é `s.chargeGain·(1 − s.sonar)`;
  - o fundo do Ch5 (sonar 0) mantém a carga da v2.
- **P3, saliência da busca:**
  - `BEAM_KNOBS`: afterglowDark 1,0 (o teto), glowSize 0,7, pingAlphaExp 0,5 (o teto), lineW 1,75; veilMax continua 0,09;
  - poeira do sonar: revelação `uDustSonar·exp(−b/0,7)·0,8`, grãos de 1,3–2 px × DPR, alfa no máximo 0,32;
  - pings a mais de 0,5 unidade além do SP são cortados por `smoothstep(0,75, 1, uSeek)`. Assim não ficam anéis congelados no rumo travado.
- **P4, rótulos** (`cinema/ch1/labels.ts`):
  - um nome por placa viva, compartilhado entre rótulos do cursor, chips de eco e iscas;
  - nenhuma placa nasce ou revive a menos de 24 px da borda (16 px em ≤ 720), e uma placa arrastada evapora a 4 px da borda;
  - no desktop, no máximo 2 rótulos do cursor enquanto houver ≥ 2 chips;
  - um ponto já nomeado por um chip não ganha rótulo do cursor, e vice-versa;
  - nenhum texto novo.
- **P5, retículo** (`cinema/rig/rig.timeline.ts`):
  - em 240–280 o quadro vira um quadrado centrado (cx-flow) e depois contrai até `discBox + 14` com `E.dry`;
  - a curvatura passou para 240–292 com `E.dry`, lida como cápsula e depois círculo;
  - o inchaço de 318–340 e a passagem de 340 não mudaram.
- **P6, passagem 336–352** (`rig.timeline.ts`):
  - a caixa do círculo DOM segue `field.ringScreen(0)`, a projeção viva, incluindo a camada de tempo;
  - entra em 336–340 e sai em 348–352;
  - não roda quando a âncora está dentro da esfera.
- **P7, retrato** (`three/field/beam.ts`, `instrument.ts`, `shaders/beam.ts`): esmaecimentos radiais separados. A linha dourada usa `uFadeRL` (2,2× a meia largura) e o véu usa `uFadeR` (1,9×). Antes os dois usavam 1,6. A paisagem não mudou.
- **P8, câmera de J1** (`cinema/beats.ts`):
  - `CAMERA.seek`, nó 2: posição [−0,85, 1,45, 10,2], alvo [0,45, −0,30, 0,2];
  - `SCORE.roll` em 110: −3,0°;
  - os nós 0, 3 e 4, `R1_POSE` e a junção de inclinação zero em 352 não mudaram, e o J3 continua intocado;
  - o fator 0,55 do celular continua valendo.

**Fluidez, rodada 1 (7661526 + ae5fbd8).** O diretor de arte deu 6,5/8,5/5,5 e pediu sete ajustes, todos aplicados:

- **P1, fundo vivo em Ch2–Ch3:**
  - nós de `flowAmp` em `beats.ts`: [1112, 0], [1140, 0,05], [1536, 0,05], [1552, 0]. Continua 0 em 398–1112;
  - `sonar.ts` agora liga o programa sonar também quando `flowAmp > 0` (só a corrente, com `uSonar` = 0, que pelo contrato do shader é exatamente a v2 mais a corrente);
  - em `camlayer.ts`: DRIFT {0,28, 300, 0,17, 400, 1,1}, SWAY {0,18, 0,26, 0,12, 0,19} e paralaxe de 0,4 para 0,8 em 1140–1536;
  - o celular mantém a deriva × 0,6 e não tem paralaxe do cursor.
- **P2, cápsula que derrama e drena as placas** do fecho de C2 e de C3 e da contagem e do fecho do Ch4:
  - `liquid.ts`: `pourPlate`/`drainPlate`;
  - variáveis CSS `--cp-v/s/e/r` em `dossier.css` e `ch4.css`, só com `prefers-reduced-motion: no-preference`;
  - a faixa condensa no início da janela e incha com o primeiro glifo (C2 1110, C3 1494, fecho do Ch4 1762). A contagem incha desde o início da própria janela, porque os dígitos são o primeiro conteúdo;
  - o estado aberto tem margem de 96 px, porque `--shadow-pop-warm` vai até 78 px abaixo da caixa;
  - a drenagem recua pela borda de saída, atrás da evaporação da direita para a esquerda;
  - janelas e textos não mudaram.
- **P3, evaporação mais lenta:**
  - os blocos EVAPORATE recebem `glyphDur: 4`;
  - o fim de D4/D7/D9 passou de 1190/1592/1848 para 1200/1604/1860;
  - a saída a 50 vh/s de scroll ficou com C2 0,31 → 0,89 s, C3 0,28 → 0,78 s e Ch4 0,36 → 0,82 s.
- **P4, mais tempo de leitura em C2:**
  - D4 K de 3,9 para 4,4 (no toque, 4,125 → 4,6);
  - S_END fino 2730,2 → 2872,8 e grosso 2784,4 → 2931,1;
  - `TRACKS_VH` {940,9, 445,3, 714,3, 872,3} e `TRACKS_VH_TOUCH` {950,9, 454,7, 736,6, 888,9}, espelhados em `landing.css`. O assert de soma das trilhas fica calado;
  - o acréscimo real foi de +142,6 vh de scroll (fino) e +146,7 (grosso), acima da estimativa de +50 do diretor de arte.
- **P5, uma só forma em C4a:**
  - `COLLAPSE_SHAPE` {rad 1620, box 1626, amt 1622} em `beats.ts`, compartilhado pelo `cardBoxAt` do DOSSIER e pela forma de canto do RIG;
  - o aperto opcional do anel do RIG para r + 3 px não foi feito.
- **P6, assentamento lateral do INK:**
  - `GlyphState.xEm = −0,12·(1 − cx-ink-settle(q))`, só no desktop, na gramática completa;
  - fica na mesma string de transform em cache, sem escritas a mais;
  - o respiro (LIGHT, protegido) não muda.
- **P7, soltura:**
  - os arcos abrem do disco até 1,5 × o raio dele, em vez de ir até os cantos do quadro;
  - `releaseFade` passou de 1856–1878 para 1850–1866;
  - `release` 1848–1878, o Ch5 e `layersOff` 1880 não mudaram.

**Ch5 em diante:** nada mudou nesta publicação. O layout dos planos é o mesmo do baseline (ver a verificação abaixo).

### Pacotes e integração

| Pacote | Branch | Commit | Merge | Situação |
|---|---|---|---|---|
| WP0 contratos, tabelas, dilatação, eases | `feature/landing-plano-sequencia` | 608f479 | — | publicação 1 |
| WP1 playhead líquido, dilatação, snap | `v3/wp1-playhead` | ebcb8fa | 3d83fa4 | publicação 1 |
| WP4 câmera viva: molas, rolagem, deriva | `v3/wp4-camera` | ed44dfd | b92874f | publicação 1 |
| WP2 feixe sonar de fósforo, caça, anéis | `v3/wp2-beam` | ee53a66 | 436e896 | publicação 1 |
| WP3 campo: contas de tinta, pings, ecos, menisco | `v3/wp3-field` | 59d7f1f | 0952f47 | publicação 1 |
| Costuras da integração A | `feature/landing-plano-sequencia` | a527abd | — | publicação 1 |
| WP5 motor de glifos (letras líquidas) | `v3/wp5-type` | c66c468 | e35b441 | publicação 2 |
| WP6 Ch1: respiro em glifos, cápsulas, HUD, chips, retículo | `v3/wp6-ch1rig` | ee64bd2 | 0df9c02 | publicação 2 |
| WP7 dossiê e Ch4 líquidos | `v3/wp7-dossier` | 723c001 | c37d04f | publicação 2 |
| WP8 dock líquido, medidor de leitura, ferramentas de QA | `v3/wp8-guide` | 7468ee2 | 6d603fd | publicação 2 |
| Costuras da integração B | `feature/landing-plano-sequencia` | b06197e, 2a4edff | — | publicação 2 |
| Direção de arte: radar, rodada 1 (8 ajustes) | `feature/landing-plano-sequencia` | 6f43a38 | — | publicação 3, veredito "ajustar" |
| Direção de arte: fluidez, rodada 1 (7 ajustes) | `feature/landing-plano-sequencia` | 7661526, ae5fbd8 | — | publicação 3, veredito "ajustar" |

- As duas rodadas de direção de arte foram feitas direto em `feature/landing-plano-sequencia`, sem branch própria.
- As branches `v3/wp5-type` e `v3/wp6-ch1rig` no GitHub estão atrás das locais (981223a e 9213e00). Os commits finais, c66c468 e ee64bd2, estão no histórico de `feature/landing-plano-sequencia`, então nada se perde.
- Os worktrees dos pacotes ficam em `.claude/worktrees/wf_d75d481f-949-{2..9}` (WP1 a WP8, na ordem). Já podem ser apagados quando ninguém mais estiver trabalhando neles.

### Verificação da publicação 3 (release3)

- `npx tsc --noEmit` limpo, e `find src -name '*.js'` vazio antes e depois do build.
- **Build único.** O chunk da landing tem **1.102,16 kB brutos e 344,09 kB gzip**:
  - +68,1 kB acima da v2 (276 kB);
  - +1,7 kB acima da publicação 2 (342,40 kB);
  - **24,1 kB acima do teto de 320 kB**.

  Os outros chunks: `main` 293,22 kB gzip e `TermosModal` 108,72 kB gzip (React, framer-motion e textos legais). Não há dependência npm nova.
- **Smoke do build** (`vite preview` em :5190, 1440×900 e 390×844, 34 quadros em cada tamanho):
  - o Gateway sobe e entra;
  - os quadros cobrem 25 posições do cinema até o Ch5, os planos (Ch5 p0/0,18/0,5/1), os topos de Ch6, Ch7, Ch8 e da seção de sinais, e o fim da página;
  - aparecem o feixe com pings e rótulos, a esfera escura, o interior com letras derramando e evaporando, o dossiê em cápsulas, a estimativa, o recuo ao universo e o dock com imperativos e medidor;
  - nenhum quadro em branco, quebrado ou sobreposto;
  - os planos têm o mesmo layout do baseline. Só a poeira viva difere, porque o baseline foi capturado com o tempo congelado, e em 390 o dock do p0 é a pílula da v3 (igual à publicação 2);
  - no console aparecem só os 500 de `/api` (não há backend local atrás do proxy) e o aviso `KHR_parallel_shader_compile` do SwiftShader.
- **App (`/`):** renderiza em 1440 e 390 sem erro de JS. Só aparecem os 500 de `/api`, pelo mesmo motivo.
- O build de produção não tem o gancho `__cxPlayhead`, então o smoke posiciona por scroll e não por vh do master. A ferramenta é `release3/tools/smoke-prod.cjs`, a mesma da publicação 2.
- Capturas e folhas de contato ficam em `scratchpad/work/v3qa/release3/`:
  - `smoke1440/` e `smoke390/`;
  - `sheet*.png`;
  - `cmp1440x900/`, `cmp390x844/` e `cmpsheet*.png`, com os pares baseline × v3 do Ch5.
- **Não verificado nesta publicação:**
  - o §11 completo no 680M e num celular;
  - uma passada real na roda a 50 vh/s (`raf.json`);
  - o espelho das trilhas de toque em execução;
  - o desempenho do programa sonar em 1112–1552 no 680M;
  - o contador de pings por volta da saliência.

### Registro da publicação 3 (em andamento)

- `feature/landing-plano-sequencia`: este registro, enviado ao GitHub.
- Próximo: merge em `main` no worktree `genesis-open`, push e `deploy.sh`.

### Histórico: publicação 2 (2026-10-29 16:51)

- `main` 38b6b56 (`merge: landing v3 — publicação 2`), enviado ao GitHub. O merge não teve conflitos. Fora de `frontend/`, só o `deploy/deploy.sh` de `main` (3b5a16f) difere da branch, e ficou o de `main`.
- Chunk da landing: 342,40 kB gzip.
- O deploy foi negado pela permissão do Claude Code (classe "Production Deploy"). O servidor ficou em 44e879b (v2).
- O checklist do §11 da integração B (o que passou, o que ficou parcial e o que falhou) está no histórico do git deste arquivo (faf7de8) e em `scratchpad/work/v3qa/intB/checklist.md`.

### Histórico: publicação 1 (2026-10-29 16:05)

- `main` acef69a (`merge: landing v3 — publicação 1`), enviado ao GitHub.
- Chunk da landing: 317,70 kB gzip.
- O deploy foi negado pela permissão do Claude Code (classe "Production Deploy"). O servidor ficou em 44e879b (v2).
- O detalhe da integração A está no histórico do git deste arquivo (795edf3).

## O que ainda NÃO foi feito

1. **Aprovação das rodadas de direção de arte.** O radar (6/6/6) e a fluidez (6,5/8,5/5,5) saíram com o veredito "ajustar". A segunda rodada de cada uma ainda não começou. O que os próprios agentes já deixaram como próximo botão:
   - **C2:** o subtítulo fica 3,17 s visível a 50 vh/s, contra a necessidade de 3,4 s. Subir D4 K para cerca de 4,7, ou atrasar o início de `c2Evap`, fecha a diferença;
   - **paralaxe de J1:** o alvo compensa a posição, então o enquadramento quase não se move. Se o diretor de arte quiser mais movimento, o próximo botão é a diferença de alvo entre os nós 1 e 2;
   - **cápsula das placas:** antes do inchaço (C2 1106–1110, fecho do Ch4 1758–1762) a faixa fica quase invisível, porque o clip também corta a borda e a sombra. Uma faixa visível pediria um traço em pseudo-elemento;
   - **contagem em 1654:** os rolos borrados "000.000" aparecem cerca de 2 vh antes de a cápsula condensar em volta;
   - **rótulos no celular:** uma placa que a câmera leva até a borda superior evapora a 4 px, mas some no lugar e pode ser cortada pela borda durante o esmaecimento (visto em 390, vh 180). Acelerar a saída ou prender a placa enquanto evapora.
2. **`SPEC-v3.md` desatualizada em relação às rodadas.** Falta registrar:
   - na tabela de permanência do §2.2: D4 K 4,4/4,6, fins 1200/1604/1860 e S_END 2872,8/2931,1;
   - no §4.2: as linhas de `flowAmp` e da paralaxe;
   - `releaseFade` 1850–1866;
   - o novo `COLLAPSE_SHAPE`;
   - os `BEAM_KNOBS` e o nó 2 de `CAMERA.seek` da rodada do radar.
3. **Divisão do chunk da landing:** carregar o campo (Three.js, `PointField`, shaders) sob demanda, de modo que o Gateway funcione sem ele.
   - O campo hoje é criado num layout effect antes do boot do Gateway (`Landing.tsx`, `createField`). O boot escreve `runtime.field.time`.
   - Caminho sugerido: começar com o `NullField` (feixe CSS) e trocar pelo `PointField` quando o `import()` resolver, ainda atrás do Gateway. O import já sai no carregamento da página.
   - Sem isso, o chunk fica acima de 320 kB.
4. **Item 1 (Ch5+):** o antialiasing LCD × cinza no cabeçalho e no rodapé depois de um salto. Investigar a composição (camadas `will-change` dos chips v2 que sumiram), ou aceitar na revisão final.
5. **Câmera em J3 a 390:** o deslocamento de zoom em 400–440 (pontos viram anéis, a borda da esfera fica deslocada) vem da integração A. Itens 30 e 31 em 390.
6. **Medições pendentes:**
   - GPU p95 de J1/J2 no 680M (`?cx-perf`; a estimativa fica perto do limite de 4,0 ms), agora também com o programa sonar em 1112–1552, onde antes rodava o da v2;
   - itens 41–44 (desempenho no 680M, CPU×4, celular, layouts);
   - uma passada real na roda a 50 vh/s (`raf.json`) e o espelho das trilhas de toque em execução;
   - saliência: o `salience.cjs` não achou o contador de pings por volta na rodada do radar, então o critério (b) ficou sem prova da ferramenta. Os pings aparecem nos quadros;
   - refazer a fixação de 400/420 em 1440 contra uma referência nova. A diferença de 464/542 px de bordas de conta é atribuída à idade da referência (pin2);
   - vídeos lado a lado (0–352 e 368–770);
   - item 22;
   - sonda Hough do item 18;
   - uma passagem num celular de verdade.
7. **Pendências pequenas:**
   - o fallback estático `LABEL_CHIP` continua, porque o `LabelPicker` precisa dele antes do primeiro `setLabelChip`;
   - o gancho `window.__cxLenis` foi revertido, porque quebrava a rolagem do QA depois do fim do master;
   - ferramentas de QA: em 390, a máscara do dock não cobre a pílula, que fica acima da caixa de `.lp-scrollcue`. Os quadros dourados dentro de atos rápidos precisam de `capture3 --pin`.

## Próximos passos, na ordem

0. **Colocar no ar:** rodar o `deploy.sh`, verificar que o servidor está no SHA de `main` e conferir no ar (ver "Como publicar"). Ou decidir segurar a v3 e reverter os merges da v3 em `main`.
1. **Direção de arte, segunda rodada do radar (0–400) e da fluidez (filme inteiro),** com nota nova do diretor de arte sobre a publicação 3. Começar pelos botões listados no item 1 acima. Resolver junto R6 não estático, o pico de atraso do playhead (10,7–10,9 vh) e a câmera em J3 a 390.
2. **Dividir o chunk** (item 3 acima) e medir de novo. A meta é ≤ 320 kB, e o ideal ≤ 291 kB.
3. **Atualizar `SPEC-v3.md`** com os valores das rodadas (item 2 acima).
4. **Publicação 4:** §11 completo, incluindo hardware (680M e celular), com tsc, build e smoke como acima.
5. **Final (§10.2 passos 4, 5 e 9):**
   - revisão com os quadros dourados e os vídeos;
   - trocar `SPEC.md` por `SPEC-v3.md` com a tabela de release;
   - passar o changelog ao usuário (padrões do §10.3 e suas flags).

## Problemas conhecidos (vão ao ar com a publicação 3)

- **Chunk da landing:** 344,09 kB gzip, acima do teto de 320 kB. Carregamento inicial mais pesado; nenhum efeito na fluidez depois de carregado.
- **Ch5+, cabeçalho e rodapé:** antialiasing LCD em vez de cinza depois de um salto. Só pixels; o layout e as fontes são iguais.
- **Câmera em J3 a 390:** o deslocamento de zoom em 400–440.
- **R6 não é estático,** por causa do fovWiden da v2 em 1552–1568. Corrigir quebra a paridade de câmera do item 30.
- **Atraso do playhead:** o pico fica em 10,7–10,9 vh a 40 vh/s (a meta é ≤ 10). Subir `SPRINGS.follower` ω de 8 para ~8,6 resolve, se a meta valer como pico.
- **Orçamento de GPU no 680M** ainda não medido, nem em J1 nem com o programa sonar em 1112–1552. A escada de sub-passos do governador e o tier de texto são a rede de segurança.
- **Iscas em 390:** só a isca de 262 aparece no retrato (WP3 escolhe as outras fora da tela).
- **Rótulos no celular:** uma placa levada até a borda pode aparecer cortada enquanto evapora.
- **C2 a 50 vh/s:** o subtítulo fica 3,17 s visível, contra 3,4 s de necessidade.

## Como publicar

Segue §10.2 da spec. Em resumo:

1. Em `frontend/`: rodar `npx tsc --noEmit` e um único `npm run build`. Em seguida, `find src -name '*.js'` precisa voltar vazio.
2. Smoke do build com `npx vite preview --port 5190 --strictPort` (e a trava do navegador) em 1440×900 e 390×844, do Gateway aos planos, mais o app em `/`. As ferramentas estão em `scratchpad/work/v3qa/release3/tools/` (`smoke-prod.cjs` e `app-check.cjs`).
3. Push de `feature/landing-plano-sequencia`.
4. No worktree `genesis-open` (branch `main`):
   - `git fetch origin`;
   - `git merge --ff-only origin/main`;
   - `git merge --no-ff origin/feature/landing-plano-sequencia`;
   - `git push origin main`.
5. **Deploy:** `ssh deploy@137.184.138.199 "sudo -iu genesis /opt/genesis/deploy/deploy.sh"`. Depois, conferir que `sudo -u genesis git -C /opt/genesis log --oneline -1` dá o SHA de `main`.
6. **Conferir no ar:**
   - rodar `live-check.cjs`;
   - abrir `https://app.genesisradar.com.br/landing.html` em 1440×900 e 390×844.
7. **Se quebrar:**
   - `git revert -m 1` do merge em `genesis-open`;
   - push;
   - deploy de novo;
   - registrar aqui.

Para desligar uma parte da v3 sem reverter código, use as flags em `flags.ts`. Os padrões decididos estão no §10.3 da spec.

Arquivo atualizado a cada publicação.
