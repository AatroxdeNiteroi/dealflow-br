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

- [ ] **Nome do domínio** (ex.: `genesisradar.com.br` ou `.com`).
- [ ] **Modelo de hospedagem** (escolha um):
  - **A) Tudo num VPS** (recomendado p/ começar): 1 servidor com Caddy/nginx
    servindo o `dist/` estático + proxy `/api` → uvicorn. SQLite no disco do
    VPS. Mais simples de manter o cookie same-site e o disco persistente.
    Ex.: Hetzner (~€4/mês), DigitalOcean, Contabo.
  - **B) Frontend gerenciado + backend separado**: Vercel/Netlify (frontend)
    + Render/Fly/VPS (backend FastAPI). Mais "managed", mas atenção ao
    cookie cross-host (precisa do proxy `/api` no mesmo domínio — ver
    `docs/deploy.md` §3) e ao disco persistente do backend.

> Recomendo **A** para o primeiro deploy: menos partes móveis, cookie e disco
> resolvidos de graça. Dá pra migrar pra B depois.

---

## Fase 1 — Comprar o domínio (15 min)

- [ ] Registrar em um registrador. Para `.com.br`: **registro.br** (oficial,
      exige CPF/CNPJ). Para `.com`: Cloudflare Registrar (preço de custo),
      Namecheap, Porkbun.
- [ ] **Recomendado:** apontar os **nameservers do domínio para o Cloudflare**
      (plano free). Ganha DNS rápido, proxy/CDN e HTTPS fácil. (registro.br e
      qualquer registrador deixam trocar os nameservers.)
- [ ] Decidir o subdomínio do app: `app.SEU_DOMINIO` (ou a raiz). Vou assumir
      `app.SEU_DOMINIO` no resto da checklist.

---

## Fase 2 — Provisionar o servidor (Modelo A · 20 min)

- [ ] Criar o VPS (Ubuntu 24.04 LTS). Anotar o IP público.
- [ ] DNS: criar um registro **A** `app` → IP do VPS (no Cloudflare/registrador).
      Se usar Cloudflare proxied (nuvem laranja), o HTTPS na borda é dele.
- [ ] Acesso SSH + básico de segurança do host:
  - [ ] usuário não-root com sudo; `ssh` por chave (desabilitar senha).
  - [ ] firewall: liberar só 22, 80, 443 (`ufw allow 22,80,443`).
  - [ ] `unattended-upgrades` (patches de segurança automáticos).
- [ ] Instalar runtime: `git`, `uv` (Python), `Node 20+`, e **Caddy**
      (HTTPS automático via Let's Encrypt — bem mais simples que nginx+certbot).

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

- [ ] Clonar o repo no servidor; setar os parquets de dados (o `estimates_final`
      versionado já basta pro app rodar; PII/sócios precisam dos parquets
      privados — ver README §6).
- [ ] **Backend**: `cd backend && uv sync` → rodar uvicorn como **serviço
      systemd** (reinício automático), escutando em `127.0.0.1:8000`.
- [ ] **Frontend**: `cd frontend && npm ci && npm run build` → gera `dist/`.
- [ ] **Caddy** (`/etc/caddy/Caddyfile`) — HTTPS automático + proxy `/api`:
      ```
      app.SEU_DOMINIO {
          root * /var/www/genesis/dist
          encode gzip
          @api path /api/*
          reverse_proxy @api 127.0.0.1:8000
          try_files {path} /index.html
          file_server
      }
      ```
      (Caddy tira o cert Let's Encrypt sozinho. O `reverse_proxy` já manda o
      `X-Forwarded-For` correto — por isso `TRUSTED_PROXY_HOPS=1`.)
- [ ] `systemctl reload caddy` → abrir `https://app.SEU_DOMINIO` (cadeado verde).

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
