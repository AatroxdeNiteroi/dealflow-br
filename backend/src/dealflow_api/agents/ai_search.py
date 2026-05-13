"""AI Search · traduz prompt em linguagem natural para QueryParams via Claude.

Uso esperado:
    >>> from dealflow_api.agents.ai_search import translate_prompt_to_params
    >>> r = translate_prompt_to_params("indústrias em SP com 50-100 funcs")
    >>> r["params"]
    {"uf": ["SP"], "cnae_secao": ["C"], "headcount_min": 50, "headcount_max": 100}

Premissas:
- Pequeno o suficiente para Haiku 4.5 (latência baixa, custo trivial).
- Tool-use FORÇADO com schema rígido — modelo só pode responder via tool.
- Cache LRU por prompt (~100 entradas) — mesmo prompt = zero custo extra.
- Nunca inventa filtro: campos ausentes do prompt ficam None.
"""

from __future__ import annotations

from functools import lru_cache

from ..settings import settings


# Schema da tool — espelha QueryParams com descrição explícita por campo.
# Mantemos sincronizado com frontend/src/api/client.ts QueryParams.
TOOL_SCHEMA = {
    "name": "aplicar_filtros",
    "description": (
        "Aplica filtros sobre o universo DealFlow BR (Ltdas matriz em RJ/SP, "
        "receita ≤ R$250M). Use APENAS para campos explicitamente mencionados "
        "no prompt do usuário; deixe os demais como null. Não invente filtros."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "uf": {
                "type": ["array", "null"],
                "items": {"type": "string", "enum": ["RJ", "SP"]},
                "description": "Estados. Cobertura: RJ e SP apenas."
            },
            "cnae_secao": {
                "type": ["array", "null"],
                "items": {
                    "type": "string",
                    "enum": [
                        "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
                        "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U"
                    ],
                },
                "description": (
                    "Seções CNAE. A=Agro · B=Extrativa · C=Indústria · "
                    "D=Energia · E=Água · F=Construção · G=Comércio · "
                    "H=Transporte · I=Aloj/Alim · J=TI/Telecom · K=Financeiro · "
                    "L=Imobiliário · M=Profissional · N=Admin · O=Adm.Públ · "
                    "P=Educação · Q=Saúde · R=Cultura · S=Serviços · "
                    "T=Doméstico · U=Org.Int."
                ),
            },
            "archetype": {
                "type": ["array", "null"],
                "items": {
                    "type": "string",
                    "enum": [
                        "family_mature_sweet_spot",
                        "labor_intensive_midcap",
                        "capital_intensive",
                        "holding_structure",
                        "partnership_heavy_services",
                        "recent_startup",
                        "financeiro_out_scope",
                        "standard",
                    ],
                },
                "description": (
                    "Perfil estrutural. family_mature_sweet_spot=sucessão familiar "
                    "(2-4 sócios PF, idade ≥10a, 20-200 funcs). "
                    "labor_intensive_midcap=mão de obra intensiva. "
                    "capital_intensive=indústria pesada. "
                    "holding_structure=holdings com sócio PJ. "
                    "partnership_heavy_services=serviços profissionais. "
                    "recent_startup=<3 anos. "
                    "financeiro_out_scope=CNAE K (fora do escopo)."
                ),
            },
            "confidence": {
                "type": ["array", "null"],
                "items": {"type": "string", "enum": ["alta", "media", "baixa", "sem_benchmark"]},
                "description": "Nível de confiança da estimativa.",
            },
            "receita_min_brl": {
                "type": ["number", "null"],
                "description": "Receita estimada mínima em R$ (anual).",
            },
            "receita_max_brl": {
                "type": ["number", "null"],
                "description": "Receita estimada máxima em R$ (anual).",
            },
            "headcount_min": {
                "type": ["integer", "null"],
                "description": "Mínimo de vínculos ativos CLT.",
            },
            "headcount_max": {
                "type": ["integer", "null"],
                "description": "Máximo de vínculos ativos CLT.",
            },
            "idade_min": {
                "type": ["integer", "null"],
                "description": "Idade mínima da empresa em anos desde a abertura.",
            },
            "idade_max": {
                "type": ["integer", "null"],
                "description": "Idade máxima da empresa em anos.",
            },
            "capital_min_brl": {
                "type": ["number", "null"],
                "description": "Capital social mínimo em R$.",
            },
            "capital_max_brl": {
                "type": ["number", "null"],
                "description": "Capital social máximo em R$.",
            },
            "n_socios_min": {
                "type": ["integer", "null"],
                "description": "Mínimo total de sócios (PF + PJ).",
            },
            "n_socios_max": {
                "type": ["integer", "null"],
                "description": "Máximo total de sócios.",
            },
            "n_socios_pj_min": {
                "type": ["integer", "null"],
                "description": "Mínimo de sócios pessoa jurídica (>0 sinaliza holding/grupo).",
            },
            "search": {
                "type": ["string", "null"],
                "description": (
                    "Busca textual em razão social ou CNPJ. Use APENAS quando o "
                    "usuário mencionar um nome específico de empresa ou CNPJ. "
                    "NÃO use para descrever setor (use cnae_secao) nem perfil."
                ),
            },
            "explain": {
                "type": "string",
                "description": (
                    "Frase curta em pt-BR explicando ao usuário como você "
                    "interpretou o prompt. Ex: 'Buscando indústrias (CNAE C) "
                    "em SP com 50–100 vínculos ativos.'"
                ),
            },
            "warnings": {
                "type": ["array", "null"],
                "items": {"type": "string"},
                "description": (
                    "Avisos quando o prompt menciona algo que NÃO é traduzível "
                    "em filtros disponíveis. Ex: 'EBITDA não está disponível.' "
                    "Deixe null se não houver aviso."
                ),
            },
        },
        "required": ["explain"],
    },
}

SYSTEM_PROMPT = """Você é um agente de tradução de prompts para o DealFlow BR — produto de inteligência M&A para empresas Ltda. médias em RJ/SP.

Sua tarefa: receber um prompt em linguagem natural (português) e traduzi-lo em filtros estruturados via a tool `aplicar_filtros`.

Regras críticas:
1. NUNCA invente filtros que o usuário não mencionou. Se ele disse só "fabricantes em SP", você aplica cnae_secao=["C"] e uf=["SP"], DEIXANDO TUDO O MAIS NULL.
2. Use seu conhecimento de CNAE para mapear setores. "Fabricantes/indústria/manufatura" → C. "Logística/transporte" → H. "Software/TI" → J. "Comércio/varejo" → G. "Construção/empreiteira" → F. "Restaurantes/hotéis" → I. "Consultoria/advocacia/engenharia" → M.
3. Para receita: o produto cobre até R$250M. Faixas comuns: "mid-market"=25M-250M; "small/sweet spot"=5M-50M; "early-stage"=<5M.
4. "Sucessão familiar" / "dono próximo da aposentadoria" / "empresa madura familiar" → archetype=["family_mature_sweet_spot"].
5. "Grupo empresarial" / "holding" → n_socios_pj_min=1.
6. "Empresa estabelecida" → idade_min=10. "Startup/recém-criada" → idade_max=5.
7. Se o usuário pede algo NÃO traduzível (EBITDA, dívida, lucro, faturamento auditado, número de clientes, presença internacional), adicione um aviso no campo `warnings`.
8. `search` é APENAS para nomes próprios de empresa ou CNPJ. NUNCA para descrever setor.
9. O campo `explain` deve sempre estar presente, em uma frase curta em pt-BR.
10. SEMPRE chame a tool `aplicar_filtros` — nunca responda em texto livre."""


def _build_params_dict(tool_input: dict) -> tuple[dict, str, list[str]]:
    """Extrai params puros (sem explain/warnings) + explain + warnings."""
    explain = tool_input.pop("explain", "")
    warnings = tool_input.pop("warnings", None) or []
    # Remove nulls — frontend ignora keys ausentes
    params = {k: v for k, v in tool_input.items() if v is not None and v != []}
    return params, explain, warnings


@lru_cache(maxsize=128)
def _cached_translate(prompt: str) -> tuple[dict, str, tuple[str, ...]]:
    """Cache puro por prompt — retorna tuple imutável para hash."""
    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    msg = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=512,
        system=SYSTEM_PROMPT,
        tools=[TOOL_SCHEMA],
        tool_choice={"type": "tool", "name": "aplicar_filtros"},
        messages=[{"role": "user", "content": prompt}],
    )
    tool_use = next((b for b in msg.content if b.type == "tool_use"), None)
    if tool_use is None:
        raise RuntimeError("Claude não retornou tool_use — fluxo inesperado.")
    params, explain, warnings = _build_params_dict(dict(tool_use.input))
    return params, explain, tuple(warnings)


def translate_prompt_to_params(prompt: str) -> dict:
    """Retorna {'params': QueryParams, 'explain': str, 'warnings': list[str]}."""
    params, explain, warnings = _cached_translate(prompt.strip())
    return {
        "params": params,
        "explain": explain,
        "warnings": list(warnings),
    }
