"""Cria (ou promove) um superusuário do Genesis Radar.

Superusuário é necessário para administração e para atribuir o plano "Mesa"
(venda assistida, sem checkout) via PATCH /api/v1/users/{id}/subscription.

Uso (manual — NUNCA importado pelo app). Rode com o Python do venv do backend
(onde dealflow_api é editable-install):

    backend/.venv/Scripts/python.exe scripts/create_superuser.py \
        --email admin@seu-dominio --password 'senha-forte'

    # ou via ambiente:
    set DEALFLOW_SUPERUSER_EMAIL=admin@seu-dominio
    set DEALFLOW_SUPERUSER_PASSWORD=senha-forte
    backend/.venv/Scripts/python.exe scripts/create_superuser.py

Idempotente: se o email já existe, promove a superuser/verificado. Cria via
user_db DIRETO (não UserManager.create) para pular o hook de email — o
superuser nasce verificado. Grava em settings.users_db_path (default
data/users.db); aponte DEALFLOW_USERS_DB_PATH para outro arquivo se preciso.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

from sqlalchemy.ext.asyncio import async_sessionmaker

# Ordem importa: dealflow_api.auth.db inicializa fastapi_users.db na ordem
# correta. Importar fastapi_users_db_sqlalchemy ANTES dele dispara um circular
# import que faz o re-export de fastapi_users.db falhar silenciosamente
# (SQLAlchemyUserDatabase some). Por isso pegamos o adapter via fastapi_users.db,
# DEPOIS de auth.db.
from dealflow_api.auth.db import User, create_db_and_tables, dispose_engine, get_engine
from dealflow_api.auth.manager import UserManager
from fastapi_users.db import SQLAlchemyUserDatabase

_MIN_SENHA = 8


async def _run(email: str, senha: str) -> int:
    await create_db_and_tables()
    maker = async_sessionmaker(get_engine(), expire_on_commit=False)
    try:
        async with maker() as session:
            user_db = SQLAlchemyUserDatabase(session, User)
            existente = await user_db.get_by_email(email)
            if existente is not None:
                await user_db.update(
                    existente,
                    {"is_superuser": True, "is_verified": True, "is_active": True},
                )
                print(f"✓ {email} promovido a superusuário (verificado/ativo).")
            else:
                hashed = UserManager(user_db).password_helper.hash(senha)
                await user_db.create(
                    {
                        "email": email,
                        "hashed_password": hashed,
                        "is_active": True,
                        "is_superuser": True,
                        "is_verified": True,
                    }
                )
                print(f"✓ superusuário {email} criado.")
    finally:
        # fecha o pool (evita lock do arquivo SQLite no Windows)
        await dispose_engine()
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Cria/promove um superusuário.")
    ap.add_argument("--email", default=os.environ.get("DEALFLOW_SUPERUSER_EMAIL"))
    ap.add_argument("--password", default=os.environ.get("DEALFLOW_SUPERUSER_PASSWORD"))
    args = ap.parse_args()

    if not args.email or not args.password:
        print(
            "Defina --email e --password (ou DEALFLOW_SUPERUSER_EMAIL/_PASSWORD).",
            file=sys.stderr,
        )
        return 1
    if len(args.password) < _MIN_SENHA:
        print(f"Senha precisa de pelo menos {_MIN_SENHA} caracteres.", file=sys.stderr)
        return 1

    return asyncio.run(_run(args.email, args.password))


if __name__ == "__main__":
    raise SystemExit(main())
