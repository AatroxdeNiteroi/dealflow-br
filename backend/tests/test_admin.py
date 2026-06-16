"""Testes do endpoint admin de assinatura (superuser) + regressão de paywall.

O endpoint PATCH /api/v1/users/{id}/subscription é superuser-only e grava
direto no ORM. O teste de regressão garante que um usuário comum NÃO consegue
escalar a própria assinatura via PATCH /me (o UserUpdate não expõe esses
campos — Pydantic ignora os extras).
"""

from __future__ import annotations

import uuid

from dealflow_api.settings import settings

from .conftest import (
    get_coluna_user,
    login,
    registrar,
    superuser_logado,
    usuario_logado_verificado,
)


def test_admin_atribui_plano_mesa_superuser_200(client, emails, users_db) -> None:
    alvo_id = registrar(client, "alvo@exemplo.com.br").json()["id"]
    superuser_logado(client, emails, users_db, "admin@exemplo.com.br")

    r = client.patch(
        f"/api/v1/users/{alvo_id}/subscription",
        json={"plan_id": "mesa", "subscription_status": "active"},
    )
    assert r.status_code == 200
    assert r.json()["plan_id"] == "mesa"
    assert r.json()["subscription_status"] == "active"

    # reflete no /me do alvo (troca o cookie da sessão para o alvo)
    assert login(client, "alvo@exemplo.com.br").status_code == 204
    me = client.get("/api/v1/users/me").json()
    assert me["plan_id"] == "mesa"
    assert me["subscription_status"] == "active"


def test_admin_subscription_user_comum_403(client, emails, users_db) -> None:
    usuario_logado_verificado(client, emails, "comum@exemplo.com.br")
    alvo_id = registrar(client, "outro@exemplo.com.br").json()["id"]
    r = client.patch(
        f"/api/v1/users/{alvo_id}/subscription",
        json={"plan_id": "sinal", "subscription_status": "active"},
    )
    assert r.status_code == 403


def test_admin_subscription_anonimo_401(client, emails) -> None:
    r = client.patch(
        f"/api/v1/users/{uuid.uuid4()}/subscription",
        json={"plan_id": "sinal", "subscription_status": "active"},
    )
    assert r.status_code == 401


def test_admin_subscription_user_inexistente_404(client, emails, users_db) -> None:
    superuser_logado(client, emails, users_db, "admin2@exemplo.com.br")
    r = client.patch(
        f"/api/v1/users/{uuid.uuid4()}/subscription",
        json={"plan_id": "sinal", "subscription_status": "active"},
    )
    assert r.status_code == 404


def test_patch_me_subscription_status_nao_fura_paywall(client, emails, monkeypatch) -> None:
    # REGRESSÃO DE SEGURANÇA: usuário comum tentando se auto-conceder assinatura
    monkeypatch.setattr(settings, "auth_required", True)
    monkeypatch.setattr(settings, "require_subscription", True)
    usuario_logado_verificado(client, emails, "espertinho@exemplo.com.br")

    r = client.patch(
        "/api/v1/users/me",
        json={"subscription_status": "active", "plan_id": "mesa"},
    )
    assert r.status_code == 200  # Pydantic ignora os campos extras
    me = client.get("/api/v1/users/me").json()
    assert me["subscription_status"] is None
    assert me["plan_id"] is None

    # paywall continua barrado
    r = client.get("/api/v1/filtros")
    assert r.status_code == 403
    assert r.json()["detail"] == "ASSINATURA_NECESSARIA"


def test_patch_me_is_superuser_nao_escala(client, emails, users_db) -> None:
    # REGRESSÃO: o safe mode do fastapi-users descarta is_superuser no PATCH /me
    usuario_logado_verificado(client, emails, "naoadmin@exemplo.com.br")
    r = client.patch("/api/v1/users/me", json={"is_superuser": True})
    assert r.status_code == 200
    assert r.json()["is_superuser"] is False
    assert get_coluna_user(users_db, "naoadmin@exemplo.com.br", "is_superuser") in (0, False)
    # e continua sem poder usar o endpoint admin (403, não 200)
    outro = registrar(client, "vitima@exemplo.com.br").json()["id"]
    r = client.patch(
        f"/api/v1/users/{outro}/subscription",
        json={"plan_id": "mesa", "subscription_status": "active"},
    )
    assert r.status_code == 403
