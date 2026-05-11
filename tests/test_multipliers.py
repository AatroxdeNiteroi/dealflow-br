"""Tabela §6.2 — multiplicador de encargos por bloco CNAE."""

from __future__ import annotations

from dealflow.domain import CNAE
from dealflow.multipliers import ENCARGOS_FALLBACK, encargos_range_for


def test_comercio_seção_g():
    rng = encargos_range_for(CNAE("4711301"))
    assert rng == (1.6, 1.7)


def test_industria_seção_c():
    rng = encargos_range_for(CNAE("1011201"))
    assert rng == (1.9, 2.1)


def test_ti_seção_j():
    rng = encargos_range_for(CNAE("6201500"))
    assert rng == (1.4, 1.6)


def test_fallback_seção_não_mapeada():
    # Seção L (imobiliária, divisão 68) não está na tabela §6.2 → fallback
    rng = encargos_range_for(CNAE("6810201"))
    assert rng == ENCARGOS_FALLBACK
