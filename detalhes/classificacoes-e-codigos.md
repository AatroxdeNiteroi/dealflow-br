# Classificações e códigos

Os sistemas de código que o motor usa. Saber ler estes códigos é
pré-requisito pra entender qualquer query ou tabela do projeto.

---

## CNAE 2.0 — Classificação Nacional de Atividades Econômicas

A versão vigente, mantida pela CONCLA/IBGE. É **hierárquica** — 5 níveis,
do mais amplo ao mais granular:

| Nível | Dígitos | Quantidade | Exemplo |
|---|---|---|---|
| **Seção** | 1 letra | 21 seções | C — Indústrias de transformação |
| **Divisão** | 2 dígitos | 87 divisões | 10 — Fabricação de produtos alimentícios |
| **Grupo** | 3 dígitos | ~285 grupos | 10.1 — Abate e fabricação de produtos de carne |
| **Classe** | 4 dígitos | ~673 classes | 1011-2 — Abate de reses |
| **Subclasse** | 7 dígitos | ~1.330 subclasses | 1011-2/01 — Frigorífico (abate de bovinos) |

### Onde cada nível é usado no motor

| Etapa | Nível CNAE | Coluna no parquet |
|---|---|---|
| Match RAIS (identificação) | Subclasse · 7 dígitos | `cnae_2_subclasse` |
| Benchmark salarial | Subclasse · 7 dígitos | `cnae_2_subclasse` |
| Razão folha/receita | Classe · 4 dígitos (cascata) | `cnae_4d` |
| Multiplicador de encargos | Seção · 1 letra | `cnae_secao` |
| Archetype `financeiro_out_scope` | Divisão 64/65/66 | derivado |

### As 21 seções CNAE

| Letra | Seção | Divisões |
|---|---|---|
| A | Agropecuária | 01-03 |
| B | Indústrias extrativas | 05-09 |
| C | Indústrias de transformação | 10-33 |
| D | Eletricidade e gás | 35 |
| E | Água, esgoto, resíduos | 36-39 |
| F | Construção | 41-43 |
| G | Comércio | 45-47 |
| H | Transporte e armazenagem | 49-53 |
| I | Alojamento e alimentação | 55-56 |
| J | Informação e comunicação | 58-63 |
| K | Atividades financeiras e seguros | 64-66 |
| L | Atividades imobiliárias | 68 |
| M | Atividades profissionais e técnicas | 69-75 |
| N | Atividades administrativas | 77-82 |
| O | Administração pública | 84 |
| P | Educação | 85 |
| Q | Saúde humana e serviços sociais | 86-88 |
| R | Artes, cultura, esporte | 90-93 |
| S | Outros serviços | 94-96 |
| T | Serviços domésticos | 97 |
| U | Organismos internacionais | 99 |

## Natureza jurídica

Código de 4 dígitos da tabela da Receita. Os relevantes para o produto:

| Código | Natureza | No produto? |
|---|---|---|
| **2062** | Sociedade Empresária Limitada (Ltda) | **SIM — é o universo do produto** |
| 2046 | Sociedade Anônima Aberta | não (referência de validação) |
| 2054 | Sociedade Anônima Fechada | não (referência de validação) |
| 2135 | Empresário Individual | não |
| 2240 | Sociedade Simples Limitada | não |
| 2305 | Empresa Individual de Resp. Limitada (EIRELI) | não |

> O motor filtra `natureza_juridica == '2062'`. Tudo que não é Ltda fica
> fora do produto — mas pode aparecer no parquet bruto como referência.

## Códigos da Receita Federal

> ⚠️ No Base dos Dados, códigos numéricos da Receita são armazenados
> **sem zero à esquerda**. `'02'` (Ativa) vira `'2'`, `'08'` (Baixada)
> vira `'8'`. Sempre conferir com `GROUP BY`.

### `situacao_cadastral`
| Código | Significado |
|---|---|
| `1` | Nula |
| **`2`** | **Ativa** (único usado) |
| `3` | Suspensa |
| `4` | Inapta |
| `8` | Baixada |

### `porte` (na tabela `empresas`)
| Código | Porte |
|---|---|
| `1` | ME — Microempresa |
| `3` | EPP — Empresa de Pequeno Porte |
| `5` | Demais |
| `0`/NULL | Não informado |

### `identificador_matriz_filial`
| Código | Significado |
|---|---|
| `1` | Matriz |
| `2` | Filial |

## Códigos da RAIS

### `tipo_estabelecimento`
| Código | Significado |
|---|---|
| `1` | Único |
| `5` | Matriz |
(o motor filtra `IN ('1','5')`)

### `tamanho_estabelecimento`
Faixas de pessoal ocupado, códigos `2`–`10`. Usado no desempate Tier 2
(coerência de porte).

### `indicador_simples`
STRING `'0'` (não-Simples) ou `'1'` (Simples). É o único indicador da
RAIS que é STRING — os demais (`indicador_atividade_ano`,
`indicador_rais_negativa` etc.) são INT64.

## Classificações de produto (geradas pelo motor)

### `confidence`
`alta` · `media` · `baixa` · `sem_benchmark`. Ver [`archetypes-e-confianca.md`](archetypes-e-confianca.md).

### `archetype`
7 perfis estruturais. Ver [`archetypes-e-confianca.md`](archetypes-e-confianca.md).

### `convergencia_flag`
`convergente` · `nao_convergente` · `sem_pia`. Ver [`alavancas-de-precisao.md`](alavancas-de-precisao.md).

### `match_tier`
`Tier 1` (match único) · `Tier 2` (desempate por cascata).
