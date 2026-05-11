"""DealFlow BR — protótipo MVP (RJ/SP).

Sequência §8 do `docs/architecture.md`. Cada módulo cobre uma etapa:

    sources      §2     download/load das 5 bases
    match        §4     Match RAIS Estabelecimentos × Receita CNPJ
    benchmark    §5     salário médio CNAE × município via RAIS Vínculos
    multipliers  §6.2   encargos por bloco · §6.3 razão folha/receita
    estimator    §6.1   fórmula · §6.4 confiança
    pipeline     §8     sequência consolidada por CNPJ
"""

__version__ = "0.2.0"
