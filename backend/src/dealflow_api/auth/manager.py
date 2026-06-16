"""UserManager · validação de senha + hooks de email do fastapi-users."""

from __future__ import annotations

import logging
import uuid
from collections.abc import AsyncGenerator
from typing import Any, Union

import stripe
from fastapi import Depends, Request
from fastapi.concurrency import run_in_threadpool
from fastapi_users import BaseUserManager, InvalidPasswordException, UUIDIDMixin
from fastapi_users.db import SQLAlchemyUserDatabase

from ..settings import settings
from . import emailer
from .db import User, get_user_db
from .schemas import UserCreate

logger = logging.getLogger(__name__)

_MIN_SENHA = 8


def _html_email(titulo: str, corpo: str, link: str, rotulo_botao: str) -> str:
    """HTML simples e legível — o link completo aparece também em texto."""
    return (
        f"<h2>{titulo}</h2>"
        f"<p>{corpo}</p>"
        f'<p><a href="{link}">{rotulo_botao}</a></p>'
        f"<p>Se o botão não funcionar, copie e cole este link no navegador:<br>{link}</p>"
        f"<p>— Genesis Radar</p>"
    )


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    """Regras do produto em cima do fastapi-users.

    Secrets lidos das settings na instanciação (por request) — testes
    podem trocar via monkeypatch sem reimportar o módulo.
    """

    # token de reset expira em 30 min (decisão do doc de arquitetura)
    reset_password_token_lifetime_seconds = 1800

    def __init__(self, user_db: SQLAlchemyUserDatabase) -> None:
        super().__init__(user_db)
        self.reset_password_token_secret = settings.auth_secret
        self.verification_token_secret = settings.auth_secret

    async def validate_password(self, password: str, user: Union[UserCreate, User]) -> None:
        if len(password) < _MIN_SENHA:
            raise InvalidPasswordException(
                reason=f"A senha precisa ter no mínimo {_MIN_SENHA} caracteres."
            )

    # ── Hooks de email ────────────────────────────────────────────

    async def on_after_register(self, user: User, request: Request | None = None) -> None:
        # verificação de email é obrigatória pro gate → dispara já no cadastro
        await self.request_verify(user, request)

    async def on_after_request_verify(
        self, user: User, token: str, request: Request | None = None
    ) -> None:
        link = f"{settings.app_base_url}/landing.html?auth=verify&token={token}"
        await emailer.get_emailer().send(
            to=user.email,
            subject="Confirme seu email · Genesis Radar",
            html=_html_email(
                "Bem-vindo ao Genesis Radar",
                "Confirme seu email para ativar a sua conta.",
                link,
                "Confirmar email",
            ),
        )

    async def on_after_update(
        self, user: User, update_dict: dict[str, Any], request: Request | None = None
    ) -> None:
        # O _update() do fastapi-users já zera e persiste is_verified=False
        # quando o email muda DE FATO (manager.py do lib). Aqui só re-disparamos
        # a verificação para o NOVO endereço. O guard `not user.is_verified`
        # cobre o PATCH com o MESMO email (is_verified continua True → evita
        # UserAlreadyVerified); `is_active` evita UserInactive. request_verify
        # não grava no banco nem chama update() → sem recursão.
        if "email" in update_dict and not user.is_verified and user.is_active:
            await self.request_verify(user, request)

    async def on_after_forgot_password(
        self, user: User, token: str, request: Request | None = None
    ) -> None:
        link = f"{settings.app_base_url}/landing.html?auth=reset&token={token}"
        await emailer.get_emailer().send(
            to=user.email,
            subject="Redefina sua senha · Genesis Radar",
            html=_html_email(
                "Redefinição de senha",
                "Recebemos um pedido para redefinir a sua senha. "
                "O link expira em 30 minutos. Se não foi você, ignore este email.",
                link,
                "Redefinir senha",
            ),
        )

    async def on_before_delete(self, user: User, request: Request | None = None) -> None:
        # LGPD art. 18: ao excluir a conta, apagamos o Customer no Stripe — isso
        # cancela as assinaturas vivas E remove o PII (email/cartão) do operador.
        # Roda para TODO delete (self-service /me e DELETE /{id} de superuser).
        # Best-effort: falha aqui NUNCA bloqueia a exclusão da conta.
        if settings.stripe_secret_key and user.stripe_customer_id:
            stripe.api_key = settings.stripe_secret_key
            try:
                await run_in_threadpool(stripe.Customer.delete, user.stripe_customer_id)
            except Exception:  # noqa: BLE001 — billing nunca impede a exclusão LGPD
                logger.warning(
                    "on_before_delete: falha ao apagar customer %s do usuário %s",
                    user.stripe_customer_id,
                    user.id,
                    exc_info=True,
                )


async def get_user_manager(
    user_db: SQLAlchemyUserDatabase = Depends(get_user_db),
) -> AsyncGenerator[UserManager, None]:
    yield UserManager(user_db)
