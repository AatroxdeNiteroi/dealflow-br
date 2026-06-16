"""Fixtures compartilhadas dos testes de auth/billing.

O `client` usa um users.db temporário: o setting é trocado ANTES de o
TestClient entrar no lifespan — a engine é lazy/cacheada por caminho,
então cada teste ganha um banco isolado sem tocar em data/users.db.
"""

from __future__ import annotations

import re
import sqlite3
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from dealflow_api.auth import emailer as emailer_mod
from dealflow_api.settings import settings

SENHA_PADRAO = "senha-forte-123"


@dataclass
class EmailCapturado:
    to: str
    subject: str
    html: str

    @property
    def token(self) -> str | None:
        """Extrai o token do link ?auth=...&token=... embutido no html."""
        m = re.search(r"token=([A-Za-z0-9._\-]+)", self.html)
        return m.group(1) if m else None


class CaptureEmailer:
    """Substitui o emailer real — guarda os emails para os testes lerem."""

    def __init__(self) -> None:
        self.enviados: list[EmailCapturado] = []

    async def send(self, to: str, subject: str, html: str) -> None:
        self.enviados.append(EmailCapturado(to=to, subject=subject, html=html))

    def ultimo_token(self, to: str) -> str:
        token = next(e.token for e in reversed(self.enviados) if e.to == to and e.token)
        assert token
        return token


@pytest.fixture()
def emails(monkeypatch: pytest.MonkeyPatch) -> CaptureEmailer:
    capture = CaptureEmailer()
    monkeypatch.setattr(emailer_mod, "get_emailer", lambda: capture)
    return capture


@pytest.fixture()
def users_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    caminho = tmp_path / "users.db"
    monkeypatch.setattr(settings, "users_db_path", caminho)
    return caminho


@pytest.fixture()
def client(
    users_db: Path, monkeypatch: pytest.MonkeyPatch, emails: CaptureEmailer
) -> Iterator[TestClient]:
    # testes de auth fazem dezenas de requests — não disputar a cota global
    monkeypatch.setattr(settings, "rate_limit_per_min", 0)
    # estado-base independente do .env local (mesmo motivo do rate limit):
    # gates desligados e billing/API key desconfigurados. Testes que
    # precisam de outro estado fazem o próprio monkeypatch por cima.
    monkeypatch.setattr(settings, "api_key", None)
    monkeypatch.setattr(settings, "auth_required", False)
    monkeypatch.setattr(settings, "require_subscription", False)
    monkeypatch.setattr(settings, "stripe_secret_key", None)
    monkeypatch.setattr(settings, "stripe_webhook_secret", None)
    from dealflow_api.main import app

    with TestClient(app) as c:
        yield c


# ── Helpers de fluxo (importados pelos módulos de teste) ──────────


def registrar(client: TestClient, email: str, senha: str = SENHA_PADRAO):
    return client.post("/api/v1/auth/register", json={"email": email, "password": senha})


def login(client: TestClient, email: str, senha: str = SENHA_PADRAO):
    # contrato: form-urlencoded com campos username/password
    return client.post("/api/v1/auth/login", data={"username": email, "password": senha})


def verificar(client: TestClient, emails: CaptureEmailer, email: str):
    return client.post("/api/v1/auth/verify", json={"token": emails.ultimo_token(email)})


def usuario_logado_verificado(
    client: TestClient, emails: CaptureEmailer, email: str, senha: str = SENHA_PADRAO
) -> None:
    assert registrar(client, email, senha).status_code == 201
    assert verificar(client, emails, email).status_code == 200
    assert login(client, email, senha).status_code == 204


def set_coluna_user(users_db: Path, email: str, coluna: str, valor: str | int) -> None:
    """Escreve direto no SQLite (ex.: subscription_status='active')."""
    con = sqlite3.connect(users_db)
    try:
        con.execute(f'UPDATE "user" SET {coluna} = ? WHERE email = ?', (valor, email))
        con.commit()
    finally:
        con.close()


def get_coluna_user(users_db: Path, email: str, coluna: str):
    """Lê uma coluna do usuário direto no SQLite (None se a linha não existe)."""
    con = sqlite3.connect(users_db)
    try:
        cur = con.execute(f'SELECT {coluna} FROM "user" WHERE email = ?', (email,))
        linha = cur.fetchone()
        return linha[0] if linha else None
    finally:
        con.close()


def superuser_logado(client, emails, users_db, email: str, senha: str = SENHA_PADRAO) -> None:
    """Cria usuário verificado+logado e o eleva a superuser no SQLite.

    Sem re-login: o JWT só carrega `sub`; is_superuser é relido do banco a
    cada request (mesmo mecanismo provado em test_gating_assinatura).
    """
    usuario_logado_verificado(client, emails, email, senha)
    set_coluna_user(users_db, email, "is_superuser", 1)
