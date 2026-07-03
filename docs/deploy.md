# Deploy — Genesis Radar (landing + app + auth + billing)

Guia operacional para subir o produto em produção e para rodar o funil
completo (cadastro → verificação → checkout → radar) localmente. Nada aqui
expõe segredo: os valores reais vão por variável de ambiente (ver
[`backend/.env.example`](../backend/.env.example)).

> Documento-irmão de [`site-architecture.md`](site-architecture.md) — lá está
> o *porquê* de cada peça; aqui está o *como* colocar no ar.

---

## 0. Decisão de hospedagem (escolhida · 03/07/2026)

**Modelo A — VPS único no DigitalOcean.** Domínio **`genesisradar.com.br`**
(registrado no registro.br); o app vive em **`app.genesisradar.com.br`**.

- **Instância:** DigitalOcean **Basic Droplet 1 GB** (1 vCPU / 1 GB / 25 GB SSD,
  x86), **US$6/mês**, disco persistente incluso, **+ swap de 2 GB** (pico do
  `npm run build`). Region **NYC** (~120 ms do BR). *Hetzner CAX11 (~€3,79) seria
  mais barato, mas o cadastro exige passaporte — por isso DO (só cartão). 4 GB era
  folga: o app carrega ~13 MB de parquets derivados (~500 MB residentes).*
- **Stack:** Ubuntu 24.04 + **Caddy** (HTTPS automático, §3) servindo o `dist/`
  estático e fazendo proxy de `/api` → **uvicorn** (serviço systemd). O
  **`users.db` (SQLite) fica no disco do VPS** — persistente entre deploys.
- **DNS/HTTPS:** nameservers apontados pro **Cloudflare** (plano free); registro
  **A** `app` → IP do VPS. Caddy tira e renova o cert Let's Encrypt sozinho.
- **Layout no servidor:** repo em `/opt/genesis` (dono `genesis:genesis`); Caddy
  serve `/opt/genesis/frontend/dist`; backend em `/opt/genesis/backend` (com o
  `users.db` SQLite ali, no disco persistente).
- **Artefatos prontos:** [`deploy/`](../deploy/) (`genesis-api.service`,
  `Caddyfile`, `deploy.sh` + [`README.md`](../deploy/README.md) turnkey).
- **Passo a passo operacional:** [`to-do-lists/dia-30.md`](../to-do-lists/dia-30.md)
  (Fases 2 e 6).

### Por que Modelo A (e não um PaaS "grátis")

Prioridade do projeto, nesta ordem: **mais barato → menor manutenção → deploy
mais rápido**. O VPS único é a opção mais barata **sem pegadinha** para *este*
app, porque duas restrições nossas derrubam os planos gerenciados baratos:

1. **Cookie same-site** — a sessão é o cookie `genesis_session` (SameSite=Lax);
   front e `/api` **precisam do mesmo eTLD+1** (ver §1). Separar front e backend
   força proxy/CORS extra.
2. **Disco persistente pro SQLite** — `users.db` é um arquivo; host que zera o
   disco a cada deploy **perde todo o cadastro**.

| Opção | Veredito |
|---|---|
| **Render free** | Dorme por inatividade (cold start) **e sem disco persistente** → perde `users.db`. Disco só no plano pago (~US$7/mês). |
| **Vercel/Netlify** | Só servem o front; backend continua precisando de host com disco pago + cookie cross-host. |
| **Fly.io** | Barato (~US$2/mês), mas exige Docker + volume preso a região = mais setup (contra a prioridade #2/#3). |
| **Oracle "Always Free"** | R$0, porém recicla conta ociosa e provisionar ARM falha por capacidade — risco pra cadastro de cliente pagante. |
| **DigitalOcean 1 GB (escolhido)** | US$6/mês, **só cartão** (Hetzner seria ~€4 mas exige passaporte), disco e cookie resolvidos de graça, **zero mudança de código**, manutenção baixa (`unattended-upgrades` + Caddy auto-renova). 1 GB + swap 2 GB. |

> Migração futura (ao escalar multi-instância): SQLite → Postgres e rate-limit em
> memória → Redis (ver [`security.md`](security.md) e Fase 8 da checklist do dia
> 30). Aí o Modelo B (front gerenciado + backend separado) passa a compensar.

---

## 1. Arquitetura de runtime

Dois processos, um domínio:

```
                    ┌──────────────────────────┐
  navegador  ──────►│  estático (Vite build)   │   /              → index.html   (app/radar)
                    │  index.html + landing    │   /landing.html  → landing
                    └────────────┬─────────────┘
                                 │ /api/*  (mesmo domínio, cookie de sessão)
                                 ▼
                    ┌──────────────────────────┐
                    │  FastAPI (uvicorn)        │   /api/v1/...  (REST + SSE + auth + billing)
                    └──────────────────────────┘
```

O frontend são **duas entries** do mesmo build Vite (ver `vite.config.ts`):
`index.html` (o radar) e `landing.html` (a landing pública). A sessão é um
cookie `genesis_session` (HTTP-only, SameSite=Lax) — por isso **frontend e
backend precisam estar no mesmo site** (mesmo eTLD+1), senão o cookie não
viaja. Em dev o proxy do Vite resolve isso (`/api` → `localhost:8000`).

---

## 2. Build

```bash
# Frontend → dist/ com index.html, landing.html e assets
cd frontend
npm ci
npm run build            # tsc -b && vite build

# Backend → ambiente Python
cd ../backend
uv sync                  # produção (sem --extra dev)
```

O `dist/` resultante tem os dois HTMLs reais. Não há roteador SPA único: cada
HTML é uma entry própria; os "deep links" (`?auth=verify`, `?checkout=sucesso`)
são lidos por query-string dentro de cada página.

---

## 3. Rewrites de hospedagem (as 2 entries + proxy /api)

O essencial: servir `index.html` na raiz, `landing.html` no seu caminho, e
encaminhar `/api/*` para o backend FastAPI. Escolha o seu host:

### Caddy — `/etc/caddy/Caddyfile` (escolhido · Hetzner, mesmo host)

HTTPS automático (Let's Encrypt) + estático + proxy `/api`, tudo num processo.
É o caminho do deploy atual (ver §0). O arquivo pronto está em
[`../deploy/Caddyfile`](../deploy/Caddyfile) (junto do serviço systemd e do
`deploy.sh` — ver [`../deploy/README.md`](../deploy/README.md)).

```
app.genesisradar.com.br {
    root * /opt/genesis/frontend/dist
    encode gzip

    # /api → uvicorn. SSE (streams) não pode bufferizar:
    @api path /api/*
    reverse_proxy @api 127.0.0.1:8000 {
        flush_interval -1
    }

    # duas entries: /landing.html é arquivo real; o resto cai no app
    try_files {path} /index.html
    file_server
}
```

> Caddy renova o cert sozinho e já envia o `X-Forwarded-For` correto — por isso
> `DEALFLOW_TRUSTED_PROXY_HOPS=1`. `flush_interval -1` é o equivalente ao
> `proxy_buffering off` do nginx (necessário pros SSE de `/api/v1/.../stream`).
> `try_files {path} /index.html` já serve `landing.html` direto (o arquivo
> existe) e manda todo o resto pro `index.html` (o radar).

### Vercel — `frontend/vercel.json`
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://API_HOST/api/:path*" },
    { "source": "/landing.html", "destination": "/landing.html" },
    { "source": "/", "destination": "/index.html" }
  ]
}
```

### Netlify — `frontend/netlify.toml`
```toml
[build]
  command = "npm run build"
  publish = "dist"

# proxy do /api para o backend (mantém o cookie same-site)
[[redirects]]
  from = "/api/*"
  to   = "https://API_HOST/api/:splat"
  status = 200
  force  = true

# a raiz é o app; landing.html é servido como arquivo real
[[redirects]]
  from = "/"
  to   = "/index.html"
  status = 200
```

### Nginx (frontend estático + backend no mesmo host)
```nginx
server {
  server_name app.SEU_DOMINIO.com.br;
  root /var/www/genesis/dist;

  # /api → uvicorn (preserva cookie + headers)
  location /api/ {
    proxy_pass         http://127.0.0.1:8000;
    proxy_set_header   Host $host;
    proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    # SSE (/api/v1/.../stream): não bufferizar
    proxy_buffering    off;
    proxy_read_timeout 3600s;
  }

  location = /            { try_files /index.html =404; }
  location = /landing.html { try_files /landing.html =404; }
  location /              { try_files $uri $uri/ /index.html; }
}
```

> Se backend e frontend ficarem em **hosts diferentes**, configure
> `DEALFLOW_CORS_ORIGINS` com o domínio do frontend e garanta que o cookie
> de sessão seja aceito (mesmo eTLD+1 ou um proxy reverso unificando os dois
> sob um domínio). O caminho mais simples é o proxy `/api` acima — tudo no
> mesmo host.

---

## 4. Checklist de variáveis de ambiente (produção)

Todas com prefixo `DEALFLOW_` (ver `settings.py`). Em `backend/.env` ou no
painel de secrets do host.

| Variável | Produção | Observação |
|---|---|---|
| `DEALFLOW_ENV` | `prod` | Liga as guardas fail-closed (exige gate + cookie seguro, proíbe CORS `*`). Ver [`security.md`](security.md). |
| `DEALFLOW_TRUSTED_PROXY_HOPS` | `1` (atrás de proxy) | Nº de proxies seus no `X-Forwarded-For`. Sem isto, rate-limit/audit usam o IP do proxy e quebram. |
| `DEALFLOW_AUTH_SECRET` | **obrigatória** | `openssl rand -hex 32` (≥32 chars). Trocar invalida sessões/tokens. |
| `DEALFLOW_AUTH_REQUIRED` | `true` | Tranca as rotas de dados atrás de login verificado. |
| `DEALFLOW_REQUIRE_SUBSCRIPTION` | `true` | Soma a exigência de assinatura ativa. |
| `DEALFLOW_COOKIE_SECURE` | `true` | Cookie só por HTTPS. |
| `DEALFLOW_APP_BASE_URL` | `https://app.SEU_DOMINIO` | Base dos links de email e dos redirects do Stripe. |
| `DEALFLOW_CORS_ORIGINS` | JSON array: `["https://app.SEU_DOMINIO"]` | ⚠️ **JSON, não CSV** — o `pydantic-settings` pinado no `uv.lock` decodifica campos-lista como JSON na fonte, **antes** do validator `_split_csv`. String simples aborta o boot (`SettingsError`). Default é só localhost. |
| `DEALFLOW_RESEND_API_KEY` | **obrigatória c/ auth** | Sem ela + `AUTH_REQUIRED=true`, o boot **aborta** (guard). |
| `DEALFLOW_STRIPE_SECRET_KEY` | obrigatória p/ cobrar | `sk_live_...` (ou `sk_test_` em staging). |
| `DEALFLOW_STRIPE_WEBHOOK_SECRET` | obrigatória p/ cobrar | `whsec_...` do endpoint registrado. |
| `DEALFLOW_ANTHROPIC_API_KEY` | p/ Busca IA | Sem ela, `/search/ai` → 503. |
| `DEALFLOW_PROTESTOS_PROVIDER` / `_API_TOKEN` | opcional | Provedor pago de protestos. |
| `DEALFLOW_SOCIOS_SALT` | **build-time only** | HMAC dos socio_keys no pipeline (`scripts/export_socios_index.py`, `refresh_pii.py`). ⚠️ **NÃO** vai no `backend/.env` — o `Settings` tem `extra=forbid` e não define esse campo; o backend runtime **não lê** o salt (serve o parquet já pronto). Fica no `.env.local` da raiz, usado só pelo pipeline. |

> **Boot guards** (`main.py::_checar_config_boot`): recusa subir com
> `CORS_ORIGINS` contendo `*`; com `AUTH_REQUIRED`/`COOKIE_SECURE`/`ENV=prod`
> ligados, exige `AUTH_SECRET` real (≥32 chars, não-default) e `RESEND_API_KEY`;
> e com `ENV=prod` exige gate de acesso ligado (auth ou api_key) e
> `COOKIE_SECURE=true`. Tudo fail-closed, de propósito. Detalhe em
> [`security.md`](security.md).

---

## 5. Stripe — passos além das chaves

1. **Semear os preços** (idempotente — pode rodar quantas vezes quiser):
   ```bash
   set DEALFLOW_STRIPE_SECRET_KEY=sk_live_...        # ou export, no shell
   uv run python scripts/stripe_seed.py
   ```
   Cria os 6 preços `sinal_{mensal,semestral,anual}` e
   `varredura_{...}` por `lookup_key`. O checkout resolve o price por essa
   chave — **sem semear, o checkout responde 503**.

2. **Registrar o webhook** no dashboard do Stripe → Developers → Webhooks →
   endpoint `https://app.SEU_DOMINIO/api/v1/billing/webhook`. Assine os eventos:
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed`. Copie o **signing secret** (`whsec_...`) para
   `DEALFLOW_STRIPE_WEBHOOK_SECRET`.

   > Sem webhook acessível, o usuário **paga e fica preso no paywall** — o app
   > nunca recebe o `active`. É o failure mode nº 1; não pule.

3. **Customer Portal**: habilite em Stripe → Settings → Billing → Customer
   Portal (o endpoint `/billing/portal` abre a sessão hospedada).

---

## 6. Primeiro superusuário (planos "Mesa" e administração)

O plano **Mesa** é venda assistida — não passa por checkout. Para concedê-lo
(ou para qualquer administração), crie um superusuário e use o endpoint
admin de assinatura.

```bash
uv run python scripts/create_superuser.py --email admin@SEU_DOMINIO --password '...'
# concede um plano manualmente (como superuser autenticado):
#   PATCH /api/v1/users/{user_id}/subscription  { "plan_id": "mesa", "subscription_status": "active" }
```

---

## 7. Runbook local — testar o funil SEM Resend e SEM domínio

Dá para exercitar o fluxo inteiro na máquina:

1. **Backend + frontend** no ar (`start.bat` ou os dois `uv run uvicorn` /
   `npm run dev`).
2. **Emails caem no console**: sem `RESEND_API_KEY`, o `ConsoleEmailer`
   imprime o link de verificação/reset no stderr do backend, marcado com
   `[EMAIL] Link: http://localhost:5173/landing.html?auth=verify&token=...`.
   Cole no navegador para verificar a conta.
3. **Gate opcional em dev**: com `AUTH_REQUIRED=false` (default) o app fica
   aberto — bom para desenvolver. Para testar o **paywall de verdade**,
   ligue `AUTH_REQUIRED=true` + `REQUIRE_SUBSCRIPTION=true` (precisa de
   `RESEND_API_KEY`, por causa do boot guard).
4. **Webhook local do Stripe** (Stripe CLI):
   ```bash
   stripe listen --forward-to localhost:8000/api/v1/billing/webhook
   # copie o whsec_... que ele imprime para DEALFLOW_STRIPE_WEBHOOK_SECRET
   stripe trigger checkout.session.completed   # opcional, para exercitar
   ```

---

## 8. Smoke test pós-deploy

```bash
curl https://app.SEU_DOMINIO/api/v1/health            # 200
curl https://app.SEU_DOMINIO/api/v1/auth/config       # auth_required/require_subscription/billing_enabled
# abra https://app.SEU_DOMINIO/landing.html → "Criar conta" → verifique o email
# → escolha um plano → checkout → volta em /?checkout=sucesso já no radar
```
