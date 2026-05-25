"""CNAE → survey classification lookup (O(1) dict, built once from CSV).

Returns a named tuple with the classification code, source survey, and coverage
status. Coverage status is one of:
    covered                — IBGE has data for this CNAE
    not_covered            — IBGE has no matching data
    ambiguous_review_needed — multiple possible mappings; needs manual review
    not_in_table           — CNAE 5-digit key absent from lookup CSV entirely
    invalid_cnae           — could not normalize input to canonical form
"""

from __future__ import annotations

from typing import NamedTuple

from .loader import load_lookup
from .normalizer import normalize_cnae


class ClassificationHit(NamedTuple):
    survey_classification_code: str | None
    source_survey: str | None
    coverage_status: str
    ambiguous: bool


def lookup_classification(cnae_raw: str | None) -> ClassificationHit:
    """Map a raw CNAE string to its IBGE survey classification.

    Args:
        cnae_raw: Any CNAE string format; will be normalized internally.

    Returns:
        :class:`ClassificationHit` with code, survey, status, and ambiguity flag.
    """
    canonical = normalize_cnae(cnae_raw)
    if canonical is None:
        return ClassificationHit(
            survey_classification_code=None,
            source_survey=None,
            coverage_status="invalid_cnae",
            ambiguous=False,
        )

    # canonical is "DDDD-D/DD" — build lookup key matching cnae_5digit_clean
    # (all digits of the 7-digit code, with leading zeros stripped)
    digits_only = canonical.replace("-", "").replace("/", "")
    key_5d = digits_only.lstrip("0") or digits_only

    lut = load_lookup()
    row = lut.get(key_5d)
    if row is None:
        return ClassificationHit(
            survey_classification_code=None,
            source_survey=None,
            coverage_status="not_in_table",
            ambiguous=False,
        )

    status = row["coverage_status"]
    # ambiguous is derived from coverage_status; the lookup CSV has no separate
    # mapping_ambiguity column — ambiguous_review_needed is the sole signal.
    ambiguous = status == "ambiguous_review_needed"

    return ClassificationHit(
        survey_classification_code=row["survey_classification_code"] or None,
        source_survey=row["source_survey"] or None,
        coverage_status=status,
        ambiguous=ambiguous,
    )
