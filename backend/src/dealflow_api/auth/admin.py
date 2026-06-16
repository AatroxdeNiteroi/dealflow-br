"""Rotas de administração (superuser) · atribuição manual de assinatura.

Por que um schema de body PRÓPRIO (SubscriptionAdminIn) + escrita direta no
ORM, em vez de estender UserUpdate: o UserUpdate é compartilhado com o
PATCH /users/me ("safe mode" do fastapi-users), e o safe mode só exclui
is_active/is_superuser/is_verified — NÃO campos custom. Se subscription_status
entrasse no UserUpdate, um usuário comum daria PATCH /me com
subscription_status=active e furaria o paywall. Aqui o gate é a dependência
de superusuário; o UserUpdate continua intocado.

Plano "mesa" é venda assistida (sem checkout no Stripe) — só atribuível aqui.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from .db import User, get_async_session
from .router import current_superuser
from .schemas import UserRead

admin_router = APIRouter()


class SubscriptionAdminIn(BaseModel):
    """Atribuição manual de assinatura (inclui o plano 'mesa')."""

    plan_id: Literal["sinal", "varredura", "mesa"]
    subscription_status: Literal["active", "trialing", "past_due", "canceled", "incomplete"]
    billing_cycle: Literal["mensal", "semestral", "anual"] | None = None
    current_period_end: datetime | None = None


@admin_router.patch(
    "/{user_id}/subscription",
    response_model=UserRead,
    dependencies=[Depends(current_superuser)],
    name="admin:set_subscription",
)
async def set_subscription(
    user_id: uuid.UUID,
    body: SubscriptionAdminIn,
    session: AsyncSession = Depends(get_async_session),
) -> UserRead:
    """Grava a assinatura direto no ORM (espelha o webhook). Superuser-only.

    Sem colisão com o get_users_router da lib: '/{user_id}/subscription' tem
    2 segmentos, nunca casa com o '/{id}' de 1 segmento das rotas nativas.
    """
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="USUARIO_NAO_ENCONTRADO")
    user.subscription_status = body.subscription_status
    user.plan_id = body.plan_id
    if body.billing_cycle is not None:
        user.billing_cycle = body.billing_cycle
    if body.current_period_end is not None:
        user.current_period_end = body.current_period_end
    # Concessão manual é autoritativa: qualquer evento do Stripe criado ANTES
    # desta atribuição vira obsoleto (não sobrescreve a cortesia). Eventos
    # genuinamente novos (created posterior) ainda se aplicam normalmente.
    user.stripe_event_ts = int(datetime.now(timezone.utc).timestamp())
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return UserRead.model_validate(user)
