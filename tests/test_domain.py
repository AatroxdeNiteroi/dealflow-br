"""Tipos do domínio — sanidade de CNPJ, CNAE.secao."""

from __future__ import annotations

import pytest

from dealflow.domain import CNAE, CNPJ


def test_cnpj_normalizes_and_validates():
    c = CNPJ("12.345.678/0001-90")
    assert c.digits == "12345678000190"
    assert str(c) == "12.345.678/0001-90"


def test_cnpj_rejects_short():
    with pytest.raises(ValueError):
        CNPJ("123")


def test_cnae_secao_mapping():
    # Comércio varejista (47) → seção G
    assert CNAE("4711301").secao == "G"
    # Indústria de transformação (10) → seção C
    assert CNAE("1011201").secao == "C"
    # Atividades de TI (62) → seção J
    assert CNAE("6201500").secao == "J"
    # Atividades profissionais (69) → seção M
    assert CNAE("6911701").secao == "M"


def test_cnae_classe_4d():
    assert CNAE("4711301").classe_4d == "4711"
