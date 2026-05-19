"""Constrói `fator_pessoal_cempre` a partir do CEMPRE (IBGE, tabela 6449).

Corrige uma inconsistência de unidade na 2ª estimativa (alavanca PIA):

  receita_por_pessoa = receita_PIA ÷ pessoal ocupado TOTAL (inclui sócios)
  receita_pia        = receita_por_pessoa × headcount (RAIS = só CLT)
                                              ↑ inconsistente

O CEMPRE distingue `pessoal ocupado total` de `pessoal ocupado
assalariado`. A razão total/assalariado por setor é o fator que aproxima
o pessoal ocupado real a partir do headcount CLT:

  pessoal_ocupado_estimado = headcount_CLT × fator_pessoal(cnae)
  receita_pia_corrigida    = receita_por_pessoa × pessoal_ocupado_estimado

Em setores low-CLT (consultoria, TI — muito sócio/PJ), o fator é alto;
em manufatura (quase tudo CLT), o fator é ~1,0.

⚠️ CEMPRE série encerrada em 2021. A razão total/assalariado é
estrutural (composição da força de trabalho do setor) — muda devagar,
defasagem de 5 anos é aceitável para um fator de correção.

Output: data/reference/fator_pessoal_cempre_2021.csv
    cnae_2d, cnae_4d, pessoal_total, pessoal_assalariado, fator_pessoal, ano

Uso:
    uv run python scripts/build_fator_pessoal_cempre.py
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

import httpx

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

sys.path.insert(0, str(Path(__file__).parent))
from build_razao_folha_receita import parse_pia_cnae_4d, parse_value  # noqa: E402

SIDRA_BASE = "https://apisidra.ibge.gov.br/values"
OUTPUT_DIR = Path("data/reference")
ANO = 2021  # último ano do CEMPRE (série encerrada)
TABELA = 6449
CLASSIF = 12762  # CNAE 2.0
VAR_TOTAL = 707
VAR_ASSALARIADO = 708


def fetch(var_id: int, client: httpx.Client) -> dict[str, float]:
    """Retorna {cnae_4d: valor} para uma variável da tabela 6449."""
    url = (
        f"{SIDRA_BASE}/t/{TABELA}/n1/all/v/{var_id}"
        f"/p/{ANO}/c{CLASSIF}/all?formato=json"
    )
    resp = client.get(url, timeout=90.0)
    resp.raise_for_status()
    records = resp.json()[1:]  # primeira linha é cabeçalho
    out: dict[str, float] = {}
    for rec in records:
        code = parse_pia_cnae_4d(rec.get("D4N", ""))
        if code is None:
            continue
        value = parse_value(rec.get("V", ""))
        if value is None:
            continue
        # múltiplas subclasses por classe 4d — soma
        out[code] = out.get(code, 0.0) + value
    return out


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with httpx.Client() as client:
        print(f"CEMPRE 6449 var {VAR_TOTAL} (pessoal ocupado total)…", file=sys.stderr)
        total = fetch(VAR_TOTAL, client)
        print(f"  {len(total)} códigos CNAE 4d", file=sys.stderr)

        print(f"CEMPRE 6449 var {VAR_ASSALARIADO} (pessoal assalariado)…", file=sys.stderr)
        assal = fetch(VAR_ASSALARIADO, client)
        print(f"  {len(assal)} códigos CNAE 4d", file=sys.stderr)

    rows = []
    for code in sorted(set(total) & set(assal)):
        t = total[code]
        a = assal[code]
        if a <= 0 or t <= 0:
            continue
        fator = t / a
        # sanity: fator entre 1.0 (tudo CLT) e ~5.0 (extremo de sócios/PJ)
        if not (1.0 <= fator <= 5.0):
            fator = max(1.0, min(fator, 5.0))
        rows.append({
            "cnae_2d": code[:2],
            "cnae_4d": code,
            "pessoal_total": int(t),
            "pessoal_assalariado": int(a),
            "fator_pessoal": round(fator, 4),
            "ano": ANO,
        })

    out_path = OUTPUT_DIR / f"fator_pessoal_cempre_{ANO}.csv"
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    fatores = sorted(r["fator_pessoal"] for r in rows)
    n = len(fatores)
    print(file=sys.stderr)
    print(f"=== Resumo ===", file=sys.stderr)
    print(f"Linhas (CNAE 4d): {n}", file=sys.stderr)
    print(f"Fator pessoal · p25 {fatores[n//4]:.2f} · "
          f"p50 {fatores[n//2]:.2f} · p75 {fatores[3*n//4]:.2f} · "
          f"max {fatores[-1]:.2f}", file=sys.stderr)
    print(f"Saída: {out_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
