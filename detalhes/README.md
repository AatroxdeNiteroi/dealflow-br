# Detalhes · documentação técnica completa do Genesis Radar

Pasta de referência exaustiva. Cada documento cobre um aspecto do motor,
das fontes, das tabelas e das decisões. Para quem precisa entender **como
e por quê** o produto funciona — não só usá-lo.

> **Empresa:** Genesis Labs Ltda. · **Produto:** Genesis Radar
> Motor de estimativa de faturamento de Ltdas de médio porte (RJ/SP) a
> partir de fontes públicas oficiais.

## Índice

| Documento | Conteúdo |
|---|---|
| [`metodologia-motor.md`](metodologia-motor.md) | A fórmula completa. Match RAIS, benchmark salarial, encargos, razão folha/receita em 3 camadas, ajuste por faixa de pessoal. |
| [`fontes-de-dados.md`](fontes-de-dados.md) | Todas as fontes públicas: Receita Federal, RAIS, IBGE (PIA/PAS/PAC), CVM, Portal da Transparência, Comex Stat. URLs, granularidade, defasagem. |
| [`tabelas-de-referencia.md`](tabelas-de-referencia.md) | Cada CSV em `data/reference/` explicado coluna a coluna. |
| [`classificacoes-e-codigos.md`](classificacoes-e-codigos.md) | CNAE 2.0 (subclasse/classe/seção), natureza jurídica, códigos da Receita e da RAIS. |
| [`archetypes-e-confianca.md`](archetypes-e-confianca.md) | Os 7 archetypes estruturais + score de confiança (4 fatores) + calibração de incerteza. |
| [`escopo-e-decisoes.md`](escopo-e-decisoes.md) | Filtros do universo do produto + histórico cronológico de decisões. |
| [`alavancas-de-precisao.md`](alavancas-de-precisao.md) | As 3 alavancas: PIA receita-por-pessoa, contratos federais, exposição exportadora. |
| [`validacao.md`](validacao.md) | Fontes de ground truth, resultados de validação medidos, limites honestos. |
| [`pipeline-e-scripts.md`](pipeline-e-scripts.md) | Pipeline BigQuery (13 SQLs) + inventário de todos os scripts Python. |
| [`glossario.md`](glossario.md) | Termos técnicos do projeto. |

## Resumo de uma frase

O motor reconstrói estatisticamente o faturamento de empresas privadas
(que não publicam DRE) cruzando **headcount** (RAIS) × **salário setorial**
(RAIS Vínculos) × **encargos** (calibração IBGE) ÷ **razão folha/receita**
(IBGE PIA/PAS/PAC), com uma segunda fórmula independente (receita por
pessoa ocupada) servindo de validação cruzada.

## Números-chave (snapshot 2026-05-19)

| Métrica | Valor |
|---|---|
| Parquet bruto | 59.511 empresas |
| Universo do produto (após escopo) | 46.115 |
| Empresas com selo de validação cruzada (PIA converge) | 7.191 (15,6%) |
| Erro mediano (validação n=134) | ~23% |
| Tabela razão folha/receita | 308 linhas |
| Tabela receita-por-pessoa (alavanca 1) | 292 linhas |
| Benchmark salarial CNAE×município | 68.265 linhas |

## Documentos relacionados fora desta pasta

- [`../docs/architecture.md`](../docs/architecture.md) — metodologia canônica v3.1 (legado, mantida como referência)
- [`../docs/methodology.md`](../docs/methodology.md) — decisões aplicadas + validação (doc vivo)
- [`../docs/lgpd-context-dossier.md`](../docs/lgpd-context-dossier.md) — contexto LGPD completo
- [`../README.md`](../README.md) — quickstart de instalação
