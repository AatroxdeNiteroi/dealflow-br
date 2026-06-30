"""Anti-abuso em memória · lockout de login + cooldown de email.

Estado em processo (dict + Lock) — adequado para o deploy single-worker
de hoje. Multi-worker/horizontal exige um store compartilhado (Redis):
trocar as funções por chamadas ao store, mantendo a mesma interface.

Dois mecanismos, ambos por janela deslizante:
  - login: N falhas por email numa janela → bloqueia (trava brute-force /
    credential-stuffing online sem CAPTCHA);
  - email: 1 envio por (tipo, endereço) a cada COOLDOWN s → evita
    email-bombing da vítima e abuso de cota do provedor (Resend).
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock

# ── Login lockout ────────────────────────────────────────────────────
_MAX_FALHAS_LOGIN = 8          # falhas toleradas dentro da janela
_JANELA_LOGIN_S = 900.0        # 15 min: janela e duração efetiva do bloqueio

# ── Cooldown de email transacional ───────────────────────────────────
_COOLDOWN_EMAIL_S = 60.0       # 1 verify/reset por endereço por minuto

_falhas_login: dict[str, deque[float]] = defaultdict(deque)
_ultimo_email: dict[str, float] = {}
_lock = Lock()


def _agora() -> float:
    return time.monotonic()


def login_bloqueado(email: str) -> bool:
    """True se o email acumulou falhas demais na janela (ainda bloqueado)."""
    chave = email.strip().lower()
    if not chave:
        return False
    limite = _agora() - _JANELA_LOGIN_S
    with _lock:
        falhas = _falhas_login.get(chave)
        if not falhas:
            return False
        while falhas and falhas[0] < limite:
            falhas.popleft()
        if not falhas:
            del _falhas_login[chave]
            return False
        return len(falhas) >= _MAX_FALHAS_LOGIN


def registrar_falha_login(email: str) -> None:
    """Conta uma tentativa de login falha para o email."""
    chave = email.strip().lower()
    if not chave:
        return
    with _lock:
        _falhas_login[chave].append(_agora())


def limpar_login(email: str) -> None:
    """Zera o contador (chamar após login bem-sucedido)."""
    chave = email.strip().lower()
    with _lock:
        _falhas_login.pop(chave, None)


def email_em_cooldown(tipo: str, endereco: str) -> bool:
    """True se já enviamos um email desse `tipo` para `endereco` há pouco.

    Registra o envio (timestamp) quando retorna False — então o chamador
    deve enviar o email exatamente quando isto devolve False.
    """
    chave = f"{tipo}:{endereco.strip().lower()}"
    agora = _agora()
    with _lock:
        ultimo = _ultimo_email.get(chave)
        if ultimo is not None and agora - ultimo < _COOLDOWN_EMAIL_S:
            return True
        _ultimo_email[chave] = agora
        return False
