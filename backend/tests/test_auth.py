"""Testes de auth (Fase A) — registro, login, verify, reset e gating.

Contrato em docs/site-architecture.md. O users.db é temporário por
teste (fixture `client` em conftest.py); os emails são capturados por
CaptureEmailer (sem rede).
"""

from __future__ import annotations

import pytest

from dealflow_api.settings import settings

from .conftest import (
    SENHA_PADRAO,
    login,
    registrar,
    set_coluna_user,
    usuario_logado_verificado,
    verificar,
)


def test_registro_login_me_logout(client, emails) -> None:
    r = registrar(client, "ana@exemplo.com.br")
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "ana@exemplo.com.br"
    assert body["is_verified"] is False
    assert body["subscription_status"] is None
    assert body["plan_id"] is None
    assert body["billing_cycle"] is None
    assert body["current_period_end"] is None

    r = login(client, "ana@exemplo.com.br")
    assert r.status_code == 204
    assert "genesis_session" in client.cookies

    r = client.get("/api/v1/users/me")
    assert r.status_code == 200
    assert r.json()["email"] == "ana@exemplo.com.br"

    r = client.post("/api/v1/auth/logout")
    assert r.status_code == 204
    assert client.get("/api/v1/users/me").status_code == 401


def test_login_credenciais_invalidas(client, emails) -> None:
    registrar(client, "bia@exemplo.com.br")
    r = login(client, "bia@exemplo.com.br", senha="senha-errada-123")
    assert r.status_code == 400
    assert r.json()["detail"] == "LOGIN_BAD_CREDENTIALS"


def test_senha_curta_400(client, emails) -> None:
    r = registrar(client, "curto@exemplo.com.br", senha="curta")
    assert r.status_code == 400
    detail = r.json()["detail"]
    assert detail["code"] == "REGISTER_INVALID_PASSWORD"
    assert "8 caracteres" in detail["reason"]


def test_email_duplicado_400(client, emails) -> None:
    assert registrar(client, "dup@exemplo.com.br").status_code == 201
    r = registrar(client, "dup@exemplo.com.br")
    assert r.status_code == 400
    assert r.json()["detail"] == "REGISTER_USER_ALREADY_EXISTS"


def test_fluxo_verificacao(client, emails) -> None:
    registrar(client, "vera@exemplo.com.br")
    # o cadastro dispara o email de verificação automaticamente
    assert any(e.to == "vera@exemplo.com.br" for e in emails.enviados)
    link_html = emails.enviados[-1].html
    assert f"{settings.app_base_url}/landing.html?auth=verify&token=" in link_html

    r = verificar(client, emails, "vera@exemplo.com.br")
    assert r.status_code == 200
    assert r.json()["is_verified"] is True

    # verificar de novo com o mesmo token → 400
    r = verificar(client, emails, "vera@exemplo.com.br")
    assert r.status_code == 400
    assert r.json()["detail"] == "VERIFY_USER_ALREADY_VERIFIED"


def test_request_verify_token_sempre_202(client, emails) -> None:
    # sem enumeração de emails: 202 mesmo para conta inexistente
    r = client.post(
        "/api/v1/auth/request-verify-token", json={"email": "naoexiste@exemplo.com.br"}
    )
    assert r.status_code == 202


def test_fluxo_esqueci_senha(client, emails) -> None:
    registrar(client, "rosa@exemplo.com.br")

    r = client.post("/api/v1/auth/forgot-password", json={"email": "rosa@exemplo.com.br"})
    assert r.status_code == 202
    assert "auth=reset&token=" in emails.enviados[-1].html
    token = emails.ultimo_token("rosa@exemplo.com.br")

    nova_senha = "nova-senha-456"
    r = client.post("/api/v1/auth/reset-password", json={"token": token, "password": nova_senha})
    assert r.status_code == 200

    # senha antiga não vale mais; a nova sim
    assert login(client, "rosa@exemplo.com.br", senha=SENHA_PADRAO).status_code == 400
    assert login(client, "rosa@exemplo.com.br", senha=nova_senha).status_code == 204


def test_reset_token_invalido_400(client, emails) -> None:
    r = client.post(
        "/api/v1/auth/reset-password", json={"token": "lixo", "password": "qualquer-senha-123"}
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "RESET_PASSWORD_BAD_TOKEN"


def test_auth_config_publico(client, emails) -> None:
    r = client.get("/api/v1/auth/config")
    assert r.status_code == 200
    body = r.json()
    assert body == {
        "auth_required": settings.auth_required,
        "require_subscription": settings.require_subscription,
        "billing_enabled": settings.stripe_secret_key is not None,
    }


# ── Gating das rotas de dados ─────────────────────────────────────


def test_gating_desligado_preserva_dev(client, emails) -> None:
    # auth_required=False (default): rota de dados aberta, sem cookie
    assert client.get("/api/v1/filtros").status_code == 200


def test_gating_auth_required(client, emails, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "auth_required", True)

    r = client.get("/api/v1/filtros")
    assert r.status_code == 401
    assert r.json()["detail"] == "NAO_AUTENTICADO"

    # health continua público (probes de infra)
    assert client.get("/api/v1/health").status_code == 200

    # usuário logado mas NÃO verificado → 403
    registrar(client, "gate@exemplo.com.br")
    assert login(client, "gate@exemplo.com.br").status_code == 204
    r = client.get("/api/v1/filtros")
    assert r.status_code == 403
    assert r.json()["detail"] == "EMAIL_NAO_VERIFICADO"

    # verificado → 200
    assert verificar(client, emails, "gate@exemplo.com.br").status_code == 200
    assert client.get("/api/v1/filtros").status_code == 200


def test_api_key_cookie_forjado_nao_bypassa(
    client, emails, monkeypatch: pytest.MonkeyPatch
) -> None:
    # cookie inventado NÃO substitui a X-Api-Key no modo api_key puro
    monkeypatch.setattr(settings, "api_key", "chave-teste")
    client.cookies.set("genesis_session", "cookie-forjado")

    assert client.get("/api/v1/filtros").status_code == 401
    r = client.get("/api/v1/filtros", headers={"X-Api-Key": "chave-teste"})
    assert r.status_code == 200

    # com auth_required=true o middleware deixa passar, mas o gate
    # valida o JWT — cookie forjado continua barrado (401)
    monkeypatch.setattr(settings, "auth_required", True)
    r = client.get("/api/v1/filtros")
    assert r.status_code == 401
    assert r.json()["detail"] == "NAO_AUTENTICADO"


def test_api_key_sessao_real_dispensa_header(
    client, emails, monkeypatch: pytest.MonkeyPatch
) -> None:
    # fluxo legítimo: auth_required=true + sessão válida → sem X-Api-Key
    monkeypatch.setattr(settings, "api_key", "chave-teste")
    monkeypatch.setattr(settings, "auth_required", True)
    usuario_logado_verificado(client, emails, "sessao@exemplo.com.br")
    assert client.get("/api/v1/filtros").status_code == 200


def test_gating_assinatura(client, emails, users_db, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "auth_required", True)
    monkeypatch.setattr(settings, "require_subscription", True)

    usuario_logado_verificado(client, emails, "paga@exemplo.com.br")

    r = client.get("/api/v1/filtros")
    assert r.status_code == 403
    assert r.json()["detail"] == "ASSINATURA_NECESSARIA"

    # assinatura ativa direto no banco (o webhook faz isso em produção)
    set_coluna_user(users_db, "paga@exemplo.com.br", "subscription_status", "active")
    assert client.get("/api/v1/filtros").status_code == 200


# ── Guardas de boot (config insegura não sobe) ────────────────────


def test_boot_guard_config_producao(monkeypatch: pytest.MonkeyPatch) -> None:
    from dealflow_api.main import _checar_config_boot

    # auth ligado + secret default/vazio → boot aborta
    monkeypatch.setattr(settings, "auth_required", True)
    monkeypatch.setattr(settings, "resend_api_key", "re_teste")
    for segredo in ("", "dev-secret-trocar-em-producao"):
        monkeypatch.setattr(settings, "auth_secret", segredo)
        with pytest.raises(RuntimeError, match="AUTH_SECRET"):
            _checar_config_boot()

    # secret real mas sem Resend → boot aborta (tokens/PII iriam p/ logs)
    monkeypatch.setattr(settings, "auth_secret", "segredo-real-de-teste")
    monkeypatch.setattr(settings, "resend_api_key", None)
    with pytest.raises(RuntimeError, match="RESEND_API_KEY"):
        _checar_config_boot()

    # config completa → sobe
    monkeypatch.setattr(settings, "resend_api_key", "re_teste")
    _checar_config_boot()

    # dev (auth e cookie_secure desligados) → segue aberto, sem guarda
    monkeypatch.setattr(settings, "auth_required", False)
    monkeypatch.setattr(settings, "cookie_secure", False)
    monkeypatch.setattr(settings, "auth_secret", "dev-secret-trocar-em-producao")
    monkeypatch.setattr(settings, "resend_api_key", None)
    _checar_config_boot()
