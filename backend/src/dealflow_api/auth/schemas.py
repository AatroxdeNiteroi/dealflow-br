"""Schemas de usuário — contrato da API (ver docs/site-architecture.md).

UserRead expõe também os campos de assinatura (Fase D), para o
frontend decidir entre "assinar" e "abrir o app" com um único
GET /users/me.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi_users import schemas


class UserRead(schemas.BaseUser[uuid.UUID]):
    """id · email · is_active · is_verified · is_superuser + assinatura.

    Campos internos do Stripe (stripe_customer_id, stripe_subscription_id,
    stripe_event_ts) ficam FORA do contrato — o frontend não precisa deles.
    """

    subscription_status: str | None = None
    # "sinal" | "varredura" | "mesa" (mesa é atribuído manualmente — sem checkout)
    plan_id: str | None = None
    # "mensal" | "semestral" | "anual"
    billing_cycle: str | None = None
    current_period_end: datetime | None = None


class UserCreate(schemas.BaseUserCreate):
    """Registro: email + password (router usa modo safe — sem escalar flags)."""


class UserUpdate(schemas.BaseUserUpdate):
    """Atualização self-service (email/senha). Flags só via superuser."""
