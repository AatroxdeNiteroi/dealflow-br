"""Revenue band lookup — Pareto-based headcount-to-revenue estimation.

Each row in the revenue_bands CSV is a Lorenz-curve slice for one
survey_classification_code. Given a company headcount N we:

  1. Compute the company's headcount percentile within the sector by
     accumulating band widths (n_empresas_cnae_total × percentile_width) from
     the bottom band upward, using po_medio as the representative headcount
     per band.  This gives p_top ∈ (0, 1] — the fraction of sector companies
     with *more* employees.

  2. Fit a Pareto shape parameter α from the empirical Lorenz shares already
     present in the CSV (OLS of log revenue-share on log company-fraction).
     This captures how concentrated revenue actually is in the sector.

  3. Estimate revenue via the Pareto quantile formula, which distributes total
     sector revenue (receita_total_cnae_mil_reais) continuously across the
     headcount distribution.  This avoids the arithmetic-mean distortion that
     occurs when a few extreme outliers inflate the empirical band average of
     broad IBGE classifications (e.g. Gerdau skewing the Metalurgia average).

Sector-wide thresholds p75 and p90 are still derived from the empirical band
means (they feed the outlier-diagnosis step in fusion.py, not the estimate).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

from .loader import BandRow, load_bands

_MIL_REAIS_TO_BRL = 1_000.0
_DEFAULT_PARETO_ALPHA = 1.16  # approximate for Brazilian firms (80/20 rule)

_SECTOR_PCT_TARGETS: dict[str, float] = {
    "p90": 0.10,
    "p75": 0.25,
}


@dataclass
class BandResult:
    """Revenue band output for one (classification_code, headcount) query.

    p50  — Pareto-based headcount-percentile revenue estimate (Step 2 estimate).
    p75/p90 — sector-wide empirical 75th/90th percentile thresholds for outlier
              diagnosis (not used as point estimates).
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


def _n_in_band(band: BandRow) -> float:
    """Approximate number of companies in this band (band_width × n_total)."""
    width = band["percentile_upper"] - band["percentile_lower"]
    return band["n_empresas_cnae_total"] * width


def _fit_pareto_alpha(
    sorted_bands: list[BandRow],
    n_total: float,
    r_total: float,
) -> float:
    """Fit Pareto shape α from the empirical Lorenz data via OLS on log-log.

    For a Pareto distribution: cumulative revenue share S(p) = p^(1-1/α),
    where p is the cumulative company fraction from the top.
    OLS through origin gives slope = (1-1/α), so α = 1/(1-slope).
    Returns α clamped to [1.05, 2.5]; falls back to _DEFAULT_PARETO_ALPHA on
    degenerate inputs.
    """
    points: list[tuple[float, float]] = []
    cumul_n = 0.0
    cumul_r = 0.0

    for band in reversed(sorted_bands):  # top bands first
        n_band = _n_in_band(band)
        cumul_n += n_band
        cumul_r += band["receita_media_empresa_faixa_mil_reais"] * n_band
        p = cumul_n / n_total
        s = cumul_r / r_total
        if 0.0 < p < 1.0 and 0.0 < s < 1.0:
            points.append((math.log(p), math.log(s)))

    if len(points) < 2:
        return _DEFAULT_PARETO_ALPHA

    num = sum(lp * ls for lp, ls in points)
    den = sum(lp * lp for lp, _ in points)
    if den == 0.0:
        return _DEFAULT_PARETO_ALPHA

    slope = num / den
    if slope >= 1.0 or slope <= 0.0:
        return _DEFAULT_PARETO_ALPHA

    return max(1.05, min(2.5, 1.0 / (1.0 - slope)))


def _headcount_percentile_from_top(
    headcount: float,
    sorted_bands: list[BandRow],
    n_total: float,
) -> tuple[float, bool]:
    """Compute company's fractional rank from the top of the headcount distribution.

    Returns (p_top, extrapolated):
      p_top = 0.01 means the company has more employees than 99% of its sector.
      extrapolated = True when headcount exceeds the maximum observed po_medio.
    """
    cum_n: list[float] = []
    running = 0.0
    for b in sorted_bands:
        running += _n_in_band(b)
        cum_n.append(running)

    lo_band = sorted_bands[0]
    hi_band = sorted_bands[-1]

    if headcount <= lo_band["po_medio_empresa_faixa"]:
        p_bottom = cum_n[0] * 0.5 / n_total
        return 1.0 - p_bottom, headcount < lo_band["po_medio_empresa_faixa"]

    if headcount >= hi_band["po_medio_empresa_faixa"]:
        p_bottom = (cum_n[-1] - _n_in_band(hi_band) * 0.5) / n_total
        return 1.0 - p_bottom, True

    for i in range(len(sorted_bands) - 1):
        lo = sorted_bands[i]
        hi = sorted_bands[i + 1]
        x0, x1 = lo["po_medio_empresa_faixa"], hi["po_medio_empresa_faixa"]
        if x0 <= headcount <= x1:
            t = (headcount - x0) / (x1 - x0) if x1 > x0 else 0.5
            n_below = cum_n[i] + t * _n_in_band(hi)
            return 1.0 - (n_below / n_total), False

    return 0.5, True  # unreachable; defensive fallback


def _pareto_revenue(
    p_top: float,
    alpha: float,
    n_total: float,
    r_total_mil: float,
) -> float:
    """Pareto quantile revenue for a company at fractional rank p_top from top.

    Derivation:
      R(k) = R_min × (N/k)^(1/α)  for rank k out of N
      R_total = N × R_min × α/(α-1)  →  R_min = R_total × (α-1)/(N × α)
      At fractional rank p_top: R = R_min × p_top^(-1/α)

    Returns revenue in BRL.
    """
    r_min_mil = r_total_mil * (alpha - 1.0) / (n_total * alpha)
    return r_min_mil * (p_top ** (-1.0 / alpha)) * _MIL_REAIS_TO_BRL


def get_revenue_band(classification_code: str, headcount: int) -> Optional[BandResult]:
    """Look up Pareto-estimated revenue for a classification + headcount.

    Args:
        classification_code: ``survey_classification_code`` from the lookup table.
        headcount: Number of employees (headcount from RAIS match).

    Returns:
        :class:`BandResult` with:
          - ``p50``: Pareto-based revenue estimate in BRL (Step 2 central estimate).
          - ``p75``, ``p90``: sector-wide empirical percentile thresholds in BRL.
          - ``mean``: sector mean revenue in BRL.
          - ``extrapolated``: True if headcount exceeds the maximum observed po_medio.
        Returns ``None`` if the classification code is absent from the bands CSV.
    """
    bands = _bands_for(classification_code)
    if not bands:
        return None

    ref = bands[0]
    n_total = ref["n_empresas_cnae_total"]
    r_total = ref["receita_total_cnae_mil_reais"]

    sorted_bands = sorted(bands, key=lambda b: b["po_medio_empresa_faixa"])

    p_top, extrapolated = _headcount_percentile_from_top(float(headcount), sorted_bands, n_total)
    p_top = max(0.5 / max(n_total, 1.0), min(1.0 - 0.5 / max(n_total, 1.0), p_top))

    p50_estimate: Optional[float] = None
    if n_total > 0 and r_total > 0:
        alpha = _fit_pareto_alpha(sorted_bands, n_total, r_total)
        p50_estimate = _pareto_revenue(p_top, alpha, n_total, r_total)

    p90 = _nearest_band_revenue(bands, _SECTOR_PCT_TARGETS["p90"])
    p75 = _nearest_band_revenue(bands, _SECTOR_PCT_TARGETS["p75"])
    mean = (r_total / n_total * _MIL_REAIS_TO_BRL) if n_total > 0 else None

    return BandResult(
        p10=None,
        p25=None,
        p50=p50_estimate,
        p75=p75,
        p90=p90,
        mean=mean,
        profile_used=ref["profile_used"],
        granularity_tier=ref["granularity_tier"],
        model_version=ref["model_version"],
        extrapolated=extrapolated,
    )
