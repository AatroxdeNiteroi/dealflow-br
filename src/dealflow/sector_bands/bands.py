"""Revenue band lookup and headcount-based interpolation.

Each row in the revenue_bands CSV is a Lorenz-curve slice for one
survey_classification_code, sorted from the highest-revenue companies
(top_0_to_0.5pct) to the lowest (top_50_to_100pct). Each band carries:
    - po_medio_empresa_faixa  : average headcount of companies in that band
    - receita_media_empresa_faixa_mil_reais : average revenue (thousands BRL)
    - percentile_lower / percentile_upper   : cumulative fraction from the top

Given a headcount N, we interpolate between adjacent bands (sorted by
po_medio ascending) to get the Step 2 revenue estimate (returned as p50).
Sector-wide percentile thresholds p75 and p90 are derived from the band
boundaries at cumulative-from-top = 0.25 and 0.10 respectively. p25 and p10
are None because the bottom half of the distribution is not granular enough.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .loader import BandRow, load_bands

_MIL_REAIS_TO_BRL = 1_000.0

# Cumulative-from-top fractions that correspond to standard percentiles.
# p90 = top 10% boundary (percentile_upper ≈ 0.10)
# p75 = top 25% boundary (percentile_upper ≈ 0.25)
# p50 = top 50% boundary (percentile_upper ≈ 0.50)
_SECTOR_PCT_TARGETS: dict[str, float] = {
    "p90": 0.10,
    "p75": 0.25,
    "p50_sector": 0.50,
}


@dataclass
class BandResult:
    """Revenue band output for one (classification_code, headcount) query.

    p50  — headcount-interpolated revenue estimate (Step 2 central estimate).
    p75/p90 — sector-wide 75th/90th percentile thresholds for outlier diagnosis.
    p25/p10 — None (bottom half of distribution not granular enough).
    mean    — sector mean revenue = total_revenue / total_companies.
    """

    p10: Optional[float]
    p25: Optional[float]
    p50: Optional[float]
    p75: Optional[float]
    p90: Optional[float]
    mean: Optional[float]
    profile_used: str
    granularity_tier: str
    model_version: str
    extrapolated: bool


def _bands_for(classification_code: str) -> list[BandRow]:
    return [r for r in load_bands() if r["survey_classification_code"] == classification_code]


def _nearest_band_revenue(bands: list[BandRow], target_upper: float) -> Optional[float]:
    """Return revenue (BRL) of the band whose percentile_upper is closest to target."""
    best: Optional[BandRow] = None
    best_dist = float("inf")
    for b in bands:
        dist = abs(b["percentile_upper"] - target_upper)
        if dist < best_dist:
            best_dist = dist
            best = b
    if best is None:
        return None
    return best["receita_media_empresa_faixa_mil_reais"] * _MIL_REAIS_TO_BRL


def _interp_revenue(headcount: float, bands: list[BandRow]) -> tuple[float, bool]:
    """Interpolate receita_media at headcount from bands sorted by po_medio ascending.

    Returns (revenue_brl, extrapolated).
    """
    sorted_bands = sorted(bands, key=lambda b: b["po_medio_empresa_faixa"])

    if len(sorted_bands) == 1:
        b = sorted_bands[0]
        extrapolated = headcount != b["po_medio_empresa_faixa"]
        return b["receita_media_empresa_faixa_mil_reais"] * _MIL_REAIS_TO_BRL, extrapolated

    lo_band = sorted_bands[0]
    hi_band = sorted_bands[-1]

    if headcount <= lo_band["po_medio_empresa_faixa"]:
        return (
            lo_band["receita_media_empresa_faixa_mil_reais"] * _MIL_REAIS_TO_BRL,
            headcount < lo_band["po_medio_empresa_faixa"],
        )

    if headcount >= hi_band["po_medio_empresa_faixa"]:
        return (
            hi_band["receita_media_empresa_faixa_mil_reais"] * _MIL_REAIS_TO_BRL,
            headcount > hi_band["po_medio_empresa_faixa"],
        )

    for i in range(len(sorted_bands) - 1):
        lo = sorted_bands[i]
        hi = sorted_bands[i + 1]
        if lo["po_medio_empresa_faixa"] <= headcount <= hi["po_medio_empresa_faixa"]:
            x0, x1 = lo["po_medio_empresa_faixa"], hi["po_medio_empresa_faixa"]
            y0 = lo["receita_media_empresa_faixa_mil_reais"] * _MIL_REAIS_TO_BRL
            y1 = hi["receita_media_empresa_faixa_mil_reais"] * _MIL_REAIS_TO_BRL
            if x1 == x0:
                return (y0 + y1) / 2, False
            t = (headcount - x0) / (x1 - x0)
            return y0 + t * (y1 - y0), False

    # Fallback (should not reach here)
    return hi_band["receita_media_empresa_faixa_mil_reais"] * _MIL_REAIS_TO_BRL, True


def get_revenue_band(classification_code: str, headcount: int) -> Optional[BandResult]:
    """Look up interpolated revenue band for a classification + headcount.

    Args:
        classification_code: ``survey_classification_code`` from the lookup table.
        headcount: Number of employees (headcount from RAIS match).

    Returns:
        :class:`BandResult` with:
          - ``p50``: headcount-interpolated revenue estimate in BRL (Step 2 estimate)
          - ``p75``, ``p90``: sector-wide percentile thresholds in BRL
          - ``p25``, ``p10``: None (insufficient data for bottom-half distribution)
          - ``mean``: sector-wide mean revenue in BRL
        Returns ``None`` if the classification code is absent from the bands CSV.
    """
    bands = _bands_for(classification_code)
    if not bands:
        return None

    ref = bands[0]
    profile_used = ref["profile_used"]
    granularity_tier = ref["granularity_tier"]
    model_version = ref["model_version"]

    p50_estimate, extrapolated = _interp_revenue(float(headcount), bands)
    p90 = _nearest_band_revenue(bands, _SECTOR_PCT_TARGETS["p90"])
    p75 = _nearest_band_revenue(bands, _SECTOR_PCT_TARGETS["p75"])

    n = ref["n_empresas_cnae_total"]
    total = ref["receita_total_cnae_mil_reais"]
    mean = (total / n * _MIL_REAIS_TO_BRL) if n > 0 else None

    return BandResult(
        p10=None,
        p25=None,
        p50=p50_estimate,
        p75=p75,
        p90=p90,
        mean=mean,
        profile_used=profile_used,
        granularity_tier=granularity_tier,
        model_version=model_version,
        extrapolated=extrapolated,
    )
