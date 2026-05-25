# Sector Bands — Step 2 Revenue Enrichment

## Overview

The sector bands layer is an optional **Step 2** enrichment that cross-checks
Step 1 revenue estimates (salary ratio × CNAE coefficient) against the
empirical revenue distribution published by IBGE in PIA, PAC, and PAS surveys.

It is entirely **opt-in**. The feature flag `SECTOR_BANDS_MODE` (environment
variable) controls behavior:

| Mode     | Step 2 runs? | Affects `recommended_revenue`? |
|----------|:------------:|:-------------------------------:|
| `off`    | No           | No — byte-identical output      |
| `shadow` | Yes          | No — Step 1 always wins         |
| `active` | Yes          | Yes — Step 2 can override Step 1 under strict conditions |

Default is `off`.

---

## Data Sources

### `revenue_bands_20260522.csv`

Lorenz-curve distribution of revenues for each IBGE survey classification.
Each row is one revenue-percentile band for one classification code, containing:

| Column | Meaning |
|--------|---------|
| `survey_classification_code` | Internal code (`PAC_2.1`, `PAS_8.1`, `10`, …) |
| `percentile_band` | Band label (`top_0_to_0.5pct` → `top_50_to_100pct`) |
| `percentile_lower` / `percentile_upper` | Cumulative fraction **from the top** (e.g. 0.075–0.10 = top 7.5–10% by revenue) |
| `po_medio_empresa_faixa` | Average headcount of companies in this band |
| `receita_media_empresa_faixa_mil_reais` | Average revenue (thousand BRL) of companies in this band |
| `granularity_tier` | Data quality: `full` ≥ 300 co., `medium` 100–300, `coarse` 50–100, `minimal` < 50 |
| `profile_used` | Company type profile used for this classification |

### `cnae_to_classification_lookup_20260522.csv`

Routing table: 7-digit CNAE subclass → IBGE survey classification.

| Column | Meaning |
|--------|---------|
| `cnae_5digit_clean` | 5-digit CNAE key (e.g. `161001` for CNAE `0161-0/01`) |
| `survey_classification_code` | Target classification in the bands table |
| `source_survey` | `PIA`, `PAC`, or `PAS` |
| `coverage_status` | `covered` / `not_covered` / `ambiguous_review_needed` |
| `mapping_ambiguity` | Non-empty when the CNAE maps to multiple possible classifications |

---

## Module Architecture

```
src/dealflow/sector_bands/
├── __init__.py       re-exports FusionResult + fuse_estimates
├── normalizer.py     Any CNAE format → canonical "DDDD-D/DD"
├── loader.py         CSV loaders (lru_cache singletons)
├── lookup.py         CNAE → ClassificationHit (O(1) dict)
├── bands.py          Revenue band interpolation → BandResult
└── fusion.py         FusionResult dataclass + fuse_estimates()
```

---

## Revenue Estimation Logic

### Step 2 estimate (`BandResult.p50`)

Given a CNAE and headcount N:

1. Normalize CNAE to canonical form (`normalizer.py`)
2. Look up `survey_classification_code` in the routing table (`lookup.py`)
3. Sort bands for that classification by `po_medio_empresa_faixa` (ascending)
4. Linearly interpolate `receita_media` at headcount N → **Step 2 revenue estimate**

If N is below the smallest `po_medio` or above the largest, the nearest band
is used and `extrapolated=True` is set.

### Sector thresholds (`BandResult.p75`, `p90`)

- **p90**: revenue of the band whose `percentile_upper` ≈ 0.10 (top-10% boundary)
- **p75**: revenue of the band whose `percentile_upper` ≈ 0.25 (top-25% boundary)
- **p25, p10**: `None` — the bottom half of the distribution is not granular enough in the current data

---

## Fusion Decision Table

`fuse_estimates(revenue_step1, cnae, headcount)` returns a `FusionResult`.

The `fusion_diagnostic` classifies Step 1 relative to the sector distribution:

| Diagnostic | Condition |
|------------|-----------|
| `no_step2_coverage` | CNAE not covered / invalid / not in table |
| `within_iqr` | Step 1 between p25 and p75 (or p25/p10 are None) |
| `atypical_high` | Step 1 > p75 but ≤ p90 |
| `outlier_high` | Step 1 > p90 |
| `atypical_low` | Step 1 < p25 (currently never triggered; p25=None) |
| `outlier_low` | Step 1 < p10 (currently never triggered; p10=None) |

The `fusion_confidence` maps from diagnostic:
- `outlier_*` → `"low"`
- `atypical_*` → `"medium"`
- `within_iqr` → `"high"`
- `no_step2_coverage` → `"n/a"`

### Step 2 Override Conditions (mode=active only)

Step 2 overrides Step 1 **only when all** of the following hold:

1. `coverage_status == "covered"`
2. `granularity_tier != "minimal"`
3. `extrapolated == False`
4. `ambiguous == False`
5. `fusion_confidence == "low"` (outlier high or low)
6. `revenue_step2_p50` is not None

When Step 2 overrides, `recommended_revenue = revenue_step2_p50` and
`recommended_revenue_source = "step2_band_fallback"`.

### `recommended_revenue_source` values

| Value | Meaning |
|-------|---------|
| `step1_only` | No Step 2 data available |
| `step1` | Step 2 available but Step 1 is within normal range |
| `step1_with_warning` | Step 1 is atypical but not extreme enough to override |
| `step1_with_minimal_tier_warning` | Coverage exists but `granularity_tier=minimal` (N<50 companies) |
| `step2_band_fallback` | Step 2 overrode Step 1 (only in `active` mode) |

---

## FusionResult Fields

```python
@dataclass
class FusionResult:
    revenue_step1: float                  # Step 1 estimate (BRL)
    revenue_step2_p10: Optional[float]    # Step 2 p10 threshold (None currently)
    revenue_step2_p25: Optional[float]    # Step 2 p25 threshold (None currently)
    revenue_step2_p50: Optional[float]    # Step 2 headcount-interpolated estimate (BRL)
    revenue_step2_p75: Optional[float]    # Sector 75th percentile (BRL)
    revenue_step2_p90: Optional[float]    # Sector 90th percentile (BRL)
    revenue_step2_mean: Optional[float]   # Sector mean revenue (BRL)
    step2_coverage_status: str            # covered|not_covered|ambiguous|not_in_table|invalid_cnae
    step2_classification_code: Optional[str]
    step2_source_survey: Optional[str]    # PIA|PAC|PAS
    step2_profile: Optional[str]          # company type profile
    step2_granularity_tier: Optional[str] # full|medium|coarse|minimal
    step2_extrapolated: bool              # True if headcount outside observed range
    step2_ambiguous: bool                 # True if CNAE has multiple possible classifications
    step2_bands_version: Optional[str]    # model_version from CSV (e.g. "1.2.0")
    fusion_diagnostic: str                # classification of Step 1 vs sector distribution
    fusion_confidence: str                # high|medium|low|n/a
    recommended_revenue: float            # final recommended estimate (BRL)
    recommended_revenue_source: str       # provenance of recommended_revenue
```

---

## Configuration (`config/dealflow.yaml`)

```yaml
sector_bands:
  mode: "off"  # off | shadow | active
  bands_csv_path: "data/external/sector_bands/revenue_bands_20260522.csv"
  lookup_csv_path: "data/external/sector_bands/cnae_to_classification_lookup_20260522.csv"
  outlier_low_percentile: 0.10
  atypical_low_percentile: 0.25
  atypical_high_percentile: 0.75
  outlier_high_percentile: 0.90
```

The mode can also be set at runtime via the `SECTOR_BANDS_MODE` environment
variable, which takes precedence over the YAML config.

---

## Performance Notes

- Both CSVs are loaded once and cached (`lru_cache`). Subsequent calls per
  process have negligible overhead.
- The `fuse_estimates` function never raises exceptions; all error paths
  return a safe `FusionResult` with `recommended_revenue = revenue_step1`.
- In `off` mode, no CSV is read and no computation occurs.

---

## Shadow Mode Diagnostics

Run in `shadow` mode to generate a diagnostic report without changing any
output. The `FusionResult` fields `fusion_diagnostic` and `fusion_confidence`
will be populated even though `recommended_revenue` is always Step 1.

This allows measuring, before going `active`:
- What fraction of companies have Step 1 as an `outlier_high`
- What fraction are `atypical_high`
- Step 2 coverage across your CNAE portfolio
