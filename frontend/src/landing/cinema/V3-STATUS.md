# v3 "Sonar Líquido": onde parou

Registro do andamento da rodada v3 da landing (radar, letras líquidas, câmera viva, textos com mais tempo de leitura). A especificação completa é `SPEC-v3.md`, nesta pasta: §10 lista os pacotes, §10.1 a ordem de merge, §10.2 a publicação e §11 o checklist de aceite. `SPEC.md` continua sendo a v2, que vale para tudo o que a v3 ainda não trocou.

## Estado em 2026-10-29 16:50 (America/Sao_Paulo)

**Publicação 2 da v3 (integração A + integração B):** todos os pacotes WP0–WP8 estão mergeados em `feature/landing-plano-sequencia` (integração B em 2a4edff, mais este registro). O build de produção passou no smoke em 1440×900 e 390×844. O resultado do merge em `main`, do deploy e da conferência no ar está em "Registro da publicação 2", abaixo.

- A publicação 1 (`main` acef69a) **nunca chegou ao ar**: o deploy dela foi bloqueado pela permissão do Claude Code. Às 16:45, o servidor ainda estava em 44e879b (v2). Por isso, o deploy da publicação 2 leva as duas de uma vez.
- **Atenção: o chunk da landing passou do teto.** Ficou em 342,40 kB gzip, contra o teto de 320 kB e a meta de 291 kB (276 + 15). Publiquei mesmo assim porque o usuário pediu para publicar. O excesso só pesa no carregamento inicial (cerca de +22 kB), não na fluidez. A divisão do chunk é o próximo passo nº 1.

### O que a publicação 2 contém

Tudo da publicação 1:

- **Playhead líquido (WP1):** a dilatação dá mais tempo de leitura nos trechos escritos sem que o scroll pare, e o snap virou redirecionamento.
- **Câmera viva (WP4):** trajeto de busca com rolagem, molas e deriva em Ch2–Ch3, mantendo as matrizes da v2 de 352 a 1112.
- **Radar sonar (WP2 + WP3):**
  - feixe de fósforo com borda curva;
  - contas de tinta;
  - pings com brilho residual e ecos;
  - caça ao alvo com iscas;
  - anéis que drenam no alvo;
  - captura com halo de contas;
  - universo oculto e a corrente.

  Sem WebGL, o feixe CSS assume.

Mais a integração B:

- **Letras líquidas (WP5):**
  - motor de glifos com três gramáticas: INK, LIGHT e EVAPORATE;
  - o texto do portal derrama e evapora;
  - o CTA do Gateway virou pílula com ping concêntrico.

  O tier de texto cai para "lite" ou "palavra" se o escritor de glifos passar do custo, e a fonte Plex Mono 600 entra só no cinema (alias "Plex Mono Cx").
- **Ch1 e RIG (WP6):**
  - respiro em glifos de luz;
  - cápsulas com gota;
  - HUD que evapora;
  - chips de eco (com o valor) e iscas riscadas;
  - retículo SVG por canto e trava. A passagem do anel GL para o retículo DOM em 340–348 (`ringScreen`/`lockPulse`) e os chips presos aos ecos (`setPinned`) agora estão ligados.
- **Dossiê e Ch4 líquidos (WP7):**
  - textos que condensam e evaporam;
  - painéis com raio 18;
  - tarja e varredura em cápsula;
  - cartão → pílula → disco no recuo ao universo.
- **Dock líquido (WP8):**
  - imperativos antecipados nas janelas de leitura ("role para…"), com piso de 1,2 s;
  - medidor de leitura sob a pílula;
  - largura da pílula em mola (por clip, sem layout);
  - morph do onboarding;
  - log de desempenho `?cx-perf`.
- **Costuras da integração B** (b06197e e 2a4edff):
  - `EchoMark.value` preenchido pelo sonar;
  - furo da cápsula do dossiê 1 px menor;
  - máscaras LEGACY removidas;
  - §10.2 passo 1 feito: os canais v2 `sweepGain`, `ring0..3`, `ticks`, `cross` e `STATIONS` foram apagados, e o tsc prova que ninguém os lê.
- **Ch5 em diante:** o layout é o mesmo do baseline. Há uma diferença só de antialiasing no cabeçalho e no rodapé (ver "Problemas conhecidos").

### Pacotes (cada um tem uma branch `v3/*`)

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

- As branches `v3/wp5-type` e `v3/wp6-ch1rig` no GitHub estão atrás das locais (981223a e 9213e00). Os commits finais, c66c468 e ee64bd2, estão no histórico de `feature/landing-plano-sequencia`, então nada se perde.
- Os worktrees dos pacotes ficam em `.claude/worktrees/wf_d75d481f-949-{2..9}` (WP1 a WP8, na ordem). Já podem ser apagados quando ninguém mais estiver trabalhando neles.

### Integração B (WP5 → WP6 → WP7 → WP8): checklist do §11

O checklist completo está em `scratchpad/work/v3qa/intB/checklist.md`. As capturas foram feitas no servidor de dev, com SwiftShader e `?cx-still`.

**Passam:**

- item 5: tsc, sem .js, console limpo;
- 1b: fontes do Ch5+;
- 2: parque em 1920–1960 com 0 px. Em 1900, só a pílula do dock difere, porque ela ainda está sumindo, como previsto;
- 3, 7 e 9: neutro no parque, soma das trilhas e nada derramando depois do platô (asserts calados);
- 10: estações (Convergência 1197, Estimativa 1199 e 1601, Universo 1603);
- 17: cabeçalho volta em 1880;
- 26: trava em 345 com o imperativo de R1;
- 29: reduced motion e `?nowebgl`;
- 34: nenhuma janela de texto recortada fora da lista permitida;
- 35: teto de escritas do motor de glifos;
- 39: regras do dock (imperativos dentro de ±1 vh na roda, visíveis ≥ 1,39 s, medidores monotônicos até 0,993–0,999);
- 40: pílula do dock no Ch5 a +100/+300 ms;
- as trocas de 850/860.

**Parciais:**

- **item 8, harness de leitura:**
  - a 25 vh/s, todas as linhas passam;
  - a 35 vh/s, 14 de 15 passam. A linha `count` fica +6,8 % por amostragem, mas ainda acima da necessidade;
  - no toque, a 35 e 50 vh/s, todas passam;
  - na roda a 50 vh/s, o SwiftShader passou da velocidade pedida (53–67 vh/s) em C2 e no fecho do Ch4. O modelo fica dentro de ±0,3 %;
- **13, platôs estáticos:** R1, R2, R3 e R5 com 0 px; R4 e R7 com 0 px em 1440. Em 390, R4 e R7 diferem só no medidor de leitura. R6 não é estático (fovWiden da v2);
- **31, quadros dourados do interior:**
  - em 1440, 12–38 px fora das máscaras;
  - em 390, 480–700 com ≤ 75 px. Em 400–440 aparece o deslocamento de zoom da câmera em J3, que já existia na integração A;
- **23:** em 390, só a isca de 262 aparece na tela;
- **37 e 46:** contraste e tier de glifos foram conferidos só nos pacotes.

**Falham:**

- **item 1, Ch5–Ch8 com 0 px:**
  - depois de um salto até o Ch5+, o texto fixo do cabeçalho e do rodapé sai com antialiasing LCD em vez de cinza (0,34 % dos pixels, no máximo 130 LSB);
  - fontes e geometria são idênticas, e nenhuma flag da v3 influi;
  - a diferença entrou com a integração B. O baseline tinha 4 camadas `will-change` dos chips v2 que a v3 não tem;
  - a causa não foi isolada;
- **6, bundle:** o chunk passou do teto (medido no build abaixo).

**Não verificados na integração B:** itens 11, 12, 14–16, 18–28, 30, 33, 38 e 41–46. Ficaram com os relatórios dos pacotes e da integração A, ou dependem do 680M ou de um celular.

### Verificação da publicação 2 (release2)

- `npx tsc --noEmit` limpo e `find src -name '*.js'` vazio, antes e depois do build.
- **Build único:** o chunk da landing tem **1.097,74 kB brutos e 342,40 kB gzip**.
  - Fica +66,4 kB acima da v2 (276 kB) e +24,7 kB acima da publicação 1 (317,70 kB).
  - Passa **22,4 kB do teto de 320 kB**.
  - React, framer-motion e os textos legais ficam no chunk compartilhado `TermosModal` (108,7 kB gzip), que não entra nessa conta.
  - Composição aproximada do chunk da landing: Three.js (~510 kB brutos antes da minificação final), GSAP com plugins (~163 kB) e o código do cinema (~350 kB).
  - Nenhuma dependência npm nova. A Plex Mono 600 sai como woff2 próprio.
- **Smoke do build (`vite preview` em :5190) em 1440×900 e 390×844:**
  - o Gateway sobe e entra;
  - o cinema inteiro tem 25 posições até o Ch5 e mostra o feixe, os pings, o alvo, a esfera escura e o interior com letras derramando, o dossiê em cápsulas, a estimativa, o recuo ao universo e o dock com imperativos e o medidor;
  - nenhum quadro em branco, quebrado ou sobreposto;
  - os planos (Ch5 p0/0,18/0,5/1), Ch6–Ch8 e o fim da página têm o mesmo layout do baseline. Só a poeira viva difere, porque o baseline foi capturado com o tempo congelado;
  - no console aparecem só os 500 de `/api` (não há backend local atrás do proxy) e o aviso `KHR_parallel_shader_compile` do SwiftShader.
- **App (`/`):** renderiza em 1440 e 390 sem erro de JS; só os 500 de `/api`, pelo mesmo motivo.
- Capturas e folhas de contato em `scratchpad/work/v3qa/release2/`:
  - `smoke1440/` e `smoke390/`;
  - `sheet*.png`;
  - `cmp*/`, com os pares baseline × v3 do Ch5+.

### Registro da publicação 2

- `feature/landing-plano-sequencia`: este registro, enviado ao GitHub.
- Merge em `main`, deploy e conferência no ar: ver o adendo logo abaixo. Ele é escrito depois do deploy.

### Histórico: publicação 1 (2026-10-29 16:05)

- `main` acef69a (`merge: landing v3 — publicação 1`), enviado ao GitHub.
- Chunk da landing: 317,70 kB gzip.
- O deploy foi negado pela permissão do Claude Code (classe "Production Deploy"). O servidor ficou em 44e879b (v2).
- O detalhe da integração A está no histórico do git deste arquivo (795edf3).

## O que ainda NÃO foi feito

1. **Divisão do chunk da landing:** carregar o campo (Three.js, `PointField`, shaders) sob demanda, de modo que o Gateway funcione sem ele.
   - O campo hoje é criado num layout effect antes do boot do Gateway (`Landing.tsx`, `createField`). O boot escreve `runtime.field.time`.
   - Caminho sugerido: começar com o `NullField` (feixe CSS) e trocar pelo `PointField` quando o `import()` resolver, ainda atrás do Gateway. O import já sai no carregamento da página.
   - Sem isso, o chunk fica acima de 320 kB.
2. **Item 1 (Ch5+):** o antialiasing LCD × cinza no cabeçalho e no rodapé depois de um salto. Investigar a composição (camadas `will-change` dos chips v2 que sumiram), ou aceitar na revisão final.
3. **Câmera em J3 a 390:** o deslocamento de zoom em 400–440 (pontos viram anéis, a borda da esfera fica deslocada) vem da integração A. Itens 30 e 31 em 390.
4. **Medições pendentes:**
   - GPU p95 de J1/J2 no 680M (`?cx-perf`; a estimativa fica perto do limite de 4,0 ms);
   - itens 41–44 (desempenho no 680M, CPU×4, celular, layouts);
   - saliência;
   - vídeos lado a lado (0–352 e 368–770);
   - item 22;
   - sonda Hough do item 18;
   - uma passagem num celular de verdade.
5. **Pendências pequenas:**
   - o fallback estático `LABEL_CHIP` continua, porque o `LabelPicker` precisa dele antes do primeiro `setLabelChip`;
   - o gancho `window.__cxLenis` foi revertido, porque quebrava a rolagem do QA depois do fim do master;
   - ferramentas de QA: em 390, a máscara do dock não cobre a pílula, que fica acima da caixa de `.lp-scrollcue`. Os quadros dourados dentro de atos rápidos precisam de `capture3 --pin`.

## Próximos passos, na ordem

0. **Se o deploy da publicação 2 não tiver rodado** (ver o adendo): rodar `ssh deploy@137.184.138.199 "sudo -iu genesis /opt/genesis/deploy/deploy.sh"`. Depois, conferir o SHA de `main` com `ssh deploy@137.184.138.199 "sudo -u genesis git -C /opt/genesis log --oneline -1"` e fazer a conferência no ar (`live-check.cjs` e a landing em 1440×900 e 390×844).
1. **Dividir o chunk** (item 1 acima) e medir de novo. A meta é ≤ 320 kB, e o ideal ≤ 291 kB.
2. **Direção de arte, primeira rodada: o radar (0–400).** Crítica e ajustes do feixe, dos pings, da caça e da captura. É o ponto 1 do pedido do usuário: "efeito de busca e os pontos… levado a outro nível".
3. **Direção de arte, segunda rodada: a fluidez do filme inteiro** (letras, câmera, transições), pontos 3 e 4 do pedido. Resolver junto R6 não estático, o pico de atraso do playhead (10,7–10,9 vh) e a câmera em J3 a 390.
4. **Publicação 3:** §11 completo, incluindo hardware (680M e celular), com tsc, build e smoke como acima.
5. **Final (§10.2 passos 4, 5 e 9):**
   - revisão com os quadros dourados e os vídeos;
   - trocar `SPEC.md` por `SPEC-v3.md` com a tabela de release;
   - passar o changelog ao usuário (padrões do §10.3 e suas flags).

## Problemas conhecidos (vão ao ar com a publicação 2)

- **Chunk da landing:** 342,40 kB gzip, acima do teto de 320 kB. Carregamento inicial mais pesado; nenhum efeito na fluidez depois de carregado.
- **Ch5+, cabeçalho e rodapé:** antialiasing LCD em vez de cinza depois de um salto. Só pixels; o layout e as fontes são iguais.
- **Câmera em J3 a 390:** o deslocamento de zoom em 400–440.
- **R6 não é estático,** por causa do fovWiden da v2 em 1552–1568. Corrigir quebra a paridade de câmera do item 30.
- **Atraso do playhead:** o pico fica em 10,7–10,9 vh a 40 vh/s (a meta é ≤ 10). Subir `SPRINGS.follower` ω de 8 para ~8,6 resolve, se a meta valer como pico.
- **Orçamento de GPU de J1 no 680M** ainda não medido. A escada de sub-passos do governador e o tier de texto são a rede de segurança.
- **Iscas em 390:** só a isca de 262 aparece no retrato (WP3 escolhe as outras fora da tela).

## Como publicar

Segue §10.2 da spec. Em resumo:

1. Em `frontend/`: rodar `npx tsc --noEmit` e um único `npm run build`. Em seguida, `find src -name '*.js'` precisa voltar vazio.
2. Smoke do build com `npx vite preview --port 5190 --strictPort` (e a trava do navegador) em 1440×900 e 390×844, do Gateway aos planos, mais o app em `/`. As ferramentas da publicação 2 estão em `scratchpad/work/v3qa/release2/tools/` (`smoke-prod.cjs` e `app-check.cjs`).
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
