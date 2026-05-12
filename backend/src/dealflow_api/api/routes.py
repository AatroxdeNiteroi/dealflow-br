"""REST endpoints — consumido pelo FRONTEND."""

from __future__ import annotations

from fastapi import APIRouter, Query

from ..data.loader import filter_domains, query_estimates

router = APIRouter(tags=["api"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/filtros")
def get_filtros() -> dict:
    return filter_domains()


@router.get("/empresas")
def list_empresas(
    uf: list[str] | None = Query(default=None),
    confidence: list[str] | None = Query(default=None),
    archetype: list[str] | None = Query(default=None),
    match_tier: str | None = None,
    receita_min_brl: float | None = None,
    receita_max_brl: float | None = None,
    headcount_min: int | None = None,
    headcount_max: int | None = None,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    items, total = query_estimates(
        uf=uf,
        confidence=confidence,
        archetype=archetype,
        match_tier=match_tier,
        receita_min_brl=receita_min_brl,
        receita_max_brl=receita_max_brl,
        headcount_min=headcount_min,
        headcount_max=headcount_max,
        search=search,
        limit=limit,
        offset=offset,
    )
    return {"items": items, "total": total, "limit": limit, "offset": offset}
