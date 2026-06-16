"""Cria (idempotente) os produtos e preços do Genesis Radar no Stripe.

Planos self-serve: Sinal (R$ 149/mês) e Varredura (R$ 389/mês).
Plano Mesa = falar com vendas — NÃO tem preço no Stripe.

Períodos e descontos (preço total do período, BRL):
    mensal     base × 1            interval=month
    semestral  round(base×6×0,85)  interval=month · interval_count=6
    anual      round(base×12×0,75) interval=year

lookup_keys: "{plan}_{period}" → sinal_mensal, sinal_semestral,
sinal_anual, varredura_mensal, varredura_semestral, varredura_anual.
O backend resolve o price por lookup_key em /api/v1/billing/checkout.

Uso (manual — NUNCA importado pelo app):
    set DEALFLOW_STRIPE_SECRET_KEY=sk_test_...   (ou STRIPE_SECRET_KEY)
    backend/.venv/Scripts/python.exe scripts/stripe_seed.py

Idempotente: consulta os lookup_keys existentes antes de criar e reusa
produtos com o mesmo nome. Rodar 2× não duplica nada.
"""

from __future__ import annotations

import os
import sys
from collections.abc import Callable

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

import stripe

# plan_id → (nome do produto, preço base R$/mês)
PLANOS: dict[str, tuple[str, int]] = {
    "sinal": ("Genesis Radar — Sinal", 149),
    "varredura": ("Genesis Radar — Varredura", 389),
}

# period → (base R$/mês → total do período em centavos, recurring kwargs)
PERIODOS: dict[str, tuple[Callable[[int], int], dict]] = {
    "mensal": (lambda base: base * 100, {"interval": "month"}),
    "semestral": (
        lambda base: round(base * 6 * 0.85) * 100,
        {"interval": "month", "interval_count": 6},
    ),
    "anual": (lambda base: round(base * 12 * 0.75) * 100, {"interval": "year"}),
}


def _precos_existentes(lookup_keys: list[str]) -> dict[str, stripe.Price]:
    """lookup_key → Price ativo já criado no Stripe."""
    listagem = stripe.Price.list(lookup_keys=lookup_keys, limit=100)
    return {p.lookup_key: p for p in listagem.auto_paging_iter() if p.lookup_key}


def _produtos_existentes() -> dict[str, stripe.Product]:
    """plan_id → Product ativo com o nome esperado (reuso idempotente)."""
    nome_para_plan = {nome: plan for plan, (nome, _) in PLANOS.items()}
    encontrados: dict[str, stripe.Product] = {}
    for prod in stripe.Product.list(active=True, limit=100).auto_paging_iter():
        plan = nome_para_plan.get(prod.name)
        if plan and plan not in encontrados:
            encontrados[plan] = prod
    return encontrados


def main() -> int:
    chave = os.environ.get("DEALFLOW_STRIPE_SECRET_KEY") or os.environ.get("STRIPE_SECRET_KEY")
    if not chave:
        print(
            "Defina DEALFLOW_STRIPE_SECRET_KEY (ou STRIPE_SECRET_KEY) no ambiente.",
            file=sys.stderr,
        )
        return 1
    stripe.api_key = chave

    lookup_keys = [f"{plan}_{period}" for plan in PLANOS for period in PERIODOS]
    precos = _precos_existentes(lookup_keys)
    produtos = _produtos_existentes()

    linhas: list[tuple[str, str, int, str]] = []
    for plan, (nome, base) in PLANOS.items():
        for period, (total_centavos_de, recurring) in PERIODOS.items():
            lk = f"{plan}_{period}"
            if lk in precos:
                preco = precos[lk]
                linhas.append((lk, preco.id, preco.unit_amount or 0, "encontrado"))
                continue
            if plan not in produtos:
                produtos[plan] = stripe.Product.create(
                    name=nome, metadata={"plan_id": plan}
                )
            total = total_centavos_de(base)
            preco = stripe.Price.create(
                product=produtos[plan].id,
                currency="brl",
                unit_amount=total,
                recurring=recurring,
                lookup_key=lk,
                nickname=f"{nome} · {period}",
            )
            linhas.append((lk, preco.id, total, "criado"))

    print(f"\n{'lookup_key':<24} {'price_id':<34} {'R$ total':>10}  estado")
    print("─" * 80)
    for lk, pid, centavos, estado in linhas:
        print(f"{lk:<24} {pid:<34} {centavos / 100:>10.2f}  {estado}")
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
