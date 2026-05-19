"""Validação consolidada: agrega TODAS as fontes de ground-truth disponíveis
e produz uma única lista NOME — % de desvio do motor DealFlow.

Fontes agregadas:
  (A) Hand-curated: 100 LTDAs/SAs grandes com receita coletada de releases
      públicos, M&A disclosures, e DRE de pares (data/cvm_cache/handcurated_dre.json)
  (B) SA Fechada (natureza 2054) com DFP CVM 2024 (subset que emite valores
      mobiliários e portanto publica demonstrativos)
  (C) SA Aberta (natureza 2046) com DFP CVM 2024

Lê tudo local:
  - data/estimates_final.parquet               (motor)
  - data/cvm_cache/handcurated_dre.json        (A)
  - data/cvm_cache/dfp_cia_aberta_2024.zip     (B + C)

Output: lista única ordenada por |desvio| crescente.
"""

from __future__ import annotations

import io
import json
import sys
import unicodedata
import zipfile
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import polars as pl

REPO = Path(__file__).resolve().parents[2]
PARQUET = REPO / "data" / "estimates_final.parquet"
HANDCURATED = REPO / "data" / "cvm_cache" / "handcurated_dre.json"
DFP_ZIP = REPO / "data" / "cvm_cache" / "dfp_cia_aberta_2024.zip"
DFP_YEAR = 2024

# Importa escopo + calibração do backend (single source of truth)
sys.path.insert(0, str(REPO / "backend" / "src"))
from dealflow_api.data.loader import _apply_scope, _apply_uncertainty_calibration  # noqa: E402


def _norm(s: str) -> str:
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).upper().strip()


def _basico(cnpj: str | None) -> str | None:
    if not cnpj:
        return None
    digits = "".join(c for c in cnpj if c.isdigit())
    return digits[:8] if len(digits) >= 8 else None


# ─── (A) Hand-curated ───────────────────────────────────────────────


def collect_handcurated(emp: pl.DataFrame) -> list[tuple[str, float, float]]:
    """Match por substring contra razao_social. Para cada case pega a empresa
    de maior receita estimada (heurística do script original)."""
    if not HANDCURATED.exists():
        print(f"  skip (A): {HANDCURATED} ausente", file=sys.stderr)
        return []
    cases = json.loads(HANDCURATED.read_text(encoding="utf-8"))
    emp_n = emp.with_columns(pl.col("razao_social").map_elements(_norm, return_dtype=pl.Utf8).alias("_n"))
    out = []
    for c in cases:
        pat = _norm(c["nome_busca"])
        hits = emp_n.filter(pl.col("_n").str.contains(pat, literal=True))
        if hits.height == 0:
            continue
        # Mesma heurística do script original: maior receita estimada.
        hits = hits.sort("receita_point_brl", descending=True, nulls_last=True).head(1)
        est = hits["receita_point_brl"].item()
        if est is None or est <= 0:
            continue
        nome = hits["razao_social"].item()
        out.append((nome, float(est), float(c["receita_brl"])))
    print(f"  (A) hand-curated: {len(out)}/{len(cases)} casaram", file=sys.stderr)
    return out


# ─── (B) + (C) CVM DFP ──────────────────────────────────────────────


def load_dre(kind: str) -> pl.DataFrame | None:
    name = f"dfp_cia_aberta_DRE_{kind}_{DFP_YEAR}.csv"
    try:
        with zipfile.ZipFile(DFP_ZIP) as z:
            raw = z.read(name)
    except (KeyError, FileNotFoundError):
        return None
    text = raw.decode("latin-1")
    df = pl.read_csv(io.StringIO(text), separator=";", infer_schema_length=20000)
    # adiciona basico do CNPJ + força VL_CONTA float
    df = df.with_columns([
        pl.col("CNPJ_CIA").map_elements(_basico, return_dtype=pl.Utf8).alias("_basico"),
        pl.col("VL_CONTA").cast(pl.Float64, strict=False),
    ])
    return df


def cvm_revenue(dre_con: pl.DataFrame | None, dre_ind: pl.DataFrame | None,
                basico: str) -> float | None:
    """Receita Líquida (CD_CONTA=3.01) último exercício, prefere consolidada."""
    for d in (dre_con, dre_ind):
        if d is None:
            continue
        sub = d.filter(
            (pl.col("_basico") == basico)
            & (pl.col("ORDEM_EXERC") == "ÚLTIMO")
            & (pl.col("CD_CONTA") == "3.01")
        )
        if sub.height == 0:
            continue
        sub = sub.sort("DT_FIM_EXERC", descending=True).head(1)
        row = sub.to_dicts()[0]
        v = row["VL_CONTA"]
        if v is None:
            continue
        if (row.get("ESCALA_MOEDA") or "").upper().strip() == "MIL":
            v *= 1_000
        return float(v)
    return None


def collect_cvm(emp: pl.DataFrame, natureza: str, label: str
                ) -> list[tuple[str, float, float]]:
    if not DFP_ZIP.exists():
        print(f"  skip ({label}): {DFP_ZIP} ausente", file=sys.stderr)
        return []
    dre_con = load_dre("con")
    dre_ind = load_dre("ind")
    if dre_con is None and dre_ind is None:
        return []
    cand = emp.filter(pl.col("natureza_juridica") == natureza)
    out = []
    for r in cand.iter_rows(named=True):
        basico = r["cnpj_basico"]
        est = r["receita_point_brl"]
        if est is None or est <= 0:
            continue
        ref = cvm_revenue(dre_con, dre_ind, basico)
        if ref is None or ref <= 0:
            continue
        out.append((r["razao_social"], float(est), ref))
    print(f"  ({label}) CVM nat={natureza}: {len(out)}/{cand.height} casaram", file=sys.stderr)
    return out


# ─── consolidação ────────────────────────────────────────────────────


def main() -> int:
    if not PARQUET.exists():
        print(f"FALTA: {PARQUET}", file=sys.stderr)
        return 1

    # Universo BRUTO — pra coletar ground-truth de SAs Abertas/Fechadas
    # (que NÃO estão no escopo do produto mas servem como referência DRE pública)
    emp_bruto = pl.read_parquet(PARQUET)
    print(f"Universo bruto (parquet): {emp_bruto.height:,}", file=sys.stderr)

    # Universo do PRODUTO (Ltda <=250M, sem holdings, sem RJ literal)
    # + calibração de incerteza aplicada (intervalo widened + confidence ajustada).
    # É AQUI que se mede a acurácia do que o cliente realmente vê.
    emp_produto = _apply_uncertainty_calibration(_apply_scope(emp_bruto))
    print(f"Universo do produto (escopo aplicado): {emp_produto.height:,}", file=sys.stderr)
    print("Coletando ground-truths…", file=sys.stderr)

    triples = []
    # Todos os ground-truths são casados contra parquet BRUTO (motor estima
    # qualquer empresa que esteja no parquet, independente de escopo de produto).
    triples += collect_handcurated(emp_bruto)
    triples += collect_cvm(emp_bruto, "2054", "B · SA Fechada")
    triples += collect_cvm(emp_bruto, "2046", "C · SA Aberta")

    # Separamos in-scope (produto) vs out-of-scope pra mostrar duas métricas:
    # (1) acurácia do MOTOR — em qualquer empresa
    # (2) acurácia do PRODUTO — só nas empresas que o usuário vê
    nomes_produto = set(emp_produto["razao_social"].to_list())

    # dedup por nome normalizado — mantém o de menor |desvio|.
    by_nome: dict[str, tuple[str, float, float, float]] = {}
    for nome, est, ref in triples:
        desv = (est - ref) / ref * 100
        key = _norm(nome)
        prev = by_nome.get(key)
        if prev is None or abs(desv) < abs(prev[3]):
            by_nome[key] = (nome, est, ref, desv)
    rows = sorted(by_nome.values(), key=lambda r: abs(r[3]))

    # separar in-scope (produto) vs out-of-scope
    in_scope_rows = [r for r in rows if r[0] in nomes_produto]
    out_scope_rows = [r for r in rows if r[0] not in nomes_produto]

    print()
    print(f"=== MOTOR · {len(rows)} empresas (qualquer natureza) ===")
    print()
    for nome, _est, _ref, desv in rows:
        sign = "+" if desv >= 0 else ""
        scope_tag = " [PRODUTO]" if nome in nomes_produto else ""
        print(f"{nome[:50]:<50}  {sign}{desv:>6.1f}%{scope_tag}")

    def _resumo(label: str, rs: list[tuple[str, float, float, float]]) -> None:
        if not rs:
            return
        absd = [abs(r[3]) for r in rs]
        n = len(absd)
        med = sorted(absd)[n // 2]
        in25 = sum(1 for x in absd if x <= 25)
        in50 = sum(1 for x in absd if 25 < x <= 50)
        fora = sum(1 for x in absd if x > 50)
        print()
        print(f"=== {label} · n={n} ===")
        print(f"  Mediana |dev|:  {med:.1f}%")
        print(f"  Dentro ±25%:    {in25}  ({in25*100//n}%)")
        print(f"  25%–50%:        {in50}  ({in50*100//n}%)")
        print(f"  >50%:           {fora}  ({fora*100//n}%)")

    _resumo("MOTOR (todos)", rows)
    _resumo("PRODUTO (in-scope: Ltda <=250M sem holdings sem RJ)", in_scope_rows)
    _resumo("FORA DO PRODUTO (SA · cooperativa · holding · RJ · etc)", out_scope_rows)
    return 0


if __name__ == "__main__":
    sys.exit(main())
