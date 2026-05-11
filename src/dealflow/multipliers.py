"""Multiplicadores setoriais (§6.2) e razão folha/receita (§6.3).

Razão folha/receita carregada de ``data/reference/razao_folha_receita_<ano>.csv``,
construída pelo script ``scripts/build_razao_folha_receita.py`` a partir das
3 pesquisas estruturais do IBGE (PIA, PAC, PAS) via SIDRA API.

A lógica de lookup é em camadas (§6.3 da arquitetura):
    L1 — CNAE 4d exato (PIA, indústria)         precisão alta
    L2 — Divisão CNAE 2d → sub-agrupamento IBGE precisão média
    L3 — Fallback default por seção             precisão baixa

Calibrar empiricamente conforme Compartilha RFB devolve faturamento real (§7.3).
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from .domain import CNAE


def _expand_secao_ranges(
    grouped: dict[tuple[str, ...], tuple[float, float]],
) -> dict[str, tuple[float, float]]:
    """Expande dict com chaves agrupadas (`("B", "C")`) em mapa por seção."""
    return {secao: rng for secoes, rng in grouped.items() for secao in secoes}


# §6.2 — Range típico de encargos por bloco.
_ENCARGOS_BLOCOS: dict[tuple[str, ...], tuple[float, float]] = {
    ("B", "C"):      (1.9, 2.1),  # Indústria
    ("F",):          (1.9, 2.0),  # Construção
    ("G",):          (1.6, 1.7),  # Comércio
    ("H", "I", "N"): (1.6, 1.8),  # Serviços gerais
    ("J",):          (1.4, 1.6),  # TI/telecom (com desoneração)
    ("K", "M"):      (1.7, 1.9),  # Serviços profissionais
}

ENCARGOS_BY_SECAO: dict[str, tuple[float, float]] = _expand_secao_ranges(_ENCARGOS_BLOCOS)
ENCARGOS_FALLBACK: tuple[float, float] = (1.6, 1.9)

# §6.3 — Tabela de razão folha/receita.
RAZAO_FOLHA_RECEITA_DEFAULT_PATH = Path("data/reference/razao_folha_receita_2023.csv")

# §6.3 — Ajuste por faixa de pessoal ocupado (PIA tabela 1839).
RAZAO_BY_SIZE_DEFAULT_PATH = Path("data/reference/razao_by_size_2023.csv")

# Brackets (low, high inclusive, label). high=None significa unbounded.
SIZE_BRACKETS: tuple[tuple[int, int, str], ...] = (
    (1, 4, "Até 4"),
    (5, 29, "5 a 29"),
    (30, 49, "30 a 49"),
    (50, 99, "50 a 99"),
    (100, 249, "100 a 249"),
    (250, 499, "250 a 499"),
    (500, 10_000_000, "500 ou mais"),
)

# Mapeamento seção CNAE → tipo de indústria da PIA tabela 1839.
_CNAE_SECAO_TO_PIA_TIPO: dict[str, str] = {
    "B": "Indústrias extrativas",
    "C": "Indústrias de transformação",
}


@dataclass(frozen=True, slots=True)
class RazaoLookup:
    """Resultado do lookup de razão folha/receita."""

    razao: float
    source_table: str
    source_category_code: str
    source_category_name: str
    source_precision: str  # 'alta' | 'media' | 'baixa'


@dataclass(frozen=True, slots=True)
class _RazaoTable:
    """Tabela em memória com lookup em 3 camadas."""

    by_cnae_4d: dict[str, RazaoLookup]
    by_cnae_2d: dict[str, RazaoLookup]
    by_secao: dict[str, RazaoLookup]


def _load_razao_table(path: Path) -> _RazaoTable:
    """Carrega o CSV em três índices (4d, 2d, seção) pra lookup O(1)."""
    by_4d: dict[str, RazaoLookup] = {}
    by_2d: dict[str, RazaoLookup] = {}
    by_secao: dict[str, RazaoLookup] = {}

    with path.open(encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            lookup = RazaoLookup(
                razao=float(row["razao_folha_receita"]),
                source_table=row["source_table"],
                source_category_code=row["source_category_code"],
                source_category_name=row["source_category_name"],
                source_precision=row["source_precision"],
            )
            cnae_4d = row.get("cnae_4d", "")
            cnae_2d = row.get("cnae_2d", "")
            if cnae_4d:
                by_4d[cnae_4d] = lookup
            elif cnae_2d:
                by_2d[cnae_2d] = lookup
            elif row["source_table"] == "DEFAULT_SECAO":
                # DEFAULT_SECAO: o código da categoria É a letra da seção.
                by_secao[row["source_category_code"]] = lookup

    return _RazaoTable(by_cnae_4d=by_4d, by_cnae_2d=by_2d, by_secao=by_secao)


@lru_cache(maxsize=4)
def _get_razao_table(path_str: str) -> _RazaoTable:
    """Cache do CSV em memória — recarregado se o caminho mudar."""
    return _load_razao_table(Path(path_str))


def _faixa_for_headcount(headcount: int) -> str | None:
    """Retorna o label da faixa de pessoal ocupado correspondente."""
    for low, high, label in SIZE_BRACKETS:
        if low <= headcount <= high:
            return label
    return None


@lru_cache(maxsize=4)
def _get_size_table(path_str: str) -> dict[tuple[str, str], float]:
    """Carrega {(tipo_industria, faixa_label): razão} da tabela 1839."""
    out: dict[tuple[str, str], float] = {}
    with Path(path_str).open(encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            key = (row["tipo_industria"], row["faixa_label"])
            out[key] = float(row["razao_folha_receita"])
    return out


def _size_adjustment_factor(
    headcount: int,
    cnae: CNAE,
    size_table: dict[tuple[str, str], float],
) -> float:
    """Fator de ajuste por faixa de pessoal vs faixa 500+ (PIA tabela 1839).

    A razão PIA por classe 4d é dominada pelas empresas grandes (que pesam
    mais na média ponderada por receita). Para empresas menores na mesma
    classe, a razão real tende a ser maior. Este fator captura quanto.

    Args:
        headcount: Número de funcionários da empresa.
        cnae: CNAE 2.0 — usado pra mapear seção → tipo de indústria.
        size_table: Tabela carregada de ``razao_by_size_2023.csv``.

    Returns:
        Fator multiplicativo (1.0 = sem ajuste; >1 amplia razão; <1 reduz).
    """
    tipo = _CNAE_SECAO_TO_PIA_TIPO.get(cnae.secao, "Indústrias de transformação")
    faixa = _faixa_for_headcount(headcount)
    if faixa is None:
        return 1.0

    razao_faixa = size_table.get((tipo, faixa))
    razao_500 = size_table.get((tipo, "500 ou mais"))
    if razao_faixa is None or razao_500 is None or razao_500 <= 0:
        return 1.0

    return razao_faixa / razao_500


def encargos_range_for(cnae: CNAE) -> tuple[float, float]:
    """Devolve o intervalo ``(low, high)`` do multiplicador de encargos (§6.2)."""
    return ENCARGOS_BY_SECAO.get(cnae.secao, ENCARGOS_FALLBACK)


def razao_folha_receita_for(
    cnae: CNAE,
    *,
    headcount: int | None = None,
    table_path: Path = RAZAO_FOLHA_RECEITA_DEFAULT_PATH,
    size_table_path: Path = RAZAO_BY_SIZE_DEFAULT_PATH,
) -> RazaoLookup:
    """Lookup da razão folha/receita com cascata L1 → L2 → L3 + ajuste por faixa.

    Quando ``headcount`` é fornecido E a fonte é PIA classe 4d (precisão alta),
    aplica fator multiplicativo da tabela 1839 (faixa de pessoal vs 500+) para
    corrigir o viés de "PIA dominada por grandes empresas". Para empresas
    menores que 500 funcs, isso geralmente aumenta a razão (e portanto reduz
    a receita estimada).

    Args:
        cnae: CNAE 2.0 do estabelecimento.
        headcount: Total de funcionários (opcional). Quando ``None`` ou quando
            a fonte não for PIA alta, nenhum ajuste é aplicado.
        table_path: Caminho do CSV de razão por CNAE.
        size_table_path: Caminho do CSV de razão por faixa de pessoal.

    Returns:
        ``RazaoLookup`` com razão (ajustada se aplicável), fonte e precisão.

    Raises:
        FileNotFoundError: Se o CSV principal não existir.
    """
    if not table_path.exists():
        raise FileNotFoundError(
            f"Tabela razão folha/receita ausente: {table_path}. "
            "Rode: uv run python scripts/build_razao_folha_receita.py"
        )

    table = _get_razao_table(str(table_path))

    # L1 — CNAE 4d exato (indústria, PIA).
    base = table.by_cnae_4d.get(cnae.classe_4d)
    # L2 — CNAE 2d via mapeamento IBGE (comércio/serviços).
    if base is None:
        base = table.by_cnae_2d.get(cnae.divisao)
    # L3 — Fallback por seção.
    if base is None:
        base = table.by_secao.get(cnae.secao)
    # Última esperança.
    if base is None:
        base = RazaoLookup(
            razao=0.25,
            source_table="HARD_DEFAULT",
            source_category_code="",
            source_category_name="Sem dado, default 25%",
            source_precision="baixa",
        )

    # Ajuste por faixa de pessoal — só aplicável quando:
    # (a) headcount foi fornecido
    # (b) fonte é PIA classe 4d (precisão alta) — pra outras fontes o ajuste
    #     não tem fundamento estatístico
    # (c) CSV de faixas existe
    if (
        headcount is None
        or base.source_precision != "alta"
        or not size_table_path.exists()
    ):
        return base

    size_table = _get_size_table(str(size_table_path))
    factor = _size_adjustment_factor(headcount, cnae, size_table)
    if factor == 1.0:
        return base

    faixa = _faixa_for_headcount(headcount) or "?"
    return RazaoLookup(
        razao=base.razao * factor,
        source_table=base.source_table + "+1839",
        source_category_code=base.source_category_code,
        source_category_name=(
            f"{base.source_category_name} | ajuste faixa {faixa} (×{factor:.2f})"
        ),
        source_precision=base.source_precision,
    )
