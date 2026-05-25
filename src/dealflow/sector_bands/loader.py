"""CSV loaders for the sector bands enrichment layer.

Both CSVs are loaded once (module-level singleton) and exposed as typed dicts.
Paths default to repo-relative locations but can be overridden via env vars:
    SECTOR_BANDS_CSV   — path to revenue_bands_*.csv
    SECTOR_LOOKUP_CSV  — path to cnae_to_classification_lookup_*.csv
"""

from __future__ import annotations

import csv
import os
from functools import lru_cache
from pathlib import Path
from typing import TypedDict

_DEFAULT_BANDS_PATH = Path("data/external/sector_bands/revenue_bands_20260522.csv")
_DEFAULT_LOOKUP_PATH = Path(
    "data/external/sector_bands/cnae_to_classification_lookup_20260522.csv"
)

_BANDS_REQUIRED_COLS = {
    "survey_classification_code",
    "granularity_tier",
    "percentile_band",
    "percentile_lower",
    "percentile_upper",
    "receita_media_empresa_faixa_mil_reais",
    "po_medio_empresa_faixa",
    "profile_used",
    "model_version",
    "mapping_ambiguity",
    "n_empresas_cnae_total",
    "receita_total_cnae_mil_reais",
}

_LOOKUP_REQUIRED_COLS = {
    "cnae_5digit_clean",
    "survey_classification_code",
    "source_survey",
    "coverage_status",
}


class BandRow(TypedDict):
    survey_classification_code: str
    granularity_tier: str
    percentile_band: str
    percentile_lower: float
    percentile_upper: float
    receita_media_empresa_faixa_mil_reais: float
    po_medio_empresa_faixa: float
    profile_used: str
    model_version: str
    mapping_ambiguity: str
    n_empresas_cnae_total: float
    receita_total_cnae_mil_reais: float


class LookupRow(TypedDict):
    survey_classification_code: str
    source_survey: str
    coverage_status: str


def _resolve_path(env_var: str, default: Path) -> Path:
    override = os.environ.get(env_var)
    return Path(override) if override else default


@lru_cache(maxsize=1)
def load_bands() -> list[BandRow]:
    """Load and validate revenue_bands CSV. Cached after first call."""
    path = _resolve_path("SECTOR_BANDS_CSV", _DEFAULT_BANDS_PATH)
    if not path.exists():
        raise FileNotFoundError(f"sector_bands: bands CSV not found at {path}")

    rows: list[BandRow] = []
    with path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        if not reader.fieldnames:
            raise ValueError("sector_bands: bands CSV is empty")
        missing = _BANDS_REQUIRED_COLS - set(reader.fieldnames)
        if missing:
            raise ValueError(f"sector_bands: bands CSV missing columns: {missing}")

        for row in reader:
            try:
                rows.append(
                    BandRow(
                        survey_classification_code=row["survey_classification_code"],
                        granularity_tier=row["granularity_tier"],
                        percentile_band=row["percentile_band"],
                        percentile_lower=float(row["percentile_lower"]),
                        percentile_upper=float(row["percentile_upper"]),
                        receita_media_empresa_faixa_mil_reais=float(
                            row["receita_media_empresa_faixa_mil_reais"]
                        ),
                        po_medio_empresa_faixa=float(row["po_medio_empresa_faixa"]),
                        profile_used=row["profile_used"],
                        model_version=row["model_version"],
                        mapping_ambiguity=row["mapping_ambiguity"],
                        n_empresas_cnae_total=float(row["n_empresas_cnae_total"] or 0),
                        receita_total_cnae_mil_reais=float(
                            row["receita_total_cnae_mil_reais"] or 0
                        ),
                    )
                )
            except (ValueError, KeyError):
                continue  # skip malformed rows
    return rows


@lru_cache(maxsize=1)
def load_lookup() -> dict[str, LookupRow]:
    """Load and validate cnae_to_classification_lookup CSV.

    Returns dict keyed by canonical 5-digit string (e.g. ``"31012"``).
    Cached after first call.
    """
    path = _resolve_path("SECTOR_LOOKUP_CSV", _DEFAULT_LOOKUP_PATH)
    if not path.exists():
        raise FileNotFoundError(f"sector_bands: lookup CSV not found at {path}")

    result: dict[str, LookupRow] = {}
    with path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        if not reader.fieldnames:
            raise ValueError("sector_bands: lookup CSV is empty")
        missing = _LOOKUP_REQUIRED_COLS - set(reader.fieldnames)
        if missing:
            raise ValueError(f"sector_bands: lookup CSV missing columns: {missing}")

        for row in reader:
            key = row["cnae_5digit_clean"].strip()
            result[key] = LookupRow(
                survey_classification_code=row["survey_classification_code"],
                source_survey=row["source_survey"],
                coverage_status=row["coverage_status"],
            )
    return result
