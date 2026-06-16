"""Protestos em cartório · consulta on-demand (CENPROT/IEPTB).

Diferente de PGFN / Datajud / Querido Diário — que têm API pública e
gratuita — a base nacional de protestos (CENPROT) **não** expõe um
caminho programático livre:

  • `api.cenprotnacional.org.br` fica atrás de WAF (403 em todo path);
  • o fluxo web exige reCAPTCHA + login GOV.BR para o detalhe per-CNPJ.

O caminho sustentável é uma **API homologada** (Infosimples / Direct
Data), que resolve captcha+login e devolve JSON normalizado de todas as
UFs, com custo por consulta (~R$ 0,01–0,10). Centralizamos isso atrás de
uma abstração de *provider* escolhida por env:

  DEALFLOW_PROTESTOS_PROVIDER = none | infosimples | directd
  DEALFLOW_PROTESTOS_API_TOKEN = <token do provedor>

Sem provedor configurado (default `none`), o serviço degrada como o resto
do produto: sempre 200, `disponivel: false`, com mensagem explicando que
a consulta é sob demanda. Com token, devolve dados reais cacheados no
processo (`lru_cache`) para não pagar 2× o mesmo CNPJ.
"""

from __future__ import annotations

import json as _json
import os as _os
from functools import lru_cache
from urllib import error as _urlerror
from urllib import parse as _urlparse
from urllib import request as _urlrequest

_INFOSIMPLES_URL = "https://api.infosimples.com/api/v2/consultas/ieptb/protestos"
_DIRECTD_URL = "https://apiv3.directd.com.br/api/Protestos"
_TIMEOUT_S = 25  # consultas de protesto resolvem captcha no provedor → mais lento


def _so_digitos(cnpj: str) -> str:
    return "".join(ch for ch in cnpj if ch.isdigit()).zfill(14)


def _indisponivel(cnpj: str, mensagem: str, *, provedor: str = "none", erro: bool = False) -> dict:
    """Payload padrão de 'não consultado' — o frontend mostra estado neutro."""
    return {
        "cnpj": cnpj,
        "disponivel": False,
        "consultado": False,
        "tem_protesto": False,
        "n_protestos": 0,
        "valor_total_brl": 0.0,
        "cartorios": [],
        "ufs": [],
        "provedor": provedor,
        "fonte": "CENPROT/IEPTB",
        "erro": erro,
        "mensagem": mensagem,
    }


def _post_json(url: str, payload: dict, *, timeout: int = _TIMEOUT_S) -> dict:
    data = _urlparse.urlencode(payload).encode("utf-8")
    req = _urlrequest.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "User-Agent": "GenesisRadar/0.2 (+contato@genesislabs.com.br)",
        },
        method="POST",
    )
    with _urlrequest.urlopen(req, timeout=timeout) as r:
        return _json.loads(r.read().decode("utf-8"))


def _to_float(v: object) -> float:
    """Converte 'R$ 1.234,56' / '1234.56' / número → float, tolerante."""
    if isinstance(v, (int, float)):
        return float(v)
    if not isinstance(v, str) or not v.strip():
        return 0.0
    s = v.strip().replace("R$", "").replace(" ", "")
    # formato BR "1.234,56" → "1234.56"
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


# ── Provider: Infosimples ─────────────────────────────────────────────


def _consulta_infosimples(cnpj: str, token: str) -> dict:
    """Consulta IEPTB/protestos via Infosimples (homologada CENPROT).

    Resposta esperada: {"code": 200, "data": [ {...cartorios...} ], ...}.
    Parsing defensivo: campos variam por cartório, então só somamos o que
    reconhecemos e nunca quebramos.
    """
    payload = {"token": token, "cnpj": _so_digitos(cnpj), "timeout": _TIMEOUT_S}
    try:
        body = _post_json(_INFOSIMPLES_URL, payload)
    except (_urlerror.URLError, TimeoutError, ValueError, OSError):
        return _indisponivel(
            cnpj,
            "Consulta de protestos temporariamente indisponível (timeout/erro do provedor).",
            provedor="infosimples",
            erro=True,
        )

    code = body.get("code")
    if code != 200:
        msg = body.get("code_message") or "Provedor recusou a consulta."
        return _indisponivel(cnpj, f"Protestos: {msg}", provedor="infosimples", erro=True)

    registros = body.get("data") or []
    cartorios: list[dict] = []
    n_total = 0
    valor_total = 0.0
    ufs: set[str] = set()

    for reg in registros:
        # cada `reg` costuma trazer uma lista de cartórios/protestos
        lista = reg.get("cartorios") or reg.get("protestos") or [reg]
        for c in lista:
            if not isinstance(c, dict):
                continue
            uf = (c.get("uf") or c.get("estado") or reg.get("uf") or "").upper()[:2]
            n = c.get("quantidade_protestos") or c.get("quantidade") or c.get("qtd") or 0
            try:
                n = int(n)
            except (TypeError, ValueError):
                n = 0
            valor = _to_float(c.get("valor_protestado") or c.get("valor") or c.get("valor_total"))
            cartorios.append(
                {
                    "uf": uf or None,
                    "cidade": c.get("cidade") or c.get("municipio"),
                    "cartorio": c.get("cartorio") or c.get("nome") or c.get("nome_cartorio"),
                    "n_protestos": n,
                    "valor_brl": valor,
                }
            )
            n_total += n
            valor_total += valor
            if uf:
                ufs.add(uf)

    # quando o provedor confirma 0 protestos, ainda assim foi consultado
    return {
        "cnpj": cnpj,
        "disponivel": True,
        "consultado": True,
        "tem_protesto": n_total > 0 or len(cartorios) > 0,
        "n_protestos": n_total,
        "valor_total_brl": round(valor_total, 2),
        "cartorios": cartorios[:20],
        "ufs": sorted(ufs),
        "provedor": "infosimples",
        "fonte": "CENPROT/IEPTB · via Infosimples (homologada)",
        "erro": False,
        "mensagem": None,
    }


# ── Provider: Direct Data ─────────────────────────────────────────────


def _consulta_directd(cnpj: str, token: str) -> dict:
    """Consulta Protestos via Direct Data (homologada CENPROT).

    Mantida defensiva — a resposta da Direct Data difere da Infosimples;
    normalizamos para o mesmo schema.
    """
    url = f"{_DIRECTD_URL}?token={_urlparse.quote(token)}&cnpj={_so_digitos(cnpj)}"
    req = _urlrequest.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": "GenesisRadar/0.2"},
    )
    try:
        with _urlrequest.urlopen(req, timeout=_TIMEOUT_S) as r:
            body = _json.loads(r.read().decode("utf-8"))
    except (_urlerror.URLError, TimeoutError, ValueError, OSError):
        return _indisponivel(
            cnpj,
            "Consulta de protestos temporariamente indisponível (timeout/erro do provedor).",
            provedor="directd",
            erro=True,
        )

    ret = body.get("retorno") or body.get("data") or body
    cartorios_raw = ret.get("cartorios") or ret.get("protestos") or []
    cartorios: list[dict] = []
    n_total = 0
    valor_total = 0.0
    ufs: set[str] = set()
    for c in cartorios_raw:
        if not isinstance(c, dict):
            continue
        uf = (c.get("uf") or c.get("estado") or "").upper()[:2]
        n = c.get("quantidadeProtestos") or c.get("quantidade") or 0
        try:
            n = int(n)
        except (TypeError, ValueError):
            n = 0
        valor = _to_float(c.get("valorProtestado") or c.get("valor"))
        cartorios.append(
            {
                "uf": uf or None,
                "cidade": c.get("cidade") or c.get("municipio"),
                "cartorio": c.get("nomeCartorio") or c.get("cartorio"),
                "n_protestos": n,
                "valor_brl": valor,
            }
        )
        n_total += n
        valor_total += valor
        if uf:
            ufs.add(uf)

    return {
        "cnpj": cnpj,
        "disponivel": True,
        "consultado": True,
        "tem_protesto": n_total > 0 or len(cartorios) > 0,
        "n_protestos": n_total,
        "valor_total_brl": round(valor_total, 2),
        "cartorios": cartorios[:20],
        "ufs": sorted(ufs),
        "provedor": "directd",
        "fonte": "CENPROT/IEPTB · via Direct Data (homologada)",
        "erro": False,
        "mensagem": None,
    }


# ── Dispatcher público ────────────────────────────────────────────────


def _resolve_config() -> tuple[str, str | None]:
    """(provider, token). Usa as Settings do backend quando disponíveis
    (carrega backend/.env); cai para os.environ se rodando fora do venv
    do backend (ex.: o CLI scripts/consulta_cenprot.py no venv raiz)."""
    try:
        from ..settings import settings

        return (settings.protestos_provider or "none"), settings.protestos_api_token
    except Exception:
        return (
            _os.environ.get("DEALFLOW_PROTESTOS_PROVIDER", "none"),
            _os.environ.get("DEALFLOW_PROTESTOS_API_TOKEN"),
        )


@lru_cache(maxsize=4096)
def get_protestos(cnpj: str) -> dict:
    """Consulta on-demand de protestos, cacheada no processo.

    Sempre devolve dict; nunca levanta. Escolhe o provedor por
    `settings.protestos_provider` (ou env). Sem provedor/token → estado
    neutro `disponivel: false` (degrada como no resto da stack)."""
    provider_raw, token = _resolve_config()
    provider = (provider_raw or "none").strip().lower()

    if provider in ("", "none", "off", "disabled"):
        return _indisponivel(
            cnpj,
            "Monitoramos protestos sob demanda. Configure um provedor homologado "
            "(DEALFLOW_PROTESTOS_PROVIDER + DEALFLOW_PROTESTOS_API_TOKEN) para ativar a consulta ao vivo.",
        )

    if not token:
        return _indisponivel(
            cnpj,
            f"Provedor '{provider}' selecionado, mas DEALFLOW_PROTESTOS_API_TOKEN não foi definido.",
            provedor=provider,
        )

    if provider == "infosimples":
        return _consulta_infosimples(cnpj, token)
    if provider in ("directd", "direct_data", "directdata"):
        return _consulta_directd(cnpj, token)

    return _indisponivel(
        cnpj,
        f"Provedor de protestos desconhecido: '{provider}'. Use 'infosimples' ou 'directd'.",
        provedor=provider,
        erro=True,
    )
