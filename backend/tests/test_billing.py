"""Testes de billing (Fase D backend) — checkout, portal e webhook.

Sem chaves do Stripe (default) tudo degrada com 503; o webhook com
secret valida a assinatura (400 quando inválida) e atualiza o usuário
quando válida (assinada manualmente com HMAC no teste).
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time

import pytest
import stripe

from dealflow_api.settings import settings

from .conftest import (
    login,
    registrar,
    set_coluna_user,
    superuser_logado,
    usuario_logado_verificado,
)

_WEBHOOK_SECRET = "whsec_teste_local"


def _assinar(payload: bytes, secret: str) -> str:
    """Gera o header Stripe-Signature válido: HMAC-SHA256 de '{ts}.{payload}'."""
    ts = int(time.time())
    mac = hmac.new(secret.encode(), f"{ts}.".encode() + payload, hashlib.sha256).hexdigest()
    return f"t={ts},v1={mac}"


# ── Checkout ──────────────────────────────────────────────────────


def test_checkout_sem_sessao_401(client, emails) -> None:
    r = client.post("/api/v1/billing/checkout", json={"plan": "sinal", "period": "mensal"})
    assert r.status_code == 401


def test_checkout_nao_verificado_403(client, emails) -> None:
    registrar(client, "naoverif@exemplo.com.br")
    from .conftest import login

    assert login(client, "naoverif@exemplo.com.br").status_code == 204
    r = client.post("/api/v1/billing/checkout", json={"plan": "sinal", "period": "mensal"})
    assert r.status_code == 403
    assert r.json()["detail"] == "EMAIL_NAO_VERIFICADO"


def test_checkout_sem_stripe_503(client, emails) -> None:
    usuario_logado_verificado(client, emails, "checkout@exemplo.com.br")
    r = client.post("/api/v1/billing/checkout", json={"plan": "varredura", "period": "anual"})
    assert r.status_code == 503
    assert "Stripe" in r.json()["detail"]


def test_checkout_plano_invalido_422(client, emails) -> None:
    usuario_logado_verificado(client, emails, "mesa@exemplo.com.br")
    # mesa NÃO é self-serve (falar com vendas) → 422 do Literal
    r = client.post("/api/v1/billing/checkout", json={"plan": "mesa", "period": "mensal"})
    assert r.status_code == 422
    r = client.post("/api/v1/billing/checkout", json={"plan": "sinal", "period": "quinzenal"})
    assert r.status_code == 422


def test_checkout_assinatura_ativa_409(client, emails, users_db) -> None:
    # assinante (active ou trialing) não abre segundo checkout — seria
    # cobrança dupla; troca de plano é pelo Customer Portal
    usuario_logado_verificado(client, emails, "jaassina@exemplo.com.br")
    # VIVA inclui past_due/incomplete/paused — todos podem virar active no Stripe
    # (incomplete = boleto/Pix pendente); regularizar é pelo Portal, não 2º checkout
    for vigente in ("active", "trialing", "past_due", "incomplete", "paused"):
        set_coluna_user(users_db, "jaassina@exemplo.com.br", "subscription_status", vigente)
        r = client.post("/api/v1/billing/checkout", json={"plan": "varredura", "period": "mensal"})
        assert r.status_code == 409
        assert r.json()["detail"] == "ASSINATURA_JA_ATIVA"
    # status mortos voltam a poder assinar (caem no 503 — Stripe desconfigurado)
    for morto in ("canceled", "unpaid", "incomplete_expired"):
        set_coluna_user(users_db, "jaassina@exemplo.com.br", "subscription_status", morto)
        r = client.post("/api/v1/billing/checkout", json={"plan": "sinal", "period": "mensal"})
        assert r.status_code == 503


# ── Portal ────────────────────────────────────────────────────────


def test_portal_sem_sessao_401(client, emails) -> None:
    assert client.post("/api/v1/billing/portal").status_code == 401


def test_portal_sem_stripe_503(client, emails) -> None:
    usuario_logado_verificado(client, emails, "portal@exemplo.com.br")
    assert client.post("/api/v1/billing/portal").status_code == 503


def test_portal_sem_customer_400(client, emails, monkeypatch: pytest.MonkeyPatch) -> None:
    # com Stripe "configurado", usuário sem stripe_customer_id → 400
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_falsa")
    usuario_logado_verificado(client, emails, "semcustomer@exemplo.com.br")
    r = client.post("/api/v1/billing/portal")
    assert r.status_code == 400


# ── Webhook ───────────────────────────────────────────────────────


def test_webhook_sem_secret_503(client, emails) -> None:
    r = client.post("/api/v1/billing/webhook", content=b"{}")
    assert r.status_code == 503


def test_webhook_assinatura_invalida_400(client, emails, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "stripe_webhook_secret", _WEBHOOK_SECRET)
    r = client.post(
        "/api/v1/billing/webhook",
        content=b'{"type": "customer.subscription.updated"}',
        headers={"Stripe-Signature": "t=1,v1=deadbeef"},
    )
    assert r.status_code == 400
    # sem header nenhum também é 400
    r = client.post("/api/v1/billing/webhook", content=b"{}")
    assert r.status_code == 400


def test_webhook_evento_desconhecido_200(client, emails, monkeypatch) -> None:
    monkeypatch.setattr(settings, "stripe_webhook_secret", _WEBHOOK_SECRET)
    # payloads reais do Stripe sempre trazem "object": "event" no topo
    payload = json.dumps(
        {"object": "event", "type": "balance.available", "data": {"object": {}}}
    ).encode()
    r = client.post(
        "/api/v1/billing/webhook",
        content=payload,
        headers={"Stripe-Signature": _assinar(payload, _WEBHOOK_SECRET)},
    )
    assert r.status_code == 200


def test_webhook_subscription_updated_atualiza_user(
    client, emails, users_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "stripe_webhook_secret", _WEBHOOK_SECRET)
    usuario_logado_verificado(client, emails, "assinante@exemplo.com.br")
    set_coluna_user(users_db, "assinante@exemplo.com.br", "stripe_customer_id", "cus_teste_123")

    fim_periodo = int(time.time()) + 30 * 86_400
    payload = json.dumps(
        {
            "object": "event",
            "type": "customer.subscription.updated",
            "data": {
                "object": {
                    "customer": "cus_teste_123",
                    "status": "active",
                    "current_period_end": fim_periodo,
                    "items": {"data": [{"price": {"lookup_key": "sinal_anual"}}]},
                }
            },
        }
    ).encode()
    r = client.post(
        "/api/v1/billing/webhook",
        content=payload,
        headers={"Stripe-Signature": _assinar(payload, _WEBHOOK_SECRET)},
    )
    assert r.status_code == 200

    me = client.get("/api/v1/users/me").json()
    assert me["subscription_status"] == "active"
    assert me["plan_id"] == "sinal"
    assert me["billing_cycle"] == "anual"
    assert me["current_period_end"] is not None


def test_webhook_subscription_deleted_cancela(
    client, emails, users_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "stripe_webhook_secret", _WEBHOOK_SECRET)
    usuario_logado_verificado(client, emails, "cancelado@exemplo.com.br")
    set_coluna_user(users_db, "cancelado@exemplo.com.br", "stripe_customer_id", "cus_teste_456")

    payload = json.dumps(
        {
            "object": "event",
            "type": "customer.subscription.deleted",
            "data": {"object": {"customer": "cus_teste_456", "status": "canceled"}},
        }
    ).encode()
    r = client.post(
        "/api/v1/billing/webhook",
        content=payload,
        headers={"Stripe-Signature": _assinar(payload, _WEBHOOK_SECRET)},
    )
    assert r.status_code == 200
    assert client.get("/api/v1/users/me").json()["subscription_status"] == "canceled"


# ── Webhook · escopo por subscription + ordenação de eventos ─────


def _postar_evento(client, evento: dict):
    """POST /billing/webhook com o evento assinado (HMAC manual)."""
    payload = json.dumps(evento).encode()
    return client.post(
        "/api/v1/billing/webhook",
        content=payload,
        headers={"Stripe-Signature": _assinar(payload, _WEBHOOK_SECRET)},
    )


def _evento(tipo: str, criado_em: int, obj: dict) -> dict:
    """Evento no formato do Stripe — `created` no topo é a base da ordenação."""
    return {"object": "event", "type": tipo, "created": criado_em, "data": {"object": obj}}


def test_webhook_updated_atrasado_nao_ressuscita(
    client, emails, users_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Stripe re-tenta entregas por até 3 dias e não garante ordem — um
    updated(active) com `created` antigo não pode reverter o cancelamento."""
    monkeypatch.setattr(settings, "stripe_webhook_secret", _WEBHOOK_SECRET)
    usuario_logado_verificado(client, emails, "foradeordem@exemplo.com.br")
    set_coluna_user(users_db, "foradeordem@exemplo.com.br", "stripe_customer_id", "cus_ordem")

    agora = int(time.time())
    r = _postar_evento(
        client,
        _evento(
            "customer.subscription.deleted",
            agora,
            {"id": "sub_ordem", "customer": "cus_ordem", "status": "canceled"},
        ),
    )
    assert r.status_code == 200
    assert client.get("/api/v1/users/me").json()["subscription_status"] == "canceled"

    # entrega atrasada: created ANTERIOR ao deleted já aplicado → descartada
    r = _postar_evento(
        client,
        _evento(
            "customer.subscription.updated",
            agora - 60,
            {
                "id": "sub_ordem",
                "customer": "cus_ordem",
                "status": "active",
                "items": {"data": [{"price": {"lookup_key": "sinal_mensal"}}]},
            },
        ),
    )
    assert r.status_code == 200
    assert client.get("/api/v1/users/me").json()["subscription_status"] == "canceled"


def test_webhook_outra_subscription_ignorada(
    client, emails, users_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    """deleted/payment_failed de uma subscription que NÃO é a registrada
    não revogam o acesso de quem segue pagando."""
    monkeypatch.setattr(settings, "stripe_webhook_secret", _WEBHOOK_SECRET)
    usuario_logado_verificado(client, emails, "pagante@exemplo.com.br")
    set_coluna_user(users_db, "pagante@exemplo.com.br", "stripe_customer_id", "cus_pagante")
    set_coluna_user(users_db, "pagante@exemplo.com.br", "stripe_subscription_id", "sub_minha")
    set_coluna_user(users_db, "pagante@exemplo.com.br", "subscription_status", "active")

    agora = int(time.time())
    r = _postar_evento(
        client,
        _evento(
            "customer.subscription.deleted",
            agora,
            {"id": "sub_intrusa", "customer": "cus_pagante", "status": "canceled"},
        ),
    )
    assert r.status_code == 200
    assert client.get("/api/v1/users/me").json()["subscription_status"] == "active"

    r = _postar_evento(
        client,
        _evento(
            "invoice.payment_failed",
            agora + 1,
            {"customer": "cus_pagante", "subscription": "sub_intrusa"},
        ),
    )
    assert r.status_code == 200
    assert client.get("/api/v1/users/me").json()["subscription_status"] == "active"


def test_webhook_fluxo_normal_created_updated_deleted(
    client, emails, users_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Fluxo em ordem segue funcionando: created → updated → deleted."""
    monkeypatch.setattr(settings, "stripe_webhook_secret", _WEBHOOK_SECRET)
    usuario_logado_verificado(client, emails, "ciclodevida@exemplo.com.br")
    set_coluna_user(users_db, "ciclodevida@exemplo.com.br", "stripe_customer_id", "cus_vida")

    agora = int(time.time())
    fim_periodo = agora + 30 * 86_400
    base = {
        "id": "sub_vida",
        "customer": "cus_vida",
        "current_period_end": fim_periodo,
        "items": {"data": [{"price": {"lookup_key": "varredura_mensal"}}]},
    }

    r = _postar_evento(
        client,
        _evento("customer.subscription.created", agora, {**base, "status": "trialing"}),
    )
    assert r.status_code == 200
    me = client.get("/api/v1/users/me").json()
    assert me["subscription_status"] == "trialing"
    assert me["plan_id"] == "varredura"
    assert me["billing_cycle"] == "mensal"

    r = _postar_evento(
        client,
        _evento("customer.subscription.updated", agora + 10, {**base, "status": "active"}),
    )
    assert r.status_code == 200
    assert client.get("/api/v1/users/me").json()["subscription_status"] == "active"

    r = _postar_evento(
        client,
        _evento("customer.subscription.deleted", agora + 20, {**base, "status": "canceled"}),
    )
    assert r.status_code == 200
    assert client.get("/api/v1/users/me").json()["subscription_status"] == "canceled"


# ── Webhook · vínculo do checkout + ordenação no mesmo segundo ────


def test_webhook_checkout_session_vincula_customer(
    client, emails, monkeypatch: pytest.MonkeyPatch
) -> None:
    """checkout.session.completed grava customer/subscription no usuário —
    provado porque um subscription.updated subsequente só acha o user se o
    vínculo (stripe_customer_id) tiver sido escrito."""
    monkeypatch.setattr(settings, "stripe_webhook_secret", _WEBHOOK_SECRET)
    usuario_logado_verificado(client, emails, "vinculo@exemplo.com.br")
    uid = client.get("/api/v1/users/me").json()["id"]
    agora = int(time.time())

    r = _postar_evento(
        client,
        _evento(
            "checkout.session.completed",
            agora,
            {"client_reference_id": uid, "customer": "cus_vinc", "subscription": "sub_vinc"},
        ),
    )
    assert r.status_code == 200
    # o handler só grava IDs; status segue None
    assert client.get("/api/v1/users/me").json()["subscription_status"] is None

    # INTRUSO: deleted de OUTRA subscription. Só é ignorado se o
    # checkout.session.completed tiver gravado stripe_subscription_id=sub_vinc
    # (senão _outra_assinatura veria None e aplicaria → status 'canceled').
    r = _postar_evento(
        client,
        _evento(
            "customer.subscription.deleted",
            agora + 5,
            {"id": "sub_intrusa", "customer": "cus_vinc", "status": "canceled"},
        ),
    )
    assert r.status_code == 200
    assert client.get("/api/v1/users/me").json()["subscription_status"] is None

    r = _postar_evento(
        client,
        _evento(
            "customer.subscription.updated",
            agora + 10,
            {
                "id": "sub_vinc",
                "customer": "cus_vinc",
                "status": "active",
                "items": {"data": [{"price": {"lookup_key": "sinal_mensal"}}]},
            },
        ),
    )
    assert r.status_code == 200
    assert client.get("/api/v1/users/me").json()["subscription_status"] == "active"


def test_webhook_created_e_updated_mesmo_segundo_aplica(
    client, emails, users_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Dois eventos distintos no MESMO segundo (created==stripe_event_ts): com
    o fix `<=`→`<`, o segundo NÃO é descartado. Com o antigo `<=` ficaria
    'trialing' — este é o teste de regressão do fix de ordenação."""
    monkeypatch.setattr(settings, "stripe_webhook_secret", _WEBHOOK_SECRET)
    usuario_logado_verificado(client, emails, "mesmosegundo@exemplo.com.br")
    set_coluna_user(users_db, "mesmosegundo@exemplo.com.br", "stripe_customer_id", "cus_seg")
    t = int(time.time())
    base = {
        "id": "sub_seg",
        "customer": "cus_seg",
        "items": {"data": [{"price": {"lookup_key": "varredura_mensal"}}]},
    }

    r = _postar_evento(
        client, _evento("customer.subscription.created", t, {**base, "status": "trialing"})
    )
    assert r.status_code == 200
    assert client.get("/api/v1/users/me").json()["subscription_status"] == "trialing"

    r = _postar_evento(
        client, _evento("customer.subscription.updated", t, {**base, "status": "active"})
    )
    assert r.status_code == 200
    assert client.get("/api/v1/users/me").json()["subscription_status"] == "active"


# ── Exclusão de conta · cancela a assinatura no Stripe (best-effort) ──


def test_delete_me_apaga_customer_stripe(
    client, emails, users_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    # exclusão remove o Customer no Stripe (cancela assinatura + apaga PII)
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_x")
    usuario_logado_verificado(client, emails, "delsub@exemplo.com.br")
    set_coluna_user(users_db, "delsub@exemplo.com.br", "stripe_customer_id", "cus_x")

    chamadas: list[str] = []
    monkeypatch.setattr(stripe.Customer, "delete", lambda cid, **k: chamadas.append(cid))

    assert client.delete("/api/v1/users/me").status_code == 204
    assert chamadas == ["cus_x"]  # apagou o customer certo
    assert client.get("/api/v1/users/me").status_code == 401


def test_delete_me_stripe_falha_nao_bloqueia(
    client, emails, users_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_x")
    usuario_logado_verificado(client, emails, "delfail@exemplo.com.br")
    set_coluna_user(users_db, "delfail@exemplo.com.br", "stripe_customer_id", "cus_y")

    def boom(cid, **k):
        raise stripe.StripeError("boom")

    monkeypatch.setattr(stripe.Customer, "delete", boom)

    # falha no Stripe NÃO bloqueia a exclusão LGPD
    assert client.delete("/api/v1/users/me").status_code == 204
    assert client.get("/api/v1/users/me").status_code == 401


def test_admin_grant_resiste_webhook_atrasado(
    client, emails, users_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Concessão manual (admin) bumpa stripe_event_ts → um webhook do Stripe
    atrasado (created anterior) não reverte a cortesia."""
    monkeypatch.setattr(settings, "stripe_webhook_secret", _WEBHOOK_SECRET)
    alvo_id = registrar(client, "cortesia@exemplo.com.br").json()["id"]
    set_coluna_user(users_db, "cortesia@exemplo.com.br", "stripe_customer_id", "cus_w")
    set_coluna_user(users_db, "cortesia@exemplo.com.br", "stripe_subscription_id", "sub_w")
    superuser_logado(client, emails, users_db, "adminw@exemplo.com.br")
    r = client.patch(
        f"/api/v1/users/{alvo_id}/subscription",
        json={"plan_id": "mesa", "subscription_status": "active"},
    )
    assert r.status_code == 200

    # webhook ATRASADO: deleted de sub_w com created bem no passado
    r = _postar_evento(
        client,
        _evento(
            "customer.subscription.deleted",
            int(time.time()) - 10_000,
            {"id": "sub_w", "customer": "cus_w", "status": "canceled"},
        ),
    )
    assert r.status_code == 200
    # cortesia preservada
    assert login(client, "cortesia@exemplo.com.br").status_code == 204
    assert client.get("/api/v1/users/me").json()["subscription_status"] == "active"
