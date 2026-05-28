"""Tests for the sector_bands Step 2 enrichment layer.

Uses real CSV fixtures from data/external/sector_bands/ — no mocking.
PAS_8.1 (agricultural services) is the primary test classification:
    po_medio:       1.42 ... 324.05 (headcount anchors)
    receita_media:  328.486 ... 61636.714 (thousand BRL)
    granularity_tier: full
Coverage test CNAE: 0161-0/01 (covered, PAS_8.1)
Ambiguous CNAE:     9101-5/00 (ambiguous_review_needed)
Not-covered CNAE:   0111-3/01
"""

from __future__ import annotations

import os

import pytest

from dealflow.sector_bands.normalizer import normalize_cnae
from dealflow.sector_bands.lookup import lookup_classification
from dealflow.sector_bands.bands import get_revenue_band
from dealflow.sector_bands.fusion import fuse_estimates


# ---------------------------------------------------------------------------
# Normalizer
# ---------------------------------------------------------------------------

class TestNormalizeCnae:
    def test_seven_raw_digits(self):
        assert normalize_cnae("3101200") == "3101-2/00"

    def test_five_digits_no_punctuation(self):
        assert normalize_cnae("31012") == "3101-2/00"

    def test_five_digits_with_hyphen(self):
        assert normalize_cnae("3101-2") == "3101-2/00"

    def test_canonical_passthrough(self):
        assert normalize_cnae("3101-2/00") == "3101-2/00"

    def test_dot_separator(self):
        assert normalize_cnae("31.01-2/00") == "3101-2/00"

    def test_dot_separator_no_suffix(self):
        assert normalize_cnae("31.01-2") == "3101-2/00"

    def test_none_input(self):
        assert normalize_cnae(None) is None

    def test_non_digit_input(self):
        assert normalize_cnae("abc-xyz") is None

    def test_eight_digits_returns_none(self):
        # 8 digits is neither 5 nor 7 — ambiguous, reject
        assert normalize_cnae("31012000") is None

    def test_real_cnae_0161(self):
        assert normalize_cnae("0161-0/01") == "0161-0/01"

    def test_real_cnae_9101(self):
        assert normalize_cnae("9101500") == "9101-5/00"


# ---------------------------------------------------------------------------
# Lookup
# ---------------------------------------------------------------------------

class TestLookupClassification:
    def test_covered_cnae(self):
        hit = lookup_classification("0161-0/01")
        assert hit.coverage_status == "covered"
        assert hit.survey_classification_code == "PAS_8.1"
        assert hit.source_survey == "PAS"
        assert hit.ambiguous is False

    def test_not_covered_cnae(self):
        hit = lookup_classification("0111-3/01")
        assert hit.coverage_status == "not_covered"
        assert hit.survey_classification_code is None

    def test_ambiguous_cnae(self):
        hit = lookup_classification("9101-5/00")
        assert hit.coverage_status == "ambiguous_review_needed"
        assert hit.ambiguous is True

    def test_not_in_table(self):
        hit = lookup_classification("9999-9/99")
        assert hit.coverage_status == "not_in_table"
        assert hit.survey_classification_code is None

    def test_invalid_cnae(self):
        hit = lookup_classification("not_a_cnae")
        assert hit.coverage_status == "invalid_cnae"
        assert hit.survey_classification_code is None

    def test_none_input(self):
        hit = lookup_classification(None)
        assert hit.coverage_status == "invalid_cnae"

    def test_raw_digit_format(self):
        # "0161001" → normalized to "0161-0/01" → key "01610"
        hit = lookup_classification("0161001")
        assert hit.coverage_status == "covered"
        assert hit.survey_classification_code == "PAS_8.1"


# ---------------------------------------------------------------------------
# Bands
# ---------------------------------------------------------------------------

class TestGetRevenueBand:
    def test_exact_po_medio_match(self):
        # po_medio=28.35 for top_7.5_to_10pct → receita=5752.76 k BRL
        result = get_revenue_band("PAS_8.1", 28)
        assert result is not None
        assert result.granularity_tier == "full"
        assert result.extrapolated is False
        # p50 should be close to 5,752,760 (headcount 28 ≈ 28.35 anchor)
        assert result.p50 is not None
        assert 3_000_000 < result.p50 < 7_000_000

    def test_p90_threshold_is_sector_top10_boundary(self):
        # Band with percentile_upper=0.10 is top_7.5_to_10pct → 5752.76 k
        result = get_revenue_band("PAS_8.1", 10)
        assert result is not None
        assert result.p90 is not None
        assert abs(result.p90 - 5_752_760) < 1_000  # within 1 BRL tolerance

    def test_p75_threshold_is_sector_top25_boundary(self):
        # Band with percentile_upper=0.25 is top_15_to_25pct → 2260.013 k
        result = get_revenue_band("PAS_8.1", 10)
        assert result is not None
        assert result.p75 is not None
        assert abs(result.p75 - 2_260_013) < 1_000

    def test_p10_p25_are_none(self):
        result = get_revenue_band("PAS_8.1", 10)
        assert result is not None
        assert result.p10 is None
        assert result.p25 is None

    def test_extrapolated_above_max(self):
        # headcount 400 > max po_medio 324.05
        result = get_revenue_band("PAS_8.1", 400)
        assert result is not None
        assert result.extrapolated is True
        # Pareto estimate for extrapolated headcount — above the top-band mean
        assert result.p50 is not None
        assert result.p50 > 0

    def test_extrapolated_below_min(self):
        # headcount 0 < min po_medio 1.42
        result = get_revenue_band("PAS_8.1", 0)
        assert result is not None
        assert result.extrapolated is True

    def test_nonexistent_code_returns_none(self):
        result = get_revenue_band("DOES_NOT_EXIST", 10)
        assert result is None

    def test_mean_is_positive(self):
        result = get_revenue_band("PAS_8.1", 10)
        assert result is not None
        assert result.mean is not None
        assert result.mean > 0

    def test_interpolation_monotone(self):
        # Higher headcount → higher revenue estimate
        r_low = get_revenue_band("PAS_8.1", 5)
        r_mid = get_revenue_band("PAS_8.1", 30)
        r_high = get_revenue_band("PAS_8.1", 100)
        assert r_low is not None and r_mid is not None and r_high is not None
        assert r_low.p50 < r_mid.p50 < r_high.p50


# ---------------------------------------------------------------------------
# Fusion — mode=off
# ---------------------------------------------------------------------------

class TestFusionOff:
    def setup_method(self):
        os.environ["SECTOR_BANDS_MODE"] = "off"

    def teardown_method(self):
        os.environ.pop("SECTOR_BANDS_MODE", None)

    def test_passthrough_no_step2(self):
        result = fuse_estimates(1_000_000.0, "0161-0/01", 10)
        assert result.recommended_revenue == 1_000_000.0
        assert result.recommended_revenue_source == "step1_only"
        assert result.revenue_step2_p50 is None

    def test_invalid_cnae_still_passthrough(self):
        result = fuse_estimates(500_000.0, None, 5)
        assert result.recommended_revenue == 500_000.0

    def test_revenue_step1_preserved(self):
        for revenue in [100_000.0, 5_000_000.0, 200_000_000.0]:
            result = fuse_estimates(revenue, "0161001", 20)
            assert result.revenue_step1 == revenue
            assert result.recommended_revenue == revenue


# ---------------------------------------------------------------------------
# Fusion — mode=shadow
# ---------------------------------------------------------------------------

class TestFusionShadow:
    def setup_method(self):
        os.environ["SECTOR_BANDS_MODE"] = "shadow"

    def teardown_method(self):
        os.environ.pop("SECTOR_BANDS_MODE", None)

    def test_step2_runs_but_recommended_is_step1(self):
        # covered CNAE, step1 far above p90 → step2 would override in active mode
        result = fuse_estimates(50_000_000.0, "0161-0/01", 28)
        # Step 2 data should be populated
        assert result.revenue_step2_p50 is not None
        assert result.step2_coverage_status == "covered"
        # But recommended MUST still be step1
        assert result.recommended_revenue == 50_000_000.0

    def test_diagnostics_populated_in_shadow(self):
        result = fuse_estimates(50_000_000.0, "0161-0/01", 28)
        assert result.fusion_diagnostic != "no_step2_coverage"
        assert result.fusion_confidence in ("high", "medium", "low")

    def test_not_covered_shadow(self):
        result = fuse_estimates(1_000_000.0, "0111-3/01", 10)
        assert result.recommended_revenue == 1_000_000.0
        assert result.step2_coverage_status == "not_covered"


# ---------------------------------------------------------------------------
# Fusion — mode=active
# ---------------------------------------------------------------------------

class TestFusionActive:
    def setup_method(self):
        os.environ["SECTOR_BANDS_MODE"] = "active"

    def teardown_method(self):
        os.environ.pop("SECTOR_BANDS_MODE", None)

    def test_step2_overrides_when_step1_is_extreme_outlier(self):
        # step1=50M far above p90≈5.75M for PAS_8.1 at headcount 28
        result = fuse_estimates(50_000_000.0, "0161-0/01", 28)
        assert result.fusion_diagnostic == "outlier_high"
        assert result.fusion_confidence == "low"
        assert result.recommended_revenue_source == "step2_band_fallback"
        assert result.recommended_revenue == result.revenue_step2_p50

    def test_step1_preserved_when_within_range(self):
        # step1 close to p50 → within_iqr → step1 wins
        # PAS_8.1 headcount=10, p75≈2.26M, p90≈5.75M
        step1 = 1_500_000.0  # below p75 → within_iqr
        result = fuse_estimates(step1, "0161-0/01", 10)
        assert result.fusion_diagnostic == "within_iqr"
        assert result.fusion_confidence == "high"
        assert result.recommended_revenue == step1
        assert result.recommended_revenue_source == "step1"

    def test_atypical_high_keeps_step1_with_warning(self):
        # Between p75 and p90 → atypical_high → step1_with_warning
        # p75≈2.26M, p90≈5.75M  → use step1=3.5M
        step1 = 3_500_000.0
        result = fuse_estimates(step1, "0161-0/01", 10)
        assert result.fusion_diagnostic == "atypical_high"
        assert result.fusion_confidence == "medium"
        assert result.recommended_revenue == step1
        assert result.recommended_revenue_source == "step1_with_warning"

    def test_not_covered_no_override(self):
        result = fuse_estimates(1_000_000.0, "0111-3/01", 10)
        assert result.recommended_revenue == 1_000_000.0
        assert result.recommended_revenue_source == "step1_only"

    def test_ambiguous_no_override(self):
        result = fuse_estimates(50_000_000.0, "9101-5/00", 10)
        # ambiguous → step2 data populated but no override
        assert result.step2_ambiguous is True
        assert result.recommended_revenue == 50_000_000.0
        assert result.recommended_revenue_source != "step2_band_fallback"

    def test_extrapolated_no_override(self):
        # headcount 1000 → extrapolated → no override even if step1 is outlier
        result = fuse_estimates(500_000_000.0, "0161-0/01", 1000)
        assert result.step2_extrapolated is True
        assert result.recommended_revenue_source != "step2_band_fallback"

    def test_invalid_cnae_passthrough(self):
        result = fuse_estimates(999.0, "INVALID", 5)
        assert result.recommended_revenue == 999.0
        assert result.step2_coverage_status == "invalid_cnae"

    def test_fusion_result_fields_complete(self):
        result = fuse_estimates(50_000_000.0, "0161-0/01", 28)
        # All required fields should be populated
        assert result.revenue_step1 == 50_000_000.0
        assert result.step2_classification_code == "PAS_8.1"
        assert result.step2_source_survey == "PAS"
        assert result.step2_granularity_tier == "full"
        assert result.step2_bands_version is not None
        assert result.fusion_diagnostic in (
            "within_iqr", "atypical_low", "atypical_high", "outlier_low", "outlier_high"
        )
