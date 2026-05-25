"""CNAE format normalizer — converts any input format to canonical XXXX-X/XX.

Accepted input formats:
    "3101200"     — 7 raw digits
    "31012"       — 5 digits (no subclass suffix)
    "3101-2"      — 5 digits with hyphen
    "3101-2/00"   — canonical (pass-through)
    "31.01-2/00"  — with dot separator
    "31.01-2"     — dot + hyphen, no slash suffix

Returns canonical "DDDD-D/DD" string, or None if input cannot be parsed.
"""

from __future__ import annotations

import re

_DIGITS_RE = re.compile(r"\d")


def normalize_cnae(raw: str | None) -> str | None:
    """Normalize any CNAE representation to canonical ``DDDD-D/DD`` form.

    Args:
        raw: Any CNAE string in the supported formats above.

    Returns:
        Canonical string like ``"3101-2/00"``, or ``None`` when parsing fails.
    """
    if raw is None:
        return None

    digits = "".join(_DIGITS_RE.findall(raw))

    if len(digits) == 7:
        return f"{digits[:4]}-{digits[4]}/{digits[5:]}"

    if len(digits) == 5:
        return f"{digits[:4]}-{digits[4]}/00"

    return None
