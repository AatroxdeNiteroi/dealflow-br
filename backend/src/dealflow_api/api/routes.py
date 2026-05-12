"""REST endpoints — consumido pelo FRONTEND."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["api"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/empresas")
def list_empresas(
    uf: str | None = None,
    confidence: str | None = None,
    receita_min_brl: float | None = None,
    receita_max_brl: float | None = None,
    archetype: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    """Lista empresas filtradas. TODO: integrar com data/loader.py."""
    return {"items": [], "total": 0, "limit": limit, "offset": offset}


@router.get("/filtros")
def get_filtros() -> dict:
    """Devolve domínios disponíveis pra UI popular dropdowns."""
    return {
        "ufs": ["RJ", "SP"],
        "confidences": ["alta", "media", "baixa", "sem_benchmark"],
        "archetypes": [],
        "tiers": ["Tier 1", "Tier 2"],
    }
