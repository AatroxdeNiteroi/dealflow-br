# Site · Arquitetura e plano

> ⚠️ **Doc-first.** Toda mudança neste sistema — autenticação,
> paywall, rotas, gating, modelo de monetização, integrações de
> pagamento — DEVE ser refletida neste documento ANTES de subir em
> produção. Se você está aqui pensando em mudar algo, atualize a
> seção correspondente como **parte do PR** (não em commit separado).

**Estado:** 2026-05-23 · **Próxima ação:** Fase A — backend de auth.

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
| Auth lib          | `fastapi-users[sqlalchemy]`         | Battle-tested. Cuida do que é perigoso fazer à mão (hash, JWT, reset). |
| Banco de usuários | SQLite (early) → Postgres (depois)  | Zero-config para começar; SQLAlchemy abstrai a migração.               |
| Hashing           | `bcrypt` via `passlib`              | Padrão da indústria; vem com `fastapi-users`.                          |
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

- Email de verificação **obrigatório** (evita conta-fantasma e abuso).
- Reset de senha por link com token expirável (30 min).
- OAuth (Google/LinkedIn) **fora da Fase 1**. Adicionar se cliente pedir.
- JWT expira em 7 dias; cookie de refresh longa.
- Tabela `users` mínima na Fase A:
  ```
  id, email, hashed_password, is_verified, is_active, created_at
  ```
- Campos de assinatura (`stripe_customer_id`, `subscription_status`,
  `current_period_end`, `plan_id`) entram **na Fase D** — sem
  alterar o schema das fases anteriores.

---

## Diagrama lógico

```
┌─────────────────────── FRONTEND (Vite multi-page) ──────────────────────┐
│                                                                          │
│  landing.html ── PÚBLICA ── qualquer um vê                              │
│       │                                                                  │
│       │ "Criar conta" / "Fazer login" / "Ver planos"                    │
│       ▼                                                                  │
│  /signup, /login ── formulários, AuthContext                            │
│       │                                                                  │
│       ▼                                                                  │
│  index.html ── ProtectedRoute ── exige sessão válida                    │
│              (Fase D: + exige subscription_status ativo)                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                              ▲
                              │  cookie HTTP-only com JWT
                              ▼
┌──────────────────────── BACKEND (FastAPI) ──────────────────────────────┐
│                                                                          │
│  /auth/register   /auth/login    /auth/logout                           │
│  /auth/forgot-password   /auth/reset-password                           │
│  /auth/verify    /users/me                                              │
│                                                                          │
│  Middleware: verifica JWT em todas as rotas /api/* não-públicas         │
│                                                                          │
│  User (SQLAlchemy):                                                      │
│    id · email · hashed_password · is_verified · is_active · created_at  │
│    (Fase D: + stripe_customer_id, subscription_status,                  │
│              current_period_end, plan_id)                               │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                              ▲
                              │  (FASE D) webhook Stripe
                              ▼
                       Stripe Checkout + Customer Portal
```

---

## Fases de execução

### Fase A — Backend de auth (próxima sessão)

1. Adicionar dependências: `fastapi-users[sqlalchemy]`,
   `passlib[bcrypt]`, `resend`, `aiosqlite` (driver assíncrono).
2. Criar módulo `backend/src/dealflow_api/auth/` (User model,
   schemas, deps, rotas).
3. Configurar JWT cookie transport + bcrypt.
4. Endpoints `/auth/register`, `/auth/login`, `/auth/logout`,
   `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify`,
   `/users/me`.
5. Adapter de email (Resend em prod; console em dev).
6. Migration inicial (Alembic ou `Base.metadata.create_all`).
7. Validação via curl + tests unitários.

### Fase B — Frontend de auth (~1 sessão)

1. `AuthContext` (React) + hook `useAuth()` — envolve `/users/me`.
2. Páginas `/signup` e `/login` — componentes React, mesma estética
   da landing.
3. Wire dos botões "Criar conta" e "Fazer login" do header da
   landing (hoje placeholders).
4. Fluxos: "esqueci a senha", "verifique seu email".

### Fase C — Gate do app (~½ sessão)

1. `ProtectedRoute` no `index.html` — redireciona não-autenticados
   para `/login`.
2. `landing.html` permanece pública (sem mudança).
3. Após login, redireciona para `/` (o app).

### Fase D — Pay gate (DEPOIS de decidir o modelo de monetização)

Decisão pendente do dono do produto: assinatura · trial · free-tier
limitado · híbrido. Quando decidido, adicionar:

1. Produtos e preços no Stripe espelhando os planos (Sinal · Varredura · Mesa).
2. `/billing/checkout` que abre Stripe Checkout para o plano escolhido.
3. Webhook `/webhooks/stripe` processa `customer.subscription.*` e
   atualiza a DB.
4. `ProtectedRoute` passa a checar `subscription_status === "active"`
   além da sessão.
5. Stripe Customer Portal em `/billing/portal` para o usuário
   gerenciar a assinatura.

---

## Pontos abertos

- **Modelo de monetização (Fase D)** — em decisão; afeta só a Fase D.
  Fases A–C são monetização-agnósticas.
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

Mudanças no schema da tabela `users` exigem migration (Alembic) e
nota de breaking change no commit message.

---

## Referências

- `frontend/src/landing/ROADMAP.md` — arquitetura cinematográfica da landing.
- `docs/architecture.md` — motor de estimativa (backend, não auth).
- `docs/methodology.md` — validação e decisões do motor.
- `docs/lgpd-context-dossier.md` — contexto LGPD do produto (relevante para auth).
- `to-do-lists/dia-23.md` — tarefas mapeadas da landing.
