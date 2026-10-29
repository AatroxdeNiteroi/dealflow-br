# v3 "Sonar Líquido": onde parou

Registro do andamento da rodada v3 da landing (radar, letras líquidas, câmera viva, textos com mais tempo de leitura). A especificação completa é `SPEC-v3.md`, nesta pasta: §10 lista os pacotes, §10.1 a ordem de merge, §10.2 a publicação e §11 o checklist de aceite. `SPEC.md` continua sendo a v2, que é a versão no ar.

## Estado em 2026-10-29 15:30 (America/Sao_Paulo)

**Em produção:** `main` 44e879b, a v2 com as correções de QA. A v3 ainda não foi publicada.

### Pacotes (cada um tem uma branch `v3/*` no GitHub)

| Pacote | Branch | Commit | Situação |
|---|---|---|---|
| WP0 contratos, tabelas, dilatação, eases | `feature/landing-plano-sequencia` | 608f479 | pronto |
| WP1 playhead líquido, dilatação, snap | `v3/wp1-playhead` | ebcb8fa | pronto, já mergeado |
| WP2 feixe sonar de fósforo, caça, anéis | `v3/wp2-beam` | ee53a66 | pronto, já mergeado |
| WP3 campo: contas de tinta, pings, ecos, menisco | `v3/wp3-field` | 59d7f1f | pronto, já mergeado |
| WP4 câmera viva: molas, rolagem, deriva | `v3/wp4-camera` | ed44dfd | pronto, já mergeado |
| WP5 motor de glifos (letras líquidas) | `v3/wp5-type` | 981223a (wip) | em andamento |
| WP6 Ch1: respiro em glifos, cápsulas, HUD, chips | `v3/wp6-ch1rig` | 9213e00 (wip) | em andamento |
| WP7 dossiê e Ch4 líquidos | `v3/wp7-dossier` | 723c001 | pronto, falta mergear |
| WP8 dock líquido, medidor de leitura e ferramentas de QA | `v3/wp8-guide` | 7468ee2 | pronto, falta mergear |

### Integração A (radar: WP1 → WP4 → WP2 → WP3)

Os merges estão feitos em `feature/landing-plano-sequencia`: 3d83fa4, b92874f, 436e896 e 0952f47. Ficaram pendentes os ajustes de costura (beats, geometry, landing.css, shader do feixe), o checkpoint de saliência do radar e as capturas.

## Próximos passos, na ordem

1. **Integração A:** terminar as costuras, rodar a saliência (§11 item 45) e garantir que a página funcione inteira, do Gateway até o Ch5, com os pacotes 5 a 8 ainda na v2. Commitar e **publicar (publicação 1)**.
2. **WP5 e WP6:** terminar nas suas branches.
3. **Integração B (WP5 → WP6 → WP7 → WP8):** mergear e rodar o checklist do §11. Commitar e **publicar (publicação 2)**.
4. **Direção de arte:** rodadas de crítica e ajuste, primeiro do radar (0–400) e depois da fluidez do filme inteiro. **Publicar (publicação 3)**.
5. **Final:** trocar `SPEC.md` por `SPEC-v3.md` e passar o changelog para o usuário (§10.2 passo 9).

## Como publicar

Segue §10.2 da spec. Em resumo:

1. Rodar `npx tsc --noEmit` e um único `npm run build` em `frontend/`. Em seguida, `find src -name '*.js'` precisa voltar vazio.
2. Push de `feature/landing-plano-sequencia`.
3. No worktree `genesis-open` (branch `main`):
   - `git fetch`;
   - `git merge origin/main`;
   - `git merge origin/feature/landing-plano-sequencia`;
   - `git push origin main`.
4. Deploy: `ssh deploy@137.184.138.199`, depois `sudo -iu genesis /opt/genesis/deploy/deploy.sh`.
5. Conferir no ar `https://app.genesisradar.com.br/landing.html` em 1440×900 e 390×844.

Para desligar uma parte da v3 sem reverter código, use as flags em `flags.ts`. Os padrões decididos estão no §10.3 da spec.

Arquivo atualizado a cada publicação.
