"""Rotas de billing · /checkout, /portal e /webhook (Stripe).

Montadas em /api/v1/billing (main.py). Fluxo:

  checkout → Stripe Checkout (mode=subscription) → webhook atualiza o
  User (subscription_status, plan_id, billing_cycle, current_period_end)
  → o gate require_access passa a liberar o app.

Plano "mesa" NÃO é self-serve (falar com vendas) — por isso o Literal
do body só aceita sinal|varredura (422 automático para o resto).
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Literal

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.db import User, get_async_session
from ..auth.router import current_active_user
from ..settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["billing"])

_SEM_STRIPE = "Pagamentos indisponíveis: Stripe não configurado (DEALFLOW_STRIPE_SECRET_KEY)."
_SEM_WEBHOOK = (
    "Webhook indisponível: DEALFLOW_STRIPE_WEBHOOK_SECRET não configurado."
)

# status que contam como assinatura vigente (espelha auth/deps.py)
_STATUS_ASSINATURA_ATIVA = {"active", "trialing"}


class CheckoutIn(BaseModel):
    """Plano + ciclo self-serve. lookup_key no Stripe = '{plan}_{period}'."""

    plan: Literal["sinal", "varredura"]
    period: Literal["mensal", "semestral", "anual"]


# ── Checkout ──────────────────────────────────────────────────────


@router.post("/checkout")
async def criar_checkout(
    body: CheckoutIn,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    """Abre uma sessão do Stripe Checkout e devolve {url}."""
    if not user.is_verified:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="EMAIL_NAO_VERIFICADO")
    # já assina → 409: um segundo checkout criaria uma SEGUNDA assinatura
    # viva (cobrança dupla). Troca de plano/ciclo é pelo Customer Portal.
    if user.subscription_status in _STATUS_ASSINATURA_ATIVA:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="ASSINATURA_JA_ATIVA")
    if settings.stripe_secret_key is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SEM_STRIPE)
    stripe.api_key = settings.stripe_secret_key

    # SDK do Stripe é síncrono (HTTPS bloqueante) — sempre via threadpool,
    # senão cada chamada congela o event loop inteiro (inclusive o SSE).
    # primeiro checkout: cria o Customer e persiste o id
    if not user.stripe_customer_id:
        customer = await run_in_threadpool(
            stripe.Customer.create,
            email=user.email,
            metadata={"user_id": str(user.id), "email": user.email},
        )
        user.stripe_customer_id = customer.id
        session.add(user)
        await session.commit()

    lookup_key = f"{body.plan}_{body.period}"
    precos = await run_in_threadpool(stripe.Price.list, lookup_keys=[lookup_key], limit=1)
    if not precos.data:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Preço '{lookup_key}' não existe no Stripe. Rode scripts/stripe_seed.py.",
        )

    checkout = await run_in_threadpool(
        stripe.checkout.Session.create,
        mode="subscription",
        customer=user.stripe_customer_id,
        line_items=[{"price": precos.data[0].id, "quantity": 1}],
        client_reference_id=str(user.id),
        allow_promotion_codes=True,
        success_url=f"{settings.app_base_url}/?checkout=sucesso",
        cancel_url=f"{settings.app_base_url}/landing.html?checkout=cancelado",
    )
    return {"url": checkout.url}


# ── Customer Portal ───────────────────────────────────────────────


@router.post("/portal")
async def abrir_portal(user: User = Depends(current_active_user)) -> dict:
    """Stripe Customer Portal — o usuário gerencia a própria assinatura."""
    if settings.stripe_secret_key is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SEM_STRIPE)
    if not user.stripe_customer_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Usuário ainda não tem cadastro de cobrança — faça o checkout primeiro.",
        )
    stripe.api_key = settings.stripe_secret_key
    # SDK síncrono → threadpool (mesmo motivo do checkout)
    portal = await run_in_threadpool(
        stripe.billing_portal.Session.create,
        customer=user.stripe_customer_id,
        return_url=f"{settings.app_base_url}/",
    )
    return {"url": portal.url}


# ── Webhook ───────────────────────────────────────────────────────


async def _user_por_customer(session: AsyncSession, customer_id: str | None) -> User | None:
    if not customer_id:
        return None
    result = await session.execute(select(User).where(User.stripe_customer_id == customer_id))
    return result.scalar_one_or_none()


async def _vincular_customer(session: AsyncSession, checkout_obj: dict) -> None:
    """checkout.session.completed → garante customer + subscription no usuário.

    Registrar `stripe_subscription_id` aqui escopa o webhook: com o 409
    do checkout só existe UMA assinatura viva por usuário, e os handlers
    abaixo ignoram eventos de qualquer outra subscription.
    """
    user_id = checkout_obj.get("client_reference_id")
    customer_id = checkout_obj.get("customer")
    subscription_id = checkout_obj.get("subscription")
    if not user_id or not customer_id:
        return
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return
    user = await session.get(User, uid)
    if user is None:
        return
    mudou = False
    if user.stripe_customer_id != customer_id:
        user.stripe_customer_id = customer_id
        mudou = True
    if subscription_id and user.stripe_subscription_id != subscription_id:
        user.stripe_subscription_id = subscription_id
        mudou = True
    if not mudou:
        return
    session.add(user)
    await session.commit()


def _plan_cycle_do_price(sub_obj: dict) -> tuple[str | None, str | None]:
    """Deriva (plan_id, billing_cycle) do lookup_key '{plan}_{period}'."""
    items = (sub_obj.get("items") or {}).get("data") or []
    if not items:
        return None, None
    price = items[0].get("price") or {}
    lookup = price.get("lookup_key") or ""
    if "_" not in lookup:
        return None, None
    plan, _, cycle = lookup.partition("_")
    return plan or None, cycle or None


def _period_end(sub_obj: dict) -> datetime | None:
    """Epoch → datetime UTC. Versões novas da API movem o campo pro item."""
    epoch = sub_obj.get("current_period_end")
    if epoch is None:
        items = (sub_obj.get("items") or {}).get("data") or []
        if items:
            epoch = items[0].get("current_period_end")
    if epoch is None:
        return None
    return datetime.fromtimestamp(int(epoch), tz=timezone.utc)


def _outra_assinatura(user: User, subscription_id: str | None) -> bool:
    """Evento de uma subscription que NÃO é a registrada do usuário.

    Sem id registrado (conta antiga, assinatura criada fora do checkout)
    o evento é aceito — e o handler registra o id que chegou.
    """
    return bool(
        user.stripe_subscription_id
        and subscription_id
        and subscription_id != user.stripe_subscription_id
    )


def _evento_obsoleto(user: User, criado_em: int | None) -> bool:
    """Stripe não garante ordem e re-tenta entregas por até 3 dias —
    um `updated` atrasado não pode ressuscitar assinatura cancelada.
    Obsoleto = `created` ≤ último evento aplicado (stripe_event_ts)."""
    if criado_em is None:
        return False
    return user.stripe_event_ts is not None and criado_em <= user.stripe_event_ts


async def _atualizar_assinatura(
    session: AsyncSession, sub_obj: dict, tipo: str, criado_em: int | None
) -> None:
    """customer.subscription.created|updated → espelha o estado no User."""
    user = await _user_por_customer(session, sub_obj.get("customer"))
    if user is None:
        return
    subscription_id = sub_obj.get("id")
    # `created` de outra subscription substitui a registrada (só acontece
    # após cancelamento — o 409 do checkout impede duas assinaturas vivas);
    # `updated` de outra subscription é descartado (escopo do FINDING 1).
    if tipo == "customer.subscription.updated" and _outra_assinatura(user, subscription_id):
        logger.info(
            "webhook: %s de subscription %s ignorado — usuário %s tem %s registrada",
            tipo, subscription_id, user.id, user.stripe_subscription_id,
        )
        return
    if _evento_obsoleto(user, criado_em):
        logger.info(
            "webhook: %s (created=%s) descartado — usuário %s já aplicou evento de %s",
            tipo, criado_em, user.id, user.stripe_event_ts,
        )
        return
    if subscription_id:
        user.stripe_subscription_id = subscription_id
    user.subscription_status = sub_obj.get("status")
    plan, cycle = _plan_cycle_do_price(sub_obj)
    if plan:
        user.plan_id = plan
    if cycle:
        user.billing_cycle = cycle
    fim = _period_end(sub_obj)
    if fim is not None:
        user.current_period_end = fim
    if criado_em is not None:
        user.stripe_event_ts = criado_em
    session.add(user)
    await session.commit()


async def _marcar_status(
    session: AsyncSession,
    customer_id: str | None,
    subscription_id: str | None,
    novo: str,
    criado_em: int | None,
) -> None:
    """subscription.deleted|invoice.payment_failed → status terminal/past_due."""
    user = await _user_por_customer(session, customer_id)
    if user is None:
        return
    if _outra_assinatura(user, subscription_id):
        logger.info(
            "webhook: '%s' de subscription %s ignorado — usuário %s tem %s registrada",
            novo, subscription_id, user.id, user.stripe_subscription_id,
        )
        return
    if _evento_obsoleto(user, criado_em):
        logger.info(
            "webhook: '%s' (created=%s) descartado — usuário %s já aplicou evento de %s",
            novo, criado_em, user.id, user.stripe_event_ts,
        )
        return
    if subscription_id and not user.stripe_subscription_id:
        user.stripe_subscription_id = subscription_id
    user.subscription_status = novo
    if criado_em is not None:
        user.stripe_event_ts = criado_em
    session.add(user)
    await session.commit()


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    """Recebe eventos do Stripe. 200 sempre que a assinatura for válida
    (eventos desconhecidos são ignorados — Stripe não deve re-tentar)."""
    if settings.stripe_webhook_secret is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SEM_WEBHOOK)
    payload = await request.body()
    assinatura = request.headers.get("stripe-signature", "")
    try:
        stripe.Webhook.construct_event(payload, assinatura, settings.stripe_webhook_secret)
    except (ValueError, stripe.SignatureVerificationError) as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Assinatura do webhook inválida."
        ) from exc

    # construct_event validou assinatura + JSON; daqui pra baixo operamos
    # no dict cru (StripeObject do SDK v15 não é mais um dict).
    evento: dict = json.loads(payload)
    tipo = evento.get("type", "")
    obj = (evento.get("data") or {}).get("object") or {}
    # epoch de criação do EVENTO — base da ordenação (ver _evento_obsoleto)
    criado_em = evento.get("created")

    if tipo == "checkout.session.completed":
        await _vincular_customer(session, obj)
    elif tipo in ("customer.subscription.created", "customer.subscription.updated"):
        await _atualizar_assinatura(session, obj, tipo, criado_em)
    elif tipo == "customer.subscription.deleted":
        await _marcar_status(session, obj.get("customer"), obj.get("id"), "canceled", criado_em)
    elif tipo == "invoice.payment_failed":
        await _marcar_status(
            session, obj.get("customer"), obj.get("subscription"), "past_due", criado_em
        )

    return {"recebido": True, "tipo": tipo}
