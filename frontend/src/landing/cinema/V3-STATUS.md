# v3 "Sonar Líquido": onde parou

Registro do andamento da rodada v3 da landing (radar, letras líquidas, câmera viva, textos com mais tempo de leitura). A especificação completa agora é `SPEC.md`, nesta pasta. Até a publicação 4 ela se chamava `SPEC-v3.md`.

- §10 lista os pacotes, §10.1 a ordem de merge, §10.2 a publicação e §11 o checklist de aceite.
- **§13 é a tabela de release:** publicações, pacotes e todos os valores que as rodadas de direção de arte mudaram depois da rev 3.1. Onde §13 difere de uma tabela anterior, valem §13 e o código.
- A spec da v2 continua no histórico do git: `git show a00d018:frontend/src/landing/cinema/SPEC.md`.

## Estado em 2026-10-29 20:45 (America/Sao_Paulo)

**Publicação 4 da v3, a última deste fluxo: publicação 3 + rodada 2 de direção de arte do radar e da fluidez.** tsc, build e smoke passaram. O resultado do merge em `main`, do deploy e da conferência no ar está em "Registro da publicação 4", abaixo.

- **Desde a publicação 3,** entraram três commits de código em `feature/landing-plano-sequencia`: 7a9ad7b (radar, rodada 2), 70de6ed (fluidez, WIP) e a00d018 (fluidez, rodada 2). Nenhum deles é do Ch5 em diante. Em `landing.css`, só mudaram a trilha do Ch4 e o espelho de toque.
- **No ar, antes desta publicação:** às 20:40 o servidor ainda estava em 44e879b, a v2. As publicações 1, 2 e 3 nunca chegaram ao ar, porque a permissão do Claude Code negou o deploy as três vezes.
- **Atenção: o chunk da landing continua acima do teto.** Ficou em **346,44 kB gzip** (1.107,94 kB brutos):
  - +2,35 kB sobre a publicação 3, que já está em `main`;
  - 26,4 kB acima do teto de 320 kB;
  - 55,4 kB acima da meta de 291 kB (276 + 15).

  Segui com a publicação pelo mesmo motivo das publicações 2 e 3: o usuário pediu para publicar, e o excesso só pesa no carregamento inicial, não na fluidez. A divisão do chunk continua pendente (ver "O que ainda NÃO foi feito").
- **As rodadas de direção de arte não foram aprovadas.** A rodada 2 subiu as notas, mas as duas terminaram de novo com o veredito "ajustar":
  - radar: 6/6/6 na rodada 1, 7/6,5/7 na rodada 2;
  - fluidez: 6,5/8,5/5,5 na rodada 1, 7/8,5/6,5 na rodada 2.

  Não houve rodada 3. O trabalho de direção de arte parou aqui, com os ajustes da rodada 2 aplicados e o que sobrou listado em "O que ainda NÃO foi feito".

### O que a publicação 4 contém

**Tudo da publicação 3:** a publicação 2 (WP0–WP8 e as costuras das integrações A e B) mais a rodada 1 do radar (6f43a38) e da fluidez (7661526, ae5fbd8). O detalhe da rodada 1 está no histórico do git deste arquivo (3b74d79) e em `SPEC.md` §13.3.

**Radar, rodada 2 (7a9ad7b).** O diretor de arte deu 7/6,5/7 e fez sete pedidos. Seis foram aplicados e um ficou parcial:

- **P1, lente do cursor na caça** (`three/shaders/points.ts`):
  - `kL = max(uCapture, uHunt)`, com `uHunt = smoothstep(0,15, 0,55, seek)·uR2`;
  - `mouseResolved ×= 1 − 0,9·kL`, covinha 9 px·(1 − kL), ganho da lente `mix(0,7, 0,3, kL)`;
  - `uR2` é um uniform novo, 1·ready só abaixo de vh 368. A partir de 368 os termos da rodada 1 voltam exatamente, e o programa só de corrente de C4/Ch2–Ch3 continua igual à v2;
  - o ganho menor só vale onde a lente domina. As contas carregadas pelo feixe mantêm o ganho da rodada 1 (o "brilho que revela como tinta").
- **P2, toque** (`Landing.tsx` → `PointField`/`NullField`/`types.setMouse(nx, ny, kind)` → `sonar.ts`): enquanto `sonar > 0`, um ponteiro de toque apaga o cursor (sem lente, rastro ou placas de cursor). A partir de vh 400, o próximo toque se comporta exatamente como na v2. Mouse e caneta não mudaram.
- **P3, rótulos** (`cinema/ch1/labels.ts`):
  - uma placa do cursor com força abaixo de 0,42 por 300 ms evapora e libera a vaga, e rótulos fracos nunca entram nem revivem;
  - `CURSOR_CAP_BUSY` de 2 para 1;
  - no máximo 3 placas (cursor + chip) com centro a menos de 420 px do cursor;
  - cada nome fica preso ao seu ponto durante a sessão e só é reatribuído (o menos usado recentemente) quando todos os nomes estão presos;
  - nenhum texto novo.
- **P4, anéis, pings e iscas** (`sweep.ts`):
  - centro e normal dos anéis com `mix(tr, uTravel[0], uMerge)`;
  - os pings somem com `1 − smoothstep(0,80, 0,94, seek)`, cerca de vh 314–329. Antecipei o corte pedido (0,88–1,0) porque ainda havia anéis de ping em 329,9;
  - nenhuma isca nova a partir de 330, e uma isca viva evapora a partir de 330 quando o risco termina.
- **P5, menisco** (`points.ts`): excesso 0,05, achatamento 1 − 0,85·f, faixa 0,12, piso de campo distante 0,42. Todos os termos × f/uCapture.
- **P6, câmera (parcial)** (`springs.ts`, `camlayer.ts`): fovKick 3,0°·pvelN com limite de 3,2° e antecipação de 0,22·pvelS, só abaixo de vh 400. O "lean" pedido foi recusado, porque `camLean`/`camLook` voltam a agir em C4 (1740–1885) com os valores da rodada 1.
- **P7, véu no retrato** (`beam.ts`): raio do esmaecimento 1,9 → 2,2 abaixo de vh 400. O setor de C4 continua em 1,9, e a paisagem não mudou.

**Fluidez, rodada 2 (70de6ed + a00d018).** O diretor de arte deu 7/8,5/6,5. Quatro pedidos aplicados, um parcial:

- **P1, placas que crescem linha a linha** com a tinta (`cinema/dossier/liquid.ts`, `dossier.css`, `ch4.css`), nos fechos de C2 e C3 e no fecho do Ch4:
  - antes do inchaço, a placa é uma pílula em volta da linha 1;
  - a borda de baixo acompanha o início de cada linha num único tween, que é uma função pura do vh, então funciona nos dois sentidos do scroll;
  - as laterais e o raio abrem para −96 px no fim (`openBy = sub.to − 4`);
  - o início das linhas é uma estimativa conservadora do motor de glifos: nenhum glifo cai fora do recorte;
  - o painel da contagem não mudou.
- **P2 (parcial), primeiro uso de programa GL:** `PointField.warmUp` agora deixa todo objeto escondido visível durante a parte síncrona do `compileAsync` e o desenho de aquecimento 1×1, e depois restaura. Antes, setor v3, fitas, linhas do instrumento e prefixo de poeira linkavam o programa no primeiro quadro visível, no meio do ato.
- **P3, fim de D9 1860 → 1870** (`dilation.ts`):
  - S_END fino 2872,8 → 2905,84 e grosso 2931,1 → 2964,86;
  - trilha do Ch4 905,3 vh (toque 922,7), espelhada em `landing.css`;
  - o assert de soma das trilhas fica calado em 1440 e 390.
- **P4, papel do dossiê:** `paperIn` 802–849 → 830–849 e `paperFade` 802–824 → 830–841 (`dossier.timeline.ts`). As chaves do RIG (`CARD_BUILD`, 800–850) não mudaram.
- **P5, subtítulo de C2 mais cedo:** `c2Sub` 1126–1150 → 1122–1146 e `D4.full` 1150 → 1146.

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
| Direção de arte: radar, rodada 2 (7 pedidos, P6 parcial) | `feature/landing-plano-sequencia` | 7a9ad7b | — | publicação 4, veredito "ajustar" |
| Direção de arte: fluidez, rodada 2 (5 pedidos, P2 parcial) | `feature/landing-plano-sequencia` | 70de6ed, a00d018 | — | publicação 4, veredito "ajustar" |
| `SPEC.md` = spec v3 + tabela de release (§13) | `feature/landing-plano-sequencia` | commit "v3 publicação 4 — onde parou" | — | publicação 4 |

- As rodadas de direção de arte foram feitas direto em `feature/landing-plano-sequencia`, sem branch própria.
- As branches `v3/wp5-type` e `v3/wp6-ch1rig` no GitHub estão atrás das locais (981223a e 9213e00). Os commits finais, c66c468 e ee64bd2, estão no histórico de `feature/landing-plano-sequencia`, então nada se perde.
- Os worktrees dos pacotes ficam em `.claude/worktrees/wf_d75d481f-949-{2..9}` (WP1 a WP8, na ordem). Podem ser apagados quando ninguém mais estiver trabalhando neles.

### Verificação da publicação 4 (release4)

- `npx tsc --noEmit` limpo, e `find src -name '*.js'` vazio antes e depois do build.
- **Build único.** O chunk da landing tem **1.107,94 kB brutos e 346,44 kB gzip**:
  - +70,4 kB acima da v2 (276 kB);
  - +2,35 kB acima da publicação 3 (344,09 kB);
  - **26,4 kB acima do teto de 320 kB**.

  Os outros chunks não mudaram: `main` 293,22 kB gzip e `TermosModal` 108,72 kB gzip. Não há dependência npm nova.
- **Smoke do build** (`vite preview` em :5190, 1440×900 e 390×844, 34 quadros em cada tamanho):
  - o Gateway sobe e entra;
  - os quadros cobrem 25 posições do cinema até o Ch5, os planos (Ch5 p0/0,18/0,5/1), os topos de Ch6, Ch7, Ch8 e da seção de sinais, e o fim da página;
  - aparecem o feixe com pings e rótulos, a esfera escura, o interior com letras derramando e evaporando, o dossiê em cápsulas, a estimativa, o recuo ao universo e o dock com imperativos;
  - nenhum quadro em branco, quebrado ou sobreposto;
  - os planos têm o mesmo layout do baseline. Só a poeira viva difere, porque o baseline foi capturado com o tempo congelado, e em 390 o dock do p0 é a pílula da v3 (igual às publicações 2 e 3);
  - no console aparecem só os 500 de `/api` (não há backend local atrás do proxy) e o aviso `KHR_parallel_shader_compile` do SwiftShader.
- **App (`/`):** renderiza em 1440 e 390 sem erro de JS. Só aparecem os 500 de `/api`, pelo mesmo motivo.
- O build de produção não tem o gancho `__cxPlayhead`, então o smoke posiciona por scroll e não por vh do master. As ferramentas são `release4/tools/smoke-prod.cjs` e `app-check.cjs`, as mesmas da publicação 3.
- Capturas e folhas de contato ficam em `scratchpad/work/v3qa/release4/`:
  - `smoke1440/` e `smoke390/`;
  - `sheet1440-1.png`, `sheet1440-2.png` e `sheet390-1.png`;
  - `cmp1440x900/`, `cmp390x844/`, `cmpsheet1440-1.png` e `cmpsheet390-1.png`, com os pares baseline × v3 do Ch5;
  - `app-1440x900.png` e `app-390x844.png`.
- **Não verificado nesta publicação:**
  - o §11 completo no 680M e num celular;
  - uma passada real na roda a 50 vh/s (`raf.json`);
  - o espelho das trilhas de toque em execução;
  - o desempenho do programa sonar em 1112–1552 e dos quadros de 26–31 ms (906, 1110,8 e 1852) no 680M;
  - o contador de pings por volta da saliência.

### Registro da publicação 4

Em andamento quando este commit foi feito: push de `feature/landing-plano-sequencia`, merge em `main` no worktree `genesis-open`, `deploy.sh` e conferência no ar. O resultado entra no commit seguinte deste arquivo.

### Histórico: publicação 3 (2026-10-29 19:22)

- `main` 9c2f465 (`merge: landing v3 — publicação 3`), enviado ao GitHub. O merge não teve conflitos.
- Chunk da landing: 344,09 kB gzip.
- O deploy foi negado pela permissão do Claude Code (classe "Production Deploy"). O servidor ficou em 44e879b (v2).
- O detalhe está no histórico do git deste arquivo (3b74d79).

### Histórico: publicação 2 (2026-10-29 16:51)

- `main` 38b6b56 (`merge: landing v3 — publicação 2`), enviado ao GitHub. O merge não teve conflitos. Fora de `frontend/`, só o `deploy/deploy.sh` de `main` (3b5a16f) difere da branch, e ficou o de `main`.
- Chunk da landing: 342,40 kB gzip.
- O deploy foi negado pela permissão do Claude Code. O servidor ficou em 44e879b (v2).
- O checklist do §11 da integração B (o que passou, o que ficou parcial e o que falhou) está no histórico do git deste arquivo (faf7de8) e em `scratchpad/work/v3qa/intB/checklist.md`.

### Histórico: publicação 1 (2026-10-29 16:05)

- `main` acef69a (`merge: landing v3 — publicação 1`), enviado ao GitHub.
- Chunk da landing: 317,70 kB gzip.
- O deploy foi negado pela permissão do Claude Code. O servidor ficou em 44e879b (v2).
- O detalhe da integração A está no histórico do git deste arquivo (795edf3).

## O que ainda NÃO foi feito

1. **Aprovação da direção de arte.** As duas rodadas 2 terminaram em "ajustar", e a rodada 3 não começou. O que os próprios agentes deixaram como próximo passo:
   - **quadros longos:** perfilar os quadros isolados de 26–31 ms em 906, 1110,8 e 1852 com um trace real do Chrome Performance (as entradas de long-animation-frame só disparam a partir de 50 ms e não deram atribuição). Testar de novo as travadas de 124 e 888 numa máquina ou perfil frio, para confirmar que o aquecimento GL de todos os objetos escondidos as remove;
   - **anel do disco em C4a/C4b:** o diretor de arte precisa decidir se o anel deve abraçar o disco (folga ≈ 3) durante toda a fase do disco. Um anel em r + 3 só em 1626–1645 saltaria 11 px na trava de 1645;
   - **câmera de J1:** o "lean" da rodada 2 foi recusado (ver P6). Se o diretor de arte quiser mais movimento na paralaxe, o próximo botão é a diferença de alvo entre os nós 1 e 2 de `CAMERA.seek`;
   - **C2 a 50 vh/s:** na rodada 1, o subtítulo ficava 3,17 s visível, contra 3,4 s de necessidade. A rodada 2 adiantou `c2Sub` em 4 vh, mas ninguém mediu de novo. Se ainda faltar, subir D4 K para cerca de 4,7;
   - **cápsula das placas:** durante o derramar linha a linha, as laterais ficam na borda do papel, então a sombra lateral e a de baixo ficam cortadas até a abertura final em [sub.to − 7, sub.to − 4];
   - **contagem em 1654:** os rolos borrados "000.000" aparecem cerca de 2 vh antes de a cápsula condensar em volta;
   - **rótulos no celular:** uma placa que a câmera leva até a borda superior evapora a 4 px, mas some no lugar e pode ser cortada pela borda durante o esmaecimento (visto em 390, vh 180). A rodada 2 não tratou isso.
2. **Divisão do chunk da landing:** carregar o campo (Three.js, `PointField`, shaders) sob demanda, de modo que o Gateway funcione sem ele.
   - O campo hoje é criado num layout effect antes do boot do Gateway (`Landing.tsx`, `createField`). O boot escreve `runtime.field.time`.
   - Caminho sugerido: começar com o `NullField` (feixe CSS) e trocar pelo `PointField` quando o `import()` resolver, ainda atrás do Gateway. O import já sai no carregamento da página.
   - Sem isso, o chunk fica acima de 320 kB.
3. **§10.2 passo 1:** apagar as entradas v2 sem uso do `SCORE` (`sweepGain`, `ring0..3`, `ticks`, `cross`, `STATIONS`) e provar com `tsc` que nada mais as lê. Não foi feito: muda código, e esta etapa era só de publicação.
4. **Item 1 (Ch5+):** o antialiasing LCD × cinza no cabeçalho e no rodapé depois de um salto. Investigar a composição (camadas `will-change` dos chips v2 que sumiram), ou aceitar na revisão final.
5. **Câmera em J3 a 390:** o deslocamento de zoom em 400–440 (pontos viram anéis, a borda da esfera fica deslocada) vem da integração A. Itens 30 e 31 em 390.
6. **Medições pendentes:**
   - GPU p95 de J1/J2 no 680M (`?cx-perf`; a estimativa fica perto do limite de 4,0 ms), agora também com o programa sonar em 1112–1552;
   - itens 41–44 (desempenho no 680M, CPU×4, celular, layouts);
   - uma passada real na roda a 50 vh/s (`raf.json`) e o espelho das trilhas de toque em execução;
   - saliência: o `salience.cjs` não achou o contador de pings por volta, então o critério (b) ficou sem prova da ferramenta. Os pings aparecem nos quadros;
   - refazer a fixação de 400/420 em 1440 contra uma referência nova (a diferença de 464/542 px de bordas de conta é atribuída à idade da referência pin2);
   - comparar pixel a pixel os quadros de 380/390, que mudam pelos termos do menisco × uCapture (permitido pelo §1.4.5);
   - uma faixa de quadros com rajada de roda para o fovKick e a antecipação de J1 (P6 do radar foi conferido só numericamente);
   - vídeos lado a lado (0–352 e 368–770), item 22, sonda Hough do item 18;
   - uma passagem num celular de verdade.
7. **Pendências pequenas:**
   - o fallback estático `LABEL_CHIP` continua, porque o `LabelPicker` precisa dele antes do primeiro `setLabelChip`;
   - o gancho `window.__cxLenis` foi revertido, porque quebrava a rolagem do QA depois do fim do master;
   - ferramentas de QA: em 390, a máscara do dock não cobre a pílula, que fica acima da caixa de `.lp-scrollcue`. Os quadros dourados dentro de atos rápidos precisam de `capture3 --pin`. Nos quadros dourados do interior, o verbo do dock depende do tempo parado ("ENTRANDO NA EMPRESA" × "continue rolando"): capturar os dois lados com a mesma espera;
   - um `glyphs.ts` não rastreado na raiz do repositório, de outro agente. Ficou intocado e fora dos commits.

## Próximos passos, na ordem

1. **Se o deploy desta publicação não tiver rodado** (ver "Registro da publicação 4"): rodar o `deploy.sh`, conferir o SHA no servidor e conferir no ar, como está lá. Ou decidir segurar a v3 e reverter os merges em `main`, pelo caminho descrito no mesmo lugar.
2. **Dividir o chunk** (item 2 acima) e medir de novo. A meta é ≤ 320 kB, e o ideal ≤ 291 kB.
3. **Rodada 3 de direção de arte,** com nota nova sobre a publicação 4. Começar pelos pontos do item 1 acima. Resolver junto R6 não estático, o pico de atraso do playhead (10,7–10,9 vh) e a câmera em J3 a 390.
4. **§11 completo,** incluindo hardware (680M e celular), e o §10.2 passo 1 (item 3 acima).
5. **Revisão final** com os quadros dourados e os vídeos lado a lado (§10.2 passo 4).

## Problemas conhecidos (vão ao ar com a publicação 4)

- **Chunk da landing:** 346,44 kB gzip, acima do teto de 320 kB. Carregamento inicial mais pesado; nenhum efeito na fluidez depois de carregado.
- **Página mais longa:** do topo aos planos, o scroll ficou 52,9 % maior no desktop (S_END 2905,84) e 56,0 % maior no toque (2964,86). Todo o acréscimo está dentro dos trechos de leitura.
- **Ch5+, cabeçalho e rodapé:** antialiasing LCD em vez de cinza depois de um salto. Só pixels; o layout e as fontes são iguais.
- **Câmera em J3 a 390:** o deslocamento de zoom em 400–440.
- **R6 não é estático,** por causa do fovWiden da v2 em 1552–1568. Corrigir quebra a paridade de câmera do item 30.
- **Atraso do playhead:** o pico fica em 10,7–10,9 vh a 40 vh/s (a meta é ≤ 10). Subir `SPRINGS.follower` ω de 8 para ~8,6 resolve, se a meta valer como pico.
- **Orçamento de GPU no 680M** ainda não medido, nem em J1 nem com o programa sonar em 1112–1552. A escada de sub-passos do governador e o tier de texto são a rede de segurança.
- **Quadros isolados de 26–31 ms** em 906, 1110,8 e 1852 (headless), sem causa atribuída.
- **Iscas em 390:** só a isca de 262 aparece no retrato (WP3 escolhe as outras fora da tela).
- **Rótulos no celular:** uma placa levada até a borda pode aparecer cortada enquanto evapora.

## Changelog para o usuário (§10.2 passo 9)

**O que mudou da v2 para a v3, do Gateway até os planos** (os planos e tudo depois deles continuam iguais):

- **Radar:** um feixe de fósforo varre o campo, as empresas acendem como contas de tinta e deixam um brilho residual, e os pings marcam o que o radar encontra. O radar caça entre iscas riscadas, trava na empresa e os anéis escorrem até o retículo. O cursor age como uma lente sobre o campo, e na captura a superfície forma um menisco.
- **Letras líquidas:** os textos derramam glifo a glifo como tinta, condensam como luz no interior escuro e evaporam ao sair. As placas dos fechos crescem linha a linha atrás da tinta.
- **Câmera viva:** a câmera segue o scroll com uma mola (sem trancos), inclina, respira e deriva de leve, e reage à velocidade da roda.
- **Tempo de leitura:** os trechos escritos seguram o scroll (dilatação), para dar tempo de ler sem parar de rolar a roda. A página ficou 52,9 % mais longa até os planos no desktop e 56,0 % no toque, e todo o acréscimo está dentro dos trechos de leitura.
- **Forma:** os elementos quadrados viraram cápsulas, círculos e cantos arredondados. O dock virou uma pílula com imperativos ("role para…") e um medidor de leitura.
- **Interior (esfera escura):** preservado. Mudou só o que o §1.4 da spec permite: o respiro condensa em glifos com as mesmas cores e tempos, a etiqueta da empresa fica numa placa-cápsula, e os termos do sonar se apagam em 368–398.

**Padrões decididos** (`SPEC.md` §10.3), cada um com sua chave em `cinema/flags.ts`:

| Decisão | Padrão | Chave |
|---|---|---|
| Página mais longa, com o acréscimo dentro dos trechos de leitura | ligado | `DILATION`, `TOUCH_DILATION` |
| Respiro com letras condensando em glifos | ligado | `GLYPHS` |
| Resfriamento glifo a glifo no respiro | **desligado** (preserva o interior) | `RESPIRO_GLYPH_COOL` |
| Borda radial ao entrar na esfera | **desligado** (preserva o interior) | `RIMIN_RADIAL` |
| Etiqueta da empresa numa placa-cápsula | ligado | `TAG_PLATE` |
| Chips de eco e iscas com os nomes fictícios já existentes | ligado | `ECHO_CHIPS`, `DECOY_CHIPS` |
| Imperativos e medidor de leitura no dock | ligado | `DOCK_LEAD`, `DOCK_METER` |
| Estações "Estimativa" e "Universo" trocam em 1198 e 1602 | ligado | tabela `STATIONS` |

**Como desligar qualquer parte:** em produção, mudar a chave em `cinema/flags.ts` e publicar de novo. Em desenvolvimento, dá para testar sem mudar código com `?cx-flags=CHAVE=0` (por exemplo `?cx-flags=SONAR=0,GLYPHS=0`). `SONAR=0` volta ao radar da v2, `GLYPHS=0` volta às palavras inteiras, `DILATION=0` volta ao scroll 1:1 e `CAM_LIFE=0` tira a vida da câmera.

## Como publicar

Segue §10.2 da spec. Em resumo:

1. Em `frontend/`: rodar `npx tsc --noEmit` e um único `npm run build`. Em seguida, `find src -name '*.js'` precisa voltar vazio.
2. Smoke do build com `npx vite preview --port 5190 --strictPort` (e a trava do navegador) em 1440×900 e 390×844, do Gateway aos planos, mais o app em `/`. As ferramentas estão em `scratchpad/work/v3qa/release4/tools/` (`smoke-prod.cjs` e `app-check.cjs`).
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

Para desligar uma parte da v3 sem reverter código, use as chaves em `flags.ts`. Os padrões decididos estão no §10.3 da spec.

Arquivo atualizado a cada publicação.
