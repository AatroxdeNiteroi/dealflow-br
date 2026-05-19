"""Compara estimativa do DealFlow vs Receita Líquida CVM (DRE 3.01) para todas
as SA Abertas single-plant do universo (natureza_juridica = '2046').

Fluxo:
  1. Lê data/estimates_final.parquet → filtra natureza_juridica == '2046'
  2. Baixa DFP CVM (zip) do ano mais recente disponível → cache em data/cvm_cache/
  3. Extrai DRE consolidada (fallback individual) → casa por cnpj_basico
  4. Pega CD_CONTA = '3.01' (Receita Líquida) do exercício ÚLTIMO
  5. Desvio % = (estimate - receita_cvm) / receita_cvm × 100
  6. Imprime lista ordenada por |desvio|, NOME — ±X.X%
"""

from __future__ import annotations

import io
import sys
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import polars as pl

REPO_ROOT = Path(__file__).resolve().parents[2]
PARQUET = REPO_ROOT / "data" / "estimates_final.parquet"
CACHE_DIR = REPO_ROOT / "data" / "cvm_cache"
CVM_BASE = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/DADOS"


def fetch_dfp_zip(year: int) -> Path | None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    local = CACHE_DIR / f"dfp_cia_aberta_{year}.zip"
    if local.exists() and local.stat().st_size > 0:
        return local
    url = f"{CVM_BASE}/dfp_cia_aberta_{year}.zip"
    print(f"Baixando {url} …", file=sys.stderr)
    try:
        urllib.request.urlretrieve(url, local)
    except (urllib.error.HTTPError, urllib.error.URLError) as e:
        print(f"  falha {year}: {e}", file=sys.stderr)
        if local.exists():
            local.unlink()
        return None
    return local


def read_dre(zip_path: Path, year: int, kind: str) -> pl.DataFrame | None:
    """kind: 'con' (consolidada) ou 'ind' (individual)."""
    name = f"dfp_cia_aberta_DRE_{kind}_{year}.csv"
    try:
        with zipfile.ZipFile(zip_path) as z:
            with z.open(name) as f:
                raw = f.read()
    except KeyError:
        print(f"  {name} não está no zip", file=sys.stderr)
        return None
    # CVM CSV: latin-1 (ISO-8859-1), separador ';'
    text = raw.decode("latin-1")
    return pl.read_csv(
        io.StringIO(text),
        separator=";",
        infer_schema_length=20000,
        try_parse_dates=False,
    )


def normalize_cnpj_to_basico(cnpj: str | None) -> str | None:
    if not cnpj:
        return None
    digits = "".join(c for c in cnpj if c.isdigit())
    return digits[:8] if len(digits) >= 8 else None


def find_revenue(dre: pl.DataFrame, cnpj_basico: str) -> tuple[float | None, str | None]:
    """Retorna (valor_brl, dt_fim_exerc_str) para a receita líquida mais recente."""
    sub = dre.filter(
        (pl.col("_cnpj_basico") == cnpj_basico)
        & (pl.col("ORDEM_EXERC") == "ÚLTIMO")
        & (pl.col("CD_CONTA") == "3.01")
    )
    if sub.height == 0:
        return None, None
    sub = sub.sort("DT_FIM_EXERC", descending=True).head(1)
    row = sub.to_dicts()[0]
    valor = float(row["VL_CONTA"])
    # ESCALA_MOEDA: 'MIL' (milhares) ou 'UNIDADE' (raro). Multiplicar para BRL nominal.
    escala = (row.get("ESCALA_MOEDA") or "").upper().strip()
    if escala == "MIL":
        valor *= 1_000
    elif escala in ("MILHAO", "MILHÃO"):  # extremamente raro
        valor *= 1_000_000
    return valor, row["DT_FIM_EXERC"]


def main() -> int:
    # 1. Universo
    if not PARQUET.exists():
        print(f"FALTA: {PARQUET}", file=sys.stderr)
        return 1
    df = pl.read_parquet(PARQUET)
    sa = df.filter(pl.col("natureza_juridica") == "2046").select(
        ["cnpj", "cnpj_basico", "razao_social", "receita_point_brl"]
    )
    print(f"SA Abertas single-plant no universo: {sa.height}", file=sys.stderr)

    # 2. DFP CVM — tenta anos mais recentes primeiro
    zip_path = None
    used_year = None
    for year in (2024, 2023, 2022):
        zp = fetch_dfp_zip(year)
        if zp:
            zip_path = zp
            used_year = year
            break
    if not zip_path:
        print("Nenhum DFP disponível na CVM (rede ou serviço fora).", file=sys.stderr)
        return 2
    print(f"Usando DFP {used_year}", file=sys.stderr)

    # 3. Carrega DRE consolidada + individual
    dre_con = read_dre(zip_path, used_year, "con")
    dre_ind = read_dre(zip_path, used_year, "ind")
    if dre_con is None and dre_ind is None:
        print("Sem DRE legível dentro do zip.", file=sys.stderr)
        return 3

    for d in (dre_con, dre_ind):
        if d is None:
            continue
        # adiciona coluna cnpj_basico normalizada
        d_basico = d["CNPJ_CIA"].map_elements(
            normalize_cnpj_to_basico, return_dtype=pl.Utf8
        )
        if "_cnpj_basico" in d.columns:
            d.drop_in_place("_cnpj_basico")
        d.insert_column(d.width, d_basico.alias("_cnpj_basico"))
        # garante VL_CONTA numérico
        if d["VL_CONTA"].dtype != pl.Float64:
            d.replace_column(
                d.get_column_index("VL_CONTA"),
                d["VL_CONTA"].cast(pl.Float64, strict=False),
            )

    # 4. Casa empresa por empresa
    rows: list[tuple[str, float | None, float, float | None, str | None]] = []
    for r in sa.iter_rows(named=True):
        basico = r["cnpj_basico"]
        est = r["receita_point_brl"]
        rec, dt = (None, None)
        if dre_con is not None:
            rec, dt = find_revenue(dre_con, basico)
        if rec is None and dre_ind is not None:
            rec, dt = find_revenue(dre_ind, basico)
        rows.append((r["razao_social"], rec, est, dt, basico))

    # 5. Calcula desvio
    out: list[tuple[str, float | None, float | None, float, str | None]] = []
    for nome, rec_cvm, est, dt, basico in rows:
        if rec_cvm is None or rec_cvm == 0 or est is None:
            out.append((nome, None, rec_cvm, est, dt))
            continue
        desv = (est - rec_cvm) / rec_cvm * 100
        out.append((nome, desv, rec_cvm, est, dt))

    # ordena: encontrados primeiro (por |desvio| crescente), depois não-encontrados
    out.sort(key=lambda x: (x[1] is None, abs(x[1]) if x[1] is not None else 0))

    # 6. Imprime
    found = [r for r in out if r[1] is not None]
    missing = [r for r in out if r[1] is None]

    print()
    print(f"=== Desvio DealFlow vs CVM DRE 3.01 ({used_year}) · {len(found)}/{len(out)} casaram ===")
    print()
    for nome, desv, _rec, _est, _dt in out:
        nome_t = nome[:48]
        if desv is None:
            print(f"{nome_t:<48}  — (sem DFP)")
        else:
            sign = "+" if desv >= 0 else ""
            print(f"{nome_t:<48}  {sign}{desv:.1f}%")

    # resumo
    if found:
        absd = [abs(r[1]) for r in found]
        n = len(found)
        in_25 = sum(1 for x in absd if x <= 25)
        in_50 = sum(1 for x in absd if 25 < x <= 50)
        fora = sum(1 for x in absd if x > 50)
        med = sorted(absd)[n // 2]
        print()
        print(f"Casaram:        {n}/{len(out)}")
        print(f"Mediana |dev|:  {med:.1f}%")
        print(f"Dentro ±25%:    {in_25}  ({in_25*100//n}%)")
        print(f"25%–50%:        {in_50}  ({in_50*100//n}%)")
        print(f">50%:           {fora} ({fora*100//n}%)")
    print()
    print("Nota: estimate é receita BRUTA estimada (folha/razão); CVM CD_CONTA=3.01")
    print("é Receita Líquida (após deduções de venda). Espera-se bias positivo de")
    print("5-15% no estimate por essa diferença conceitual.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
