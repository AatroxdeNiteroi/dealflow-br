"""ANÁLISE DIAGNÓSTICA INTERNA — NÃO É PARTE DO PIPELINE DE PRODUÇÃO.

Compara a razão folha/receita REAL das empresas B3 (extraída da DVA + DRE
consolidadas da CVM 2024) com a razão de referência que o motor usa
(``data/reference/razao_folha_receita_2023.csv``).

Por design:
    - Só LÊ arquivos. Não escreve em data/reference/ nem em parquet algum.
    - Não importa nada de src/dealflow/ ou backend/. Roda 100% isolado.
    - Output só para stdout. Nenhum efeito colateral em estimates_final.

Fontes:
    /tmp/dfp_2024/dfp_cia_aberta_DVA_con_2024.csv  — folha (CD_CONTA 7.08.01)
    /tmp/dfp_2024/dfp_cia_aberta_DRE_con_2024.csv  — receita (CD_CONTA 3.01)
    data/sample/matches_validation_batch.csv       — CNPJ + CNAE das 343 B3
    data/reference/razao_folha_receita_2023.csv    — razão de referência (read-only)

Fluxo:
    1. CNPJ_basico (8 primeiros dígitos) de cada empresa B3
    2. VL_CONTA em CD_CONTA 7.08.01 da DVA con (fallback ind)
    3. VL_CONTA em CD_CONTA 3.01 da DRE con (fallback ind)
    4. razao_real = folha / receita
    5. Mapeia CNAE 7d da empresa à chave do CSV de referência:
       - cnae_4d → PIA (alta) ou PAC subagrupado (média)
       - cnae_2d → PAS (média) ou PAC divisão (média)
       - fallback → grupo "Others/<seção>"
    6. Agrupa por chave e calcula mediana de razao_real
    7. Diff vs razão de referência

Rodar:
    uv run python scripts/dev/analyze_b3_razao_folha_receita.py
"""

from __future__ import annotations

import csv
import os
import sys
from pathlib import Path
from statistics import median
from typing import Optional

_ROOT = Path(__file__).resolve().parents[2]
_TEMP = Path(os.environ.get("TEMP", os.environ.get("TMP", "/tmp")))

BATCH = _ROOT / "data/sample/matches_validation_batch.csv"
RAZAO_REF = _ROOT / "data/reference/razao_folha_receita_2023.csv"
DRE_CON = _TEMP / "dfp_2024" / "dfp_cia_aberta_DRE_con_2024.csv"
DRE_IND = _TEMP / "dfp_2024" / "dfp_cia_aberta_DRE_ind_2024.csv"
DVA_CON = _TEMP / "dfp_2024" / "dfp_cia_aberta_DVA_con_2024.csv"
DVA_IND = _TEMP / "dfp_2024" / "dfp_cia_aberta_DVA_ind_2024.csv"

CD_PESSOAL = "7.08.01"     # DVA — Distribuição: Pessoal (total: remuneração + benefícios + FGTS)
CD_RECEITA = "3.01"        # DRE — Receita líquida


# ── utilities ────────────────────────────────────────────────────────────────

def _digits(s: str | None) -> str:
    return "".join(c for c in (s or "") if c.isdigit())


def cnpj_basico(cnpj: str) -> str:
    return _digits(cnpj)[:8]


def cnae_secao_from_2d(c2d: str) -> str:
    """Mapeia divisão CNAE 2d (string ZZ) à seção (letra)."""
    try:
        n = int(c2d)
    except ValueError:
        return "?"
    if  1 <= n <=  3: return "A"
    if  5 <= n <=  9: return "B"
    if 10 <= n <= 33: return "C"
    if n == 35:       return "D"
    if 36 <= n <= 39: return "E"
    if 41 <= n <= 43: return "F"
    if 45 <= n <= 47: return "G"
    if 49 <= n <= 53: return "H"
    if 55 <= n <= 56: return "I"
    if 58 <= n <= 63: return "J"
    if 64 <= n <= 66: return "K"
    if n == 68:       return "L"
    if 69 <= n <= 75: return "M"
    if 77 <= n <= 82: return "N"
    if n == 84:       return "O"
    if n == 85:       return "P"
    if 86 <= n <= 88: return "Q"
    if 90 <= n <= 93: return "R"
    if 94 <= n <= 96: return "S"
    if 97 <= n <= 98: return "T"
    if n == 99:       return "U"
    return "?"


# ── loaders ──────────────────────────────────────────────────────────────────

def load_razao_ref():
    """Constrói 3 índices a partir do CSV de referência:
       by_cnae_4d, by_cnae_2d, by_secao.
    Cada entry = (razao, source_table, source_category_code, source_category_name, precision).
    """
    by_4d: dict[str, tuple] = {}
    by_2d: dict[str, tuple] = {}
    by_secao: dict[str, tuple] = {}

    with RAZAO_REF.open(encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            entry = (
                float(row["razao_folha_receita"]),
                row["source_table"],
                row["source_category_code"],
                row["source_category_name"],
                row["source_precision"],
            )
            c4 = row.get("cnae_4d") or ""
            c2 = row.get("cnae_2d") or ""
            src = row.get("source_table", "")
            if c4:
                by_4d[c4] = entry
            elif c2:
                by_2d[c2] = entry
            elif src == "DEFAULT_SECAO":
                by_secao[row["source_category_code"]] = entry
    return by_4d, by_2d, by_secao


def load_batch():
    """Empresas B3 com receita GT > 0."""
    out = []
    with BATCH.open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            gt_raw = (row.get("receita_verdadeira_brl") or "").strip()
            if not gt_raw:
                continue
            try:
                gt = float(gt_raw)
            except ValueError:
                continue
            if gt <= 0:
                continue
            out.append({
                "cnpj": row["cnpj"],
                "razao_social": row["razao_social"],
                "cnae": row["cnae_2_subclasse"],  # 7 dígitos
                "receita_gt": gt,
            })
    return out


def load_cvm_values(path: Path, cd_conta_targets: set[str]) -> dict[str, dict[str, float]]:
    """{cnpj_basico: {cd_conta: vl_conta}} para ORDEM_EXERC='ÚLTIMO'."""
    if not path.exists():
        return {}
    result: dict[str, dict[str, float]] = {}
    with path.open(encoding="latin-1") as fh:
        reader = csv.DictReader(fh, delimiter=";")
        for row in reader:
            if row.get("ORDEM_EXERC", "").strip() != "ÚLTIMO":
                continue
            cd = row.get("CD_CONTA", "").strip()
            if cd not in cd_conta_targets:
                continue
            cnpj_b = cnpj_basico(row.get("CNPJ_CIA", ""))
            if not cnpj_b:
                continue
            try:
                vl = float(row.get("VL_CONTA", "0") or "0")
            except ValueError:
                continue
            result.setdefault(cnpj_b, {})[cd] = vl
    return result


# ── mapping ──────────────────────────────────────────────────────────────────

def map_cnae_to_group(cnae_7d: str, by_4d: dict, by_2d: dict):
    """Retorna (group_key, source_name, razao_ref, precision).

    Para CNAEs sem mapeamento em PIA/PAC/PAS, vai pra 'Others/<seção>'.
    """
    if not cnae_7d:
        return ("Others/?", "CNAE inválido", None, "n/a")

    c4 = cnae_7d[:4]
    c2 = cnae_7d[:2]

    if c4 in by_4d:
        razao, _src, src_code, src_name, prec = by_4d[c4]
        return (src_code, src_name, razao, prec)

    if c2 in by_2d:
        razao, _src, src_code, src_name, prec = by_2d[c2]
        return (src_code, src_name, razao, prec)

    secao = cnae_secao_from_2d(c2)
    return (f"Others/{secao}", f"Fallback seção {secao} (motor: precisão baixa)", None, "baixa")


# ── main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    print("Carregando dados…")
    by_4d, by_2d, by_secao = load_razao_ref()
    batch = load_batch()
    print(f"  Empresas B3 com receita_verdadeira_brl: {len(batch)}")

    print("Lendo DVA + DRE CVM 2024 (CON e IND)…")
    dre_con = load_cvm_values(DRE_CON, {CD_RECEITA})
    dre_ind = load_cvm_values(DRE_IND, {CD_RECEITA})
    dva_con = load_cvm_values(DVA_CON, {CD_PESSOAL})
    dva_ind = load_cvm_values(DVA_IND, {CD_PESSOAL})
    print(f"  DRE con: {len(dre_con)} empresas | DRE ind: {len(dre_ind)} empresas")
    print(f"  DVA con: {len(dva_con)} empresas | DVA ind: {len(dva_ind)} empresas")

    rows_grouped: dict[str, list[dict]] = {}
    missing_dva = 0
    missing_dre = 0
    not_in_cvm = 0

    for emp in batch:
        cnpj_b = cnpj_basico(emp["cnpj"])
        if not cnpj_b:
            not_in_cvm += 1
            continue

        receita = (dre_con.get(cnpj_b) or {}).get(CD_RECEITA)
        if receita is None or receita <= 0:
            receita = (dre_ind.get(cnpj_b) or {}).get(CD_RECEITA)

        folha = (dva_con.get(cnpj_b) or {}).get(CD_PESSOAL)
        if folha is None or folha <= 0:
            folha = (dva_ind.get(cnpj_b) or {}).get(CD_PESSOAL)

        if receita is None or receita <= 0:
            missing_dre += 1
            continue
        if folha is None or folha <= 0:
            missing_dva += 1
            continue

        razao_real = folha / receita

        group_key, src_name, razao_ref, prec = map_cnae_to_group(
            emp["cnae"], by_4d, by_2d
        )

        rows_grouped.setdefault(group_key, []).append({
            "razao_social": emp["razao_social"],
            "cnae": emp["cnae"],
            "razao_real": razao_real,
            "razao_ref": razao_ref,
            "src_name": src_name,
            "precision": prec,
            "folha": folha,
            "receita": receita,
        })

    n_analisado = sum(len(v) for v in rows_grouped.values())
    print(f"\n  Empresas com folha + receita extraídas: {n_analisado}")
    print(f"  Sem receita na DRE 2024:                {missing_dre}")
    print(f"  Sem folha na DVA 2024 (7.08.01):        {missing_dva}")
    print(f"  CNPJ inválido:                          {not_in_cvm}")

    # ── tabela agregada por grupo ────────────────────────────────────────────
    W = 145
    print(f"\n{'=' * W}")
    print(f"  RAZÃO FOLHA/RECEITA — observada B3 (DVA 7.08.01 ÷ DRE 3.01) vs referência do motor")
    print(f"{'=' * W}")
    print(
        f"  {'Grupo':<12} {'Descrição (categoria IBGE)':<58} {'N':>3} "
        f"{'Md B3':>7} {'IQR B3':>16} {'Motor':>7} {'Diff':>7} {'Prec':<6}"
    )
    print(f"  {'-' * (W - 4)}")

    # Ordena: maior N primeiro, depois alfabético
    groups_sorted = sorted(rows_grouped.items(), key=lambda kv: (-len(kv[1]), kv[0]))

    for group_key, rows in groups_sorted:
        n = len(rows)
        razoes = sorted(r["razao_real"] for r in rows)
        med = median(razoes)
        if len(razoes) >= 4:
            q1 = razoes[len(razoes) // 4]
            q3 = razoes[(len(razoes) * 3) // 4]
        else:
            q1, q3 = razoes[0], razoes[-1]

        razao_ref = rows[0]["razao_ref"]
        src_name = rows[0]["src_name"]
        precision = rows[0]["precision"]

        if razao_ref:
            diff_pct = (med - razao_ref) / razao_ref * 100
            diff_str = f"{diff_pct:>+6.0f}%"
            ref_str = f"{razao_ref:>7.3f}"
        else:
            diff_str = "    n/a"
            ref_str = "    n/a"

        iqr_str = f"[{q1:.3f}–{q3:.3f}]"
        src_short = (src_name or "")[:56]

        print(
            f"  {group_key:<12} {src_short:<58} {n:>3} "
            f"{med:>7.3f} {iqr_str:>16} {ref_str} {diff_str} {precision:<6}"
        )

    print(f"{'=' * W}")

    # ── lista das empresas em 'Others' pra inspeção ──────────────────────────
    others_buckets = sorted(k for k in rows_grouped if k.startswith("Others/"))
    if others_buckets:
        print(f"\n  EMPRESAS EM 'OTHERS' (CNAE em fallback seção — motor: precisão baixa)")
        print(f"  {'-' * (W - 4)}")
        for bucket in others_buckets:
            rows = rows_grouped[bucket]
            razoes = sorted(r["razao_real"] for r in rows)
            med_obs = median(razoes)
            print(f"\n  {bucket}  ({len(rows)} empresas · mediana razão observada: {med_obs:.3f})")
            for r in sorted(rows, key=lambda x: -x["razao_real"]):
                name = r["razao_social"][:55]
                print(
                    f"    {r['cnae']:>8}  {r['razao_real']:>6.3f}  "
                    f"folha=R${r['folha']/1e6:>8.0f}M  receita=R${r['receita']/1e6:>9.0f}M  {name}"
                )

    print()


if __name__ == "__main__":
    main()
