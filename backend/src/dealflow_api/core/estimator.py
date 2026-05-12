"""Fórmula de estimativa (§6.1) + score de confiança (§6.4).

    Folha   = headcount × salário_médio_mensal × 12 × multiplicador_encargos
    Receita = Folha ÷ razão_folha_receita

A fórmula é determinística e auditável — o intervalo ``(low, high)`` vem do
range natural do multiplicador setorial (§6.2), não de heurística.
"""

from __future__ import annotations

from .domain import CNAE, MatchConfidence, MatchResult, RevenueEstimate
from .multipliers import encargos_range_for, razao_folha_receita_for

_MESES_NO_ANO = 12

# Setores low-CLT — TI/telecom (J), financeiro (K), profissionais (M).
# §9.2: headcount RAIS subestima quando há muitos pró-labore.
_LOW_CLT_SECTIONS = frozenset({"J", "K", "M"})
_LOW_CLT_HEADCOUNT_THRESHOLD = 20

# §6.4 — heurística inicial até termos calibração via Compartilha RFB.
_BENCHMARK_HIGH_MIN_VINCULOS = 100
_BENCHMARK_LOW_MAX_VINCULOS = 30


def estimate_revenue(
    *,
    match: MatchResult,
    cnae: CNAE,
    salario_medio_mensal_brl: float,
    n_vinculos_benchmark: int,
    razao_folha_receita: float | None = None,
) -> RevenueEstimate:
    """Aplica a fórmula §6.1 e o score §6.4.

    O intervalo ``(low, high)`` é produzido aplicando os extremos do range de
    encargos setoriais; o ponto central usa a média do range.

    Args:
        match: Resultado do Match RAIS, fonte do ``headcount``.
        cnae: CNAE 2.0 do estabelecimento (define encargos e razão).
        salario_medio_mensal_brl: Salário médio mensal do benchmark §5.
        n_vinculos_benchmark: Tamanho amostral da célula benchmark (entra no score).
        razao_folha_receita: Razão folha/receita do CNAE. Quando ``None``,
            é resolvida via :func:`razao_folha_receita_for`.

    Returns:
        ``RevenueEstimate`` com intervalo, ponto, confiança e racional auditável.

    Raises:
        ValueError: Se ``salario_medio_mensal_brl`` ou ``razao_folha_receita``
            não forem positivos.
    """
    if salario_medio_mensal_brl <= 0:
        raise ValueError("salário médio deve ser > 0")

    enc_low, enc_high = encargos_range_for(cnae)
    enc_point = (enc_low + enc_high) / 2

    if razao_folha_receita is not None:
        razao = razao_folha_receita
        razao_source_precision = "manual"
    else:
        razao_lookup = razao_folha_receita_for(cnae, headcount=match.headcount)
        razao = razao_lookup.razao
        razao_source_precision = razao_lookup.source_precision
    if razao <= 0:
        raise ValueError("razão folha/receita deve ser > 0")

    folha_base = match.headcount * salario_medio_mensal_brl * _MESES_NO_ANO

    receita_low = (folha_base * enc_low) / razao
    receita_high = (folha_base * enc_high) / razao
    receita_point = (folha_base * enc_point) / razao

    confidence = score_confidence(
        match=match,
        n_vinculos=n_vinculos_benchmark,
        cnae=cnae,
        razao_source_precision=razao_source_precision,
    )

    return RevenueEstimate(
        cnpj=match.cnpj,
        low_brl=receita_low,
        high_brl=receita_high,
        point_brl=receita_point,
        confidence=confidence,
        headcount=match.headcount,
        salario_medio_brl=salario_medio_mensal_brl,
        encargos_multiplier=enc_point,
        razao_folha_receita=razao,
        n_vinculos_benchmark=n_vinculos_benchmark,
        rationale=_rationale(match, n_vinculos_benchmark, cnae),
    )


def score_confidence(
    *,
    match: MatchResult,
    n_vinculos: int,
    cnae: CNAE,
    razao_source_precision: str = "alta",
) -> MatchConfidence:
    """Combina os 4 fatores do §6.4: match, amostra, setor, precisão da razão.

    Regras em cascata (a primeira que casa decide):

    1. Setor low-CLT com headcount baixo → ``LOW`` (§9.2).
    2. Match em fallback → propaga ``FALLBACK``.
    3. Razão de precisão baixa (DEFAULT_SECAO) → no máximo ``LOW``.
    4. Razão de precisão média (PAS/PAC sub-agrupamento) → no máximo ``MEDIUM``.
    5. Match alto + benchmark robusto + razão alta → ``HIGH``.
    6. Match baixo OU amostra benchmark pequena → ``LOW``.
    7. Caso restante → ``MEDIUM``.

    Args:
        match: Resultado do Match RAIS.
        n_vinculos: Tamanho amostral da célula benchmark consultada.
        cnae: CNAE 2.0 do estabelecimento.
        razao_source_precision: 'alta' (PIA 4d), 'media' (PAS/PAC), 'baixa'
            (fallback setor), ou 'manual' (passado pelo caller).

    Returns:
        Classificação ``MatchConfidence`` correspondente.
    """
    if cnae.secao in _LOW_CLT_SECTIONS and match.headcount < _LOW_CLT_HEADCOUNT_THRESHOLD:
        return MatchConfidence.LOW

    if match.confidence == MatchConfidence.FALLBACK:
        return MatchConfidence.FALLBACK

    # Precisão da razão capa a confiança final.
    if razao_source_precision == "baixa":
        return MatchConfidence.LOW

    is_razao_alta = razao_source_precision in {"alta", "manual"}

    if (
        match.confidence == MatchConfidence.HIGH
        and n_vinculos >= _BENCHMARK_HIGH_MIN_VINCULOS
        and is_razao_alta
    ):
        return MatchConfidence.HIGH

    if match.confidence == MatchConfidence.LOW or n_vinculos < _BENCHMARK_LOW_MAX_VINCULOS:
        return MatchConfidence.LOW

    return MatchConfidence.MEDIUM


def _rationale(match: MatchResult, n_vinculos: int, cnae: CNAE) -> str:
    """Constrói a frase auditável anexada ao ``RevenueEstimate``."""
    plural = "s" if match.n_candidates != 1 else ""
    return (
        f"Match {match.confidence.value} ({match.n_candidates} candidato{plural} "
        f"na chave RAIS); benchmark calibrado em {n_vinculos} vínculos do "
        f"CNAE {cnae.code} × município; multiplicador setorial bloco {cnae.secao}."
    )
