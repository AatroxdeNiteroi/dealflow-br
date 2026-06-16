"""Composição dos routers do fastapi-users + GET /auth/config público.

Transporte: cookie `genesis_session` (httponly · samesite=lax ·
secure conforme settings) carregando JWT HS256 de 7 dias.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi_users import FastAPIUsers
from fastapi_users.authentication import AuthenticationBackend, CookieTransport, JWTStrategy

from ..settings import settings
from .db import User
from .manager import UserManager, get_user_manager
from .schemas import UserCreate, UserRead, UserUpdate

_SESSAO_MAX_AGE_S = 604_800  # 7 dias

cookie_transport = CookieTransport(
    cookie_name="genesis_session",
    cookie_max_age=_SESSAO_MAX_AGE_S,
    cookie_secure=settings.cookie_secure,
    cookie_httponly=True,
    cookie_samesite="lax",
)


def get_jwt_strategy() -> JWTStrategy:
    # lido em request-time — testes podem trocar o secret via settings
    return JWTStrategy(secret=settings.auth_secret, lifetime_seconds=_SESSAO_MAX_AGE_S)


auth_backend = AuthenticationBackend(
    name="cookie",
    transport=cookie_transport,
    get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

# Dependências reutilizadas por deps.require_access e billing/
current_active_user = fastapi_users.current_user(active=True)
optional_current_active_user = fastapi_users.current_user(active=True, optional=True)
# Gate de administração (auth/admin.py): exige superusuário ativo.
current_superuser = fastapi_users.current_user(active=True, superuser=True)

# ── /api/v1/auth ──────────────────────────────────────────────────
auth_router = APIRouter()
# login/logout — login SEM exigir email verificado; o gate (deps.py) exige
auth_router.include_router(fastapi_users.get_auth_router(auth_backend))
auth_router.include_router(fastapi_users.get_register_router(UserRead, UserCreate))
auth_router.include_router(fastapi_users.get_verify_router(UserRead))
auth_router.include_router(fastapi_users.get_reset_password_router())


@auth_router.get("/config")
def auth_config() -> dict:
    """Config pública (sem auth) — a landing decide o que renderizar."""
    return {
        "auth_required": settings.auth_required,
        "require_subscription": settings.require_subscription,
        "billing_enabled": settings.stripe_secret_key is not None,
    }


# ── /api/v1/users (me + administração por superuser) ──────────────
_me_router = APIRouter()


@_me_router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    name="users:delete_me",
    responses={401: {"description": "Sem sessão ou usuário inativo."}},
)
async def delete_me(
    request: Request,
    user: User = Depends(current_active_user),
    user_manager: UserManager = Depends(get_user_manager),
) -> Response:
    """Exclusão de conta self-service (LGPD art. 18).

    A limpeza no Stripe (cancela assinatura + remove o Customer/PII) acontece no
    hook UserManager.on_before_delete — best-effort e compartilhado com o
    DELETE /{id} administrativo. Aqui apenas apagamos o usuário e limpamos o
    cookie de sessão. O JWT é stateless, mas fica inócuo: o usuário some e
    qualquer request seguinte resolve para None → 401.
    """
    await user_manager.delete(user, request=request)
    return await cookie_transport.get_logout_response()


# DELETE /me precisa ser registrada ANTES do router da lib: senão o
# DELETE /{id} (superuser) sombreia /me (capturando id="me") e o usuário
# comum levaria 403. include_router preserva a ordem de inserção.
users_router = APIRouter()
users_router.include_router(_me_router)
users_router.include_router(fastapi_users.get_users_router(UserRead, UserUpdate))
