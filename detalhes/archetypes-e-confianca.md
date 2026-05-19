# Archetypes e confiança

Como o motor classifica empresas estruturalmente e como ele declara
quão confiável é cada estimativa.

---

## Archetypes — 7 perfis estruturais

A fórmula §6.1 é setorial — não vê a **estrutura societária**. Mas a
Receita publica `capital_social`, `qualificacao_socio`,
`data_entrada_sociedade`, etc. Esses sinais classificam cada empresa em
um archetype.

> **Archetype NÃO é fator do cálculo de receita.** É filtro de produto —
> guia a tese M&A e sinaliza onde o modelo perde confiança. Experimentos
> com ajuste numérico por archetype pioraram tanto quanto melhoraram, e
> foram descartados.

Eram 8 archetypes. **`holding_structure` foi removido** após validação
mostrar erro mediano >75% — holding não opera, a receita real são
dividendos de controladas. Restam 7:

| Archetype | Heurística (sinais Receita) | Uso de produto |
|---|---|---|
| `family_mature_sweet_spot` | 2-4 sócios PF, idade ≥10 anos, capital R$100k-5M, headcount 20-200 | **Magic filter** — sucessão familiar, perfil canônico search fund |
| `labor_intensive_midcap` | seção B/C/F/G, headcount 50-500, capital >R$500k | Indústria/varejo médio porte — confidence alta em geral |
| `capital_intensive` | seção C/D, capital ≥R$10M, ratio headcount/capital baixo | Atenção: viés residual +35-40% em midcaps 100-500 funcs |
| `partnership_heavy_services` | seção J/K/M, ≥5 sócios, headcount baixo | Low-CLT — confidence rebaixada automaticamente |
| `recent_startup` | idade <5 anos, capital <R$100k | Fora do escopo M&A maduro |
| `financeiro_out_scope` | CNAE divisão 64/65/66 | Fora do escopo PIA/PAS/PAC |
| `standard` | resto do universo | Aplica §6.1 sem ressalva específica |

Distribuição no universo do produto (46.115 empresas):

| Archetype | N |
|---|---|
| standard | ~33.000 |
| family_mature_sweet_spot | ~5.400 |
| labor_intensive_midcap | ~4.700 |
| partnership_heavy_services | ~1.600 |
| recent_startup | ~700 |
| financeiro_out_scope | ~485 |
| capital_intensive | ~190 |

## Confiança (`confidence`)

Score qualitativo em 4 níveis: `alta` · `media` · `baixa` · `sem_benchmark`.
Combina 4 fatores, em cascata — a primeira regra que casa decide.

### Os 4 fatores

1. **Setor low-CLT com headcount baixo** (seções J/K/M, <20 funcs) → `baixa`.
   Headcount RAIS subestima quando há muitos pró-labores.
2. **Match em fallback** → propaga confiança baixa.
3. **Precisão da razão folha/receita** atua como **teto**:
   - razão precisão `baixa` (DEFAULT_SECAO) → no máximo `baixa`
   - razão precisão `media` (PAS/PAC) → no máximo `media`
   - razão precisão `alta` (PIA 4d) → pode chegar a `alta`
4. **Combinação Match × benchmark × razão:**
   - Match Tier 1 + `n_vinculos ≥ 100` + razão alta → `alta`
   - Match fraco OU `n_vinculos < 30` → `baixa`
   - Resto → `media`

### Margem de erro típica por nível

| Confiança | Margem típica | Recomendação de uso |
|---|---|---|
| `alta` | ±15% | funil M&A sem validação adicional |
| `media` | ±25-30% | validar pontualmente antes de aprofundar |
| `baixa` | >35% | tratar como ordem de magnitude |
| `sem_benchmark` | indeterminada | célula CNAE×município sem amostra salarial |

## Calibração de incerteza (pós-processamento)

Aplicada em runtime no backend (`loader.py`), **não altera o parquet**.

### Alargamento do intervalo

O parquet upstream produz intervalo low/high muito apertado (±10% mediano)
que não reflete o erro real medido (±20%+). O backend alarga o intervalo
por confidence:

| Confiança | Fator de alargamento |
|---|---|
| `alta` | ×1,4 |
| `media` | ×1,8 |
| `baixa` | ×2,5 |
| `sem_benchmark` | ×3,0 |

Resultado: intervalo passa de ±10% para ±14-21% mediano — honesto.

### Ajustes de confidence em runtime

| Regra | Efeito |
|---|---|
| `capital_intensive` com headcount 100-500 | rebaixa para `baixa` (viés PIA 1839 conhecido) |
| Convergência PIA ≤25% (selo) | **promove** um nível (baixa→media, media→alta) |
| Piso de contrato federal > estimativa | rebaixa para `baixa` (subestimação comprovada) |

> **Princípio da convergência PIA:** só ADICIONA confiança. Divergência
> nunca penaliza — a folha continua sendo a estimativa de referência.
> Ver [`alavancas-de-precisao.md`](alavancas-de-precisao.md).
