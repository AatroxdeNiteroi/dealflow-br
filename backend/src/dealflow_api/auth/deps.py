"""Gate de acesso das rotas de dados — flags lidas em request-time.

Aplicado via `dependencies=[Depends(require_access)]` no
`include_router` dos routers de dados (routes + events) em main.py.

Com `settings.auth_required=False` (default, dev) o comportamento
atual fica intacto — passa direto, sem tocar no banco de usuários.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status

from ..settings import settings
from .db import User
from .router import optional_current_active_user

# health permanece público mesmo com auth_required (probes de infra),
# espelhando _AUTH_EXEMPT_PATHS do middleware de API key.
_CAMINHOS_PUBLICOS = {"/api/v1/health"}

_STATUS_ASSINATURA_OK = {"active", "trialing"}


async def require_access(
    request: Request,
    user: User | None = Depends(optional_current_active_user),
) -> None:
    """401 sem sessão · 403 sem verificação · 403 sem assinatura (flag)."""
    if not settings.auth_required:
        return
    if request.url.path in _CAMINHOS_PUBLICOS:
        return
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="NAO_AUTENTICADO")
    if not user.is_verified:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="EMAIL_NAO_VERIFICADO")
    if settings.require_subscription and user.subscription_status not in _STATUS_ASSINATURA_OK:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="ASSINATURA_NECESSARIA")
