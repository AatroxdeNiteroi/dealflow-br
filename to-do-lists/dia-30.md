# Dia 30 — 30 de junho de 2026

> Tarefa mapeada nesta sessão: **subir o Genesis Radar em produção, do zero**
> (incluindo comprar domínio), com login + paywall ligados e o hardening de
> segurança aplicado nesta sessão.
>
> Esta é a checklist **acionável e ordenada**. O *porquê* de cada peça está
> em [`docs/deploy.md`](../docs/deploy.md) (runtime, rewrites, nginx) e
> [`docs/security.md`](../docs/security.md) (estado de segurança). Faça na
> ordem — cada fase depende da anterior.
>
> **Estado ao fim da sessão do dia 30:** Stripe (teste) + Resend + login +
> paywall já plugados e funcionando **local**; backend sobe limpo com auth
> ligado; auditoria de segurança feita e hardening aplicado (61 testes
> verdes). Falta só o **deploy** abaixo. Segredos locais em `backend/.env`
> (gitignored) — NÃO viajam pro servidor; têm que ser setados de novo lá.

---

## 🟢 Atualização 03/07/2026 — deploy em execução

> Domínio **`genesisradar.com.br`** (registro.br) → app em **`app.genesisradar.com.br`**.
> Hospedagem: **DigitalOcean** droplet 1 GB (NYC, IP `137.184.138.199`) + swap 2 GB
> — Hetzner caiu por exigir passaporte. Racional em [`docs/deploy.md`](../docs/deploy.md) §0.
>
> - ✅ **Fase 1** (domínio + NS pro Cloudflare) · ✅ **Fase 2** (servidor provisionado,
>   endurecido, runtime instalado — banner abaixo).
> - ✅ **Fase 5** (`.env` de prod montado; `AUTH_SECRET` novo gerado no droplet;
>   Stripe em **TEST** por ora) · ✅ **Fase 6 parcial** (repo em `/opt/genesis`,
>   frontend buildado, `genesis-api` **ATIVO** em 127.0.0.1:8000, `/health`=200,
>   gate 401 ok). **HTTPS armado**: um vigia no droplet recarrega o Caddy sozinho
>   quando o DNS propagar → site live em **staging**.
> - ⏳ **Bloqueado no DNS** (NS ainda propagando). ⬜ **Falta**: Fase 3 (Resend
>   domínio), Fase 4 (Stripe LIVE + webhook hospedado), Fase 7 (verificação HTTPS).
> - 🐛 **2 gotchas de boot** (já em `docs/deploy.md` §4): `CORS_ORIGINS` tem que ser
>   **JSON array** (não CSV); `SOCIOS_SALT` é **build-time**, não vai no `backend/.env`.

---

## 🎯 Objetivo: qualquer usuário criar conta e usar

Duas peças, **ambas dependem de ter um domínio** (por isso a Fase 1 é comprá-lo):

1. **Email de verificação chegar em QUALQUER endereço** → verificar o domínio no
   **Resend** (Fase 3). Hoje, com `onboarding@resend.dev`, só o email da sua
   conta Resend recebe. Isso **não é limitação do nosso código** (ele já envia
   pra qualquer um) — é regra anti-spam de todo provedor de email: pra mandar
   pra terceiros, tem que provar que você é dono do domínio de envio (via DNS).
2. **Usuários alcançarem o site** → **deploy** num domínio com HTTPS (Fases 2/6).
   Hoje roda em `localhost` — só você acessa.

Enquanto não há domínio, o funil só dá pra testar com **o seu próprio email** (o
da conta Resend) ou em modo console (link no log do backend). "Aberto ao público"
= **domínio + Resend verificado + deploy**. O domínio é o pré-requisito comum —
compre uma vez, serve pras duas coisas.

---

## ⚠️ 3 armadilhas que derrubam o deploy (leia antes)

1. **`DEALFLOW_TRUSTED_PROXY_HOPS=1`** atrás de proxy (nginx/Vercel/Render).
   Sem isso, o backend vê o IP do proxy (127.0.0.1) como "o cliente" → o
   rate-limit junta todo mundo num bucket só e trava geral após 60 req/min.
2. **`DEALFLOW_APP_BASE_URL=https://app.SEU_DOMINIO`** — se ficar `localhost`,
   o link do email de verificação e o "voltou do checkout" apontam pro lugar
   errado. Ninguém consegue confirmar conta nem cair de volta no app.
3. **`users.db` em disco persistente.** SQLite é um arquivo. Em host que
   reseta disco a cada deploy (alguns PaaS), você **perde todos os usuários**.
   Use VPS com disco, volume persistente, ou migre pra Postgres antes.

---

## Fase 0 — Decisões (5 min)

- [x] **Nome do domínio:** `genesisradar.com.br` (registrando em 03/07/2026 no registro.br).
      App vai em `app.genesisradar.com.br` no resto da checklist.
- [x] **Modelo de hospedagem: A — VPS único, no DigitalOcean.** (decidido 03/07/2026)
  - **Provedor/instância:** DigitalOcean **Basic Droplet 1 GB** (1 vCPU / 1 GB /
    25 GB SSD, x86) — **US$6/mês**, disco persistente incluso, region **NYC**
    (~120 ms do BR). **+ swap de 2 GB** (absorve o pico do `npm run build`; o
    runtime do app fica em ~500 MB, então 1 GB basta).
  - **Por que DO e não Hetzner:** o Hetzner (CAX11, ~€3,79 — seria mais barato)
    exige **verificação por passaporte** no cadastro, que não temos. DO é **só
    cartão**. E 4 GB era folga: o app carrega só ~13 MB de parquets derivados
    (~500 MB residentes), então 1 GB + swap sobra.
  - **Stack:** Ubuntu 24.04 + **Caddy** (HTTPS automático) servindo o `dist/`
    estático + proxy `/api` → uvicorn (systemd). SQLite (`users.db`) no disco do
    droplet.
  - **Por quê (resumo):** é a opção mais barata **sem pegadinha** — cookie
    same-site e disco persistente do `users.db` resolvidos de graça, **zero
    mudança de código**. Os PaaS "grátis" quebram o nosso caso: Render free dorme
    + sem disco persistente (perde o cadastro); Vercel/Netlify só servem o front
    (backend continua precisando de disco pago + dor de cookie cross-host); Fly
    sai barato mas exige Docker + volume preso a região. Oracle "Always Free"
    seria R$0 mas recicla conta ociosa — risco pra guardar cliente pagante.
    **Racional completo em [`docs/deploy.md`](../docs/deploy.md) §0.**

> `SEU_DOMINIO` no resto deste arquivo = **`genesisradar.com.br`**; o app vive em
> **`app.genesisradar.com.br`**.

---

## Fase 1 — Comprar o domínio (15 min)

- [x] **`genesisradar.com.br` registrado e ativo no registro.br** (03/07/2026).
- [ ] **Recomendado — faça AGORA, em paralelo:** apontar os **nameservers para o
      Cloudflare** (plano free). É o gate de todo o DNS (registro A do app na
      Fase 2 + SPF/DKIM do Resend na Fase 3); a troca de NS propaga sozinha
      enquanto você provisiona o VPS. registro.br: painel do domínio → "DNS" →
      "Usar outros servidores DNS" → colar os 2 nameservers do Cloudflare.
- [x] Subdomínio do app: **`app.genesisradar.com.br`** (assumido no resto da checklist).

---

## Fase 2 — Provisionar o servidor (DigitalOcean · Modelo A · 20 min)

> ✅ **FEITO em 03/07/2026.** Droplet `genesis-app` (NYC1) no IP **137.184.138.199**.
> Acesso: `ssh deploy@137.184.138.199` (root e senha desativados; só chave).
> Instalado: swap 2 GB, `ufw` (SSH/80/443), `unattended-upgrades`, git, uv, Node 20,
> Caddy (tudo system-wide). **Pendência desta fase:** criar o registro **A**
> `app → 137.184.138.199` no Cloudflare (se ainda não fez).

- [x] **Criar a conta** em `cloud.digitalocean.com` (só **cartão**, sem passaporte;
      pode haver uma pré-autorização de ~US$1 no cartão).
- [ ] **Adicionar a chave SSH**: Settings → Security → **SSH Keys → Add SSH Key** →
      colar a **chave pública** (`~/.ssh/id_ed25519.pub`). (Ou já na criação do
      droplet, no passo *Authentication*.)
- [ ] **Criar o Droplet**: Create → Droplets →
  - **Region:** **New York** (NYC1/NYC3) — mais perto do BR (~120 ms).
  - **Image:** Ubuntu **24.04 LTS x64**.
  - **Type:** Basic → CPU **Regular (SSD)** → **US$6/mês** (1 vCPU / 1 GB / 25 GB).
  - **Authentication:** **SSH Key** (marcar a que você adicionou) — **não** use senha.
  - **Hostname:** `genesis-app` → **Create Droplet**. Anotar o **IP público**.
- [ ] **DNS** (no Cloudflare): registro **A** `app` → IP do droplet. Deixe
      **DNS-only** (nuvem cinza) pro Caddy tirar o cert Let's Encrypt; proxy
      laranja (CDN) só depois do cadeado verde.
- [ ] **Entrar via SSH**: `ssh root@SEU_IP` (aceitar o fingerprint na 1ª vez).
- [ ] **Swap de 2 GB** (absorve o pico do `npm run build` no box de 1 GB):
      ```bash
      fallocate -l 2G /swapfile && chmod 600 /swapfile
      mkswap /swapfile && swapon /swapfile
      echo '/swapfile none swap sw 0 0' >> /etc/fstab
      ```
- [ ] **Hardening do host** (ainda como root):
  - [ ] usuário não-root com sudo, copiar a chave SSH pra ele e **desligar
        senha/root** em `/etc/ssh/sshd_config` (`PasswordAuthentication no`,
        `PermitRootLogin no` → `systemctl restart ssh`).
  - [ ] firewall: `ufw allow OpenSSH && ufw allow 80,443/tcp && ufw enable`.
        (Se preferir, dá pra usar o **Cloud Firewall** grátis do painel DO também.)
  - [ ] `apt update && apt install -y unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades`
        (patches de segurança automáticos).
- [ ] **Instalar runtime**: `git`; **`uv`** (`curl -LsSf https://astral.sh/uv/install.sh | sh`);
      **Node 20+** (NodeSource); e **Caddy** (repo oficial `.deb` — HTTPS
      automático via Let's Encrypt, sem certbot).

---

## Fase 3 — Verificar o domínio no Resend (emails reais · 20 min + espera DNS)

> Hoje o `EMAIL_FROM` está em `onboarding@resend.dev` (só entrega pro seu
> próprio email). Pra mandar verificação pra **qualquer** cliente, verifique
> o domínio.

- [ ] Resend → **Domains** → Add Domain → `SEU_DOMINIO` (ou `mail.SEU_DOMINIO`).
- [ ] Adicionar no DNS os registros que o Resend mostrar: **SPF** (TXT),
      **DKIM** (CNAME/TXT) e, recomendado, **DMARC** (TXT).
- [ ] Esperar verificar (minutos a algumas horas). Status → **Verified**.
- [ ] No servidor, setar `DEALFLOW_EMAIL_FROM="Genesis Radar <radar@SEU_DOMINIO>"`
      (sai do `onboarding@resend.dev`).

---

## Fase 4 — Stripe em modo LIVE (cobrança real · 30 min)

> Hoje está em **teste** (`sk_test_`, cartão 4242). Para cobrar de verdade:

- [ ] **Ativar a conta** no Stripe (dados da empresa/CNPJ + conta bancária).
- [ ] Pegar a **Secret key LIVE** (`sk_live_...`) em dashboard → API keys
      (modo Live, não Test).
- [ ] **Semear os preços no modo live** (cria os 6 preços de novo, agora live):
      ```bash
      DEALFLOW_STRIPE_SECRET_KEY=sk_live_...  uv run python scripts/stripe_seed.py
      ```
- [ ] **Registrar o webhook hospedado**: Stripe → Developers → Webhooks → Add
      endpoint → `https://app.SEU_DOMINIO/api/v1/billing/webhook`. Eventos:
      `checkout.session.completed`, `customer.subscription.created`,
      `customer.subscription.updated`, `customer.subscription.deleted`,
      `invoice.payment_failed`. Copiar o **signing secret** (`whsec_...`).
      → substitui o `whsec_` do `stripe listen` local.
- [ ] Habilitar o **Customer Portal** (Stripe → Settings → Billing → Customer Portal).

---

## Fase 5 — Variáveis de ambiente no servidor (15 min)

> ⚠️ O `backend/.env` local **não vai** pro Git nem pro servidor. Setar tudo no
> painel de secrets do host / arquivo `.env` no servidor. Lista canônica em
> [`docs/deploy.md`](../docs/deploy.md) §4. Valores de **produção**:

- [ ] `DEALFLOW_ENV=prod` ← **liga as guardas fail-closed** (sem isso o servidor
      pode subir aberto). **Novo nesta sessão.**
- [ ] `DEALFLOW_TRUSTED_PROXY_HOPS=1` ← atrás de 1 proxy. **Novo nesta sessão.**
- [ ] `DEALFLOW_AUTH_SECRET=` ← `openssl rand -hex 32` (gerar um **novo**, não
      reusar o de dev). Trocar invalida sessões.
- [ ] `DEALFLOW_AUTH_REQUIRED=true` · `DEALFLOW_REQUIRE_SUBSCRIPTION=true`
- [ ] `DEALFLOW_COOKIE_SECURE=true` (em prod com auth, o boot **exige** isso)
- [ ] `DEALFLOW_APP_BASE_URL=https://app.SEU_DOMINIO`
- [ ] `DEALFLOW_CORS_ORIGINS=https://app.SEU_DOMINIO` (NUNCA `*` — o boot aborta)
- [ ] `DEALFLOW_RESEND_API_KEY=re_...` · `DEALFLOW_EMAIL_FROM="...@SEU_DOMINIO"`
- [ ] `DEALFLOW_STRIPE_SECRET_KEY=sk_live_...` · `DEALFLOW_STRIPE_WEBHOOK_SECRET=whsec_...`
- [ ] `DEALFLOW_ANTHROPIC_API_KEY=sk-ant-...` (Busca IA)
- [ ] `DEALFLOW_SOCIOS_SALT=` (o mesmo do vault — trocar invalida os socio_keys)
- [ ] (opcional) `DEALFLOW_API_KEY=` se quiser uma camada extra de X-Api-Key
- [ ] (opcional) `DEALFLOW_AUDIT_LOG_PATH=/var/log/genesis/audit.jsonl` (LGPD art. 37)

---

## Fase 6 — Build, deploy e HTTPS (30 min)

> **Artefatos prontos** em [`deploy/`](../deploy/): `genesis-api.service` (systemd),
> `Caddyfile`, `deploy.sh` (deploy de 1 comando) e o **passo a passo turnkey** em
> [`deploy/README.md`](../deploy/README.md). Layout no servidor: repo em
> `/opt/genesis`, dono `genesis:genesis`; Caddy serve `/opt/genesis/frontend/dist`.

- [ ] Clonar o repo em `/opt/genesis`; setar os parquets de dados (o
      `estimates_final` versionado já basta pro app rodar; PII/sócios precisam dos
      parquets privados — ver README §6).
- [ ] Seguir o **setup inicial** de `deploy/README.md` (usuário `genesis`, secrets
      da Fase 5 em `/opt/genesis/backend/.env`, sudoers, instalar `.service` +
      `Caddyfile`).
- [ ] **Primeiro deploy**: `sudo -u genesis /opt/genesis/deploy/deploy.sh`
      (build do front + `uv sync`) → `sudo systemctl enable --now genesis-api`
      → `sudo systemctl reload caddy`.
- [ ] Abrir `https://app.genesisradar.com.br` (cadeado verde — Caddy tira o cert
      Let's Encrypt sozinho). Redeploys futuros: só rodar `deploy.sh` de novo.

---

## Fase 7 — Verificação pós-deploy (15 min)

- [ ] `curl https://app.SEU_DOMINIO/api/v1/health` → `{"status":"ok"}`
- [ ] `curl https://app.SEU_DOMINIO/api/v1/auth/config` →
      `{"auth_required":true,"require_subscription":true,"billing_enabled":true}`
- [ ] **Segurança** (ver [`docs/security.md`](../docs/security.md) §"Verificação"):
  - [ ] Sem cookie/login, `GET /api/v1/empresas` → **401** (gate fechado).
  - [ ] Resposta de login traz `Set-Cookie: genesis_session` com **`Secure`**,
        `HttpOnly`, `SameSite=Lax`.
  - [ ] `?limit=999999` em `/api/v1/empresas` retorna no máximo 200 itens.
  - [ ] CORS de um Origin aleatório é **negado**.
- [ ] **Funil real**: criar conta → receber o email no inbox real → verificar →
      escolher plano → checkout → pagar (cartão real ou de teste se em staging)
      → o webhook marca `active` → cai no radar em `/?checkout=sucesso`.
- [ ] **Primeiro superusuário** (plano "Mesa" + admin):
      `uv run python scripts/create_superuser.py --email admin@SEU_DOMINIO --password '...'`

---

## Fase 8 — Manutenção contínua (anotar)

- [ ] **Backup do `users.db`** (cron diário p/ storage externo) — é o seu cadastro.
- [ ] Atualizar dependências periodicamente (`uv lock --upgrade`; lib de auth/Stripe).
- [ ] Quando crescer (multi-instância): migrar SQLite → **Postgres** e o
      rate-limit/throttle em memória → **Redis** (ver `docs/security.md`).
- [ ] Backlog de hardening adicional em `docs/security.md` §"Resíduo conhecido".

---

> Quando voltar, atualize a memória `stripe-login-setup-progresso` com o que
> foi ao ar. Doc-first: mudanças de auth/billing/deploy entram em
> `docs/site-architecture.md` no mesmo PR.
