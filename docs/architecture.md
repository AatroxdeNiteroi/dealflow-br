# DealFlow BR — Motor de Identificação e Estimativa de Faturamento

> Source: `DealFlow_BR_Metodologia_Consolidada.docx` v3.1 (MVP RJ/SP). Este arquivo é a referência canônica. O `.docx` fica preservado ao lado para distribuição.

## 1. O problema

Empresas Ltda. de médio porte no Brasil não declaram faturamento publicamente — sigilo fiscal (art. 198 CTN). Bureaus pagos entregam faixas opacas. Solução: motor de estimativa sobre fontes públicas com metodologia auditável + camada opcional de verificação ativa via **Compartilha RFB**.

**Escopo MVP.** RJ ou SP. Restrição geográfica é estratégica: RJ e SP são as únicas capitais onde a RAIS Estabelecimentos expõe **bairro** como variável adicional, e concentram a maioria dos search funds e boutiques M&A do Brasil.

**Princípio de design — separação de dados vs produto.** A faixa R$4,8M–R$100M de "sweet spot M&A médio porte" é **filtro de produto (UI/API)**, não filtro de coleta de dados. A **camada de dados** captura o universo amplo de empresas estimáveis (qualquer Ltda. com operação real em RJ/SP). A **camada de produto** deixa o usuário filtrar por: estimativa de faturamento (range), confiança mínima, setor, geografia, etc. Isso permite que clientes diferentes (search funds tradicionais, boutiques small-business, family offices) usem o mesmo motor com escopos diferentes. Headcount, porte declarado e Simples Nacional **não devem cortar empresas precocemente** — entram como insumos da estimativa ou como dimensão de confidence, mas o filtro de "vale pra mim?" é do usuário.

## 2. As 5 bases

| Base | Atualização | CNPJ | Papel |
|---|---|---|---|
| Receita Federal — Cadastro CNPJ | Mensal | Identificada | Universo + chave de match |
| Simples Nacional — Portal | Tempo real | Identificada | Filtro de teto + exclusão |
| RAIS pública — Estabelecimentos | Anual | Anonimizada | Headcount via Match composto |
| RAIS pública — Vínculos | Anual | Anonimizada | Benchmark salarial CNAE × município |
| Compartilha RFB (e-CAC) | Sob demanda | Identificada (consentimento) | Verificação no funil ativo |

**CAGED foi descartado.** Match RAIS já entrega o headcount; defasagem de 12m é aceitável para triagem M&A.

**Limite estrutural das duas RAIS.** Estabelecimentos e Vínculos são publicadas como tabelas independentes pelo MTE. Não existe identificador comum que ligue uma linha da Vínculos a um estabelecimento específico da Estabelecimentos. Por isso a Vínculos só serve para construir **agregados estatísticos** (benchmark por CNAE × município), nunca para enriquecer perfil de CNPJ identificado. CEP, bairro e geo fina ficam só na Estabelecimentos.

## 3. Divisão por faixa

- **§3.1 Até R$4,8M (Simples Nacional)** — confirmar opção via portal. Se ativo → teto confirmado, aplicar benchmark setorial dentro da faixa. Excluído por excesso → piso com data.
- **§3.2 Acima de R$4,8M (não Simples)** — coração do produto. Identificar estabelecimento na RAIS Estabelecimentos via Match composto contra base CNPJ da Receita.

## 4. Match RAIS — coração do motor

### 4.1 Filtragem inicial

**Lado Receita Federal.** `situacao_cadastral='2'` (Ativa), `opcao_simples != 1` (ou `data_exclusao_simples` preenchida — JOIN em `simples` via `cnpj_basico`), `porte IN ('3','5')` (EPP=3, Demais=5), `sigla_uf IN ('RJ','SP')`, `identificador_matriz_filial='1'` (matriz). Filtrar `data = DATE '2024-12-18'` — snapshot alinhado ao ano-base RAIS 2024. BD publica snapshot mensal; conferir partições disponíveis via `INFORMATION_SCHEMA.PARTITIONS`.

**Códigos Receita confirmados via GROUP BY:**

| Campo | Códigos reais (sem zero à esquerda) |
|---|---|
| `situacao_cadastral` | `'1'`=Nula, **`'2'`=Ativa**, `'3'`=Suspensa, `'4'`=Inapta, `'8'`=Baixada |
| `porte` (em `empresas`) | `'1'`=ME, **`'3'`=EPP**, **`'5'`=Demais**, `'0'`/NULL=Não informado |
| `identificador_matriz_filial` | `'1'`=matriz, `'2'`=filial |

> **Códigos da Receita no Base dos Dados são armazenados SEM zero à esquerda.** `'02'` (Ativa) virou `'2'`, `'08'` (Baixada) virou `'8'`. Isso afeta: `situacao_cadastral`, `identificador_matriz_filial`, `porte`, e qualquer outro código numérico STRING. Sempre conferir valores reais com `GROUP BY` antes de chutar.

**Lado RAIS Estabelecimentos.** `ano = 2024` (último ano-base disponível), `indicador_atividade_ano = 1`, `indicador_rais_negativa = 0`, `indicador_simples = '0'` (sem zero à esquerda; é STRING aqui), `sigla_uf IN ('RJ','SP')`, `quantidade_vinculos_ativos >= 5`, `tipo_estabelecimento IN ('1','5')` (único ou matriz — códigos RAIS), `natureza_juridica LIKE '2%'` (só entidades empresariais).

**Resultado da filtragem (snapshot 2026-05-11):**
- `receita_universe_v1`: ~1.6M CNPJs ativos RJ/SP, matriz, não-Simples
- `rais_universe_v1`: 179.566 estabelecimentos (RAIS 2024, 5+ funcs, natureza 2XXX)

> **Threshold de headcount = 5+ (não 20+) por desígnio.** A camada de dados não decide o que é "médio porte" — captura ampla. O usuário filtra por faturamento estimado no produto. Headcount 5+ apenas garante que existe operação real (empresa com 0-4 funcs é estatisticamente ruidosa demais — variância intra-CNAE explode). Empresas pequenas saem do motor com confidence baixa (§6.4) — produto decide se mostra.

> Tipos reais conferidos no BigQuery — ver `docs/bigquery_schemas.md`. Indicadores da Receita (`opcao_simples`, `opcao_mei`) e da RAIS (`indicador_atividade_ano`, `indicador_rais_negativa`, `indicador_cei_vinculado`, `indicador_pat`) são **INT64**, não STRING `'S'/'N'`. Único indicador STRING é `indicador_simples` na RAIS.

### 4.2 Chave composta

```
chave_match = CEP
            + cnae_2_subclasse        // 7 dígitos
            + natureza_juridica
            + tipo_estabelecimento
            + id_municipio            // IBGE 7 dígitos

chave_match_capital = chave_match + bairros_sp     // se município = SP capital
                                  + bairros_rj     // se município = RJ capital
```

### 4.3 Aplicação

| Candidatos | Classificação | Ação |
|---|---|---|
| 1 CNPJ | Match único — alta | Identifica direto, atribui vínculos |
| 2–3 | Ambíguo — média | Aplicar §4.4 |
| 4+ | Não resolvido — baixa | Aplicar §4.4; se persistir, §4.5 |

**Resultado da chave composta (snapshot 2026-05-11):** `matches_v1` = **72.813 empresas Tier 1** (chave única — identidade confirmada com confiança alta). Casos 2-3 e 4+ ainda não processados; ficam para iteração Tier B (§9.3).

### 4.4 Filtros de desempate (cascata Tier 2)

Implementado em `scripts/sql/11_matches_tier2.sql`. Aplicado a chaves com 2-5 candidatos Receita. Cada critério vale 1 ponto; o candidato vencedor precisa ter **score ≥ 2 E vencer sozinho** (sem empate no topo) — senão a chave é descartada (não força match ruim).

1. **Coerência de porte**: `porte` (Receita) × `tamanho_estabelecimento` (RAIS).
   - Receita `'1'` (ME) ↔ RAIS `'2'`–`'4'` (1-19 funcs)
   - Receita `'3'` (EPP) ↔ RAIS `'4'`–`'6'` (10-99 funcs)
   - Receita `'5'` (Demais) ↔ RAIS `'5'`–`'10'` (20+ funcs)
2. **Coerência temporal**: `Receita.data_inicio_atividade < ano-base RAIS`.
3. **Coerência Simples**: `Receita.opcao_simples != 1` casa com `RAIS.indicador_simples = '0'`.
4. ~~Subatividade IBGE~~ (não implementado — granularidade fina, baixo retorno marginal)
5. ~~Bairro nas capitais~~ (RAIS 2024 anonimizou `bairros_sp`/`bairros_rj` em `999997` — não está mais disponível)

**Resultado empírico:** 9.345 matches Tier 2 confirmados de 32.267 chaves 2-5 cand (taxa 29%). 96% com score 3/3 — qualidade comparável ao Tier 1.

### 4.5 Agregação multi-plant (descartada do produto final)

**Decisão arquitetural pós-validação (2026-05-11):** após implementação e teste sistemático contra 21 DREs públicas, a v3 multi-plant entregou **|erro| médio 107%** com casos catastróficos no varejo (BLAU +917%, RIACHUELO +60%, RAIA DROGASIL +77%). O over-count via chave compartilhada em zonas comerciais densas é **estrutural** — a RAIS pública é anonimizada (sem CNPJ), o que torna impossível desambiguar qual RAIS estab corresponde a qual filial Receita quando a chave (CEP + CNAE + NJ + município) é compartilhada.

**Resultado:** `estimates_v3`, `estabs_universe_v1`, `grupos_estabs_v1`, `benchmark_salarial_v2` ficam como **artefatos exploratórios** no BigQuery (não fazem parte do produto). O produto final (`estimates_final`) usa apenas single-plant — empresas com `n_estabs_ativos_br = 1` na Receita.

A agregação multi-plant continua sendo a direção certa **teoricamente**, mas exige:
- (a) Acesso à RAIS identificada (via convênio MTE/IPEA, fonte paga ou Compartilha RFB §7)
- (b) Ou nova fonte com `cnpj_basico` casável ao headcount

Manter como roadmap mas não bloquear o produto.

### 4.5 (legado) Lógica original de agregação por raiz

A partir das raízes Tier 1 confirmadas (matriz em RJ/SP), expandimos para captar **todas as filiais BR** com headcount na RAIS 2024 — empresa com matriz em SP e filiais em MG/PR/RJ tem o headcount somado em um único grupo. Implementação em `scripts/sql/08_estabs_universe.sql` + `09_grupos_estabs.sql` + `10_estimates_v3.sql`.

**Chave de identidade da filial:** vem do `cnpj_basico` (mesmo da matriz Tier 1). A chave composta da filial pode ter múltiplos candidatos na RAIS — aceita-se isso, mas aplica-se um **deflator de chave compartilhada**:

```
headcount_filial = SUM(headcount_RAIS_estabs_com_mesma_chave)
                   ÷ COUNT(CNPJs_Receita_ativos_com_mesma_chave)
```

Isso reduz over-count em prédios comerciais densos onde várias filiais de empresas diferentes dividem (CEP, CNAE, NJ, município). Trade-off explícito: aceita aproximação onde Tier 1 garantia unicidade.

**Folha calculada planta-a-planta:**

```
folha_grupo_total = SUM por estab( headcount × salario_municipio × 12 × encargos )
receita = folha_grupo_total ÷ razão_folha_receita_CNAE_matriz
```

Salário é do **município do estab** (filial em MG usa benchmark de MG) — exige `benchmark_salarial_v2` nacional. Razão folha/receita é do **CNAE da matriz** (presume operação coerente entre matriz e filiais).

**Fallback que persiste (não implementado):**
- Proxy via porte declarado quando RAIS não tem nenhum estab da raiz — sinalizar confiança baixa + recomendar Compartilha RFB

## 5. RAIS Vínculos — benchmark salarial

**Restrição.** Vínculos não tem CEP nem identificador de estabelecimento. Único uso: benchmark agregado por CNAE × município.

### 5.2 Construção (uma vez por ano-base)

```sql
SELECT
  cnae_2_subclasse,
  id_municipio,
  AVG(valor_remuneracao_media) AS salario_medio,
  COUNT(*)                     AS n_vinculos
FROM `basedosdados.br_me_rais.microdados_vinculos`
WHERE ano = 2024
  AND sigla_uf IN ('RJ', 'SP')
  AND vinculo_ativo_3112 = '1'       -- nome real da coluna, sem o "_" central
  AND tipo_vinculo IN ('10', '15')   -- CLT urbano e por prazo
  AND valor_remuneracao_media > 0
GROUP BY 1, 2
HAVING COUNT(*) >= 10
```

`HAVING COUNT(*) >= 10` garante amostra mínima. Células abaixo caem em fallback de granularidade menor (CNAE × UF, depois CNAE nacional).

**Por que média e não mediana.** Folha = soma de salários. Folha ÷ headcount = média, por definição. Multiplicar média × headcount devolve folha exata. Mediana subestima sistematicamente (ignora cauda superior).

## 6. Fórmula

### 6.1 Base

```
Folha estimada   = headcount × salário_médio_mensal × 12 × multiplicador_encargos_CNAE
Receita estimada = Folha estimada ÷ razão_folha_receita_CNAE
```

### 6.2 Multiplicador de encargos por bloco

| Bloco | Seções CNAE | Multiplicador típico |
|---|---|---|
| Indústria | B, C | 1,9 – 2,1 |
| Construção | F | 1,9 – 2,0 |
| Comércio | G | 1,6 – 1,7 |
| Serviços gerais | H, I, N | 1,6 – 1,8 |
| TI/telecom (com desoneração) | J | 1,4 – 1,6 |
| Serviços profissionais | K, M | 1,7 – 1,9 |

Calibrar empiricamente conforme Compartilha RFB devolve faturamento real.

### 6.3 Razão folha/receita

Vem de IBGE PIA (indústria), PAC (comércio), PAS (serviços) via SIDRA API. **Construída em 3 camadas** por restrição estatística — apenas PIA publica em CNAE 4d real; PAC/PAS publicam em sub-agrupamentos custom IBGE.

| Camada | Fonte | Granularidade | Precisão | Cobertura |
|---|---|---|---|---|
| **L1** | PIA 7241+7242 | CNAE 4d real (265 classes) | alta | Indústria (seções B, C) |
| **L2** | PAS 2577 (~44 cats) e PAC 1418 (~49 cats) | sub-agrupamento IBGE | média | Serviços H-N e Comércio G — divisão CNAE 2d herda razão do sub-agrupamento |
| **L3** | Default hardcoded por seção | seção CNAE | baixa | Setores fora do escopo PIA/PAS/PAC (D, E, F, K, P, Q, etc.) |

**Lookup cascata** (`src/dealflow/multipliers.py`, função `razao_folha_receita_for`):
1. Tenta CNAE 4d na tabela L1 (PIA)
2. Tenta divisão CNAE 2d na tabela L2 (PAS/PAC, via mapeamento `CNAE_TO_IBGE_CATEGORY`)
3. Tenta seção na tabela L3 (DEFAULT_SECAO)
4. Fallback duro: 0.25 (precisão baixa, sinalizada)

Tabela canonizada em `data/reference/razao_folha_receita_2023.csv` (308 linhas: 265 PIA 4d + 31 PAS/PAC 2d + 12 DEFAULT_SECAO) com `source_precision` por linha. Espelhada em BigQuery como `razao_folha_receita_v1`.

**Ajuste por faixa de pessoal (PIA tabela 1839)** — quando a razão vem de PIA (precision='alta') e headcount é conhecido, aplica-se fator multiplicativo:

```
razao_ajustada = razao_PIA × (razao_PIA_faixa_X / razao_PIA_500+)
```

Resolve viés "PIA dominada por grandes" — empresas pequenas no mesmo CNAE têm razão folha/receita maior. Fator vai de **2.48× (5-29 funcs)** até **1.0× (500+)**. Estratificado por tipo de indústria: indústrias de transformação (seção C) e extrativas (seção B). Tabela: `data/reference/razao_by_size_2023.csv` (24 linhas) e `razao_by_size_v1` no BigQuery.

**Por que não temos CNAE 4d em comércio/serviços:** PAS e PAC são pesquisas amostrais; em CNAE 4d o intervalo de confiança estatístico ficaria proibitivo. IBGE oficialmente publica em sub-agrupamentos pra preservar precisão. Não é falta de publicação — é limitação metodológica das pesquisas. Pra ter CNAE 4d em todos setores, fontes pagas (Serasa Empresas, BoaVista) ou calibração futura via Compartilha RFB.

Calibrar empiricamente conforme Compartilha RFB devolve faturamento real (§7.3).

### 6.4 Confiança

Combina **quatro** fatores (regra em cascata; a primeira que casa decide — `src/dealflow/estimator.py::score_confidence`):

1. **Setor low-CLT com headcount baixo** (seções J/K/M, <20 funcs) → `LOW` por §9.2 (headcount RAIS subestima quando há muitos pró-labore).
2. **Match em fallback** → propaga `FALLBACK`.
3. **Precisão da razão folha/receita** (§6.3) atua como **teto**:
   - razão precisão `baixa` (DEFAULT_SECAO) → no máximo `LOW`
   - razão precisão `media` (PAS/PAC sub-agrupamento) → no máximo `MEDIUM`
   - razão precisão `alta` (PIA 4d) ou `manual` → pode chegar a `HIGH`
4. **Combinação Match × benchmark × razão**:
   - Match `HIGH` + `n_vinculos ≥ 100` + razão alta → `HIGH`
   - Match `LOW` OU `n_vinculos < 30` → `LOW`
   - Restante → `MEDIUM`

Output ilustrativo: `Estimativa R$10M–R$14M, confiança alta, baseado em match único na RAIS (Tier 1), benchmark calibrado em 312 vínculos do mesmo CNAE × município, razão folha/receita de PIA 4d (precisão alta), multiplicador setorial bloco G (comércio).`

**Distribuição empírica (estimates_v1, n=72.813):**

| Confiança | N empresas | Mediana receita | Driver |
|---|---|---|---|
| `alta` | 9.733 | R$15.7M | match Tier 1 + benchmark ≥100 + PIA 4d |
| `media` | 39.988 | R$12.2M | razão PAS/PAC OU benchmark 30-100 |
| `baixa` | 20.681 | R$5.2M | razão default OU setor low-CLT OU benchmark <30 |
| `sem_benchmark` | ~2.400 | — | célula CNAE×município sem vínculos suficientes |

### 6.5 Archetype classification (estimates_v2)

A fórmula §6.1 é setorial — não vê a **estrutura societária** da empresa. Mas a Receita publica `capital_social`, `qualificacao_socio`, `data_entrada_sociedade` e `data_inicio_atividade`. Esses sinais permitem segmentar o universo em 8 archetypes — usados como **filtro de produto**, não como ajuste numérico da estimativa.

**Decisão arquitetural pós-validação empírica (2026-05-11):** experimentos com ajuste numérico por archetype (multiplicadores em `estimates_v2_numeric`) pioraram tanto quanto melhoraram (HAGA -5%→-21%, ROMI -18%→-10%, BAUMER +35%→+58%). Conclusão: **o sinal estrutural é real para filtrar leads, mas o público RJ/SP é heterogêneo demais dentro de cada archetype para virar coeficiente.** A v2 mantém o mesmo `receita_estimada` da v1 e expõe os archetypes como metadado.

| Archetype | Heurística (sinais Receita) | Uso de produto |
|---|---|---|
| `family_mature_sweet_spot` | 2-4 sócios PF, idade ≥10 anos, capital R$100k-R$5M, headcount 20-200 | Magic filter — sucessão familiar em curso, perfil canônico search fund |
| `labor_intensive_midcap` | seção B/C/F/G, headcount 50-500, capital >R$500k | Indústria/varejo de médio porte — confidence alta em geral |
| `capital_intensive` | seção C/D, capital ≥R$10M, headcount/capital ratio baixo | Atenção: PIA estratifica até 500 funcs; viés residual +35-40% em midcaps |
| `holding_structure` | natureza 2014/2062/2305, ≥1 sócio PJ, headcount baixo | Excluir do funil M&A (não opera) |
| `recent_startup` | idade <5 anos, capital <R$100k | Fora do escopo M&A maduro |
| `partnership_heavy_services` | seção J/K/M, ≥5 sócios, headcount baixo | Low-CLT — confidence rebaixada automática (§6.4) |
| `financeiro_out_scope` | CNAE divisão 64/65/66 (financeiro/seguros) | Excluir — fora do escopo PIA/PAS/PAC |
| `standard` | resto | Aplicar §6.1 sem ressalva específica |

**Tabela:** `estimates_v2` (72.813 linhas, BigQuery). Colunas adicionais sobre v1:
- `archetype` (string)
- `capital_social_brl` (FLOAT64)
- `n_socios` (INT64), `n_socios_pj` (INT64), `n_socios_pf` (INT64)
- `idade_anos` (INT64, ano-base 2024 − ano `data_inicio_atividade`)
- `natureza_juridica`, `natureza_familia` ('Ltda', 'SA', 'EIRELI', etc.)

Tabela `socios_summary_v1` agrega por `cnpj_basico` os contadores de sócios (a base Receita publica em formato long).

## 7. Compartilha RFB — verificação ativa

API SERPRO retorna faturamento bruto declarado (DEFIS para Simples, ECF para Lucro Presumido/Real). Empresário autoriza no e-CAC com certificado digital.

**Duplo valor.**
1. Entrega faturamento exato — substitui estimativa por número auditável
2. Sinaliza intenção real de venda — o ato de autorizar é em si o lead mais qualificado

**Loop de calibração.** Cada faturamento real serve para corrigir multiplicadores por CNAE/município/porte. Com volume, o motor melhora sozinho.

## 8. Pipeline consolidado por CNPJ

### 8.1 Lógica conceitual

1. **Roteamento por regime tributário** — consulta Simples. Ativo → fluxo direto por porte. Não → §2.
2. **Filtragem inicial** dos universos (Receita + RAIS Estab) — §4.1
3. **Match RAIS** — chave composta §4.2 e aplicação §4.3
4. **Filtros de desempate** — §4.4 em cascata; classifica match
5. **Extração do headcount** — `quantidade_vinculos_ativos`
6. **Consulta ao benchmark salarial** — tabela pré-calculada §5.2
7. **Aplicação do multiplicador setorial** — §6.2 + §6.3 (com ajuste 1839 quando aplicável)
8. **Cálculo da estimativa** — fórmula §6.1
9. **Score de confiança** — §6.4
10. **Enriquecimento societário** — archetype + sinais Receita — §6.5
11. **Verificação ativa** (no funil ativo) — convite Compartilha RFB §7

### 8.2 Implementação BigQuery (`the-dumbers.dealflow.*`)

Pipeline batch executado uma vez por ano-base RAIS (anual) + snapshot Receita (mensal):

```
receita_universe_v1     ──┐
                          ├─► matches_v1 ──┐
rais_universe_v1        ──┘                │
                                           ├─► estimates_v1 ──► estimates_v2
benchmark_salarial_v1   ──┐                │                      (+ archetype)
razao_folha_receita_v1  ──┤                │
razao_by_size_v1        ──┤                │
socios_summary_v1       ──┘────────────────┘
```

**UDFs** (`the-dumbers.dealflow.*`):
- `cnae_secao(cnae STRING)` → seção A-U (mapeia CNAE 2.0 nas 21 seções)
- `faixa_pessoal(headcount INT64)` → label da faixa PIA 1839 ('5 a 29', '500 ou mais', etc.)
- `encargos_low(secao STRING)` / `encargos_high(secao STRING)` → §6.2 ranges
- `tamanho_for_headcount(headcount INT64)` → código RAIS `tamanho_estabelecimento`

### 8.3 Consumo

A **camada de produto** (UI/API — ainda por implementar) consome `estimates_v2` com filtros do usuário:

```sql
SELECT cnpj, razao_social, receita_estimada_brl, confianca, archetype, capital_social_brl
FROM `the-dumbers.dealflow.estimates_v2`
WHERE confianca IN ('alta', 'media')
  AND receita_estimada_brl BETWEEN 5e6 AND 50e6      -- sweet spot M&A do cliente
  AND archetype = 'family_mature_sweet_spot'         -- magic filter sucessão
  AND id_municipio_uf = 'SP'
```

Nenhum critério acima (range receita, confiança mínima, archetype, geografia) é filtro de **dados** — todos são filtros de **produto**, customizáveis por cliente.

## 9. Limites honestos

### 9.1 Limites estruturais (não solucionáveis sem novas fontes)

- **9.1.1** RAIS defasada 12–18m. Em mai/2026, ano-base = 2024.
- **9.1.2** Setores low-CLT (TI/J, financeiro/K, consultoria/M com pró-labore alto) — headcount subestimado. §6.4 rebaixa para `LOW`; Compartilha RFB resolve no funil.
- **9.1.3** Ambiguidade do Match em prédios comerciais densos fora das capitais (Niterói, Guarulhos, ABC) — sem bairro de desempate, cai em fallback ou fica fora do Tier 1.
- **9.1.4** Benchmark salarial em CNAE × município — sem granularidade de bairro (Vínculos não tem CEP). Loja em Pinheiros e em Cidade Tiradentes caem na mesma célula.
- **9.1.5** Variação intra-CNAE — benchmarks são médias, capturam o típico, não o extremo. Modelo entrega intervalos, não pontos exatos.
- **9.1.6** PAS/PAC não publicam em CNAE 4d (limitação amostral IBGE). Setores G/H-N têm precisão `media` por estrutura — caps a confiança em `MEDIUM`.
- **9.1.7** Multi-plant: empresa com várias filiais em municípios diferentes só tem o headcount da **matriz** no Tier 1. Receita reportada (consolidada) é múltiplos da matriz. §4.5 (agregação por raiz) ainda não implementado.

### 9.2 Validação empírica vs DRE público (5 casos in-scope, snapshot 2026-05-11)

Critérios in-scope: empresa única-CNAE, matriz como operação principal, S.A. de capital aberto com DRE publicada (para ter referência).

| Empresa | Setor | Headcount | Estimativa | Real (DRE) | Erro |
|---|---|---|---|---|---|
| HAGA | C — indústria (149 funcs, ajuste 1839) | 149 | R$55.8M–R$61.7M | R$61.7M | **0%** ✅ |
| VIDROPORTO | C — indústria de vidro | 697 | R$798M–R$882M | ~R$850M | **±0%** ✅ |
| ROMI | C — máquinas industriais | 974 | R$948M–R$1.05B | R$1.22B | **−18%** ✅ |
| NUTRIPLANT | C — fertilizantes | (midcap) | — | — | **+39%** ⚠️ |
| BAUMER | C — equipamentos médicos | (midcap) | — | — | **+35%** ⚠️ |

**Em-scope sweet spot médio porte:** erro absoluto fica em ±20% nos casos com headcount >500. **Viés conhecido:** midcaps de 100-500 funcs em CNAEs dominados por gigantes capital-intensivos (NUTRIPLANT, BAUMER) ficam **superestimados +35-40%** — PIA tabela 1839 estratifica até 500 funcs apenas, e a razão da faixa 500+ é arrastada por empresas R$1B+.

### 9.3 Out-of-scope identificados na validação

- ✅ **Multi-plant** — RESOLVIDO em `estimates_v3` via §4.5 (agregação por raiz CNPJ + folha planta-a-planta). 12.931 grupos identificados como multi-plant (18,5% do produto); 4.163 com filiais interestaduais. Top deltas vs v2: SENDAS R$74M→R$56B, RAIA DROGASIL R$4.2B→R$55B, MARFRIG R$549M→R$22B. **Limite residual:** persiste over-count em alguns casos via chave compartilhada (ROMI: v2 −18% → v3 +34%). Deflator §4.5 ajuda mas não elimina.
- **S.A. de capital aberto** — não é o target do produto (o produto serve Ltdas privadas). Servem só como referência de DRE auditável.

### 9.4 Magic filter (decisão de produto)

Para reduzir o ruído do universo amplo, o filtro **`archetype = 'family_mature_sweet_spot'`** (§6.5) entrega ~5.339 empresas RJ/SP em sucessão familiar provável, faixa headcount 20-200, idade ≥10 anos. É o **perfil canônico search fund** — recomendação default no produto.

### 9.5 Calibração futura

Multiplicadores §6.2 e razões §6.3 são calibração inicial — primeiro ano tem margem de erro maior. Cada faturamento real entregue via Compartilha RFB (§7.3) entra no loop de calibração por CNAE/município/porte. Com volume, o motor melhora sozinho.

## 10. Estado atual do motor (snapshot 2026-05-11)

### 10.1 Inventário BigQuery (`the-dumbers.dealflow.*`)

| Tabela | Linhas | Conteúdo | Origem |
|---|---|---|---|
| `receita_universe_v1` | ~1.6M | Universo Receita Federal filtrado (§4.1 lado Receita) | `basedosdados.br_me_cnpj.*` snapshot 2024-12-18 |
| `rais_universe_v1` | 179.566 | Universo RAIS Estab filtrado (§4.1 lado RAIS) | `basedosdados.br_me_rais.microdados_estabelecimentos` ano 2024 |
| `matches_v1` | 72.813 | Tier 1 — chave composta única (§4.2) | JOIN receita × rais via §4.2 |
| `benchmark_salarial_v1` | ~70.000 | Salário médio CNAE 7d × município (RJ/SP) | `microdados_vinculos` ano 2024 |
| `benchmark_salarial_v2` | 259.319 | Idem v1 mas BR todo (necessário para v3) | `microdados_vinculos` ano 2024 |
| `razao_folha_receita_v1` | 308 | 3 camadas L1/L2/L3 (§6.3) | Upload de `data/reference/razao_folha_receita_2023.csv` |
| `razao_by_size_v1` | 24 | Faixa pessoal × tipo indústria (PIA 1839) | Upload de `data/reference/razao_by_size_2023.csv` |
| `socios_summary_v1` | (por cnpj_basico) | Contadores e agregados de sócios | `basedosdados.br_me_cnpj.socios` |
| `estabs_universe_v1` | 154.002 | Receita expandida (matriz+filial BR) ⋈ RAIS BR com deflator §4.5 | `01-05` + estab por CNPJ ativo |
| `grupos_estabs_v1` | 154.002 | 1 linha por estab com folha planta-a-planta calculada | `08` ⋈ `benchmark_salarial_v2` |
| `estimates_v1` | 72.813 | Receita estimada §6.1 + intervalo + confidence (legado) | matches × benchmark × razão |
| `estimates_v2` | 72.813 | v1 + archetype + sinais Receita (§6.5, legado) | estimates_v1 ⋈ socios_summary_v1 |
| `estimates_v3` | 69.941 | v2 + agregação multi-plant (§4.5, **descartado do produto**) | `09` GROUP BY cnpj_basico ⋈ socios + razão |
| `matches_tier2_v1` | 9.345 | Tier 2 — desempate cascata §4.4 (porte+temporal+simples) | chaves 2-5 cand, score ≥2 e top único |
| **`estimates_final`** | **59.807** | **Produto final: single-plant (Tier 1+Tier 2) com filtros plausibilidade** | UNION matches + matches_tier2 ⋈ formula §6.1 |

**Snapshot dates** congelados nesta iteração:
- Receita Federal: 2024-12-18
- RAIS Estabelecimentos e Vínculos: ano-base 2024
- IBGE PIA/PAC/PAS: ano-base 2023 (última publicação disponível)

### 10.2 Universo do produto (estimates_v2)

Distribuição por confiança × archetype × faixa de receita estimada — **base de filtros do produto**:

| Recorte | N empresas |
|---|---|
| Total Tier 1 (72.813) | 72.813 |
| ↳ confiança `alta` ou `media` | **43.813** |
| ↳ ↳ receita estimada R$5M–R$50M (sweet spot M&A médio porte) | **~22.000** |
| ↳ ↳ ↳ archetype `family_mature_sweet_spot` | **5.339** (magic filter) |
| ↳ ↳ ↳ archetype `labor_intensive_midcap` | ~4.894 |
| ↳ ↳ ↳ archetype `standard` | ~17.578 (faixa R$5M–R$100M) |

Estes números são **referência para dimensionar mercado**, não compromisso — qualquer cliente do produto define seu próprio recorte (range, archetype, geografia, setor) sobre `estimates_v2`.

### 10.3 Versionamento

- `_v1`: motor base — fórmula §6.1 sobre matches Tier 1 (matriz only RJ/SP)
- `_v2`: + archetype + sinais Receita (§6.5) — receita numérica IDÊNTICA à v1
- ⚠️ `_v3` (descartado): + agregação multi-plant (§4.5) — falhou em varejo high-density, mantido como artefato exploratório
- ✅ `_final`: Tier 1 + Tier 2 (§4.4) + filtro single-plant + plausibilidade — **59.807 empresas**, **HAGA −5% / VIDROPORTO ±1%** validados
- `_v4` (próximo): calibração via Compartilha RFB (§7.3) — corrige viés midcap e refina razões; resgata multi-plant via dado real

---

**Princípio metodológico.** O motor não substitui due diligence — substitui o palpite por triagem fundamentada com metodologia auditável. O comprador sabe de onde vem cada número, com qual margem de erro, baseado em qual fonte pública. Isso é diferente — e mais valioso para M&A — do que uma faixa opaca de bureau.
