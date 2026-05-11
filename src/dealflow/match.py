"""Match RAIS Estabelecimentos × Receita CNPJ (§4).

Operação central do produto. Sequência:

    filter_receita_universe   §4.1
    filter_rais_universe      §4.1
    run_match                 §4.2 + §4.3
    apply_dismatch_filters    §4.4
    fallback                  §4.5
    collect_results
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from .domain import MatchResult


@dataclass(frozen=True, slots=True)
class MatchKey:
    """Chave composta §4.2.

    Em SP/RJ capital, ``bairro`` é populado e entra na chave; em outros
    municípios fica ``None`` (apenas o subconjunto base é usado).
    """

    cep: str
    cnae_2_subclasse: str  # 7 dígitos
    natureza_juridica: str
    tipo_estabelecimento: str  # 'matriz' | 'filial' | 'único'
    id_municipio: str  # IBGE 7 dígitos
    bairro: str | None = None


def filter_receita_universe(conn) -> None:
    """Cria a view ``receita_universe`` com filtros §4.1 do lado Receita.

    Args:
        conn: Conexão DuckDB com as views da Receita Federal já registradas.

    Raises:
        NotImplementedError: Stub.
    """
    raise NotImplementedError(
        "TODO: WHERE situacao_cadastral='02' AND opcao_simples='N' "
        "AND porte IN ('05','00') AND uf IN ('RJ','SP') "
        "AND identificador_matriz_filial='1'"
    )


def filter_rais_universe(conn, *, ano: int) -> None:
    """Cria a view ``rais_universe`` com filtros §4.1 do lado RAIS Estabelecimentos.

    Args:
        conn: Conexão DuckDB com a view RAIS já registrada.
        ano: Ano-base a filtrar.

    Raises:
        NotImplementedError: Stub.
    """
    raise NotImplementedError(
        "TODO: WHERE ano=? AND indicador_atividade_ano='S' "
        "AND indicador_rais_negativa='N' AND indicador_simples='N' "
        "AND sigla_uf IN ('RJ','SP') AND tipo_estabelecimento IN ('matriz','único') "
        "AND tamanho_estabelecimento compatível com 20+ vínculos"
    )


def run_match(conn) -> None:
    """Executa o JOIN §4.2 pela chave composta e materializa ``match_raw``.

    A tabela resultante carrega colunas ``cnpj``, ``rais_row_id``,
    ``n_candidates``, ``headcount`` e atributos brutos para desempate.

    Args:
        conn: Conexão DuckDB com ``receita_universe`` e ``rais_universe``.

    Raises:
        NotImplementedError: Stub.
    """
    raise NotImplementedError(
        "TODO: JOIN ON (CEP, cnae_2_subclasse, natureza_juridica, "
        "tipo_estabelecimento, id_municipio[, bairro])"
    )


def apply_dismatch_filters(conn) -> None:
    """Aplica em cascata os 5 filtros de desempate (§4.4).

    Ordem: coerência ``indicador_simples`` → porte → temporal → subatividade
    IBGE → bairro (capitais). O primeiro filtro que reduz a 1 candidato decide.

    Args:
        conn: Conexão DuckDB com ``match_raw`` já materializada.

    Raises:
        NotImplementedError: Stub.
    """
    raise NotImplementedError("TODO: cascade de UPDATE com WHERE")


def fallback_aggregation(conn) -> None:
    """Aplica o fallback §4.5 para CNPJs sem match único.

    Soma headcount de filiais com match único pela mesma raiz, ou usa proxy
    via porte declarado (ME ≤9, EPP ≤49, Demais 50+). Marca confiança baixa.

    Args:
        conn: Conexão DuckDB com ``match_raw`` pós-desempate.

    Raises:
        NotImplementedError: Stub.
    """
    raise NotImplementedError("TODO: GROUP BY cnpj_basico + proxy por porte")


def collect_results(conn) -> Iterable[MatchResult]:
    """Materializa a tabela final em ``MatchResult`` por CNPJ.

    Args:
        conn: Conexão DuckDB com ``match_raw`` final.

    Yields:
        Um ``MatchResult`` por CNPJ resolvido (ou em fallback).

    Raises:
        NotImplementedError: Stub.
    """
    raise NotImplementedError("TODO: SELECT * FROM match_raw → MatchResult")
