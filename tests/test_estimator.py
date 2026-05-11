"""Fórmula §6.1 + score §6.4."""

from __future__ import annotations

from dealflow.domain import CNAE, CNPJ, MatchConfidence, MatchResult
from dealflow.estimator import estimate_revenue, score_confidence


def _match(headcount: int = 50, confidence: MatchConfidence = MatchConfidence.HIGH) -> MatchResult:
    return MatchResult(
        cnpj=CNPJ("00.000.000/0001-91"),
        rais_estab_index=42,
        headcount=headcount,
        confidence=confidence,
        n_candidates=1,
        rationale="match único",
    )


def test_estimate_revenue_formula_shape():
    # comércio (seção G), encargos 1.6–1.7
    cnae = CNAE("4711301")
    est = estimate_revenue(
        match=_match(headcount=50),
        cnae=cnae,
        salario_medio_mensal_brl=3000,
        n_vinculos_benchmark=200,
        razao_folha_receita=0.10,
    )
    # Folha base = 50 × 3000 × 12 = 1.800.000
    # Receita low  = 1.800.000 × 1.6 / 0.10 = 28.800.000
    # Receita high = 1.800.000 × 1.7 / 0.10 = 30.600.000
    assert abs(est.low_brl - 28_800_000) < 1
    assert abs(est.high_brl - 30_600_000) < 1
    assert est.low_brl < est.point_brl < est.high_brl


def test_score_high_when_match_high_and_benchmark_solid():
    cnae = CNAE("4711301")  # G — não low-CLT
    level = score_confidence(match=_match(), n_vinculos=200, cnae=cnae)
    assert level == MatchConfidence.HIGH


def test_score_low_for_low_clt_sector_small_headcount():
    # TI (J) com <20 funcs → §9.2 sempre confiança baixa
    cnae = CNAE("6201500")
    level = score_confidence(match=_match(headcount=8), n_vinculos=500, cnae=cnae)
    assert level == MatchConfidence.LOW


def test_score_fallback_propagates():
    cnae = CNAE("4711301")
    level = score_confidence(
        match=_match(confidence=MatchConfidence.FALLBACK),
        n_vinculos=200,
        cnae=cnae,
    )
    assert level == MatchConfidence.FALLBACK


def test_score_low_when_benchmark_amostra_pequena():
    cnae = CNAE("4711301")
    level = score_confidence(match=_match(), n_vinculos=15, cnae=cnae)
    assert level == MatchConfidence.LOW
