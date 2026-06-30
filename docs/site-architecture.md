# Site · Arquitetura e plano

> ⚠️ **Doc-first.** Toda mudança neste sistema — autenticação,
> paywall, rotas, gating, modelo de monetização, integrações de
> pagamento — DEVE ser refletida neste documento ANTES de subir em
> produção. Se você está aqui pensando em mudar algo, atualize a
> seção correspondente como **parte do PR** (não em commit separado).

**Estado:** 2026-06-11 · Fases A–D **implementadas** (backend de auth,
frontend de auth, gate do app e billing Stripe — com hardening de
webhook) · **Próxima ação:** produção — ver "Pontos abertos" (Postgres,
boletim, página "Nossa história").

---

## Visão geral

O produto Genesis Radar tem duas faces na web, ambas servidas por um
único bundle Vite multi-page:

| Entry              | Onde                                | Acesso                                            |
|--------------------|-------------------------------------|---------------------------------------------------|
| `landing.html`     | `frontend/src/landing/`             | **Pública** — qualquer um vê.                    |
| `index.html`       | `frontend/src/` (fora de `landing/`)| **Autenticada** (Fase D: + assinatura ativa).    |

Backend único: **FastAPI** em `backend/src/dealflow_api/`. Mesma
origem serve as duas entries; Vite faz proxy de `/api/*` para o
backend (porta 8000).

Arquitetura da experiência da landing (capítulos cinematográficos
1–8): **`frontend/src/landing/ROADMAP.md`** — documento vivo
mantido com a landing.

---

## Modelo de auth + paywall

### Stack escolhida

| Camada            | Tecnologia                          | Por quê                                                                |
|-------------------|-------------------------------------|------------------------------------------------------------------------|
| Auth lib          | `fastapi-users[sqlalchemy]` v14+    | Battle-tested. Cuida do que é perigoso fazer à mão (hash, JWT, reset). |
| Banco de usuários | SQLite (early) → Postgres (depois)  | Zero-config para começar; SQLAlchemy abstrai a migração. Arquivo: `data/users.db` (fora do Git — LGPD). |
| Hashing           | `argon2`/`bcrypt` via `pwdlib`      | É o que o `fastapi-users` atual (v14+) traz — substituiu o `passlib`.  |
| Token             | JWT HS256                           | Stateless; escala horizontal sem sessão central.                       |
| Transporte        | Cookie HTTP-only + `SameSite=Lax`   | Imune a XSS (vs localStorage); CSRF mitigado por SameSite.             |
| Email transacional| **Resend**                          | DX limpo; 100 emails/dia grátis; US$ 20/mês a partir de 50k.           |
| Pagamentos (Fase D)| Stripe Checkout + Customer Portal  | Hospedado, zero PCI scope, dominado pelo time.                         |

### Por que esta stack

Restrição declarada pelo dono do produto:

- **custo financeiro mínimo** (idealmente R$ 0 enquanto possível);
- **escalabilidade sem teto** (sem cair em planos pagos surpresa);
- **time já fluente em Stripe**, OK em "ter trabalho".

Roll-your-own no FastAPI que já existe atende custo e escalabilidade.
`fastapi-users` reduz a superfície de bug de segurança (que é onde
roll-your-own normalmente vaza) sem reintroduzir lock-in de vendor.

Cobenefício: tudo no servidor do produto = sem transferência
internacional de dados = LGPD friendly — relevante para a tese de
honestidade que a landing vende.

**Alternativas avaliadas e descartadas:**

- *Supabase Auth* — bom, mas mais um vendor; free tier acaba.
- *Clerk* — UI excelente; US$ 25+/mês a partir de 10k MAU.
- *Firebase Auth* — grátis, mas Google + transferência US (atrito LGPD).
- *Auth0* — caro para B2B SaaS começando.

### Defaults aplicados

- Email de verificação **obrigatório para o gate** (evita conta-fantasma
  e abuso). Login SEM verificação é permitido — o gate das rotas de
  dados é que exige usuário verificado (`403 EMAIL_NAO_VERIFICADO`).
- Cadastro dispara o email de verificação automaticamente
  (`on_after_register` → `request_verify`).
- Reset de senha por link com token expirável (30 min).
- Senha mínima: 8 caracteres (validada no `UserManager`, mensagem pt-BR).
- OAuth (Google/LinkedIn) **fora da Fase 1**. Adicionar se cliente pedir.
- JWT HS256 expira em 7 dias; cookie `genesis_session` (httponly ·
  samesite=lax · secure=`DEALFLOW_COOKIE_SECURE` · max_age 7 dias).
- Guardas de boot (`main.py`): com `AUTH_REQUIRED` (ou `COOKIE_SECURE`)
  ligado, o servidor NÃO sobe com `DEALFLOW_AUTH_SECRET` default/vazio;
  com `AUTH_REQUIRED=true` também exige `DEALFLOW_RESEND_API_KEY`
  (sem ela o ConsoleEmailer despejaria tokens + PII nos logs).
- Tabela `user` (criada no startup via `create_all`, engine lazy):
  ```
  id (UUID), email, hashed_password, is_verified, is_active, is_superuser,
  created_at, stripe_customer_id, stripe_subscription_id, stripe_event_ts,
  subscription_status, plan_id, billing_cycle, current_period_end
  ```
  Os campos de assinatura já nasceram no schema (Fase D backend foi
  implementada junto) — preenchidos pelo webhook do Stripe.
  `stripe_subscription_id` e `stripe_event_ts` são **internos** (fora do
  `UserRead`) e chegaram depois do primeiro deploy: como `create_all`
  não altera tabela existente, o startup roda uma **mini-migração**
  (`PRAGMA table_info` + `ALTER TABLE user ADD COLUMN`, em `auth/db.py`)
  para completar bancos antigos in-place.

### Flags de gating (settings · prefixo `DEALFLOW_`)

| Flag                   | Default | Efeito                                                                  |
|------------------------|---------|-------------------------------------------------------------------------|
| `AUTH_REQUIRED`        | `false` | `true`: rotas de dados exigem sessão de usuário ativo **e verificado** (`401 NAO_AUTENTICADO` / `403 EMAIL_NAO_VERIFICADO`). `false`: comportamento dev aberto preservado. |
| `REQUIRE_SUBSCRIPTION` | `false` | `true` (adicional): exige `subscription_status ∈ {active, trialing}` (`403 ASSINATURA_NECESSARIA`). |

O gate é a dependency `require_access` (`auth/deps.py`), aplicada no
`include_router` dos routers de dados (routes + events) em `main.py` e
lida **em request-time**. `/api/v1/health` permanece público (probes).
`GET /api/v1/auth/config` (público) expõe `{auth_required,
require_subscription, billing_enabled}` para a landing se adaptar.

### Endpoints implementados

```
POST /api/v1/auth/register              201 UserRead · 400 REGISTER_USER_ALREADY_EXISTS
POST /api/v1/auth/login                 form username/password → 204 + Set-Cookie genesis_session
POST /api/v1/auth/logout                204, limpa cookie
POST /api/v1/auth/request-verify-token  202 (sempre — sem enumeração)
POST /api/v1/auth/verify                200 UserRead · 400 VERIFY_USER_BAD_TOKEN|ALREADY_VERIFIED
POST /api/v1/auth/forgot-password       202 (sempre)
POST /api/v1/auth/reset-password        200 · 400 RESET_PASSWORD_BAD_TOKEN
GET  /api/v1/auth/config                público, sem auth
GET  /api/v1/users/me                   200 UserRead | 401

POST /api/v1/billing/checkout           {plan: sinal|varredura, period: mensal|semestral|anual} → {url}
                                        · 403 EMAIL_NAO_VERIFICADO · 409 ASSINATURA_JA_ATIVA (usar o portal)
POST /api/v1/billing/portal             {url} do Customer Portal · 400 sem customer
POST /api/v1/billing/webhook            assinatura Stripe-Signature obrigatória
```

Emails (verify/reset) apontam para
`{app_base_url}/landing.html?auth=verify|reset&token=...`. Sem
`DEALFLOW_RESEND_API_KEY`, os emails saem no stderr com marcador
`[EMAIL]` e o link completo (dev + e2e) — com `AUTH_REQUIRED=true` o
boot **aborta** sem a chave (tokens/PII não vazam para os logs).
Isenções do `ApiKeyAuthMiddleware`: paths `/api/v1/auth/*` e
`/api/v1/billing/webhook` (têm autenticação própria); o cookie
`genesis_session` só dispensa a X-Api-Key quando `AUTH_REQUIRED=true`
(o gate valida o JWT downstream) — com `AUTH_REQUIRED=false` um cookie
forjado NÃO substitui a API key (modo api_key puro).

---

## Diagrama lógico

```
┌─────────────────────── FRONTEND (Vite multi-page) ──────────────────────┐
│                                                                          │
│  landing.html ── PÚBLICA ── qualquer um vê                              │
│       │                                                                  │
│       │ "Criar conta" / "Fazer login" / "Ver planos"                    │
│       ▼                                                                  │
│  AuthOverlay ── camada sobre a landing (sem páginas /signup, /login)    │
│       deep links: ?auth=login|signup|verify|reset|plans                 │
│       (&token, &plan, &period) — links de email apontam para cá         │
│       │                                                                  │
│       ▼                                                                  │
│  index.html ── PortaoDoApp (src/App.tsx) ── exige sessão válida         │
│              (REQUIRE_SUBSCRIPTION: + subscription_status ativo)        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                              ▲
                              │  cookie HTTP-only com JWT
                              ▼
┌──────────────────────── BACKEND (FastAPI) ──────────────────────────────┐
│                                                                          │
│  /auth/register   /auth/login    /auth/logout    /auth/config           │
│  /auth/forgot-password   /auth/reset-password                           │
│  /auth/request-verify-token   /auth/verify    /users/me                 │
│  /billing/checkout   /billing/portal   /billing/webhook                 │
│                                                                          │
│  Gate: dependency require_access nos routers de dados (request-time;    │
│        flags DEALFLOW_AUTH_REQUIRED / DEALFLOW_REQUIRE_SUBSCRIPTION)    │
│                                                                          │
│  User (SQLAlchemy · data/users.db):                                      │
│    id · email · hashed_password · is_verified · is_active               │
│    · is_superuser · created_at · stripe_customer_id                     │
│    · stripe_subscription_id · stripe_event_ts (internos — webhook)      │
│    · subscription_status · plan_id · billing_cycle                      │
│    · current_period_end                                                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                              ▲
                              │  (FASE D) webhook Stripe
                              ▼
                       Stripe Checkout + Customer Portal
```

---

## Fases de execução

### Fase A — Backend de auth ✅ (implementada 2026-06-10)

1. ✅ Dependências: `fastapi-users[sqlalchemy]>=14` (hash via `pwdlib`),
   `aiosqlite`, `httpx` (Resend via REST — sem SDK extra), `stripe`.
2. ✅ Módulo `backend/src/dealflow_api/auth/` — `db.py` (User model +
   engine lazy), `schemas.py`, `manager.py` (UserManager + hooks de
   email), `emailer.py` (Resend/console), `deps.py` (`require_access`),
   `router.py` (composição fastapi-users + `/auth/config`).
3. ✅ JWT HS256 em cookie `genesis_session` (CookieTransport).
4. ✅ Endpoints (lista completa na seção "Endpoints implementados").
5. ✅ Adapter de email: `ResendEmailer` quando `DEALFLOW_RESEND_API_KEY`
   definido; senão `ConsoleEmailer` (stderr, marcador `[EMAIL]`).
6. ✅ `Base.metadata.create_all` no lifespan (Alembic quando o schema
   precisar evoluir — ver "Como mudar este sistema").
7. ✅ Testes: `backend/tests/test_auth.py` (fluxos completos + gating).

### Fase B — Frontend de auth ✅ (implementada 2026-06-10)

1. ✅ `AuthContext` + hook `useAuth()` (`frontend/src/auth/AuthContext.tsx`)
   — carrega `/auth/config` + `/users/me` na montagem; expõe
   login/register/logout/refresh; serve as duas entries.
2. ✅ **Decisão de UX:** em vez das páginas `/signup` e `/login`
   planejadas, um **`AuthOverlay` deep-linkável** em camada sobre a
   landing (`frontend/src/landing/AuthOverlay.tsx`) — coerente com a
   filosofia do Gateway (nada de troca de tela). Modos: login · signup ·
   forgot · reset · verify-pending · verify-confirm, acionados por
   `?auth=login|signup|verify|reset|plans` (+ `&token`, `&plan`,
   `&period`) — os links de email caem direto no modo certo.
3. ✅ Botões "Criar conta"/"Fazer login" do header da landing ligados
   ao overlay.
4. ✅ Fluxos "esqueci a senha" e "verifique seu email" completos
   (reenvio de link incluído).

### Fase C — Gate do app ✅ (implementada 2026-06-10)

1. ✅ `PortaoDoApp` em `frontend/src/App.tsx` — exige sessão válida (e,
   com `require_subscription`, assinatura ativa); não-autenticados vão
   para a landing (`?auth=login`).
2. ✅ `landing.html` permanece pública (sem mudança).
3. ✅ Após login, redireciona para `/` (o app).

### Fase D — Pay gate ✅ (backend e frontend 2026-06-10 · hardening de webhook 2026-06-11)

**Decisão de monetização (dono do produto):** assinatura pura — sem
trial, sem free-tier. Planos self-serve: **Sinal** (R$ 149/mês) e
**Varredura** (R$ 389/mês). **Mesa** = falar com vendas (sem checkout).
Ciclos: mensal · semestral (−15%) · anual (−25%). Moeda BRL.

Backend (`backend/src/dealflow_api/billing/routes.py`):

1. ✅ Produtos/preços no Stripe via `scripts/stripe_seed.py`
   (idempotente; roda manualmente). `lookup_keys = "{plan}_{period}"`:
   `sinal_mensal/semestral/anual`, `varredura_mensal/semestral/anual`.
   Semestral: `interval=month, interval_count=6`, total
   `round(base×6×0,85)`; anual: `interval=year`, total `round(base×12×0,75)`.
2. ✅ `POST /api/v1/billing/checkout` — exige usuário verificado; **409
   `ASSINATURA_JA_ATIVA`** se `subscription_status ∈ {active, trialing}`
   (um 2º checkout criaria uma segunda assinatura viva = cobrança dupla;
   troca de plano/ciclo é pelo Customer Portal); cria o Stripe Customer
   na 1ª vez (metadata `user_id`, `email`) e persiste
   `stripe_customer_id`; resolve o price por `lookup_key`; abre Checkout
   `mode=subscription` com `client_reference_id` e
   `allow_promotion_codes`; redirects `{app_base_url}/?checkout=sucesso`
   e `{app_base_url}/landing.html?checkout=cancelado`.
3. ✅ `POST /api/v1/billing/webhook` — `Stripe-Signature` validada com
   `construct_event`. Eventos: `checkout.session.completed` (vincula
   customer **e subscription** ao user), `customer.subscription.created|
   updated` (espelha `status`, `plan_id`/`billing_cycle` do lookup_key,
   `current_period_end`), `customer.subscription.deleted` → `canceled`,
   `invoice.payment_failed` → `past_due`. Desconhecidos: 200 ignorado.
   **Hardening (2026-06-11):**
   - *Escopo por assinatura* — `stripe_subscription_id` registrado no
     `User` (em `checkout.session.completed` e `subscription.created`);
     `updated`/`deleted`/`payment_failed` de OUTRA subscription são
     ignorados (sem id registrado, o evento é aceito e o id, registrado).
     Sem isso, com 2 assinaturas vivas, o `deleted` de qualquer uma
     revogava o acesso de quem seguia pagando.
   - *Ordenação de eventos* — `stripe_event_ts` guarda o `created` do
     último evento aplicado; eventos com `created` ≤ são **descartados**
     (200 + log). O Stripe não garante ordem e re-tenta por até 3 dias —
     um `updated(active)` atrasado não pode ressuscitar assinatura
     cancelada, nem um `payment_failed` re-entregue travar um pagante
     regularizado em `past_due`. Sem re-fetch via API (testes herméticos).
4. ✅ Gate de assinatura: `DEALFLOW_REQUIRE_SUBSCRIPTION=true` →
   `403 ASSINATURA_NECESSARIA` sem status `active`/`trialing`.
5. ✅ `POST /api/v1/billing/portal` — Customer Portal com `return_url`
   `{app_base_url}/`.
6. ✅ SDK do Stripe é síncrono — toda chamada (Customer.create,
   Price.list, checkout/portal Session.create) roda via
   `fastapi.concurrency.run_in_threadpool`, senão bloqueia o event loop
   single-worker inteiro (inclusive o SSE de `/events`).

**Breaking change de schema (2026-06-11):** colunas `stripe_subscription_id`
e `stripe_event_ts` na tabela `user` — aplicadas em bancos existentes
pela mini-migração de startup (`ALTER TABLE ADD COLUMN` em `auth/db.py`).
Internas: fora do `UserRead`.

Degradação graciosa (padrão protestos): sem `DEALFLOW_STRIPE_SECRET_KEY`
checkout/portal → 503; sem `DEALFLOW_STRIPE_WEBHOOK_SECRET` webhook →
503. Testes: `backend/tests/test_billing.py` (webhook assinado com HMAC
manual; cobre 409, escopo por subscription e descarte de evento antigo).

Frontend (✅ 2026-06-10): CTAs dos planos do Capítulo 5 da landing →
checkout (anônimo abre cadastro; não-verificado cai na verificação com
o plano pendente em `localStorage`; **assinante ativo vai direto ao
Customer Portal** — nunca um 2º checkout); 409 `ASSINATURA_JA_ATIVA`
mapeado para mensagem pt-BR + encaminhamento ao portal
(`frontend/src/auth/api.ts` + `Landing.tsx`); "Gerenciar assinatura"
(Customer Portal) no Header do app.

---

## Pontos abertos

- ~~**Modelo de monetização (Fase D)**~~ — **decidido (2026-06-10):**
  assinatura pura, sem trial e sem free-tier; Sinal e Varredura
  self-serve, Mesa via vendas. Backend implementado (ver Fase D).
- **OAuth providers** — fora da Fase 1. Adicionar se cliente pedir.
- **Banco** — SQLite na Fase A; migrar para Postgres quando precisarmos
  compartilhar entre instâncias ou os usuários crescerem.
- **Boletim (email capture)** — botão já existe no header da landing;
  página de destino e backend de captura ainda a fazer (próxima
  iteração da landing).
- **Página "Nossa história"** — botão existe no header como
  placeholder; destino e copy a definir.

---

## Como mudar este sistema

1. Decidir a mudança.
2. **Atualizar este documento na seção afetada** (mesmo commit que a
   mudança — não em commit separado, para evitar deriva).
3. Implementar e testar.
4. Submeter o PR com a mudança + a atualização do doc juntas.
5. Revisar (auth é segurança-crítica — pelo menos um par de olhos).

Mudanças no schema da tabela `user`: colunas **novas** entram pela
mini-migração de startup (`PRAGMA table_info` + `ALTER TABLE ADD
COLUMN` em `auth/db.py` — o SQLite suporta `ADD COLUMN`; `create_all`
não altera tabela existente). Mudanças estruturais (rename, drop,
índices compostos) exigem Alembic. Sempre com nota de breaking change
no commit message.

---

## Referências

- `frontend/src/landing/ROADMAP.md` — arquitetura cinematográfica da landing.
- `docs/architecture.md` — motor de estimativa (backend, não auth).
- `docs/methodology.md` — validação e decisões do motor.
- `docs/lgpd-context-dossier.md` — contexto LGPD do produto (relevante para auth).
- `docs/security.md` — estado de segurança do app (auditoria + hardening 2026-06-30).
- `docs/deploy.md` — como subir em produção (runtime, env, Stripe, smoke).
- `to-do-lists/dia-30.md` — checklist de deploy full (incl. domínio).
- `to-do-lists/dia-23.md` — tarefas mapeadas da landing.
