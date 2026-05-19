"""Constrói tabela `receita_por_pessoa` a partir do IBGE SIDRA.

Receita líquida por pessoa ocupada — segunda estimativa independente vs a
fórmula folha/razão. Mesma fonte primária (PIA/PAS/PAC) mas razão diferente:

    receita_estimada = receita_por_pessoa_PIA(cnae_4d) × headcount

Onde divergir da fórmula atual em >X%, sinal automático de baixa confiança.
Onde convergir, alta confiança real (validação cruzada).

Output: ``data/reference/receita_por_pessoa_<ano>.csv``
    cnae_2d, cnae_4d, receita_por_pessoa_brl, source_table, source_precision, ano

Uso:
    uv run python scripts/build_receita_por_pessoa.py
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from dataclasses import dataclass
from pathlib import Path

import httpx

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

SIDRA_BASE_URL = "https://apisidra.ibge.gov.br/values"
OUTPUT_DIR = Path("data/reference")
DEFAULT_ANO = 2023
REQUEST_TIMEOUT = 60.0

PIA_CNAE_PATTERN = re.compile(r"^(\d{2})\.(\d{2})(?:-\d)?(?:/\d{2})?(?:\s|$)")


@dataclass(frozen=True, slots=True)
class SidraTab:
    name: str
    tabela: int
    classif_id: int
    var_receita: int   # variável de receita (mil reais)
    var_pessoal: int   # variável de pessoal ocupado (pessoas)
    parser: str        # 'pia_4d' | 'ibge_category'


TABLES: tuple[SidraTab, ...] = (
    SidraTab("PIA_industria",  7242, 12762, 806,  0,    "pia_4d"),
    SidraTab("PIA_pessoal",    7241, 12762, 0,    631,  "pia_4d"),
    SidraTab("PAS_servicos",   2577, 12355, 643,  631,  "ibge_category"),
    SidraTab("PAC_comercio",   1418, 11070, 643,  631,  "ibge_category"),
)

# Reaproveita mapeamento de CNAE → IBGE category do script anterior.
# Importa indiretamente pra single source of truth.
sys.path.insert(0, str(Path(__file__).parent))
from build_razao_folha_receita import (  # noqa: E402
    CNAE_TO_IBGE_CATEGORY,
    cnae_secao,
    parse_pia_cnae_4d,
    parse_ibge_category,
    parse_value,
)


def build_url(tab: SidraTab, ano: int, var_id: int) -> str:
    return (
        f"{SIDRA_BASE_URL}/t/{tab.tabela}"
        f"/n1/all/v/{var_id}/p/{ano}/c{tab.classif_id}/all?formato=json"
    )


def fetch(url: str, client: httpx.Client) -> list[dict]:
    response = client.get(url, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    data = response.json()
    return data[1:] if data else []


def extract(records: list[dict], parser_name: str) -> dict[str, tuple[float, str]]:
    out: dict[str, tuple[float, str]] = {}
    for rec in records:
        d4n = rec.get("D4N", "")
        if parser_name == "pia_4d":
            code = parse_pia_cnae_4d(d4n)
        else:
            code = parse_ibge_category(d4n)
        if code is None:
            continue
        value = parse_value(rec.get("V", ""))
        if value is None:
            continue
        if code in out and parser_name == "pia_4d":
            old, desc = out[code]
            out[code] = (old + value, desc)
        else:
            out[code] = (value, d4n)
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ano", type=int, default=DEFAULT_ANO)
    args = parser.parse_args()
    ano = args.ano

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    rows: list[dict] = []

    with httpx.Client() as client:
        # ── PIA (indústria, CNAE 4d) ──────────────────────────────
        print(f"PIA 7242 var 806 (receita líquida)…", file=sys.stderr)
        rec_pia = extract(fetch(build_url(TABLES[0], ano, 806), client), "pia_4d")
        print(f"  {len(rec_pia)} códigos CNAE 4d", file=sys.stderr)

        print(f"PIA 7241 var 631 (pessoal ocupado)…", file=sys.stderr)
        pes_pia = extract(fetch(build_url(TABLES[1], ano, 631), client), "pia_4d")
        print(f"  {len(pes_pia)} códigos CNAE 4d", file=sys.stderr)

        common = set(rec_pia) & set(pes_pia)
        for code in sorted(common):
            rec_milhoes, desc = rec_pia[code]
            pes, _ = pes_pia[code]
            if pes <= 0 or rec_milhoes <= 0:
                continue
            # rec_milhoes está em mil reais, pes em pessoas
            # receita_por_pessoa em mil reais por pessoa
            rpp_milhares = rec_milhoes / pes
            rows.append({
                "cnae_2d": code[:2],
                "cnae_4d": code,
                "receita_por_pessoa_brl": round(rpp_milhares * 1000, 2),
                "source_table": "PIA_7241_7242",
                "source_precision": "alta",
                "ano": ano,
                "source_desc": desc,
            })

        # ── PAS (serviços, sub-agrupamento IBGE) ──────────────────
        print(f"PAS 2577 var 643 (receita)…", file=sys.stderr)
        rec_pas = extract(fetch(build_url(TABLES[2], ano, 643), client), "ibge_category")
        print(f"PAS 2577 var 631 (pessoal)…", file=sys.stderr)
        pes_pas = extract(fetch(build_url(TABLES[2], ano, 631), client), "ibge_category")

        print(f"PAC 1418 var 643 (receita)…", file=sys.stderr)
        rec_pac = extract(fetch(build_url(TABLES[3], ano, 643), client), "ibge_category")
        print(f"PAC 1418 var 631 (pessoal)…", file=sys.stderr)
        pes_pac = extract(fetch(build_url(TABLES[3], ano, 631), client), "ibge_category")

        # Mapeia divisões CNAE 2d que caem em PAS/PAC → herda razão do sub-agrupamento
        for cnae_2d, (source, ibge_code) in CNAE_TO_IBGE_CATEGORY.items():
            rec_map = rec_pas if source == "PAS" else rec_pac
            pes_map = pes_pas if source == "PAS" else pes_pac
            if ibge_code not in rec_map or ibge_code not in pes_map:
                continue
            rec_milhoes, desc = rec_map[ibge_code]
            pes, _ = pes_map[ibge_code]
            if pes <= 0 or rec_milhoes <= 0:
                continue
            rpp = rec_milhoes / pes * 1000  # em reais
            rows.append({
                "cnae_2d": cnae_2d,
                "cnae_4d": cnae_2d + "00",  # marca como divisão (não 4d real)
                "receita_por_pessoa_brl": round(rpp, 2),
                "source_table": f"{source}_{TABLES[2 if source=='PAS' else 3].tabela}",
                "source_precision": "media",
                "ano": ano,
                "source_desc": f"{ibge_code} {desc[:60]}",
            })

    # ── escreve CSV ───────────────────────────────────────────────
    out_path = OUTPUT_DIR / f"receita_por_pessoa_{ano}.csv"
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    # ── estatísticas ──────────────────────────────────────────────
    alta = [r for r in rows if r["source_precision"] == "alta"]
    media = [r for r in rows if r["source_precision"] == "media"]
    print(file=sys.stderr)
    print(f"=== Resumo ===", file=sys.stderr)
    print(f"Total linhas:     {len(rows)}", file=sys.stderr)
    print(f"  PIA 4d (alta):  {len(alta)}", file=sys.stderr)
    print(f"  PAS/PAC (media): {len(media)}", file=sys.stderr)
    if alta:
        vals = [r["receita_por_pessoa_brl"] for r in alta]
        print(f"Receita/pessoa PIA · p25 R$ {sorted(vals)[len(vals)//4]/1000:.0f}k · p50 {sorted(vals)[len(vals)//2]/1000:.0f}k · p75 {sorted(vals)[3*len(vals)//4]/1000:.0f}k", file=sys.stderr)
    print(f"Saída: {out_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
