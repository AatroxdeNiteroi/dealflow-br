"""Constrói tabela `razao_folha_receita` com lógica em camadas.

Camadas:
    L1 — PIA 7241+7242 → CNAE 4d real (indústria, seções B, C)
    L2 — PAS 2577 → sub-agrupamento IBGE (serviços H-N, exclusive K/finance)
    L2 — PAC 1418 → sub-agrupamento IBGE (comércio G)
    L3 — fallback default por seção

Mapeamento CNAE divisão (2d) → sub-agrupamento IBGE é hand-coded, baseado nas
descrições oficiais das classificações PAS/PAC.

Output: ``data/reference/razao_folha_receita_<ano>.csv`` com colunas:
    cnae_2d, cnae_4d, razao_folha_receita, source_table, source_category_code,
    source_category_name, source_precision (alta/media/baixa), ano

Uso:
    uv run python scripts/build_razao_folha_receita.py
    uv run python scripts/build_razao_folha_receita.py --ano 2022
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

import httpx

# Windows console defaults to cp1252; force UTF-8 so prints don't crash.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

SIDRA_BASE_URL = "https://apisidra.ibge.gov.br/values"
OUTPUT_DIR = Path("data/reference")
DEFAULT_ANO = 2023
REQUEST_TIMEOUT = 60.0

# PIA usa formato "XX.YY-Z Descrição" — extrai dígitos da classe (4d).
PIA_CNAE_PATTERN = re.compile(r"^(\d{2})\.(\d{2})(?:-\d)?(?:/\d{2})?(?:\s|$)")
# PAS/PAC usam formato hierárquico custom "X.Y.Z Descrição" (códigos IBGE).
IBGE_CATEGORY_PATTERN = re.compile(r"^(\d+(?:\.\d+)*)\.?\s")


@dataclass(frozen=True, slots=True)
class SidraTable:
    """Configuração de uma tabela SIDRA."""

    name: str
    tabela: int
    classif_id: int
    var_receita: int
    var_salarios: int
    parser: str  # 'pia_4d' | 'ibge_category'


TABLES: tuple[SidraTable, ...] = (
    SidraTable(
        name="PIA_industria",
        tabela=7242,  # receita
        classif_id=12762,
        var_receita=806,    # Receita líquida de vendas - total
        var_salarios=0,     # vem da 7241
        parser="pia_4d",
    ),
    SidraTable(
        name="PIA_salarios",
        tabela=7241,
        classif_id=12762,
        var_receita=0,
        var_salarios=822,   # Total de salários, retiradas e outras remunerações
        parser="pia_4d",
    ),
    SidraTable(
        name="PAS_servicos",
        tabela=2577,
        classif_id=12355,
        var_receita=643,    # Receita operacional líquida
        var_salarios=673,   # Salários, retiradas e outras remunerações
        parser="ibge_category",
    ),
    SidraTable(
        name="PAC_comercio",
        tabela=1418,
        classif_id=11070,
        var_receita=863,    # Receita total
        var_salarios=314,   # Gastos com salários, retiradas e outras remunerações
        parser="ibge_category",
    ),
)


# Mapeamento CNAE divisão (2 dígitos) → categoria IBGE do PAS ou PAC.
# Fonte: descrições oficiais das classificações 12355 (PAS) e 11070 (PAC).
# Cada divisão CNAE pertence claramente a 1 sub-agrupamento.
CNAE_TO_IBGE_CATEGORY: dict[str, tuple[str, str]] = {
    # Comércio (seção G) → PAC sub-agrupamentos. Códigos verificados na execução.
    "45": ("PAC", "2"),   # Comércio de veículos, peças e motocicletas
    "46": ("PAC", "3"),   # Comércio por atacado
    "47": ("PAC", "4"),   # Comércio varejista

    # Transportes (seção H) → PAS categoria 5.
    "49": ("PAS", "5.2"),  # Transporte terrestre — assume rodoviário, dominante
    "50": ("PAS", "5.4"),  # Transporte aquaviário
    "51": ("PAS", "5.5"),  # Transporte aéreo
    "52": ("PAS", "5.6"),  # Armazenamento e atividades auxiliares
    "53": ("PAS", "5.8"),  # Correio e atividades de entrega

    # Alojamento e alimentação (seção I) → PAS 2.
    "55": ("PAS", "2.1"),  # Alojamento
    "56": ("PAS", "2.2"),  # Alimentação

    # Informação e comunicação (seção J) → PAS 3.
    "58": ("PAS", "3.4"),  # Edição
    "59": ("PAS", "3.3"),  # Audiovisual (cinema, vídeo)
    "60": ("PAS", "3.3"),  # Audiovisual (rádio/TV)
    "61": ("PAS", "3.1"),  # Telecomunicações
    "62": ("PAS", "3.2"),  # TI
    "63": ("PAS", "3.5"),  # Agências de notícias e outros serviços de informação

    # Atividades imobiliárias (seção L) → PAS 6.
    "68": ("PAS", "6"),

    # Atividades profissionais, científicas e técnicas (seção M) → PAS 4.1.
    "69": ("PAS", "4.1"),  # Atividades jurídicas, contábeis
    "70": ("PAS", "4.1"),  # Sedes / consultorias
    "71": ("PAS", "4.1"),  # Arquitetura e engenharia
    "72": ("PAS", "4.1"),  # Pesquisa e desenvolvimento
    "73": ("PAS", "4.1"),  # Publicidade e pesquisa de mercado
    "74": ("PAS", "4.1"),  # Outras atividades profissionais
    "75": ("PAS", "4.1"),  # Veterinárias

    # Atividades administrativas e serviços complementares (seção N) → PAS 4.2-4.6.
    "77": ("PAS", "4.2"),  # Aluguéis não imobiliários
    "78": ("PAS", "4.3"),  # Seleção, agenciamento e locação de mão-de-obra
    "79": ("PAS", "4.4"),  # Agências de viagens
    "80": ("PAS", "4.5"),  # Vigilância e segurança
    "81": ("PAS", "4.6"),  # Edifícios e atividades paisagísticas
    "82": ("PAS", "4"),    # Outras administrativas — fallback pra agregado 4

    # Manutenção e reparação (seção S, div 95) → PAS 7.
    "95": ("PAS", "7"),
}


# Defaults por seção quando nada cobrir (estimativas conservadoras de mercado).
SECAO_FALLBACK_RAZAO: dict[str, float] = {
    "A": 0.20,  # Agropecuária
    "D": 0.08,  # Eletricidade e gás (capital-intensivo)
    "E": 0.20,  # Água, esgoto, resíduos
    "F": 0.20,  # Construção
    "K": 0.20,  # Financeiro (excluído da PAS)
    "O": 0.40,  # Administração pública (geralmente excluída do escopo)
    "P": 0.50,  # Educação (intensiva em pessoal)
    "Q": 0.45,  # Saúde
    "R": 0.30,  # Artes, recreação
    "S": 0.30,  # Outros serviços
    "T": 0.40,  # Serviços domésticos
    "U": 0.40,  # Organismos internacionais
}


def build_url(table: SidraTable, ano: int, var_id: int) -> str:
    return (
        f"{SIDRA_BASE_URL}/t/{table.tabela}"
        f"/n1/all/v/{var_id}/p/{ano}/c{table.classif_id}/all?formato=json"
    )


def fetch_sidra(url: str, client: httpx.Client) -> list[dict]:
    response = client.get(url, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    data = response.json()
    return data[1:] if data else []


def parse_pia_cnae_4d(d4n: str) -> str | None:
    """Extrai CNAE 4d de strings tipo '05.00-3 Extração...'."""
    match = PIA_CNAE_PATTERN.match(d4n)
    return match.group(1) + match.group(2) if match else None


def parse_ibge_category(d4n: str) -> str | None:
    """Extrai código hierárquico tipo '2.1' de strings tipo '2.1 Alojamento'.

    Devolve None para 'Total' ou linhas sem código numérico.
    """
    if not d4n:
        return None
    parts = d4n.split(" ", 1)
    if len(parts) < 2:
        return None
    code = parts[0].rstrip(".")
    if not re.fullmatch(r"\d+(\.\d+)*", code):
        return None
    return code


def parse_value(raw: str) -> float | None:
    if raw in ("..", "-", "...", "X", ""):
        return None
    try:
        return float(raw.replace(",", "."))
    except ValueError:
        return None


def extract_records(
    records: list[dict],
    *,
    parser_name: str,
) -> dict[str, tuple[float, str]]:
    """Devolve {code: (value, description)} extraído da resposta SIDRA."""
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

        # Para PIA pode haver múltiplas subclasses por classe 4d — somar.
        if code in out and parser_name == "pia_4d":
            old_value, desc = out[code]
            out[code] = (old_value + value, desc)
        else:
            out[code] = (value, d4n)
    return out


@dataclass(frozen=True, slots=True)
class CategoryRow:
    """Linha intermediária — receita + salários por código."""

    code: str
    receita: float
    salarios: float
    description: str


def compute_razao(
    receita_map: dict[str, tuple[float, str]],
    salarios_map: dict[str, tuple[float, str]],
) -> dict[str, CategoryRow]:
    """Combina receita e salários do mesmo source em razão por código."""
    out: dict[str, CategoryRow] = {}
    common = set(receita_map) & set(salarios_map)
    for code in common:
        rec, desc = receita_map[code]
        sal, _ = salarios_map[code]
        if rec <= 0:
            continue
        out[code] = CategoryRow(
            code=code,
            receita=rec,
            salarios=sal,
            description=desc,
        )
    return out


def cnae_secao(divisao: str) -> str:
    """Retorna a seção CNAE (letra) a partir da divisão (2 dígitos)."""
    d = int(divisao)
    if d in {1, 2, 3}: return "A"
    if d in {5, 6, 7, 8, 9}: return "B"
    if 10 <= d <= 33: return "C"
    if d == 35: return "D"
    if 36 <= d <= 39: return "E"
    if 41 <= d <= 43: return "F"
    if 45 <= d <= 47: return "G"
    if 49 <= d <= 53: return "H"
    if d in {55, 56}: return "I"
    if 58 <= d <= 63: return "J"
    if d in {64, 65, 66}: return "K"
    if d == 68: return "L"
    if 69 <= d <= 75: return "M"
    if 77 <= d <= 82: return "N"
    if d == 84: return "O"
    if d == 85: return "P"
    if 86 <= d <= 88: return "Q"
    if 90 <= d <= 93: return "R"
    if 94 <= d <= 96: return "S"
    if d in {97, 98}: return "T"
    if d == 99: return "U"
    return "?"


def build(ano: int, output: Path) -> int:
    """Pipeline completo: baixa, combina, gera CSV final."""
    print(f"Baixando 4 tabelas SIDRA para ano-base {ano}...\n")

    pia_receita: dict[str, tuple[float, str]] = {}
    pia_salarios: dict[str, tuple[float, str]] = {}
    pas_receita: dict[str, tuple[float, str]] = {}
    pas_salarios: dict[str, tuple[float, str]] = {}
    pac_receita: dict[str, tuple[float, str]] = {}
    pac_salarios: dict[str, tuple[float, str]] = {}

    with httpx.Client(follow_redirects=True) as client:
        for table in TABLES:
            print(f"[{table.name}] tabela {table.tabela}")
            if table.var_receita:
                url = build_url(table, ano, table.var_receita)
                print(f"  -> receita (v{table.var_receita})")
                records = fetch_sidra(url, client)
                parsed = extract_records(records, parser_name=table.parser)
                if table.name == "PIA_industria":
                    pia_receita.update(parsed)
                elif table.name == "PAS_servicos":
                    pas_receita = parsed
                elif table.name == "PAC_comercio":
                    pac_receita = parsed
                print(f"     {len(parsed)} códigos com dado")
            if table.var_salarios:
                url = build_url(table, ano, table.var_salarios)
                print(f"  -> salários (v{table.var_salarios})")
                records = fetch_sidra(url, client)
                parsed = extract_records(records, parser_name=table.parser)
                if table.name == "PIA_salarios":
                    pia_salarios.update(parsed)
                elif table.name == "PAS_servicos":
                    pas_salarios = parsed
                elif table.name == "PAC_comercio":
                    pac_salarios = parsed
                print(f"     {len(parsed)} códigos com dado")

    # Combina cada fonte.
    pia_4d = compute_razao(pia_receita, pia_salarios)
    pas_cats = compute_razao(pas_receita, pas_salarios)
    pac_cats = compute_razao(pac_receita, pac_salarios)

    print(f"\nResumo das fontes:")
    print(f"  PIA CNAE 4d:                       {len(pia_4d)} classes")
    print(f"  PAS sub-agrupamentos:              {len(pas_cats)} categorias")
    print(f"  PAC sub-agrupamentos:              {len(pac_cats)} categorias")

    # Listas pra debug do mapeamento.
    pas_codes_seen = sorted(pas_cats.keys())
    pac_codes_seen = sorted(pac_cats.keys())
    print(f"\n  Códigos PAS disponíveis: {pas_codes_seen[:20]}...")
    print(f"  Códigos PAC disponíveis: {pac_codes_seen[:20]}...")

    output.parent.mkdir(parents=True, exist_ok=True)
    rows_written = 0
    with output.open("w", encoding="utf-8") as fh:
        fh.write(
            "cnae_2d,cnae_4d,razao_folha_receita,source_table,"
            "source_category_code,source_category_name,source_precision,ano\n"
        )

        # L1 — PIA CNAE 4d (precisão alta)
        for cnae_4d, row in sorted(pia_4d.items()):
            razao = row.salarios / row.receita
            cnae_2d = cnae_4d[:2]
            desc = row.description.replace(",", " ").replace("\n", " ")
            fh.write(
                f"{cnae_2d},{cnae_4d},{razao:.6f},PIA_7242_7241,"
                f"{cnae_4d},{desc},alta,{ano}\n"
            )
            rows_written += 1

        # L2 — PAS/PAC sub-agrupamentos (precisão média), por divisão CNAE mapeada
        for cnae_2d, (source_short, ibge_code) in sorted(CNAE_TO_IBGE_CATEGORY.items()):
            source_map = pas_cats if source_short == "PAS" else pac_cats
            row = source_map.get(ibge_code)
            if row is None:
                # Tenta nível mais agregado removendo última .X
                if "." in ibge_code:
                    fallback_code = ibge_code.rsplit(".", 1)[0]
                    row = source_map.get(fallback_code)
                if row is None:
                    print(f"  WARN: divisão {cnae_2d} -> {source_short} código {ibge_code} sem dado")
                    continue

            razao = row.salarios / row.receita
            desc = row.description.replace(",", " ").replace("\n", " ")
            source_table = "PAS_2577" if source_short == "PAS" else "PAC_1418"
            fh.write(
                f"{cnae_2d},,{razao:.6f},{source_table},"
                f"{row.code},{desc},media,{ano}\n"
            )
            rows_written += 1

        # L3 — fallback default por seção (precisão baixa)
        for secao, default_razao in sorted(SECAO_FALLBACK_RAZAO.items()):
            fh.write(
                f",,{default_razao:.6f},DEFAULT_SECAO,"
                f"{secao},Estimativa setorial (fallback),baixa,{ano}\n"
            )
            rows_written += 1

    print(f"\nSalvo: {output} ({rows_written} linhas)")
    return rows_written


def build_size_table(ano: int, dest: Path) -> int:
    """Constrói tabela de razão folha/receita por faixa de pessoal ocupado.

    Usa tabela SIDRA 1839 — PIA estratificada por tipo de indústria
    (Extrativas/Transformação) × faixa de pessoal (Até 4, 5-29, ..., 500+).
    Output: ``data/reference/razao_by_size_<ano>.csv``.

    Args:
        ano: Ano-base SIDRA.
        dest: Caminho do CSV de saída.

    Returns:
        Número de linhas (combinações tipo × faixa).
    """
    print(f"\n[PIA tabela 1839] estratificação por faixa de pessoal (ano {ano})")
    url = (
        f"{SIDRA_BASE_URL}/t/1839/n1/all"
        f"/v/806,804/p/{ano}/c9117/all/c319/all?formato=json"
    )

    with httpx.Client(follow_redirects=True) as client:
        records = fetch_sidra(url, client)

    # Index by (tipo_industria, faixa) -> {var_id: value}
    by_key: dict[tuple[str, str], dict[int, float]] = {}
    for rec in records:
        tipo = rec.get("D4N", "").strip()
        faixa = rec.get("D5N", "").strip()
        try:
            var_id = int(rec.get("D2C", "0"))
        except ValueError:
            continue
        value = parse_value(rec.get("V", ""))
        if value is None or not tipo or not faixa:
            continue
        by_key.setdefault((tipo, faixa), {})[var_id] = value

    dest.parent.mkdir(parents=True, exist_ok=True)
    rows = 0
    with dest.open("w", encoding="utf-8") as fh:
        fh.write(
            "tipo_industria,faixa_label,"
            "razao_folha_receita,receita_brl_mil,salarios_brl_mil,ano\n"
        )
        for (tipo, faixa), vars_map in sorted(by_key.items()):
            receita = vars_map.get(806)
            salarios = vars_map.get(804)
            if receita is None or salarios is None or receita <= 0:
                continue
            razao = salarios / receita
            tipo_clean = tipo.replace(",", " ")
            faixa_clean = faixa.replace(",", " ")
            fh.write(
                f"{tipo_clean},{faixa_clean},{razao:.6f},"
                f"{receita:.2f},{salarios:.2f},{ano}\n"
            )
            rows += 1

    print(f"Tabela de faixas salva: {dest} ({rows} linhas)")
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--ano", type=int, default=DEFAULT_ANO)
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()

    output = args.output or OUTPUT_DIR / f"razao_folha_receita_{args.ano}.csv"
    size_output = OUTPUT_DIR / f"razao_by_size_{args.ano}.csv"
    try:
        n = build(args.ano, output)
        build_size_table(args.ano, size_output)
    except httpx.HTTPError as exc:
        print(f"ERRO HTTP: {exc}", file=sys.stderr)
        return 1
    except (json.JSONDecodeError, KeyError, ValueError) as exc:
        print(f"ERRO parse: {exc}", file=sys.stderr)
        return 1
    return 0 if n > 0 else 2


if __name__ == "__main__":
    sys.exit(main())
