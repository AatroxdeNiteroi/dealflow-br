"""Consulta de protestos em cartório (CENPROT/IEPTB) — on-demand, por CNPJ.

Diferente dos outros sinais de risco (PGFN, Datajud, Querido Diário), a
base de protestos NÃO tem API pública livre:

  • `api.cenprotnacional.org.br` fica atrás de WAF (403 em todo path);
  • o fluxo web exige reCAPTCHA + login GOV.BR para o detalhe per-CNPJ.

Por isso a consulta é unitária (não-batch) e passa por um provedor
homologado (Infosimples / Direct Data), que resolve captcha+login e
devolve JSON normalizado de todas as UFs. Custo por consulta nova
(~R$ 0,01–0,10), com cache no backend pra não pagar 2× o mesmo CNPJ.

Este script é um wrapper de linha de comando sobre a mesma função usada
pelo endpoint `GET /api/v1/empresas/{cnpj}/protestos`
(`dealflow_api.data.protestos.get_protestos`), útil pra debugar/testar a
configuração do provedor sem subir a API.

Config (env ou backend/.env):
    DEALFLOW_PROTESTOS_PROVIDER = none | infosimples | directd
    DEALFLOW_PROTESTOS_API_TOKEN = <token do provedor>

Uso:
    uv run python scripts/consulta_cenprot.py 49058654000165
    uv run python scripts/consulta_cenprot.py 49.058.654/0001-65 --json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Permite rodar o script sem instalar o pacote: adiciona backend/src ao path.
_BACKEND_SRC = Path(__file__).resolve().parents[1] / "backend" / "src"
if _BACKEND_SRC.exists() and str(_BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(_BACKEND_SRC))


def _fmt_brl(v: float) -> str:
    s = f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {s}"


def main() -> int:
    ap = argparse.ArgumentParser(description="Consulta protestos (CENPROT/IEPTB) por CNPJ.")
    ap.add_argument("cnpj", help="CNPJ (com ou sem máscara)")
    ap.add_argument("--json", action="store_true", help="imprime o payload bruto em JSON")
    args = ap.parse_args()

    try:
        from dealflow_api.data.protestos import get_protestos
    except ImportError as exc:  # pragma: no cover - ambiente sem deps
        print(f"erro: não consegui importar o backend ({exc}).", file=sys.stderr)
        print("Rode com: uv run python scripts/consulta_cenprot.py <cnpj>", file=sys.stderr)
        return 2

    cnpj = "".join(ch for ch in args.cnpj if ch.isdigit()).zfill(14)
    res = get_protestos(cnpj)

    if args.json:
        print(json.dumps(res, ensure_ascii=False, indent=2))
        return 0

    print(f"CNPJ: {cnpj}")
    print(f"Provedor: {res.get('provedor')}  ·  fonte: {res.get('fonte')}")
    if not res.get("disponivel"):
        print(f"Indisponível: {res.get('mensagem')}")
        return 0
    if not res.get("tem_protesto"):
        print("✔ Sem protestos registrados.")
        return 0

    print(
        f"⚠ {res['n_protestos']} protesto(s) · {_fmt_brl(res['valor_total_brl'])}"
        f" · UFs: {', '.join(res.get('ufs') or []) or '—'}"
    )
    for c in res.get("cartorios", []):
        loc = " / ".join(x for x in (c.get("cidade"), c.get("uf")) if x)
        print(f"  · {c.get('cartorio') or 'cartório'} [{loc}] "
              f"{c.get('n_protestos', 0)}× {_fmt_brl(c.get('valor_brl', 0))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
