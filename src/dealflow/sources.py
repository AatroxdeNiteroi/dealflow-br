"""Download + load das 5 fontes públicas (§2).

Convenção: cada ``download_*`` baixa para ``data/raw/<fonte>/`` e devolve o
caminho do arquivo principal. Cada ``load_*`` registra views DuckDB em cima
dos arquivos brutos.

Bases (§2.1):
    Receita Federal CNPJ — dados-abertos.receita.fazenda.gov.br (CSV mensal).
    RAIS Estabelecimentos — Base dos Dados ou MTE (parquet anual).
    RAIS Vínculos — Base dos Dados via BigQuery (microdados anuais).
    Simples Nacional — portal público (scraping pontual).
    Compartilha RFB — API SERPRO (apenas no funil ativo, §7).
"""

from __future__ import annotations

from pathlib import Path

# Endpoints públicos — a Receita publica mensalmente, a RAIS anualmente.
RECEITA_DUMP_BASE_URL = (
    "https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-da-pessoa-juridica-cnpj"
)
RAIS_BASEDOSDADOS_TABLE_ESTAB = "basedosdados.br_me_rais.microdados_estabelecimentos"
RAIS_BASEDOSDADOS_TABLE_VINC = "basedosdados.br_me_rais.microdados_vinculos"


def download_receita_cnpj(dest: Path, *, ano_mes: str | None = None) -> Path:
    """Baixa os dumps oficiais ESTABELECIMENTO + EMPRESA + SIMPLES.

    Args:
        dest: Pasta de destino (criada se não existir).
        ano_mes: Identificador do snapshot no formato ``"YYYYMM"``.
            Quando ``None``, baixa o snapshot mais recente disponível.

    Returns:
        Pasta contendo os arquivos descompactados.

    Raises:
        NotImplementedError: Stub.
    """
    raise NotImplementedError("TODO: httpx download + unzip de dados.gov.br")


def download_rais_estabelecimentos(dest: Path, *, ano: int) -> Path:
    """Baixa a RAIS Estabelecimentos do ano-base.

    Args:
        dest: Pasta de destino.
        ano: Ano-base (ex.: 2024 para a publicação mais recente em mai/2026).

    Returns:
        Caminho do arquivo parquet baixado.

    Raises:
        NotImplementedError: Stub.
    """
    raise NotImplementedError("TODO: basedosdados.read_table ou download direto MTE")


def consultar_simples(cnpj_digits: str) -> dict:
    """Consulta o portal do Simples Nacional para um CNPJ específico.

    Scraping pontual. **Não usar em batch sem rate-limit** — o portal bloqueia.

    Args:
        cnpj_digits: CNPJ normalizado (14 dígitos, só números).

    Returns:
        Dicionário com chaves ``optante`` (bool), ``data_opcao`` (date | None),
        ``data_exclusao`` (date | None), ``motivo_exclusao`` (str | None).

    Raises:
        NotImplementedError: Stub.
    """
    raise NotImplementedError("TODO: scraping do portal Simples")


def load_receita_cnpj(raw_dir: Path):
    """Carrega ESTABELECIMENTO + EMPRESA + SIMPLES em views DuckDB.

    Args:
        raw_dir: Pasta contendo os CSVs descompactados.

    Returns:
        Conexão DuckDB com as 3 views registradas.

    Raises:
        NotImplementedError: Stub.
    """
    raise NotImplementedError("TODO: duckdb.read_csv + register de views")


def load_rais_estabelecimentos(raw_dir: Path, *, ano: int):
    """Carrega RAIS Estabelecimentos como view DuckDB.

    Args:
        raw_dir: Pasta contendo o parquet RAIS.
        ano: Ano-base do arquivo.

    Returns:
        Conexão DuckDB com a view ``rais_estabelecimentos`` registrada.

    Raises:
        NotImplementedError: Stub.
    """
    raise NotImplementedError("TODO: duckdb.read_parquet")
