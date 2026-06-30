"""REST endpoints — consumido pelo FRONTEND."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..data.loader import (
    filter_domains,
    get_contato,
    get_contexto_da_empresa,
    get_contexto_uf,
    get_divida_ativa,
    get_empresas_do_socio,
    get_history,
    get_qd_mencoes,
    get_socios_da_empresa,
    market_stats,
    query_estimates,
    top_empresas,
)

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
    # Clamp defensivo: sem isto, ?limit=99999999 serializa o universo inteiro
    # (exfiltração do dataset) e estoura memória/CPU num único request.
    limit = min(max(limit, 1), 200)
    offset = max(offset, 0)
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


# ── Histórico headcount ─────────────────────────────────────────────


@router.get("/empresas/{cnpj}/history")
def empresa_history(cnpj: str) -> dict:
    """Série temporal de headcount (ano · vínculos ativos)."""
    return {"cnpj": cnpj, "points": get_history(cnpj)}


# ── Contato oficial ─────────────────────────────────────────────────


@router.get("/empresas/{cnpj}/contato")
def empresa_contato(cnpj: str) -> dict:
    """Endereço, telefones, email do registro oficial.

    Caveat: telefone/email frequentemente desatualizados ou do contador.
    O frontend exibe aviso ao usuário.
    """
    data = get_contato(cnpj)
    if data is None:
        raise HTTPException(status_code=404, detail="contato não encontrado")
    return data


# ── Mapa de grupo · sócios ──────────────────────────────────────────


@router.get("/empresas/{cnpj}/socios")
def empresa_socios(cnpj: str) -> dict:
    return {"cnpj": cnpj, "socios": get_socios_da_empresa(cnpj)}


@router.get("/empresas/{cnpj}/divida_ativa")
def empresa_divida_ativa(cnpj: str) -> dict:
    """Sinal de dívida ativa federal (PGFN). 200 sempre — quando a
    empresa não deve, retorna um payload "limpo" para o frontend
    poder mostrar bandeira verde sem precisar tratar 404."""
    data = get_divida_ativa(cnpj)
    if data is None:
        return {"cnpj": cnpj, "tem_divida": False}
    return {"cnpj": cnpj, "tem_divida": True, **data}


@router.get("/empresas/{cnpj}/risco_contexto")
def empresa_risco_contexto(cnpj: str) -> dict:
    """Contexto regional de risco (Datajud): volume de RJ + Falência
    na UF da empresa, janela atual vs anterior. Sempre 200."""
    ctx = get_contexto_da_empresa(cnpj)
    if ctx is None:
        return {"cnpj": cnpj, "disponivel": False}
    return {"cnpj": cnpj, "disponivel": True, **ctx}


@router.get("/risco/uf/{uf}")
def risco_por_uf(uf: str) -> dict:
    """Contexto Datajud para uma UF arbitrária — útil para widgets
    de dashboard e para a landing."""
    ctx = get_contexto_uf(uf.upper())
    if ctx is None:
        raise HTTPException(status_code=404, detail=f"UF {uf} sem dados Datajud")
    return ctx


@router.get("/empresas/{cnpj}/diario_oficial")
def empresa_diario_oficial(cnpj: str) -> dict:
    """Menções a este CNPJ em Diários Oficiais municipais (Querido
    Diário). Estratégia: usa o parquet pre-cacheado se disponível,
    senão consulta a API live (com cache de processo). Sempre 200."""
    from ..data.loader import get_qd_live  # late import: evita circular

    cached = get_qd_mencoes(cnpj)
    if cached is not None:
        return {"cnpj": cnpj, "disponivel": True, "origem": "cache", **cached}

    # fallback live
    live = get_qd_live(cnpj)
    return {
        "cnpj": cnpj,
        "disponivel": True,
        "origem": "live",
        **live,
    }


@router.get("/empresas/{cnpj}/protestos")
def empresa_protestos(cnpj: str) -> dict:
    """Protestos em cartório (CENPROT/IEPTB), consulta on-demand.

    A base de protestos não tem API pública livre, então usamos um
    provedor homologado por consulta (ver data/protestos.py). Sem
    provedor configurado, devolve disponivel:false — sempre 200, para
    o frontend renderizar o painel em estado neutro sem tratar erro."""
    from ..data.protestos import get_protestos  # late import: lazy/optional

    return get_protestos(cnpj)


@router.get("/socios/{socio_key}/empresas")
def socio_empresas(socio_key: str) -> dict:
    return {"socio_key": socio_key, "empresas": get_empresas_do_socio(socio_key)}


# ── AI Search · busca em linguagem natural ──────────────────────────


@router.post("/search/ai")
def search_ai(payload: dict) -> dict:
    """Traduz prompt em linguagem natural → QueryParams via Claude.

    Sem ANTHROPIC_API_KEY no env, retorna 503 com mensagem amigável.
    """
    from ..settings import settings

    prompt = (payload.get("prompt") or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt vazio")
    if len(prompt) > 1000:
        raise HTTPException(status_code=400, detail="prompt > 1000 chars")

    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=503,
            detail="AI Search indisponível: defina DEALFLOW_ANTHROPIC_API_KEY ou ANTHROPIC_API_KEY no .env do backend.",
        )

    from ..agents.ai_search import translate_prompt_to_params

    try:
        result = translate_prompt_to_params(prompt)
    except Exception as exc:  # noqa: BLE001
        msg = str(exc)
        # Mensagens amigáveis para erros comuns do provedor
        if "credit balance is too low" in msg.lower():
            raise HTTPException(
                status_code=402,
                detail="Sem créditos na conta Anthropic. Adicione fundos em console.anthropic.com/settings/billing e tente novamente.",
            ) from exc
        if "invalid x-api-key" in msg.lower() or "authentication" in msg.lower():
            raise HTTPException(
                status_code=401,
                detail="API key inválida ou expirada. Verifique DEALFLOW_ANTHROPIC_API_KEY no .env.",
            ) from exc
        if "rate_limit" in msg.lower() or "429" in msg:
            raise HTTPException(
                status_code=429,
                detail="Rate limit do provedor IA atingido. Aguarde alguns segundos e tente novamente.",
            ) from exc
        raise HTTPException(status_code=502, detail=f"Falha no provedor IA: {msg}") from exc

    return result
