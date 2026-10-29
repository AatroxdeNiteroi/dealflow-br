# v3 "Sonar Líquido": onde parou

Registro do andamento da rodada v3 da landing (radar, letras líquidas, câmera viva, textos com mais tempo de leitura). A especificação completa é `SPEC-v3.md`, nesta pasta: §10 lista os pacotes, §10.1 a ordem de merge, §10.2 a publicação e §11 o checklist de aceite. `SPEC.md` continua sendo a v2, que vale para tudo o que a v3 ainda não trocou.

## Estado em 2026-10-29 15:56 (America/Sao_Paulo)

**Publicação 1 da v3 (integração A):** é a que vai ao ar com este commit. A integração está em `feature/landing-plano-sequencia` a527abd, mais este registro. O merge em `main`, o deploy e a conferência no ar estão anotados abaixo, em "Registro da publicação 1". Antes dela estava no ar `main` 44e879b, a v2 com as correções de QA.

### O que a publicação 1 contém

- **Playhead líquido (WP1):** a dilatação dá mais tempo de leitura nos trechos escritos sem que o scroll pare, e o snap virou redirecionamento.
- **Câmera viva (WP4):** trajeto de busca com rolagem, molas e deriva em Ch2–Ch3, mantendo as matrizes da v2 de 352 a 1112.
- **Radar sonar (WP2 + WP3):** feixe de fósforo com borda curva, contas de tinta, pings com brilho residual, ecos, caça ao alvo com iscas, anéis que drenam no alvo e captura com halo de contas. O universo oculto e a corrente também entram. Sem WebGL, o feixe CSS assume.
- **Costuras da integração A** (a527abd): beats, geometry, landing.css e shader do feixe.
- **Ainda como na v2:** letras (WP5), DOM do Ch1 (respiro, cápsulas, HUD e chips, WP6), dossiê e Ch4 (WP7), dock e guia (WP8).
- **Ch5 em diante intocado:** diff de 0 px contra o baseline (§11 item 1).

### Pacotes (cada um tem uma branch `v3/*`)

| Pacote | Branch | Commit | Situação |
|---|---|---|---|
| WP0 contratos, tabelas, dilatação, eases | `feature/landing-plano-sequencia` | 608f479 | publicado (publicação 1) |
| WP1 playhead líquido, dilatação, snap | `v3/wp1-playhead` | ebcb8fa | publicado (publicação 1) |
| WP2 feixe sonar de fósforo, caça, anéis | `v3/wp2-beam` | ee53a66 | publicado (publicação 1) |
| WP3 campo: contas de tinta, pings, ecos, menisco | `v3/wp3-field` | 59d7f1f | publicado (publicação 1) |
| WP4 câmera viva: molas, rolagem, deriva | `v3/wp4-camera` | ed44dfd | publicado (publicação 1) |
| WP5 motor de glifos (letras líquidas) | `v3/wp5-type` | 82db11a local (wip); no GitHub, 981223a | em andamento no worktree |
| WP6 Ch1: respiro em glifos, cápsulas, HUD, chips | `v3/wp6-ch1rig` | ee64bd2 local; no GitHub, 9213e00 (wip) | sendo finalizado no worktree; conferir o relatório antes do merge |
| WP7 dossiê e Ch4 líquidos | `v3/wp7-dossier` | 723c001 | pronto, falta mergear |
| WP8 dock líquido, medidor de leitura e ferramentas de QA | `v3/wp8-guide` | 7468ee2 | pronto, falta mergear |

Os worktrees dos pacotes ficam em `.claude/worktrees/wf_d75d481f-949-{2..9}` (WP1 a WP8, na ordem).

### Integração A (WP1 → WP4 → WP2 → WP3)

Merges 3d83fa4 (WP1), b92874f (WP4), 436e896 (WP2) e 0952f47 (WP3), mais as costuras em a527abd. O checklist do §11, como ficou:

- **Passam:**
  - item 1, Ch5–Ch8 com 0 px nos dois tamanhos (só ruído de captura ≤ 3 LSB num ponto da linha do dock em 390);
  - 1b, fontes;
  - 2, parque 1900/1960;
  - 3, neutro no parque;
  - 5, tsc, sem .js e sem erros;
  - 14, snap;
  - 15, fling no Ch5;
  - 19, feixe gira com a roda (θ(150) − θ(50) exato);
  - 21, 12 fontes de crista de eco;
  - 23, caça: 1 troca de sinal em 250–300 e θ(336) = β_SP;
  - 25, captura: capInside 0 em 300–368;
  - 27, câmera: FOV 46° e rolagem 0 em 352;
  - 29, reduced motion e `?nowebgl`;
  - 45, saliência em GPU real (razões 0,849 / 0,868 / 1,085 / 1,08).
- **Parciais:**
  - item 12: o pico de atraso é 10,7–10,9 vh contra ≤ 10 (a média passa);
  - 13: R6 não fica estático por causa do fovWiden da v2;
  - 18: a sonda Hough não foi refeita depois do merge;
  - 20: falta o amostrador de matiz;
  - 24 e 26: o anel e o pulso de travamento dependem do WP6;
  - 28: o universo oculto não foi medido em hardware;
  - 30 e 31: o campo está idêntico; as diferenças estão só em caixas do DOM, e a tag do RIG fica deslocada em 420/440 por um termo de histórico da v2;
  - §10.1: há tiras lado a lado e uma passagem ao vivo em 1440, mas nenhum vídeo.
- **Não verificados:** item 8 (harness de leitura, depois do WP7), item 22 (pré-sinal da esfera) e item 41 (GPU de J1/J2 no 680M).

### Verificação da publicação 1 (release1)

- `npx tsc --noEmit` limpo e `find src -name '*.js'` vazio, antes e depois do build.
- **Build único:** o chunk da landing tem 1.034,24 kB brutos e **317,70 kB gzip**. A v2 tinha 276 kB, então são **+41,7 kB**: acima da folga de +15 kB e abaixo do teto de 320 kB. A conta inclui as ~10 mil linhas novas do sonar, da câmera e do playhead; os ganchos de dev não entram no bundle.
- **Smoke do build (`vite preview`) em 1440×900 e 390×844:**
  - o Gateway sobe e entra;
  - o cinema inteiro tem 25 posições até o Ch5 e mostra o feixe, os pings, o alvo, o interior, o dossiê e o universo;
  - os planos (Ch5 p0/0,18/0,5/1) estão iguais ao baseline; só a poeira viva difere, porque o baseline foi capturado com o tempo congelado;
  - Ch6–Ch8 e o fim da página também estão iguais;
  - no console aparecem só os 500 de `/api` (não há backend local atrás do proxy) e o aviso `KHR_parallel_shader_compile` do SwiftShader.
- **App (`/`):** renderiza em 1440 e 390 sem erro de JS; só os 500 de `/api`, pelo mesmo motivo.

### Registro da publicação 1

(Preenchido depois do deploy, no commit seguinte deste arquivo.)

## O que ainda NÃO foi feito

1. **Integração B:** WP5, WP6, WP7 e WP8 (letras líquidas; respiro em glifos, cápsulas, HUD e chips; dossiê e Ch4 líquidos; dock líquido com medidor de leitura). Nada disso está no ar.
2. **Hand-off do travamento (WP6):**
   - ligar `field.ringScreen(0)` a um retículo DOM redondo que aparece em 340–348;
   - animar `field.time.lockPulse` de 1 a 0 no ato do travamento.

   Até lá, os anéis GL somem no travamento e sobram só os cantos da v2.
3. **Chips de eco e de isca (WP6):** chamar `field.setPinned` com os índices de `frameData.echoes`. As marcas já são emitidas (ECHO_CHIPS e DECOY_CHIPS ligados), mas o DOM ainda não as usa.
4. **Medições pendentes:**
   - item 22;
   - a sonda Hough do item 18 depois do merge;
   - uma passagem ao vivo em 390;
   - o vídeo lado a lado;
   - o GPU p95 de J1 no 680M (com o `?cx-perf` do WP8; a estimativa é de ~3,9 ms, perto do limite de 4,0 ms);
   - o item 8 (harness de leitura).

## Próximos passos, na ordem

1. **WP5 e WP6:** terminar nos seus worktrees (`wf_d75d481f-949-6` e `-7`), com o relatório de cada pacote.
2. **Integração B (WP5 → WP6 → WP7 → WP8)** em `feature/landing-plano-sequencia`:
   - ligar `ringScreen`/`lockPulse`/`setPinned` (itens 2 e 3 acima);
   - rodar o §11 inteiro, incluindo os itens 8, 18, 22 e 41;
   - medir o bundle: com os pacotes 5 a 8, o chunk da landing tende a passar de 320 kB gzip. Nesse caso, dividir antes de publicar, por exemplo carregando o campo e o Three.js sob demanda depois do Gateway.

   Depois disso, commitar e **publicar (publicação 2)**.
3. **Direção de arte:** rodadas de crítica e ajuste, primeiro do radar (0–400) e depois da fluidez do filme inteiro. **Publicar (publicação 3).**
4. **Final (§10.2 passo 9):**
   - apagar de `cinema/dev/assert.ts:217` as entradas v2 `sweepGain`/`ring0..3`/`ticks`/`cross` e a linha `sweepGain`, quando todos os consumidores já leem os canais `_v3`;
   - trocar `SPEC.md` por `SPEC-v3.md`;
   - passar o changelog ao usuário.

## Problemas conhecidos (no ar com a publicação 1)

- **Depois do travamento (vh 348) não há anel redondo:** ficam os cantos da v2 até o WP6 entrar.
- **Dock em trânsito:** nas capturas em vh de trânsito aparece o "CONTINUE ROLANDO" da v2. É por tempo, e o assentamento da v3 demora mais; o WP8 resolve.
- **R6 não é estático,** por causa do fovWiden da v2 em 1552–1568. Corrigir quebra a paridade de câmera do item 30. Decidir na revisão final.
- **Atraso do playhead:** o pico fica em 10,7–10,9 vh a 40 vh/s (a meta é ≤ 10). Subir `SPRINGS.follower` ω de 8 para ~8,6 resolve, se a meta valer como pico.
- **Orçamento de GPU de J1 no 680M** ainda não medido. A escada de sub-passos do governador é a rede de segurança.
- **Bundle da landing:** +41,7 kB gzip sobre a v2 (317,70 kB), perto do teto de 320 kB.

## Como publicar

Segue §10.2 da spec. Em resumo:

1. Em `frontend/`: rodar `npx tsc --noEmit` e um único `npm run build`. Em seguida, `find src -name '*.js'` precisa voltar vazio.
2. Smoke do build com `npx vite preview --port 5190 --strictPort` (e a trava do navegador) em 1440×900 e 390×844, do Gateway aos planos, mais o app em `/`.
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
