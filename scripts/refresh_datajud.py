"""Agrega volumes processuais de Recuperação Judicial / Falência por
TJ × UF × janela temporal, do CNJ Datajud (API pública).

Datajud mascara o nome das partes por LGPD — não dá pra linkar
processo → CNPJ específico. Mas dá pra ter o **contexto regional**:
"X RJs e Y Falências abertas em SP nos últimos 12m (vs 12m anteriores)".
Útil pro analista entender o ambiente do alvo.

⚠️ Nota técnica importante: o campo `dataAjuizamento` no Datajud é
STRING no formato yyyyMMddHHmmss (não date). Por isso usamos
`range` com comparação lexicográfica de strings, e NÃO
`date_histogram`/`date_range`.

Códigos CNJ (Tabela Unificada de Classes Processuais — descobertos
via search nos próprios docs do Datajud, não na documentação):
    108 · Falência de Empresários, Sociedades Empresárias, ME e EPP
    129 · Recuperação Judicial
    128 · Recuperação Extrajudicial

Fonte: https://api-publica.datajud.cnj.jus.br/ (público, chave
documentada em datajud-wiki.cnj.jus.br/api-publica/acesso)

Uso:
    uv run python scripts/refresh_datajud.py [--meses 12]

Output:
    data/datajud_rj_falencia.parquet
        tribunal · uf · classe_codigo · classe_nome
        · janela ('atual' | 'anterior')
        · n_processos
        · gte · lte
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date, timedelta
from pathlib import Path
from urllib import request as urlrequest

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

import polars as pl

OUT = Path("data/datajud_rj_falencia.parquet")

DATAJUD_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=="
BASE = "https://api-publica.datajud.cnj.jus.br"

TJS = {
    "TJAC": "AC", "TJAL": "AL", "TJAP": "AP", "TJAM": "AM", "TJBA": "BA",
    "TJCE": "CE", "TJDFT": "DF", "TJES": "ES", "TJGO": "GO", "TJMA": "MA",
    "TJMT": "MT", "TJMS": "MS", "TJMG": "MG", "TJPA": "PA", "TJPB": "PB",
    "TJPR": "PR", "TJPE": "PE", "TJPI": "PI", "TJRJ": "RJ", "TJRN": "RN",
    "TJRS": "RS", "TJRO": "RO", "TJRR": "RR", "TJSC": "SC", "TJSP": "SP",
    "TJSE": "SE", "TJTO": "TO",
}

CLASSES = {
    108: "Falência",
    129: "Recuperação Judicial",
    128: "Recuperação Extrajudicial",
}


def to_datajud_ts(d: date, end_of_day: bool = False) -> str:
    """date → string yyyyMMddHHmmss (formato do campo no Datajud)."""
    return d.strftime("%Y%m%d") + ("235959" if end_of_day else "000000")


def query_tribunal(sigla_lower: str, gte_str: str, lte_str: str) -> dict:
    """Conta processos por classe num tribunal numa janela.

    Range filter usa comparação lexicográfica em string yyyyMMddHHmmss.
    """
    url = f"{BASE}/api_publica_{sigla_lower}/_search"
    body = {
        "size": 0,
        "query": {
            "bool": {
                "filter": [
                    {"terms": {"classe.codigo": list(CLASSES.keys())}},
                    {"range": {"dataAjuizamento": {"gte": gte_str, "lte": lte_str}}},
                ]
            }
        },
        "aggs": {
            "by_classe": {"terms": {"field": "classe.codigo", "size": 10}},
        },
    }
    req = urlrequest.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"APIKey {DATAJUD_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urlrequest.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def parse_buckets(
    sigla: str, uf: str, payload: dict, janela: str, gte_str: str, lte_str: str
) -> list[dict]:
    rows: list[dict] = []
    for cb in payload.get("aggregations", {}).get("by_classe", {}).get("buckets", []):
        cod = int(cb["key"])
        rows.append(
            {
                "tribunal": sigla,
                "uf": uf,
                "classe_codigo": cod,
                "classe_nome": CLASSES.get(cod, f"código {cod}"),
                "janela": janela,
                "gte": gte_str,
                "lte": lte_str,
                "n_processos": int(cb["doc_count"]),
            }
        )
    # garante uma linha por classe (zero quando ausente) pra UI conseguir comparar
    presentes = {r["classe_codigo"] for r in rows}
    for cod, nome in CLASSES.items():
        if cod not in presentes:
            rows.append(
                {
                    "tribunal": sigla,
                    "uf": uf,
                    "classe_codigo": cod,
                    "classe_nome": nome,
                    "janela": janela,
                    "gte": gte_str,
                    "lte": lte_str,
                    "n_processos": 0,
                }
            )
    return rows


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--meses", type=int, default=12, help="tamanho de cada janela em meses (default 12)")
    args = ap.parse_args()

    hoje = date.today()
    janela_dias = args.meses * 31  # aproximado, OK pra contexto
    atual_gte = hoje - timedelta(days=janela_dias)
    anterior_lte = atual_gte - timedelta(days=1)
    anterior_gte = anterior_lte - timedelta(days=janela_dias)

    janelas = [
        ("atual", to_datajud_ts(atual_gte), to_datajud_ts(hoje, end_of_day=True)),
        ("anterior", to_datajud_ts(anterior_gte), to_datajud_ts(anterior_lte, end_of_day=True)),
    ]

    print("=" * 64)
    print(f"Datajud · RJ + Falência · janelas de {args.meses} meses")
    print(f"  atual:    {atual_gte.isoformat()} → {hoje.isoformat()}")
    print(f"  anterior: {anterior_gte.isoformat()} → {anterior_lte.isoformat()}")
    print("=" * 64)

    all_rows: list[dict] = []
    ok = 0
    fail = 0
    for sigla, uf in sorted(TJS.items()):
        try:
            uf_total = 0
            for janela, gte_str, lte_str in janelas:
                payload = query_tribunal(sigla.lower(), gte_str, lte_str)
                rows = parse_buckets(sigla, uf, payload, janela, gte_str, lte_str)
                all_rows.extend(rows)
                if janela == "atual":
                    uf_total = sum(r["n_processos"] for r in rows)
                time.sleep(0.2)
            print(f"  {sigla} ({uf}): atual {uf_total:>5,} processos (RJ+Fal+Extra)")
            ok += 1
        except Exception as exc:  # noqa: BLE001
            print(f"  {sigla} ({uf}): ERRO — {exc}", file=sys.stderr)
            fail += 1

    if not all_rows:
        print("\nNenhum dado coletado.", file=sys.stderr)
        return 1

    df = pl.DataFrame(all_rows).sort(["uf", "janela", "classe_codigo"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    df.write_parquet(OUT, compression="zstd")

    print(f"\n✓ {OUT} ({OUT.stat().st_size / 1024:.1f} KB)")
    print(f"  Tribunais OK: {ok} · falhas: {fail}")
    print(f"  Linhas: {df.height:,}")
    print()
    print("  Total nacional (janela atual):")
    tot = (
        df.filter(pl.col("janela") == "atual")
        .group_by("classe_nome")
        .agg(pl.col("n_processos").sum().alias("total"))
        .sort("total", descending=True)
    )
    print(tot)
    print()
    print("  Top 8 UFs (atual, todas as classes somadas):")
    topuf = (
        df.filter(pl.col("janela") == "atual")
        .group_by("uf")
        .agg(pl.col("n_processos").sum().alias("total"))
        .sort("total", descending=True)
        .head(8)
    )
    print(topuf)
    print(f"\nReinicie o backend para invalidar o lru_cache.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
