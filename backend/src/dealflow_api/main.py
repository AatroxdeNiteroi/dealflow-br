"""FastAPI entry. Compõe routes REST + SSE de status dos agentes."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import events, routes
from .security import ApiKeyAuthMiddleware, AuditLogMiddleware, RateLimitMiddleware
from .settings import settings

app = FastAPI(
    title="DealFlow BR",
    description="Motor de triagem M&A médio porte RJ/SP — 3 agentes de motor + REST + SSE",
    version="0.1.0",
)

# Ordem importa: `add_middleware` registra OUTSIDE-IN inversamente.
# O último add_middleware vira o OUTERMOST. Stack desejada (out → in):
#   CORS → AuditLog → RateLimit → ApiKeyAuth → App
# Logo, registrar na ordem inversa abaixo:
app.add_middleware(ApiKeyAuthMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(AuditLogMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["X-Api-Key", "Content-Type", "Authorization"],
)

app.include_router(routes.router, prefix="/api/v1")
app.include_router(events.router, prefix="/api/v1")


@app.get("/")
def root() -> dict[str, str]:
    return {"app": "dealflow-api", "version": "0.1.0", "docs": "/docs"}
