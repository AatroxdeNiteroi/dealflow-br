# Dia 03 — 3 de julho de 2026

> Continuação direta do [`dia-30.md`](dia-30.md) (30 de junho). **Hoje o Genesis
> Radar foi ao ar em produção** (modo *staging*). Este arquivo é o handoff: o que
> já está no ar, como a próxima sessão retoma, e o que falta.

---

## 🟢 Estado atual — o que JÁ está no ar

- **Site LIVE:** `https://app.genesisradar.com.br` (HTTPS válido, Let's Encrypt).
  Modo **staging**: funciona de ponta a ponta, mas **ainda não cobra de verdade**.
- **Servidor:** DigitalOcean droplet 1 GB (NYC), IP **`137.184.138.199`**.
  - Acesso: **`ssh deploy@137.184.138.199`** (chave privada em `~/.ssh/id_ed25519`
    na máquina do Daniel; root e senha do SSH estão **desativados**).
  - `deploy` tem sudo sem senha. Serviço da app roda como usuário **`genesis`**.
- **Arquitetura no droplet:** Caddy (HTTPS + estático + proxy `/api`) → uvicorn
  (`systemd genesis-api`, 127.0.0.1:8000). Repo em **`/opt/genesis`** (dono `genesis`).
  `users.db` (SQLite) em `/opt/genesis/backend/`. `.env` de prod em
  `/opt/genesis/backend/.env` (perm 600, **fora do git**).
- **Staging quer dizer:**
  - **Stripe em TEST** → checkout funciona com cartão `4242 4242 4242 4242`, sem cobrança real.
  - **Email via `onboarding@resend.dev`** → verificação de conta só chega **no email
    da conta Resend** (o seu). Pra testar o funil: cadastre com **o seu próprio email**.

---

## 📖 Próxima sessão do Claude — LEIA ANTES DE MEXER

⚠️ **Isto é um servidor de PRODUÇÃO no ar.** Toda ação em `137.184.138.199` afeta o
site real. Verifique antes de aplicar; nada de reload/restart às cegas.

**Ordem de leitura:**
1. **Memória `stripe-login-setup-progresso`** (vem no recall automático) — estado
   completo do deploy, decisões, e os **3 gotchas de boot**.
2. **`docs/deploy.md`** — o "como": decisão de hospedagem (§0), Caddy (§3),
   **checklist de env vars (§4)**, Stripe (§5). ⚠️ A versão atualizada está no
   **PR #1** (branch `deploy/digitalocean-setup`) — **mergeie pra ter na `main`**.
3. **`deploy/README.md`** — setup turnkey do servidor + **como redeployar**.
4. **Este arquivo** — o que falta.
5. **`dia-30.md`** — passos detalhados das Fases 3/4/7/8.

**Como redeployar código novo (depois de commitar+pushar na `main`):**
```bash
ssh deploy@137.184.138.199
sudo -iu genesis /opt/genesis/deploy/deploy.sh   # git pull + build + uv sync + restart + health
```
⚠️ **O clone atual em `/opt/genesis` é da `main` SEM a pasta `deploy/`** (o PR #1
ainda não foi mergeado). Antes do 1º redeploy: mergear o PR **e** rodar
`cd /opt/genesis && sudo -u genesis git pull` pra o `deploy.sh` existir lá.
Enquanto isso, dá pra redeployar na mão: `git pull` → `cd frontend && npm ci &&
npm run build` (como genesis) → `cd ../backend && uv sync` → `sudo systemctl restart genesis-api`.

**3 gotchas que MORDEM (já em `docs/deploy.md` §4, mas reforçando):**
1. `DEALFLOW_CORS_ORIGINS` **tem que ser JSON array** `["https://..."]`, **não CSV**
   (o pydantic-settings pinado decodifica listas como JSON na fonte).
2. `DEALFLOW_SOCIOS_SALT` **não vai no `backend/.env`** — é build-time only; o
   `Settings` tem `extra=forbid` e aborta o boot se achar essa chave.
3. **Caddyfile usa blocos `handle`** pro `/api/*` ir pro backend antes do fallback
   SPA. Com `try_files` global, toda rota de API volta o HTML do app.

---

## ⬜ O que FALTA (tarefas de hoje/próximas sessões)

### 1. 🐛 Usar o site pra pegar merdinhas pequenas e corrigir o fluxo
> **Prioridade de UX.** Com o site no ar, dá pra ver os defeitos reais que não
> aparecem no código.
- Abrir `https://app.genesisradar.com.br` e **usar de verdade**, como um cliente:
  criar conta (com o email da conta Resend, pra receber a verificação) → verificar
  → escolher plano → checkout com cartão `4242` → cair no radar → navegar, buscar
  empresas, abrir detalhes, testar a Busca IA, o Customer Portal, logout/login, etc.
- **Anotar cada "merdinha":** texto quebrado/placeholder, link/rota errada, layout
  torto no mobile, estado que não atualiza, erro no console do navegador, mensagem
  de erro feia, passo confuso do funil, 404/500, cookie/sessão estranha, botão que
  não faz nada, loading infinito, etc.
- **Corrigir no código → testar local → redeployar.** Foco no polish do funil
  **cadastro → verificação → checkout → radar** e na UX geral.
- Dica: o Claude pode **abrir o site e navegar** (ferramentas de browser/verify)
  pra reproduzir e confirmar cada correção.

### 2. Mergear o PR #1
- https://github.com/AatroxdeNiteroi/dealflow-br/pull/1 — leva `deploy/` + docs
  (4 commits, com os 3 gotchas) pra `main`. Depois: `cd /opt/genesis &&
  sudo -u genesis git pull` no droplet pra trazer a pasta `deploy/`.

### 3. Fase 3 — Resend: email pra QUALQUER um
> Passos completos em [`dia-30.md`](dia-30.md) §Fase 3.
- Verificar o domínio **`genesisradar.com.br`** no Resend (adicionar SPF/DKIM/DMARC
  no Cloudflare). Esperar status **Verified**.
- No `/opt/genesis/backend/.env`, trocar `DEALFLOW_EMAIL_FROM` de `onboarding@resend.dev`
  para `"Genesis Radar <radar@genesisradar.com.br>"` → `sudo systemctl restart genesis-api`.

### 4. Fase 4 — Stripe LIVE: cobrança real
> Passos completos em [`dia-30.md`](dia-30.md) §Fase 4.
- Ativar a conta no Stripe (dados da empresa/CNPJ + banco). Pegar `sk_live_...`.
- Semear os 6 preços no modo **live** (`scripts/stripe_seed.py`).
- Registrar o **webhook hospedado** em `https://app.genesisradar.com.br/api/v1/billing/webhook`
  (eventos de checkout/subscription/invoice) → copiar o `whsec_...`.
- No `.env`: trocar `DEALFLOW_STRIPE_SECRET_KEY` (test→live) e
  `DEALFLOW_STRIPE_WEBHOOK_SECRET` (do endpoint hospedado) → restart.
- Habilitar o Customer Portal no Stripe.

### 5. Fase 8 — Manutenção
- **Backup diário do `users.db`** (`/opt/genesis/backend/users.db`) — cron → storage
  externo. É o cadastro dos clientes; sem backup, perda é irreversível.
- (Ao escalar) migrar SQLite → Postgres e rate-limit/throttle em memória → Redis
  (o serviço é **single-process** de propósito por causa disso — ver
  `deploy/genesis-api.service` e `docs/security.md`).

---

## Referência rápida
| Preciso de… | Onde |
|---|---|
| Estado do deploy + gotchas | memória `stripe-login-setup-progresso` |
| Como (runtime/env/Caddy/Stripe) | `docs/deploy.md` (PR #1) |
| Redeploy / setup do servidor | `deploy/README.md` + `deploy/deploy.sh` |
| Passos Fases 3/4/7/8 | `dia-30.md` |
| Segurança | `docs/security.md` |
| Acesso ao servidor | `ssh deploy@137.184.138.199` |
