"""Step 2 fusion engine — combines Step 1 revenue estimate with sector bands.

Controlled by SECTOR_BANDS_MODE environment variable:
    off    — Step 2 is never run; recommended_revenue == revenue_step1 always
    shadow — Step 2 runs but recommended_revenue is always forced to step1
    active — Full fusion logic: Step 2 can override Step 1 under strict conditions

Never raises exceptions; all errors are captured in FusionResult fields.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

from .bands import get_revenue_band
from .lookup import lookup_classification
from .normalizer import normalize_cnae


def _mode() -> str:
    return os.environ.get("SECTOR_BANDS_MODE", "off").lower().strip()


@dataclass
class FusionResult:
    revenue_step1: float
    revenue_step2_p10: Optional[float]
    revenue_step2_p25: Optional[float]
    revenue_step2_p50: Optional[float]
    revenue_step2_p75: Optional[float]
    revenue_step2_p90: Optional[float]
    revenue_step2_mean: Optional[float]
    step2_coverage_status: str  # covered|not_covered|ambiguous|not_in_table|invalid_cnae
    step2_classification_code: Optional[str]
    step2_source_survey: Optional[str]
    step2_profile: Optional[str]
    step2_granularity_tier: Optional[str]  # full|medium|coarse|minimal
    step2_extrapolated: bool
    step2_ambiguous: bool
    step2_bands_version: Optional[str]
    fusion_diagnostic: str  # within_iqr|atypical_low|atypical_high|outlier_low|outlier_high|no_step2_coverage
    fusion_confidence: str  # high|medium|low|n/a
    recommended_revenue: float
    recommended_revenue_source: str  # step1|step2_band_fallback|step1_only|step1_with_warning|step1_with_minimal_tier_warning


def _no_coverage_result(revenue_step1: float) -> FusionResult:
    return FusionResult(
        revenue_step1=revenue_step1,
        revenue_step2_p10=None,
        revenue_step2_p25=None,
        revenue_step2_p50=None,
        revenue_step2_p75=None,
        revenue_step2_p90=None,
        revenue_step2_mean=None,
        step2_coverage_status="not_covered",
        step2_classification_code=None,
        step2_source_survey=None,
        step2_profile=None,
        step2_granularity_tier=None,
        step2_extrapolated=False,
        step2_ambiguous=False,
        step2_bands_version=None,
        fusion_diagnostic="no_step2_coverage",
        fusion_confidence="n/a",
        recommended_revenue=revenue_step1,
        recommended_revenue_source="step1_only",
    )


def _diagnose(
    revenue_step1: float,
    p25: Optional[float],
    p75: Optional[float],
    p10: Optional[float],
    p90: Optional[float],
    p_low: float = 0.10,
    p_atypical_low: float = 0.25,
    p_atypical_high: float = 0.75,
    p_high: float = 0.90,
) -> str:
    """Classify step1 relative to step2 distribution band."""
    # outlier thresholds take precedence over atypical
    if p10 is not None and revenue_step1 < p10:
        return "outlier_low"
    if p90 is not None and revenue_step1 > p90:
        return "outlier_high"
    if p25 is not None and revenue_step1 < p25:
        return "atypical_low"
    if p75 is not None and revenue_step1 > p75:
        return "atypical_high"
    return "within_iqr"


def _confidence_from_diagnostic(diagnostic: str) -> str:
    if diagnostic in ("outlier_low", "outlier_high"):
        return "low"
    if diagnostic in ("atypical_low", "atypical_high"):
        return "medium"
    return "high"


def fuse_estimates(
    revenue_step1: float,
    cnae: str | None,
    headcount: int,
) -> FusionResult:
    """Combine Step 1 point estimate with Step 2 sector band data.

    Args:
        revenue_step1: Revenue estimate from Step 1 (BRL).
        cnae: Raw CNAE string in any supported format.
        headcount: Number of employees from RAIS match.

    Returns:
        :class:`FusionResult` — never raises.
    """
    mode = _mode()

    # mode=off: zero computation, pass-through
    if mode == "off":
        return FusionResult(
            revenue_step1=revenue_step1,
            revenue_step2_p10=None,
            revenue_step2_p25=None,
            revenue_step2_p50=None,
            revenue_step2_p75=None,
            revenue_step2_p90=None,
            revenue_step2_mean=None,
            step2_coverage_status="not_covered",
            step2_classification_code=None,
            step2_source_survey=None,
            step2_profile=None,
            step2_granularity_tier=None,
            step2_extrapolated=False,
            step2_ambiguous=False,
            step2_bands_version=None,
            fusion_diagnostic="no_step2_coverage",
            fusion_confidence="n/a",
            recommended_revenue=revenue_step1,
            recommended_revenue_source="step1_only",
        )

    # Attempt Step 2 lookup
    try:
        hit = lookup_classification(cnae)
    except Exception:
        return _no_coverage_result(revenue_step1)

    if hit.coverage_status in ("invalid_cnae", "not_in_table", "not_covered"):
        result = _no_coverage_result(revenue_step1)
        result = FusionResult(
            **{
                **result.__dict__,
                "step2_coverage_status": hit.coverage_status,
            }
        )
        if mode == "shadow":
            result = FusionResult(**{**result.__dict__, "recommended_revenue": revenue_step1})
        return result

    band_result = None
    if hit.survey_classification_code:
        try:
            band_result = get_revenue_band(hit.survey_classification_code, headcount)
        except Exception:
            band_result = None

    if band_result is None:
        r = _no_coverage_result(revenue_step1)
        r = FusionResult(
            **{
                **r.__dict__,
                "step2_coverage_status": hit.coverage_status,
                "step2_classification_code": hit.survey_classification_code,
                "step2_source_survey": hit.source_survey,
                "step2_ambiguous": hit.ambiguous,
            }
        )
        if mode == "shadow":
            r = FusionResult(**{**r.__dict__, "recommended_revenue": revenue_step1})
        return r

    diagnostic = _diagnose(
        revenue_step1=revenue_step1,
        p25=band_result.p25,
        p75=band_result.p75,
        p10=band_result.p10,
        p90=band_result.p90,
    )
    confidence = _confidence_from_diagnostic(diagnostic)

    # Determine recommended revenue and source
    can_override = (
        mode == "active"
        and hit.coverage_status == "covered"
        and band_result.granularity_tier != "minimal"
        and not band_result.extrapolated
        and not hit.ambiguous
        and confidence == "low"
        and band_result.p50 is not None
    )

    if can_override:
        recommended_revenue = band_result.p50
        recommended_revenue_source = "step2_band_fallback"
    elif band_result.granularity_tier == "minimal":
        recommended_revenue = revenue_step1
        recommended_revenue_source = "step1_with_minimal_tier_warning"
    elif confidence in ("medium", "low"):
        recommended_revenue = revenue_step1
        recommended_revenue_source = "step1_with_warning"
    else:
        recommended_revenue = revenue_step1
        recommended_revenue_source = "step1"

    # shadow mode always forces step1
    if mode == "shadow":
        recommended_revenue = revenue_step1
        recommended_revenue_source = (
            recommended_revenue_source
            if recommended_revenue_source == "step1"
            else "step1"
        )

    return FusionResult(
        revenue_step1=revenue_step1,
        revenue_step2_p10=band_result.p10,
        revenue_step2_p25=band_result.p25,
        revenue_step2_p50=band_result.p50,
        revenue_step2_p75=band_result.p75,
        revenue_step2_p90=band_result.p90,
        revenue_step2_mean=band_result.mean,
        step2_coverage_status=hit.coverage_status,
        step2_classification_code=hit.survey_classification_code,
        step2_source_survey=hit.source_survey,
        step2_profile=band_result.profile_used,
        step2_granularity_tier=band_result.granularity_tier,
        step2_extrapolated=band_result.extrapolated,
        step2_ambiguous=hit.ambiguous,
        step2_bands_version=band_result.model_version,
        fusion_diagnostic=diagnostic,
        fusion_confidence=confidence,
        recommended_revenue=recommended_revenue,
        recommended_revenue_source=recommended_revenue_source,
    )
