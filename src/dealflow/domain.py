"""Tipos puros usados em todo o protótipo. Sem I/O.

Domain types are frozen dataclasses with explicit validation in ``__post_init__``.
Identifier types (``CNPJ``, ``CNAE``) normalize and validate on construction so
that downstream code can rely on shape invariants.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import StrEnum

_DIGITS_RE = re.compile(r"\D")

# Mapeamento CNAE 2.0 divisão (2 dígitos) → seção (A..U).
# Fonte: IBGE — https://cnae.ibge.gov.br/
# Cada entrada é (divisao_inicial, divisao_final_inclusive, secao).
_CNAE_SECTION_RANGES: tuple[tuple[int, int, str], ...] = (
    (1, 3, "A"),    # Agricultura, pecuária, pesca
    (5, 9, "B"),    # Indústrias extrativas
    (10, 33, "C"),  # Indústrias de transformação
    (35, 35, "D"),  # Eletricidade e gás
    (36, 39, "E"),  # Água, esgoto, resíduos
    (41, 43, "F"),  # Construção
    (45, 47, "G"),  # Comércio
    (49, 53, "H"),  # Transporte e armazenagem
    (55, 56, "I"),  # Alojamento e alimentação
    (58, 63, "J"),  # Informação e comunicação
    (64, 66, "K"),  # Financeiro
    (68, 68, "L"),  # Imobiliário
    (69, 75, "M"),  # Profissionais e técnicas
    (77, 82, "N"),  # Administrativas e suporte
    (84, 84, "O"),  # Administração pública
    (85, 85, "P"),  # Educação
    (86, 88, "Q"),  # Saúde humana e social
    (90, 93, "R"),  # Artes e recreação
    (94, 96, "S"),  # Outras atividades de serviços
    (97, 98, "T"),  # Serviços domésticos
    (99, 99, "U"),  # Organismos internacionais
)


def _cnae_section_for(divisao: str) -> str:
    """Mapeia divisão CNAE (2 dígitos) para seção (letra A..U).

    Args:
        divisao: String de 2 dígitos correspondente à divisão CNAE.

    Returns:
        Letra da seção CNAE 2.0.

    Raises:
        ValueError: Se a divisão não cair em nenhum range conhecido.
    """
    d = int(divisao)
    for start, end, secao in _CNAE_SECTION_RANGES:
        if start <= d <= end:
            return secao
    raise ValueError(f"divisão CNAE desconhecida: {divisao!r}")


@dataclass(frozen=True, slots=True)
class CNPJ:
    """CNPJ brasileiro de 14 dígitos.

    A entrada (``raw``) pode vir com pontuação ou só dígitos; o tipo normaliza
    em ``digits`` e expõe a forma formatada em ``__str__``.

    Raises:
        ValueError: Se ``raw`` não contiver exatamente 14 dígitos.
    """

    raw: str

    @property
    def digits(self) -> str:
        """Apenas os 14 dígitos, sem pontuação."""
        return _DIGITS_RE.sub("", self.raw)

    def __post_init__(self) -> None:
        if len(self.digits) != 14:
            raise ValueError(f"CNPJ must have 14 digits, got {self.raw!r}")

    def __str__(self) -> str:
        d = self.digits
        return f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}"


@dataclass(frozen=True, slots=True)
class CNAE:
    """CNAE 2.0 de 7 dígitos (subclasse).

    A RAIS Estabelecimentos guarda CNAE no nível subclasse (``cnae_2_subclasse``),
    enquanto IBGE PIA/PAC/PAS publicam por classe (4 dígitos). As propriedades
    ``classe_4d`` e ``divisao`` extraem os níveis correspondentes.
    """

    code: str

    @property
    def secao(self) -> str:
        """Letra da seção CNAE (A..U) derivada da divisão.

        Returns:
            Uma letra maiúscula correspondente à seção CNAE 2.0.
        """
        return _cnae_section_for(self.code[:2])

    @property
    def divisao(self) -> str:
        """2 primeiros dígitos do CNAE."""
        return self.code[:2]

    @property
    def classe_4d(self) -> str:
        """4 primeiros dígitos do CNAE — granularidade da IBGE PIA/PAC/PAS."""
        return self.code[:4]


class Porte(StrEnum):
    """Porte declarado na tabela EMPRESA da Receita Federal."""

    NAO_INFORMADO = "01"
    ME = "03"
    EPP = "05"
    DEMAIS = "00"


class MatchConfidence(StrEnum):
    """Classificação do resultado do Match RAIS Estabelecimentos.

    Conforme §4.3 (classificação) e §4.5 (fallback) da arquitetura.
    """

    HIGH = "alta"          # match único — §4.3
    MEDIUM = "media"       # 2-3 candidatos resolvidos por desempate — §4.4
    LOW = "baixa"          # 4+ candidatos OU benchmark/setor fraco
    FALLBACK = "fallback"  # Match falhou; proxy via porte — §4.5


@dataclass(frozen=True, slots=True)
class MatchResult:
    """Saída do Match RAIS Estabelecimentos × Receita CNPJ (§4).

    Attributes:
        cnpj: Identificação do CNPJ resolvido.
        rais_estab_index: Índice da linha correspondente na RAIS Estabelecimentos,
            ou ``None`` quando o match caiu em fallback.
        headcount: ``quantidade_vinculos_ativos`` extraído da RAIS.
        confidence: Classificação do match conforme §4.3/§4.5.
        n_candidates: Número de candidatos retornados pela chave composta.
        rationale: Explicação curta auditável (entra no output final).
    """

    cnpj: CNPJ
    rais_estab_index: int | None
    headcount: int
    confidence: MatchConfidence
    n_candidates: int
    rationale: str


@dataclass(frozen=True, slots=True)
class RevenueEstimate:
    """Saída final do motor (§6.1 + §6.4).

    Sempre representa um intervalo, nunca ponto isolado, conforme princípio
    metodológico do produto.

    Raises:
        ValueError: Se ``low_brl <= point_brl <= high_brl`` for violado.
    """

    cnpj: CNPJ
    low_brl: float
    high_brl: float
    point_brl: float
    confidence: MatchConfidence
    headcount: int
    salario_medio_brl: float
    encargos_multiplier: float
    razao_folha_receita: float
    n_vinculos_benchmark: int
    rationale: str

    def __post_init__(self) -> None:
        if not (self.low_brl <= self.point_brl <= self.high_brl):
            raise ValueError("low ≤ point ≤ high required")
