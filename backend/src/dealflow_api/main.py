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
    """Guardas de boot — config insegura não sobe.

    Evita acidentes de produção:
      - CORS "*" com cookies de credencial (qualquer site faria requests
        autenticados);
      - JWT de sessão e tokens de verify/reset assinados com o segredo
        default do repo (público), vazio ou curto demais → forjáveis;
      - fallback silencioso para ConsoleEmailer, que despejaria email do
        usuário (PII/LGPD) e tokens de verify/reset nos logs do host;
      - em DEALFLOW_ENV=prod, falha FECHADO: exige gate de acesso ligado
        (auth ou api_key) e o cookie de sessão com a flag Secure.
    """
    # CORS "*" + allow_credentials=True reflete a Origin do request e emite
    # Access-Control-Allow-Credentials — qualquer site faria requests com o
    # cookie genesis_session. Nunca permitir, em qualquer modo.
    if "*" in settings.cors_origins:
        raise RuntimeError(
            "DEALFLOW_CORS_ORIGINS não pode conter '*': o app usa cookies de sessão "
            "(allow_credentials), e '*' liberaria qualquer site a fazer requests "
            "autenticados. Liste os domínios reais."
        )

    em_prod = settings.env.lower() == "prod"
    if em_prod:
        # fail-closed: produção não pode servir dados/PII com o gate aberto.
        if not (settings.auth_required or settings.api_key):
            raise RuntimeError(
                "DEALFLOW_ENV=prod exige DEALFLOW_AUTH_REQUIRED=true ou DEALFLOW_API_KEY "
                "definido — senão as rotas de dados ficam públicas."
            )
        if settings.auth_required and not settings.cookie_secure:
            raise RuntimeError(
                "DEALFLOW_ENV=prod com AUTH_REQUIRED exige DEALFLOW_COOKIE_SECURE=true "
                "(senão o cookie genesis_session trafega sem a flag Secure)."
            )

    if not (settings.auth_required or settings.cookie_secure or em_prod):
        return

    if settings.auth_secret in ("", "dev-secret-trocar-em-producao"):
        raise RuntimeError(
            "DEALFLOW_AUTH_SECRET vazio ou com o default de dev — gere um segredo real "
            "(openssl rand -hex 32) antes de ligar DEALFLOW_AUTH_REQUIRED/DEALFLOW_COOKIE_SECURE."
        )
    if len(settings.auth_secret) < 32:
        raise RuntimeError(
            "DEALFLOW_AUTH_SECRET muito curto (<32 caracteres) — gere um segredo real "
            "com entropia suficiente (openssl rand -hex 32 = 64 chars)."
        )
    if (settings.auth_required or settings.cookie_secure) and not settings.resend_api_key:
        raise RuntimeError(
            "DEALFLOW_RESEND_API_KEY ausente com auth/cookie_secure ligados — o fallback de "
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
