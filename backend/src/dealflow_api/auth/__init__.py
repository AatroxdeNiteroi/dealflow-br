"""Auth · fastapi-users + SQLite assíncrono + cookie JWT.

Módulos:
  db.py      — engine/sessão lazy + modelo User (campos de assinatura inclusos)
  schemas.py — UserRead/UserCreate/UserUpdate (contrato da API)
  manager.py — UserManager (validação de senha, hooks de email)
  emailer.py — Resend em produção · console em dev (fábrica get_emailer)
  deps.py    — require_access (gate das rotas de dados, lê settings em request-time)
  router.py  — composição dos routers do fastapi-users + GET /auth/config

Ver docs/site-architecture.md (Fase A) para o contrato completo.
"""
