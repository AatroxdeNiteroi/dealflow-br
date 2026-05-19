"""Cruza ground-truths ativos (active_validation_v1.json) com Tier 1 do parquet.

Match por:
  1. CNPJ exato (quando o scraper conseguiu extrair)
  2. Nome fuzzy (substring normalizada do nome do alvo)

Emite tabela NOME — % de desvio onde a empresa estava no Tier 1 e tinha
estimativa do motor.
"""

from __future__ import annotations

import json
import sys
import unicodedata
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import polars as pl

REPO = Path(__file__).resolve().parents[2]
GT_PATH = REPO / "data" / "active_validation_v1.json"
PARQUET = REPO / "data" / "estimates_final.parquet"


def _norm(s: str) -> str:
    if not s:
        return ""
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).upper().strip()


def _digits(s: str) -> str:
    return "".join(c for c in s if c.isdigit())


def main() -> int:
    if not GT_PATH.exists():
        print(f"FALTA: {GT_PATH}", file=sys.stderr)
        return 1
    if not PARQUET.exists():
        print(f"FALTA: {PARQUET}", file=sys.stderr)
        return 1

    gts = json.loads(GT_PATH.read_text(encoding="utf-8"))
    df = pl.read_parquet(PARQUET)
    print(f"Parquet bruto: {df.height:,}", file=sys.stderr)
    print(f"Ground-truths ativos: {len(gts)}", file=sys.stderr)
    print(file=sys.stderr)

    # Adiciona colunas normalizadas pra match
    df = df.with_columns([
        pl.col("razao_social").map_elements(_norm, return_dtype=pl.Utf8).alias("_n"),
        pl.col("cnpj").map_elements(_digits, return_dtype=pl.Utf8).alias("_cnpj_d"),
    ])

    matched = []
    no_match = []

    for gt in gts:
        nome_alvo = gt.get("nome_alvo") or ""
        cnpj_alvo = gt.get("cnpj_alvo") or ""
        receita_ref = gt.get("receita_brl")

        hit = None
        match_via = None

        # 1. Match por CNPJ exato
        if cnpj_alvo:
            cnpj_d = _digits(cnpj_alvo)
            sub = df.filter(pl.col("_cnpj_d") == cnpj_d)
            if sub.height == 1:
                hit = sub.to_dicts()[0]
                match_via = f"CNPJ {cnpj_alvo}"

        # 2. Match por nome fuzzy (substring)
        if hit is None and nome_alvo:
            # Pega palavras significantes do nome
            nome_n = _norm(nome_alvo)
            # remove sufixos societários pra match mais amplo
            for suf in (" LTDA", " S.A.", " S/A", " SA", " EIRELI"):
                nome_n = nome_n.replace(suf, "")
            nome_n = nome_n.strip()
            if len(nome_n) >= 5:
                sub = df.filter(pl.col("_n").str.contains(nome_n, literal=True))
                if sub.height >= 1:
                    # pega o de maior receita estimada (mesmo critério do validador)
                    hit = sub.sort("receita_point_brl", descending=True, nulls_last=True).head(1).to_dicts()[0]
                    match_via = f"nome ~ '{nome_n[:30]}'"

        if hit and receita_ref and hit.get("receita_point_brl"):
            est = float(hit["receita_point_brl"])
            desv = (est - receita_ref) / receita_ref * 100
            matched.append({
                "nome_matched": hit["razao_social"],
                "nome_alvo": nome_alvo,
                "cnpj_matched": hit["cnpj"],
                "receita_real": receita_ref,
                "receita_estimada": est,
                "desvio_pct": desv,
                "match_via": match_via,
                "natureza": hit.get("natureza_juridica"),
                "archetype": hit.get("archetype"),
                "confidence": hit.get("confidence"),
                "fonte": gt["fonte"],
                "link": gt["link"],
            })
        else:
            no_match.append({
                "nome_alvo": nome_alvo,
                "cnpj_alvo": cnpj_alvo,
                "receita_real": receita_ref,
                "adquirente": gt.get("adquirente_nome"),
            })

    # imprime
    matched.sort(key=lambda x: abs(x["desvio_pct"]))
    print(f"=== Matched · {len(matched)}/{len(gts)} ground-truths casaram no parquet ===")
    print()
    for m in matched:
        sign = "+" if m["desvio_pct"] >= 0 else ""
        scope_tag = " [no_escopo]" if (m["natureza"] == "2062" and m["receita_estimada"] <= 250_000_000) else ""
        print(
            f"{m['nome_matched'][:42]:<42}  "
            f"real R$ {m['receita_real']/1e6:>7.1f}M  "
            f"est R$ {m['receita_estimada']/1e6:>7.1f}M  "
            f"{sign}{m['desvio_pct']:>6.1f}%  "
            f"[{m['confidence']}]{scope_tag}"
        )
    print()
    print(f"=== Não casaram ({len(no_match)}) — provavelmente fora do parquet (sub-tier ou outra UF) ===")
    for nm in no_match[:20]:
        rec_s = f"R$ {nm['receita_real']/1e6:.1f}M" if nm.get("receita_real") else "—"
        print(f"  · {nm['nome_alvo'] or '(sem nome)':<40}  {rec_s}")

    # salva matched
    out = REPO / "data" / "active_validation_matched.json"
    out.write_text(json.dumps(matched, ensure_ascii=False, indent=2), encoding="utf-8")
    print(file=sys.stderr)
    print(f"Saída: {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
