"""FastAPI entry. Compõe routes REST + SSE + auth (fastapi-users) + billing."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import events, routes
from .auth.admin import admin_router
from .auth.db import create_db_and_tables, dispose_engine
from .auth.deps import require_access
from .auth.router import auth_router, users_router
from .billing.routes import router as billing_router
from .security import ApiKeyAuthMiddleware, AuditLogMiddleware, RateLimitMiddleware
from .settings import settings


def _checar_config_boot() -> None:
    """Guardas de boot — config insegura não sobe com auth ligado.

    Evita dois acidentes de produção:
      - JWT de sessão e tokens de verify/reset assinados com o segredo
        default do repo (público) ou vazio → forjáveis por qualquer um;
      - fallback silencioso para ConsoleEmailer, que despejaria email do
        usuário (PII/LGPD) e tokens de verify/reset nos logs do host.
    """
    if not (settings.auth_required or settings.cookie_secure):
        return
    if settings.auth_secret in ("", "dev-secret-trocar-em-producao"):
        raise RuntimeError(
            "DEALFLOW_AUTH_SECRET vazio ou com o default de dev — gere um segredo real "
            "(openssl rand -hex 32) antes de ligar DEALFLOW_AUTH_REQUIRED/DEALFLOW_COOKIE_SECURE."
        )
    if settings.auth_required and not settings.resend_api_key:
        raise RuntimeError(
            "DEALFLOW_RESEND_API_KEY ausente com DEALFLOW_AUTH_REQUIRED=true — o fallback de "
            "console logaria emails e tokens de verificação/reset (PII/LGPD) no stderr."
        )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    _checar_config_boot()
    # Banco de usuários: cria tabelas se não existirem (idempotente).
    # Engine lazy — respeita users_db_path trocado pelos testes antes do start.
    await create_db_and_tables()
    yield
    await dispose_engine()


app = FastAPI(
    title="DealFlow BR",
    description="Motor de triagem M&A médio porte RJ/SP — 3 agentes de motor + REST + SSE",
    version="0.1.0",
    lifespan=lifespan,
)

# Ordem importa: `add_middleware` registra OUTSIDE-IN inversamente.
# O último add_middleware vira o OUTERMOST. Stack desejada (out → in):
#   CORS → AuditLog → RateLimit → ApiKeyAuth → App
# Logo, registrar na ordem inversa abaixo:
app.add_middleware(ApiKeyAuthMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(AuditLogMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,  # cookie genesis_session cruza origens da whitelist
    allow_methods=["*"],
    allow_headers=["X-Api-Key", "Content-Type", "Authorization"],
)

# Rotas de dados — gate por require_access (no-op com auth_required=False)
app.include_router(routes.router, prefix="/api/v1", dependencies=[Depends(require_access)])
app.include_router(events.router, prefix="/api/v1", dependencies=[Depends(require_access)])

# Auth + billing (contrato em docs/site-architecture.md)
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users_router, prefix="/api/v1/users", tags=["users"])
app.include_router(admin_router, prefix="/api/v1/users", tags=["users-admin"])
app.include_router(billing_router, prefix="/api/v1/billing")


@app.get("/")
def root() -> dict[str, str]:
    return {"app": "dealflow-api", "version": "0.1.0", "docs": "/docs"}
