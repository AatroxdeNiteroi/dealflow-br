"""REST endpoints — consumido pelo FRONTEND."""

from __future__ import annotations

from fastapi import APIRouter, Query

from ..data.loader import filter_domains, market_stats, query_estimates, top_empresas

router = APIRouter(tags=["api"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/filtros")
def get_filtros() -> dict:
    return filter_domains()


@router.get("/stats")
def get_stats() -> dict:
    return market_stats()


@router.get("/empresas/top")
def get_top(n: int = 20) -> dict:
    return {"items": top_empresas(n=min(max(n, 1), 100))}


@router.get("/empresas")
def list_empresas(
    uf: list[str] | None = Query(default=None),
    confidence: list[str] | None = Query(default=None),
    archetype: list[str] | None = Query(default=None),
    cnae_secao: list[str] | None = Query(default=None),
    razao_precision: list[str] | None = Query(default=None),
    match_tier: str | None = None,
    receita_min_brl: float | None = None,
    receita_max_brl: float | None = None,
    headcount_min: int | None = None,
    headcount_max: int | None = None,
    idade_min: int | None = None,
    idade_max: int | None = None,
    capital_min_brl: float | None = None,
    capital_max_brl: float | None = None,
    n_socios_min: int | None = None,
    n_socios_max: int | None = None,
    n_socios_pj_min: int | None = None,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    items, total = query_estimates(
        uf=uf,
        confidence=confidence,
        archetype=archetype,
        cnae_secao=cnae_secao,
        razao_precision=razao_precision,
        match_tier=match_tier,
        receita_min_brl=receita_min_brl,
        receita_max_brl=receita_max_brl,
        headcount_min=headcount_min,
        headcount_max=headcount_max,
        idade_min=idade_min,
        idade_max=idade_max,
        capital_min_brl=capital_min_brl,
        capital_max_brl=capital_max_brl,
        n_socios_min=n_socios_min,
        n_socios_max=n_socios_max,
        n_socios_pj_min=n_socios_pj_min,
        search=search,
        limit=limit,
        offset=offset,
    )
    return {"items": items, "total": total, "limit": limit, "offset": offset}
