# Segurança — estado do Genesis Radar

> **Estado:** 2026-06-30 · auditoria completa do app (auth, billing/webhook,
> input/injeção, config/secrets/middleware, frontend) + hardening aplicado.
> **0 vulnerabilidades críticas.** Os achados HIGH/MEDIUM foram corrigidos ou
> têm mitigação documentada abaixo. 61 testes verdes após as mudanças.
>
> Documento vivo: toda mudança de segurança (gates, throttle, headers, deps)
> deve ser refletida aqui. Irmão de [`site-architecture.md`](site-architecture.md)
> (auth/paywall) e [`deploy.md`](deploy.md) (como subir).

---

## 1. Postura geral

As fundações são **sólidas e acima da média para um produto no início**:

- **Senhas** via `fastapi-users` com hash **argon2/bcrypt** (`pwdlib`) — nunca
  em texto. Não há cripto caseira.
- **Sessão** em **cookie HTTP-only** (imune a roubo por XSS) + **SameSite=Lax**
  (mitiga CSRF) + flag **Secure** (sob `COOKIE_SECURE`/prod).
- **Pagamento**: Stripe Checkout — **dados de cartão nunca passam pelo nosso
  servidor** (zero PCI scope). Guardamos só email + status de assinatura.
- **Webhook do Stripe** com assinatura verificada (fail-closed) + hardening de
  replay/ordem/escopo por assinatura.
- **Gate de acesso** (`auth/deps.py`) com ordem de checagem correta e sem
  bypass por cookie forjado (provado em teste).
- **LGPD**: PII pseudonimizada (HMAC), exclusão de conta cascateia no Stripe,
  audit log estruturado (art. 37), `users.db`/PII fora do Git.

"Seguro" nunca é absoluto: depois de no ar, o **maior risco é operacional**
(segredo vazado, sem HTTPS, deps desatualizadas, sem backup) — ver §4.

---

## 2. Hardening aplicado nesta sessão (2026-06-30)

Auditoria por 5 revisores independentes; três convergiram no mesmo nº 1
(X-Forwarded-For). Correções aplicadas:

| # | Sev | Achado | Correção | Onde |
|---|-----|--------|----------|------|
| 1 | HIGH | `X-Forwarded-For` era confiável sempre → forjar IP burlava rate-limit e poluía o audit log | Só confia no XFF com `trusted_proxy_hops>0`, pegando o IP a N hops da direita; default 0 = usa o IP do socket | `security.py::_client_ip`, `settings.py` |
| 2 | HIGH | `GET /empresas` sem teto de `limit/offset` → puxar o dataset inteiro + DoS de memória | Clamp `limit∈[1,200]`, `offset≥0` | `api/routes.py::list_empresas` |
| 3 | HIGH | Boot guard não exigia `COOKIE_SECURE` em prod → cookie de sessão sem flag Secure | Em `ENV=prod`: exige `COOKIE_SECURE` (com auth), exige gate ligado (auth ou api_key), proíbe CORS `*` | `main.py::_checar_config_boot` |
| 4 | MED | Login sem proteção a brute-force/credential-stuffing | Lockout por email (8 falhas/15 min → 429) | `auth/manager.py::authenticate`, `auth/throttle.py` |
| 5 | MED | Senha fraca (só ≥8) | Mín. **12**, teto 128, bloqueio de senhas comuns, proíbe email na senha | `auth/manager.py::validate_password` |
| 6 | MED | Email-bombing / abuso de cota Resend (verify/forgot sem limite) | Cooldown de 60s por (tipo, endereço) | `auth/manager.py`, `auth/throttle.py` |
| 7 | MED | Comparação de API key não era tempo-constante (timing) | `secrets.compare_digest` | `security.py` |
| 8 | MED | Dict do rate-limiter crescia sem limite (OOM) | GC periódico de buckets vazios/expirados | `security.py::RateLimitMiddleware` |
| 9 | MED | `CORS_ORIGINS="*"` + credenciais permitiria qualquer site autenticado | Boot aborta se `*` em `CORS_ORIGINS` | `main.py::_checar_config_boot` |
| 10 | MED | `.gitignore` sem catch-all de `*.db` (havia `_probe.db` solto) | Regras `*.db`/`*.sqlite*` + `_probe.db` removido | `.gitignore` |
| 11 | MED | "Insegura por padrão": auth off + sem api_key servia PII aberto | `ENV=prod` falha FECHADO (exige gate) | `main.py` |
| 12 | LOW | Boot guard aceitava secret curtíssimo | Exige `AUTH_SECRET` ≥32 chars | `main.py` |
| 13 | LOW | Guard do Resend só cobria `auth_required` | Agora cobre `auth_required` **ou** `cookie_secure` | `main.py` |

Cobertura nova de testes: `test_boot_guard_prod_fail_closed`,
`test_login_lockout_apos_falhas` (`backend/tests/test_auth.py`).

---

## 3. Resíduo conhecido (aceito ou backlog)

Itens reais da auditoria **não corrigidos nesta sessão** — por serem
mudanças maiores, dependerem de produção, ou serem trade-offs conscientes.
Nenhum é crítico; documentados para decisão futura.

### Backlog recomendado (antes de escala / muito tráfego)
- **CAPTCHA no cadastro/login** (Cloudflare Turnstile / hCaptcha). O lockout
  (#4) cobre brute-force online, mas CAPTCHA barra criação de contas por bot.
  Precisa de chave + integração no frontend (na branch `main`).
- **CSP + headers de segurança** (frontend não tem). Adicionar
  `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options`
  na borda (Caddy/nginx) ou meta tag. Defense-in-depth contra XSS futuro.
- **Teto de gasto da Busca IA** (`/search/ai`) por usuário/dia. Hoje só o
  rate-limit (agora não-forjável) limita. Adicionar contador de tokens/dia.
- **Chamadas externas síncronas** (Querido Diário 8s / protestos 25s) em rotas
  `def` → podem esgotar o threadpool. Migrar p/ `httpx.AsyncClient` + circuit
  breaker + teto de custo no provedor pago.
- **Revogação de sessão**: JWT de 7 dias é stateless; logout/reset de senha não
  matam sessões vivas. Adicionar `token_version` no User e checar no strategy.

### Trade-offs / dependentes de produção
- **Lockout pode ser usado p/ DoS de conta** (atacante trava a vítima com 8
  senhas erradas). Aceito para o início; mitigar depois com lockout por
  (email+IP) ou backoff exponencial em vez de bloqueio duro.
- **Enumeração de conta no `/register`** (400 "já existe"). Trade-off de UX;
  `forgot`/`verify` já são 202 cego.
- **Double-charge** (janela entre completar o checkout e o webhook chegar): o
  409 só dispara após o webhook. Corrigir conferindo `stripe.Subscription.list`
  do customer antes de abrir o checkout (ver `billing/routes.py` finding 1).
- **Token de verify/reset na query string** do link de email (vaza por Referer
  do host do frontend). Mover p/ fragment (`#token=`) — exige mudança no
  frontend (`main`). TTL do reset já é curto (30 min).
- **Multi-worker / multi-instância**: rate-limit, login-lockout e email-cooldown
  são **em memória (single-worker)**. Ao escalar horizontalmente, mover para
  **Redis**; e SQLite → **Postgres** (race do `stripe_event_ts` sob concorrência
  real fica relevante — usar `SELECT ... FOR UPDATE`).
- **Swagger/OpenAPI** público mesmo com api_key. Em prod, considerar
  `openapi_url=None` ou gate.

---

## 4. Requisitos operacionais (responsabilidade do deploy)

O código pode ser ótimo e vazar por aqui. Obrigatórios em produção:

- **Segredos só no ambiente do servidor**, nunca no Git/log/chat. Vazar
  `AUTH_SECRET` = forjar qualquer sessão. `backend/.env` é gitignored.
- **`DEALFLOW_ENV=prod`** — liga as guardas fail-closed (§2 #3/#11).
- **HTTPS sempre** + `COOKIE_SECURE=true`.
- **`DEALFLOW_TRUSTED_PROXY_HOPS=1`** atrás de proxy (senão rate-limit e audit
  usam o IP do proxy — quebram).
- **`users.db` em disco persistente + backup** (é o cadastro; sem backup, um
  reset de disco apaga todos os usuários).
- **Dependências atualizadas** (`uv lock --upgrade`).
- **Domínio verificado no Resend** (senão emails reais não saem).

---

## 5. Verificação (pós-deploy)

Checagens rápidas de que a segurança está ativa em produção:

```bash
# 1. Gate fechado: sem sessão, rota de dados → 401
curl -s -o /dev/null -w "%{http_code}\n" https://app.SEU_DOMINIO/api/v1/empresas   # 401

# 2. Cookie de sessão com flags certas (após login)
#    Set-Cookie: genesis_session=...; HttpOnly; Secure; SameSite=Lax

# 3. Clamp do limit (não dá pra puxar o dataset todo)
curl -s "https://app.SEU_DOMINIO/api/v1/empresas?limit=999999" | jq '.items | length'  # <= 200

# 4. CORS de origem aleatória é negado (sem Access-Control-Allow-Origin refletido)
curl -s -I -H "Origin: https://evil.example" https://app.SEU_DOMINIO/api/v1/health

# 5. config reflete prod
curl -s https://app.SEU_DOMINIO/api/v1/auth/config   # auth_required/require_subscription true
```

E periodicamente: rodar a suíte (`uv --directory backend run pytest`) e revisar
o backlog do §3.

---

## 6. Como auditar de novo

A auditoria desta sessão cobriu 5 dimensões (auth/sessão, billing/webhook,
input/injeção, config/secrets/middleware, frontend). Para repetir após
mudanças grandes, revisar os mesmos arquivos e atualizar a tabela do §2/§3.
Há também `/security-review` (revisa o diff da branch) para PRs incrementais.
