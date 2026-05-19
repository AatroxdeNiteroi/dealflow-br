# Metodologia do motor — a fórmula completa

Como o Genesis Radar reconstrói o faturamento de uma empresa que não
publica nada.

---

## 1. O problema

Empresas Ltda. brasileiras não declaram faturamento publicamente — sigilo
fiscal (art. 198 do CTN). Bureaus pagos (Serasa, BoaVista) vendem faixas
opacas, sem proveniência. O motor reconstrói a estimativa **só com dado
público**, de forma auditável: cada número rastreável até a fonte primária.

## 2. A fórmula base

```
Folha estimada   = headcount × salário_médio_mensal × 12 × multiplicador_encargos
Receita estimada = Folha estimada ÷ razão_folha_receita_setorial
```

Quatro fatores, cada um de uma fonte:

| Fator | Fonte | O que é |
|---|---|---|
| `headcount` | RAIS Estabelecimentos | nº de vínculos CLT ativos |
| `salário_médio_mensal` | RAIS Vínculos | média salarial do CNAE × município |
| `multiplicador_encargos` | calibração IBGE | folha total ÷ salário base (1,4–2,1) |
| `razão_folha_receita` | IBGE PIA/PAS/PAC | quanto a folha representa da receita |

**Saída:** intervalo `(receita_low, receita_point, receita_high)` +
`confidence` ∈ {alta, media, baixa, sem_benchmark}.

## 3. Etapa por etapa

### 3.1 Match RAIS — identificar a empresa

A RAIS pública é **anonimizada** (sem CNPJ). Para saber o headcount de uma
empresa específica, é preciso casar o registro da RAIS Estabelecimentos
com o cadastro CNPJ da Receita Federal através de uma **chave composta**:

```
chave_match = CEP
            + cnae_2_subclasse   (7 dígitos)
            + natureza_juridica
            + tipo_estabelecimento
            + id_municipio        (IBGE 7 dígitos)
```

Resultado da chave:

| Candidatos na chave | Classificação | Ação |
|---|---|---|
| 1 CNPJ | **Tier 1** — match único, identidade confirmada | atribui o headcount direto |
| 2–5 CNPJs | **Tier 2** — ambíguo | cascata de desempate (§3.2) |
| 6+ CNPJs | não resolvido | descartado (não força match ruim) |

### 3.2 Cascata de desempate (Tier 2)

Para chaves com 2–5 candidatos, 3 critérios — cada um vale 1 ponto. O
vencedor precisa de **score ≥ 2 E vencer sozinho** (sem empate no topo):

1. **Coerência de porte**: `porte` da Receita × `tamanho_estabelecimento` da RAIS
2. **Coerência temporal**: data de início da empresa < ano-base da RAIS
3. **Coerência Simples**: opção pelo Simples na Receita casa com o indicador na RAIS

Taxa empírica: ~29% das chaves ambíguas resolvem. 96% dos resolvidos com
score 3/3 — qualidade comparável ao Tier 1.

### 3.3 Benchmark salarial

A RAIS Vínculos não tem CEP nem identificador de estabelecimento — só
serve para **agregados**. Constrói-se uma tabela:

```sql
salário_médio = AVG(valor_remuneracao_media)
GROUP BY cnae_2_subclasse, id_municipio
HAVING COUNT(*) >= 10   -- amostra mínima
```

Células com menos de 10 vínculos caem em fallback: CNAE × UF, depois
CNAE nacional.

**Por que média e não mediana:** folha = soma de salários. Folha ÷
headcount = média, por definição. Mediana subestima (ignora a cauda alta).

### 3.4 Multiplicador de encargos

Converte salário-base em **folha total** (encargos, 13º, FGTS, férias,
benefícios). Calibrado por **seção CNAE** (grão grosso, pois encargo é
estrutural por grande setor):

| Bloco | Seções CNAE | Multiplicador |
|---|---|---|
| Indústria | B, C | 1,9 – 2,1 |
| Construção | F | 1,9 – 2,0 |
| Comércio | G | 1,6 – 1,7 |
| Serviços gerais | H, I, N | 1,6 – 1,8 |
| TI/telecom (com desoneração) | J | 1,4 – 1,6 |
| Serviços profissionais | K, M | 1,7 – 1,9 |

O motor calcula `folha_low` (encargo mínimo) e `folha_high` (máximo) — daí
o intervalo da estimativa.

### 3.5 Razão folha/receita — 3 camadas

O divisor da fórmula. Vem do IBGE, mas **a granularidade muda por setor**
porque as pesquisas estruturais publicam em níveis diferentes:

| Camada | Fonte | Granularidade | Precisão | Cobre |
|---|---|---|---|---|
| **L1** | PIA 7241+7242 | CNAE 4d real (265 classes) | alta | Indústria (seções B, C) |
| **L2** | PAS 2577 / PAC 1418 | sub-agrupamento IBGE (~31 cats) | media | Comércio (G) e serviços (H-N) |
| **L3** | default por seção (hardcoded) | seção CNAE | baixa | Setores fora de PIA/PAS/PAC (D, E, F, K, P, Q…) |

**Lookup em cascata** (`src/dealflow/multipliers.py::razao_folha_receita_for`):
1. Tenta CNAE 4d na tabela L1
2. Tenta divisão 2d na tabela L2 (via mapeamento `CNAE_TO_IBGE_CATEGORY`)
3. Tenta seção na tabela L3
4. Fallback duro: `0.25`

Por que comércio/serviços não tem CNAE 4d: PAS e PAC são pesquisas
**amostrais** — em 4d o intervalo de confiança estatístico explodiria. O
IBGE publica em sub-agrupamentos por desígnio metodológico.

### 3.6 Ajuste por faixa de pessoal (PIA tabela 1839)

A PIA é dominada por grandes empresas — a razão folha/receita média do
CNAE puxa contra empresas pequenas (que têm razão maior). Quando a razão
vem da PIA (precisão alta) e o headcount é conhecido:

```
razao_ajustada = razao_PIA × (razao_PIA_faixa_X ÷ razao_PIA_500+)
```

Fator vai de **2,48×** (5-29 funcionários) a **1,0×** (500+). Tabela:
`data/reference/razao_by_size_2023.csv`. Ver [`tabelas-de-referencia.md`](tabelas-de-referencia.md).

## 4. Pipeline consolidado (por CNPJ)

1. Roteia por regime tributário (Simples vs não-Simples)
2. Filtra os universos (Receita ativa RJ/SP + RAIS 5+ funcs)
3. Match RAIS — chave composta (§3.1)
4. Desempate Tier 2 (§3.2)
5. Extrai headcount (`quantidade_vinculos_ativos`)
6. Consulta benchmark salarial (§3.3)
7. Aplica encargos (§3.4) → folha
8. Aplica razão folha/receita (§3.5 + §3.6) → receita
9. Calcula confidence (ver [`archetypes-e-confianca.md`](archetypes-e-confianca.md))
10. Enriquece com archetype + sinais societários
11. **Pós-processamento** (no backend, runtime): calibração de incerteza
    + 2ª estimativa PIA + piso de contratos federais (ver
    [`alavancas-de-precisao.md`](alavancas-de-precisao.md))

## 5. Limites estruturais conhecidos

- **RAIS defasada 12–18 meses** — em mai/2026, ano-base 2024.
- **Setores low-CLT** (TI, financeiro, consultoria com pró-labore alto):
  headcount subestima a força de trabalho real → estimativa rebaixada.
- **Multi-plant**: empresa com filiais em vários estados fica fora do
  Tier 1 single-plant (a agregação multi-plant falhou na validação — erro
  >100% — e foi descartada do produto).
- **Benchmark sem granularidade de bairro**: a RAIS 2024 anonimizou o
  campo bairro. Loja em Pinheiros e em Cidade Tiradentes caem na mesma
  célula CNAE×município.
- **Variação intra-CNAE**: benchmarks são médias — capturam o típico, não
  o extremo. Por isso o motor entrega intervalo, não ponto exato.

Detalhes de validação empírica em [`validacao.md`](validacao.md).
