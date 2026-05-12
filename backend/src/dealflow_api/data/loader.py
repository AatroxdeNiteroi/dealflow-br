"""Loader do parquet estimates_final pelo BACKEND."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import polars as pl


@lru_cache(maxsize=1)
def load_estimates(path: Path) -> pl.DataFrame:
    return pl.read_parquet(path)
