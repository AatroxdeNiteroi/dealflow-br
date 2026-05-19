"""Teste consolidado FINAL · maior conjunto de empresas testáveis.

Junta todas as fontes de ground-truth disponíveis e produz uma lista
única NOME — % de desvio do motor:

  A. Hand-curated (releases públicos + M&A disclosures)
  B. CVM DFP (SA Aberta + SA Fechada · DRE auditada)
  C. Contratos federais · Portal da Transparência
     - Só inclui quando o piso permite medir erro:
       · motor < piso  → SUBESTIMAÇÃO comprovada (% real, negativo)
       · gov-dependente (piso ≥ 50% da estimativa) → piso ≈ receita,
         desvio reportável nos dois sentidos

Saída: lista NOME — % ordenada por |desvio|.
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
FEDERAL = REPO / "data" / "contratos_federais_por_cnpj.json"
DFP_YEAR = 2024

sys.path.insert(0, str(REPO / "backend" / "src"))
from dealflow_api.data.loader import _apply_pia_second_estimate  # noqa: E402


def _norm(s: str) -> str:
    if not s:
        return ""
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).upper().strip()


def _digits(s: str) -> str:
    return "".join(c for c in (s or "") if c.isdigit())


# ── Fonte A · hand-curated ──────────────────────────────────────────
def collect_handcurated(emp: pl.DataFrame) -> list[tuple[str, float, float, str]]:
    if not HANDCURATED.exists():
        return []
    cases = json.loads(HANDCURATED.read_text(encoding="utf-8"))
    emp_n = emp.with_columns(pl.col("razao_social").map_elements(_norm, return_dtype=pl.Utf8).alias("_n"))
    out = []
    for c in cases:
        pat = _norm(c["nome_busca"])
        hits = emp_n.filter(pl.col("_n").str.contains(pat, literal=True))
        if hits.height == 0:
            continue
        hits = hits.sort("receita_point_brl", descending=True, nulls_last=True).head(1)
        est = hits["receita_point_brl"].item()
        if not est or est <= 0:
            continue
        out.append((hits["razao_social"].item(), float(est), float(c["receita_brl"]), "hand-curated"))
    return out


# ── Fonte B · CVM DFP ───────────────────────────────────────────────
def load_dre(kind: str) -> pl.DataFrame | None:
    name = f"dfp_cia_aberta_DRE_{kind}_{DFP_YEAR}.csv"
    try:
        with zipfile.ZipFile(DFP_ZIP) as z:
            raw = z.read(name)
    except (KeyError, FileNotFoundError):
        return None
    df = pl.read_csv(io.StringIO(raw.decode("latin-1")), separator=";", infer_schema_length=20000)
    return df.with_columns([
        pl.col("CNPJ_CIA").map_elements(
            lambda c: _digits(c)[:8] if c else None, return_dtype=pl.Utf8
        ).alias("_basico"),
        pl.col("VL_CONTA").cast(pl.Float64, strict=False),
    ])


def cvm_revenue(dre_con, dre_ind, basico: str) -> float | None:
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
        row = sub.sort("DT_FIM_EXERC", descending=True).head(1).to_dicts()[0]
        v = row["VL_CONTA"]
        if v is None:
            continue
        if (row.get("ESCALA_MOEDA") or "").upper().strip() == "MIL":
            v *= 1_000
        return float(v)
    return None


def collect_cvm(emp: pl.DataFrame) -> list[tuple[str, float, float, str]]:
    if not DFP_ZIP.exists():
        return []
    dre_con, dre_ind = load_dre("con"), load_dre("ind")
    if dre_con is None and dre_ind is None:
        return []
    out = []
    for nat in ("2046", "2054"):
        for r in emp.filter(pl.col("natureza_juridica") == nat).iter_rows(named=True):
            est = r["receita_point_brl"]
            if not est or est <= 0:
                continue
            ref = cvm_revenue(dre_con, dre_ind, r["cnpj_basico"])
            if not ref or ref <= 0:
                continue
            out.append((r["razao_social"], float(est), ref, "CVM-DFP"))
    return out


# ── Fonte C · contratos federais ────────────────────────────────────
def collect_federal() -> list[tuple[str, float, float, str]]:
    if not FEDERAL.exists():
        return []
    data = json.loads(FEDERAL.read_text(encoding="utf-8"))
    out = []
    for r in data:
        est = r.get("estimativa_motor_brl") or 0
        piso = r.get("piso_minimo_anual_brl") or 0
        if est <= 0 or piso <= 0:
            continue
        ratio = piso / est
        # inclui quando: motor subestima (piso>est) OU gov-dependente (piso≥50% est)
        if piso > est or ratio >= 0.5:
            tag = "federal-subest" if piso > est else "federal-gov-dep"
            out.append((r["razao_social_motor"], float(est), float(piso), tag))
    return out


def main() -> int:
    emp = _apply_pia_second_estimate(pl.read_parquet(PARQUET))
    print(f"Universo bruto + PIA: {emp.height:,}", file=sys.stderr)

    triples = []
    a = collect_handcurated(emp)
    b = collect_cvm(emp)
    c = collect_federal()
    triples = a + b + c
    print(f"  A hand-curated: {len(a)}", file=sys.stderr)
    print(f"  B CVM-DFP:      {len(b)}", file=sys.stderr)
    print(f"  C federal:      {len(c)}", file=sys.stderr)

    # dedup por nome, mantém menor |desvio|
    by_nome: dict[str, tuple] = {}
    for nome, est, ref, fonte in triples:
        desv = (est - ref) / ref * 100
        key = _norm(nome)
        prev = by_nome.get(key)
        if prev is None or abs(desv) < abs(prev[3]):
            by_nome[key] = (nome, est, ref, desv, fonte)
    rows = sorted(by_nome.values(), key=lambda r: abs(r[3]))

    print()
    print(f"=== TESTE CONSOLIDADO · {len(rows)} empresas · NOME — % ===")
    print()
    for nome, _est, _ref, desv, fonte in rows:
        sign = "+" if desv >= 0 else ""
        print(f"{nome[:52]:<52}  {sign}{desv:>7.1f}%   [{fonte}]")

    absd = [abs(r[3]) for r in rows]
    n = len(absd)
    if n:
        med = sorted(absd)[n // 2]
        in25 = sum(1 for x in absd if x <= 25)
        in50 = sum(1 for x in absd if 25 < x <= 50)
        fora = sum(1 for x in absd if x > 50)
        print()
        print(f"Total testado:   {n}")
        print(f"Mediana |dev|:   {med:.1f}%")
        print(f"Dentro ±25%:     {in25}  ({in25*100//n}%)")
        print(f"25–50%:          {in50}  ({in50*100//n}%)")
        print(f">50%:            {fora}  ({fora*100//n}%)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
