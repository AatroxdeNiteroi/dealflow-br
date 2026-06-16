"""Banco de usuários · SQLite assíncrono (aiosqlite) + modelo User.

Separado dos parquets de dados de mercado: aqui moram DADOS PESSOAIS
(LGPD) — o arquivo `data/users.db` NÃO vai pro Git (ver .gitignore).

A engine é LAZY de propósito: criada na primeira chamada e cacheada
por caminho de arquivo, para os testes poderem trocar
`settings.users_db_path` (tmp_path) ANTES do primeiro acesso.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import datetime
from functools import lru_cache
from pathlib import Path

from fastapi import Depends
from fastapi_users.db import SQLAlchemyBaseUserTableUUID, SQLAlchemyUserDatabase
from sqlalchemy import BigInteger, DateTime, String, func
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from ..settings import settings


class Base(DeclarativeBase):
    """Base declarativa do banco de usuários."""


class User(SQLAlchemyBaseUserTableUUID, Base):
    """Usuário (Fase A) + campos de assinatura Stripe (Fase D).

    Herdado da lib: id (UUID) · email · hashed_password · is_active ·
    is_superuser · is_verified. Tabela: "user".
    """

    # ── Assinatura (Fase D) — preenchidos pelo webhook do Stripe ──
    stripe_customer_id: Mapped[str | None] = mapped_column(
        String(length=255), index=True, nullable=True, default=None
    )
    # assinatura REGISTRADA do usuário (interna — fora do UserRead).
    # Escopa o webhook: eventos de outra subscription não sobrescrevem
    # o estado de quem segue pagando.
    stripe_subscription_id: Mapped[str | None] = mapped_column(
        String(length=255), nullable=True, default=None
    )
    # epoch (`created`) do último evento de assinatura APLICADO — o
    # Stripe não garante ordem nem entrega única; eventos com created
    # menor/igual são descartados pelo webhook (interna — fora do UserRead).
    stripe_event_ts: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, default=None
    )
    # status cru do Stripe: active | trialing | past_due | canceled | ...
    subscription_status: Mapped[str | None] = mapped_column(
        String(length=32), nullable=True, default=None
    )
    # derivados do lookup_key "{plan}_{period}" do price assinado
    plan_id: Mapped[str | None] = mapped_column(String(length=32), nullable=True, default=None)
    billing_cycle: Mapped[str | None] = mapped_column(
        String(length=16), nullable=True, default=None
    )
    current_period_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


@lru_cache(maxsize=None)
def _engine_para(db_url: str) -> AsyncEngine:
    """Uma engine por URL, cacheada no processo (lazy por design)."""
    return create_async_engine(db_url)


def get_engine() -> AsyncEngine:
    """Engine do banco de usuários — resolve o caminho em request-time."""
    caminho = Path(settings.users_db_path)
    caminho.parent.mkdir(parents=True, exist_ok=True)
    # as_posix(): URLs SQLAlchemy não aceitam backslash do Windows
    return _engine_para(f"sqlite+aiosqlite:///{caminho.as_posix()}")


# Mini-migração de startup: `create_all` NÃO altera tabela existente —
# colunas adicionadas ao modelo depois do primeiro deploy precisam de
# ALTER TABLE ADD COLUMN (suportado pelo SQLite). Mapa coluna → tipo DDL.
# Mudanças estruturais maiores (rename, drop, índice composto) → Alembic.
_COLUNAS_NOVAS_USER: dict[str, str] = {
    "stripe_subscription_id": "VARCHAR(255)",
    "stripe_event_ts": "BIGINT",
}


async def create_db_and_tables() -> None:
    """Cria as tabelas se não existirem (idempotente) — chamado no lifespan."""
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # bancos criados antes das colunas novas: completa o schema in-place
        info = await conn.exec_driver_sql('PRAGMA table_info("user")')
        existentes = {linha[1] for linha in info.fetchall()}
        for coluna, tipo in _COLUNAS_NOVAS_USER.items():
            if coluna not in existentes:
                await conn.exec_driver_sql(f'ALTER TABLE "user" ADD COLUMN {coluna} {tipo}')


async def dispose_engine() -> None:
    """Fecha o pool no shutdown (evita lock do arquivo SQLite no Windows)."""
    await get_engine().dispose()


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    maker = async_sessionmaker(get_engine(), expire_on_commit=False)
    async with maker() as session:
        yield session


async def get_user_db(
    session: AsyncSession = Depends(get_async_session),
) -> AsyncGenerator[SQLAlchemyUserDatabase, None]:
    yield SQLAlchemyUserDatabase(session, User)
