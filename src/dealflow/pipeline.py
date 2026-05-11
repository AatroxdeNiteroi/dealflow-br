"""Pipeline §8 — sequência consolidada por CNPJ.

    1. Roteamento por regime tributário
    2. Filtragem dos universos (Receita + RAIS Estab)
    3. Match RAIS — chave composta
    4. Filtros de desempate
    5. Extração do headcount
    6. Consulta ao benchmark salarial
    7. Aplicação do multiplicador setorial
    8. Cálculo da estimativa
    9. Score de confiança
    10. (Funil ativo) convite Compartilha RFB
"""

from __future__ import annotations

from .domain import CNPJ, RevenueEstimate


def estimate_cnpj(cnpj: CNPJ) -> RevenueEstimate:
    """Roda o pipeline §8 end-to-end para um único CNPJ.

    Esta função orquestra chamadas a ``sources``, ``match``, ``benchmark``,
    ``multipliers`` e ``estimator``. A lógica pesada vive nos módulos
    especializados; aqui só costuramos a sequência.

    Args:
        cnpj: CNPJ alvo da estimativa.

    Returns:
        ``RevenueEstimate`` com intervalo, confiança e proveniência.

    Raises:
        NotImplementedError: Stub — implementar quando match/benchmark/sources
            estiverem prontos.
    """
    raise NotImplementedError(
        "TODO: implementar §8 quando match/benchmark/sources estiverem prontos"
    )
