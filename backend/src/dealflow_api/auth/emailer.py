"""Email transacional · Resend em produção, console em dev.

Protocolo único `Emailer.send(to, subject, html)`. A fábrica
`get_emailer()` vive neste módulo de propósito: os testes fazem
`monkeypatch.setattr(emailer, "get_emailer", ...)` para capturar os
emails (e os tokens dos links) sem rede.
"""

from __future__ import annotations

import re
import sys
from typing import Protocol

import httpx

from ..settings import settings

_RESEND_URL = "https://api.resend.com/emails"
_TIMEOUT_S = 15


class Emailer(Protocol):
    """Contrato mínimo de envio — implementações não levantam na rota."""

    async def send(self, to: str, subject: str, html: str) -> None: ...


class ConsoleEmailer:
    """Imprime o email no stderr — dev local e e2e capturam o link daqui.

    O marcador [EMAIL] e o LINK COMPLETO em linha própria são contrato
    com os testes e2e (não mudar o formato sem atualizar lá).
    """

    async def send(self, to: str, subject: str, html: str) -> None:
        links = re.findall(r"https?://[^\s\"'<>]+", html)
        bloco = [
            "[EMAIL] ────────────────────────────────────────────",
            f"[EMAIL] Para:    {to}",
            f"[EMAIL] Assunto: {subject}",
            *(f"[EMAIL] Link:    {link}" for link in links),
            "[EMAIL] ────────────────────────────────────────────",
        ]
        print("\n".join(bloco), file=sys.stderr, flush=True)


class ResendEmailer:
    """Envia via Resend (https://resend.com) usando settings.resend_api_key."""

    async def send(self, to: str, subject: str, html: str) -> None:
        async with httpx.AsyncClient(timeout=_TIMEOUT_S) as client:
            r = await client.post(
                _RESEND_URL,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                json={
                    "from": settings.email_from,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                },
            )
            r.raise_for_status()


def get_emailer() -> Emailer:
    """Fábrica — Resend quando configurado; console caso contrário.

    Console é só para dev: com auth_required=true o boot aborta sem
    resend_api_key (guarda em main.py) — tokens e PII nunca vão para
    os logs de produção.
    """
    if settings.resend_api_key:
        return ResendEmailer()
    return ConsoleEmailer()
