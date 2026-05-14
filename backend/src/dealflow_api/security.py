"""Middlewares de segurança · auth, rate-limit, audit log.

LGPD:
  - art. 46 (segurança) — auth + rate-limit dificultam scraping massivo
  - art. 37 (registro das operações de tratamento) — audit log estruturado
"""

from __future__ import annotations

import json
import sys
import time
from collections import defaultdict, deque
from typing import Deque

from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp

from .settings import settings

# Caminhos isentos de autenticação (health, docs estáticos).
_AUTH_EXEMPT_PATHS = {
    "/",
    "/api/v1/health",
    "/docs",
    "/redoc",
    "/openapi.json",
}


def _client_ip(request: Request) -> str:
    """Resolve IP do cliente respeitando X-Forwarded-For do proxy reverso."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class ApiKeyAuthMiddleware(BaseHTTPMiddleware):
    """Exige header `X-Api-Key` quando `settings.api_key` está definido.

    Sem `settings.api_key`, passa direto (modo dev — modal de aviso já
    informado no README/docs). Isenções: health, docs estáticos, preflight CORS.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if settings.api_key is None:
            return await call_next(request)
        if request.method == "OPTIONS":
            return await call_next(request)
        if request.url.path in _AUTH_EXEMPT_PATHS:
            return await call_next(request)
        provided = request.headers.get("x-api-key")
        if provided != settings.api_key:
            return Response(
                content=json.dumps({"detail": "API key inválida ou ausente (header X-Api-Key)."}),
                status_code=status.HTTP_401_UNAUTHORIZED,
                media_type="application/json",
            )
        return await call_next(request)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate-limit simples por IP · janela deslizante de 60 segundos.

    `settings.rate_limit_per_min` controla o limite. Zero ou negativo desativa.

    Estado em memória — adequado para single-worker. Para múltiplos workers
    use solução distribuída (Redis, slowapi com redis backend).
    """

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self._hits: dict[str, Deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        limit = settings.rate_limit_per_min
        if limit <= 0:
            return await call_next(request)
        # Health check e preflight não consomem cota
        if request.method == "OPTIONS" or request.url.path in _AUTH_EXEMPT_PATHS:
            return await call_next(request)
        ip = _client_ip(request)
        now = time.monotonic()
        cutoff = now - 60.0
        bucket = self._hits[ip]
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= limit:
            return Response(
                content=json.dumps({
                    "detail": f"Rate limit excedido ({limit}/min). Aguarde alguns segundos."
                }),
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                media_type="application/json",
                headers={"Retry-After": "60"},
            )
        bucket.append(now)
        return await call_next(request)


class AuditLogMiddleware(BaseHTTPMiddleware):
    """Audit log estruturado (LGPD art. 37 — registro das operações).

    Escreve JSONL em `settings.audit_log_path`. Se None, imprime em stderr —
    capturado pelos sistemas de log do host (systemd, Docker, etc.).

    Esquema por linha:
      {ts, ip, method, path, qs, status, ms, ua, key_present}
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        t0 = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
        entry = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "ip": _client_ip(request),
            "method": request.method,
            "path": request.url.path,
            "qs": request.url.query or None,
            "status": response.status_code,
            "ms": elapsed_ms,
            "ua": request.headers.get("user-agent", "")[:120],
            "key_present": "x-api-key" in request.headers,
        }
        line = json.dumps(entry, ensure_ascii=False, separators=(",", ":"))
        path = settings.audit_log_path
        if path is None:
            print(line, file=sys.stderr, flush=True)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("a", encoding="utf-8") as f:
                f.write(line + "\n")
        return response
