"""Benchmark salarial CNAE × município (§5).

A RAIS Vínculos é processada uma vez por ano-base no BigQuery (Base dos
Dados); o resultado é salvo como tabela de referência em
``data/reference/benchmark_salarial.parquet`` e consultado em runtime.

Saída da query (§5.2):
    cnae_2_subclasse, id_municipio, salario_medio, n_vinculos
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .domain import CNAE

BENCHMARK_REFERENCE_PATH = Path("data/reference/benchmark_salarial.parquet")

# §5.2 — consulta autoritativa; executar uma vez por ano-base.
BENCHMARK_QUERY_SQL = """
SELECT
  cnae_2_subclasse,
  id_municipio,
  AVG(valor_remuneracao_media) AS salario_medio,
  COUNT(*)                     AS n_vinculos
FROM `basedosdados.br_me_rais.microdados_vinculos`
WHERE ano = @ano
  AND sigla_uf IN ('RJ', 'SP')
  AND vinculo_ativo_3112 = '1'
  AND tipo_vinculo IN ('10', '15')   -- CLT urbano e por prazo
  AND valor_remuneracao_media > 0
GROUP BY cnae_2_subclasse, id_municipio
HAVING COUNT(*) >= 10
"""


@dataclass(frozen=True, slots=True)
class SalaryBenchmark:
    """Salário médio agregado para uma célula CNAE × município.

    Attributes:
        cnae_2_subclasse: CNAE 2.0 subclasse (7 dígitos).
        id_municipio: Código IBGE de 7 dígitos.
        salario_medio_brl: Média do ``valor_remuneracao_media`` em reais.
        n_vinculos: Tamanho amostral da célula (entra no score de confiança).
        granularity: ``'cnae_municipio'`` | ``'cnae_uf'`` | ``'cnae_nacional'``
            — indica qual nível de fallback foi usado.
    """

    cnae_2_subclasse: str
    id_municipio: str
    salario_medio_brl: float
    n_vinculos: int
    granularity: str


def build_benchmark(ano: int, dest: Path = BENCHMARK_REFERENCE_PATH) -> None:
    """Executa ``BENCHMARK_QUERY_SQL`` no BigQuery e salva o resultado.

    Args:
        ano: Ano-base passado como parâmetro nomeado ``@ano`` da query.
        dest: Caminho parquet onde o resultado é persistido.

    Raises:
        NotImplementedError: Stub — depende de credencial GCP do usuário.
    """
    raise NotImplementedError(
        "TODO: rodar via basedosdados.read_sql ou bigquery.Client(); "
        "salvar em data/reference/benchmark_salarial.parquet"
    )


def benchmark_for(cnae: CNAE, id_municipio: str) -> SalaryBenchmark:
    """Lê a tabela de referência e devolve a entrada apropriada.

    Aplica cascata de fallback quando a célula não tem amostra suficiente:
    ``cnae × município`` → ``cnae × UF`` → ``cnae nacional``.

    Args:
        cnae: CNAE 2.0 do estabelecimento.
        id_municipio: Código IBGE de 7 dígitos.

    Returns:
        ``SalaryBenchmark`` com o nível de granularidade efetivamente usado.

    Raises:
        NotImplementedError: Stub.
    """
    raise NotImplementedError(
        "TODO: pl.read_parquet + filter; fallback de granularidade quando ausente"
    )
