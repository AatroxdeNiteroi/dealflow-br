"""Conta menções por CNPJ em Diários Oficiais municipais via API do
Querido Diário (Open Knowledge BR).

O QD agrega DOs municipais (e alguns estaduais) — útil pra encontrar
empresas mencionadas em licitações, sanções, decisões administrativas.
Não substitui Datajud (judicial), mas complementa.

Limitação prática: API só permite 1 query por requisição (não bulk).
Por isso varremos só os top-N CNPJs por receita_point_brl, com
checkpoint pra retomar. Pra expandir cobertura é só rodar com --top
maior — quem já foi consultado é pulado.

Fonte: https://api.queridodiario.ok.org.br/ (público, sem auth, CORS aberto).

Uso:
    uv run python scripts/refresh_querido_diario.py --top 2000

Output:
    data/querido_diario_mencoes.parquet
        cnpj · n_mencoes · ultima_data · ultima_url · territorios (list)
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from urllib import request as urlrequest
from urllib.parse import quote_plus

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

import polars as pl

ESTIMATES = Path("data/estimates_final.parquet")
OUT = Path("data/querido_diario_mencoes.parquet")
QD_API = "https://api.queridodiario.ok.org.br/gazettes"


def cnpj_formatado(cnpj: str) -> str:
    """14 dígitos → 'XX.XXX.XXX/0001-XX'."""
    c = "".join(ch for ch in cnpj if ch.isdigit()).zfill(14)
    return f"{c[:2]}.{c[2:5]}.{c[5:8]}/{c[8:12]}-{c[12:14]}"


def query_qd(termo: str, size: int = 20) -> dict:
    """1 requisição na API do QD. Retorna o JSON cru."""
    url = f"{QD_API}?querystring={quote_plus(termo)}&size={size}&sort_by=relevance"
    req = urlrequest.Request(
        url,
        headers={"User-Agent": "GenesisRadar/0.2 (+contato@genesislabs.com.br)"},
    )
    with urlrequest.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def consulta_cnpj(cnpj: str) -> dict | None:
    """Tenta a forma pontuada (mais precisa) e cai pra 14 dígitos crus."""
    pontuado = cnpj_formatado(cnpj)
    pl_res = query_qd(f'"{pontuado}"', size=20)
    n_pont = pl_res.get("total_gazettes", 0)
    if n_pont == 0:
        # fallback: 14 dígitos podem aparecer em alguns DOs sem máscara
        cru = "".join(ch for ch in cnpj if ch.isdigit()).zfill(14)
        pl_res = query_qd(f'"{cru}"', size=20)
        n = pl_res.get("total_gazettes", 0)
        if n == 0:
            return None
    else:
        n = n_pont

    gazettes = pl_res.get("gazettes", [])
    if not gazettes:
        return {
            "cnpj": cnpj,
            "n_mencoes": n,
            "ultima_data": None,
            "ultima_url": None,
            "territorios": [],
        }

    # ordena por data desc — pega a mais recente
    gazettes.sort(key=lambda g: g.get("date", ""), reverse=True)
    ultima = gazettes[0]
    territorios = sorted({
        f"{g.get('territory_name','?')}/{g.get('state_code','?')}"
        for g in gazettes
    })
    return {
        "cnpj": cnpj,
        "n_mencoes": int(n),
        "ultima_data": ultima.get("date"),
        "ultima_url": ultima.get("url"),
        "territorios": territorios[:10],  # top 10 territórios
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--top", type=int, default=2000,
                    help="quantos CNPJs varrer (ordenados por receita_point_brl desc)")
    ap.add_argument("--sleep", type=float, default=0.15,
                    help="pausa entre requests em segundos (default 0.15 ≈ 6 req/s)")
    args = ap.parse_args()

    if not ESTIMATES.exists():
        print(f"ERRO: {ESTIMATES} não existe.", file=sys.stderr)
        return 1

    est = pl.read_parquet(ESTIMATES)
    targets = (
        est.filter(pl.col("receita_point_brl").is_not_null())
        .sort("receita_point_brl", descending=True)
        .head(args.top)
        ["cnpj"]
        .to_list()
    )
    print("=" * 64)
    print(f"Querido Diário · top {args.top} CNPJs por receita")
    print("=" * 64)

    # checkpoint: se já existe parquet, pula CNPJs já consultados
    seen: set[str] = set()
    existentes: list[dict] = []
    if OUT.exists():
        prev = pl.read_parquet(OUT)
        seen = set(prev["cnpj"].to_list())
        existentes = prev.to_dicts()
        print(f"Checkpoint: {len(seen):,} CNPJs já no parquet, pulando.\n")

    pending = [c for c in targets if c not in seen]
    print(f"A consultar: {len(pending):,}\n")

    novos: list[dict] = []
    com_mencao = 0
    erros = 0
    t0 = time.time()
    for i, cnpj in enumerate(pending, 1):
        try:
            r = consulta_cnpj(cnpj)
            if r is not None:
                novos.append(r)
                com_mencao += 1
        except Exception as exc:  # noqa: BLE001
            erros += 1
            if erros < 5:
                print(f"  ERRO em {cnpj}: {exc}", file=sys.stderr)
        if i % 100 == 0:
            elapsed = time.time() - t0
            rate = i / elapsed if elapsed > 0 else 0
            eta = (len(pending) - i) / rate if rate > 0 else 0
            print(
                f"  {i:>5}/{len(pending):>5} · "
                f"{rate:.1f} req/s · ETA {eta/60:.1f} min · "
                f"{com_mencao} com menção · {erros} erros"
            )
        time.sleep(args.sleep)

    all_rows = existentes + novos
    if not all_rows:
        print("\nNenhum dado coletado.")
        return 0

    df = pl.DataFrame(all_rows, schema_overrides={"territorios": pl.List(pl.Utf8)})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    df.write_parquet(OUT, compression="zstd")

    print(f"\n✓ {OUT} ({OUT.stat().st_size / 1024:.1f} KB)")
    print(f"  Total CNPJs no parquet: {df.height:,}")
    print(f"  Total menções somadas: {df['n_mencoes'].sum():,}")
    print(f"  Top 10 mais mencionados:")
    print(
        df.sort("n_mencoes", descending=True)
        .head(10)
        .select(["cnpj", "n_mencoes", "ultima_data"])
    )
    print(f"\nReinicie o backend para invalidar o lru_cache.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
