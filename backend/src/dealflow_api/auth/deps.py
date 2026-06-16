"""Gate de acesso das rotas de dados — flags lidas em request-time.

Aplicado via `dependencies=[Depends(require_access)]` no
`include_router` dos routers de dados (routes + events) em main.py.

Com `settings.auth_required=False` (default, dev) o comportamento
atual fica intacto — passa direto, sem tocar no banco de usuários.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status

from ..settings import settings
from .db import User
from .router import optional_current_active_user

# health permanece público mesmo com auth_required (probes de infra),
# espelhando _AUTH_EXEMPT_PATHS do middleware de API key.
_CAMINHOS_PUBLICOS = {"/api/v1/health"}

_STATUS_ASSINATURA_OK = {"active", "trialing"}


def _carencia_valida(user: User) -> bool:
    """past_due ainda dentro do período já pago → carência até o vencimento.

    Sem janela conhecida (current_period_end None) não há carência. O SQLite
    devolve datetime NAIVE (representando UTC); normalizamos o tzinfo antes de
    comparar com um now tz-aware, senão a comparação lança TypeError. Em
    Postgres o valor já volta aware e o replace vira no-op.
    """
    if user.subscription_status != "past_due":
        return False
    cpe = user.current_period_end
    if cpe is None:
        return False
    if cpe.tzinfo is None:
        cpe = cpe.replace(tzinfo=timezone.utc)
    return cpe > datetime.now(timezone.utc)


def _assinatura_libera(user: User) -> bool:
    """Assinatura vigente: active/trialing, ou past_due dentro da carência."""
    return user.subscription_status in _STATUS_ASSINATURA_OK or _carencia_valida(user)


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
    if settings.require_subscription and not _assinatura_libera(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="ASSINATURA_NECESSARIA")
