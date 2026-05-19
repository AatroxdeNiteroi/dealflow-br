# Tabelas de referência

Os CSVs em `data/reference/` — dados curados que alimentam o motor.
Versionados no repositório (não são dados brutos).

---

## 1. `razao_folha_receita_2023.csv` — 308 linhas

O divisor da fórmula. Quanto a folha de pagamento representa da receita,
por setor. Construída em 3 camadas (ver [`metodologia-motor.md`](metodologia-motor.md) §3.5).

| Coluna | Tipo | Descrição |
|---|---|---|
| `cnae_2d` | string | divisão CNAE (2 dígitos) |
| `cnae_4d` | string | classe CNAE (4 dígitos) |
| `razao_folha_receita` | float | folha ÷ receita (ex.: 0,14 = folha é 14% da receita) |
| `source_table` | string | `PIA_7242_7241`, `PAS_2577`, `PAC_1418` ou `DEFAULT_SECAO` |
| `source_category_code` | string | código da categoria na fonte IBGE |
| `source_category_name` | string | descrição oficial |
| `source_precision` | string | `alta` (PIA 4d), `media` (PAS/PAC), `baixa` (default) |
| `ano` | int | 2023 |

Composição: **265 linhas PIA 4d** (alta) + **31 PAS/PAC 2d** (media) +
**12 DEFAULT_SECAO** (baixa).

Gerada por: `scripts/build_razao_folha_receita.py`.

## 2. `razao_by_size_2023.csv` — 24 linhas

Ajuste da razão folha/receita por faixa de pessoal ocupado (PIA tab. 1839).
Corrige o viés "PIA dominada por grandes empresas".

| Coluna | Descrição |
|---|---|
| `tipo_industria` | "Indústrias de transformação", "Indústrias extrativas", "Total" |
| `faixa_label` | "5 a 29", "30 a 49", "50 a 99", "100 a 249", "250 a 499", "500 ou mais", "Até 4", "Total" |
| `razao_folha_receita` | razão da faixa |
| `receita_brl_mil` | receita total da faixa (mil R$) |
| `salarios_brl_mil` | salários da faixa (mil R$) |
| `ano` | 2023 |

**Como funciona o ajuste:** uma empresa de 5-29 funcionários tem razão
~0,148, enquanto a faixa 500+ tem ~0,060. O fator de ajuste (razão da
faixa ÷ razão 500+) vai de **2,48×** a **1,0×**.

## 3. `benchmark_salarial.csv` — 68.265 linhas

Salário médio mensal por CNAE × município (RJ/SP), da RAIS Vínculos 2024.

| Coluna | Descrição |
|---|---|
| `cnae_2_subclasse` | CNAE 7 dígitos |
| `id_municipio` | código IBGE 7 dígitos |
| `salario_medio` | média de `valor_remuneracao_media` |
| `n_vinculos` | nº de vínculos na célula (mínimo 10) |

Células com <10 vínculos são omitidas — caem em fallback (CNAE×UF, depois
CNAE nacional). O `n_vinculos` entra no cálculo de confiança: ≥100 é sinal
de benchmark robusto.

## 4. `receita_por_pessoa_2023.csv` — 292 linhas — ALAVANCA 1

A segunda fórmula independente. Receita líquida por pessoa ocupada, por
setor. Permite validação cruzada com a fórmula folha/razão.

| Coluna | Descrição |
|---|---|
| `cnae_2d` | divisão CNAE |
| `cnae_4d` | classe CNAE (com sufixo `00` quando é divisão PAS/PAC) |
| `receita_por_pessoa_brl` | receita líquida ÷ pessoal ocupado, em R$/ano |
| `source_table` | `PIA_7241_7242`, `PAS_2577` ou `PAC_1418` |
| `source_precision` | `alta` (PIA 4d) ou `media` (PAS/PAC) |
| `ano` | 2023 |

Composição: **265 linhas PIA 4d** (alta) + **27 PAS/PAC** (media).

Valores típicos: p25 R$ 383k/funcionário · p50 R$ 583k · p75 R$ 1.042k.

Gerada por: `scripts/build_receita_por_pessoa.py`.

**Uso:** `receita_pia = receita_por_pessoa × headcount`. Quando converge
com a fórmula principal (≤25%), gera o selo de validação cruzada. Ver
[`alavancas-de-precisao.md`](alavancas-de-precisao.md).

## Outras pastas de `data/`

| Caminho | Conteúdo | No repo? |
|---|---|---|
| `data/estimates_final.parquet` | universo do motor (59.511 empresas) | sim |
| `data/reference/` | as 4 tabelas acima | sim |
| `data/sample/matches_sa_abertas.csv` | amostra de validação | sim |
| `data/cvm_cache/handcurated_dre.json` | 104 cases hand-curated | sim |
| `data/contratos_federais_por_cnpj.json` | resultado do scraper Portal | sim |
| `data/empresas_convergentes_pia.csv` | 7.191 empresas com selo de convergência | sim |
| `data/baselines/*.txt` | snapshots de validação | sim |
| `data/socios_index.parquet` | sócios pseudonimizados (PII) | **não** (gitignored) |
| `data/cvm_cache/*.zip/.csv/.pdf` | cache reproduzível da CVM | **não** |
