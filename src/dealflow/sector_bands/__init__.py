"""Sector Bands — Step 2 revenue enrichment layer.

Opt-in via SECTOR_BANDS_MODE env var: off | shadow | active.
Default is 'off', which produces zero changes to existing pipeline output.
"""

from .fusion import FusionResult, fuse_estimates

__all__ = ["FusionResult", "fuse_estimates"]
