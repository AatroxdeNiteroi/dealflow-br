-- Estimates final — UNION Tier 1 + Tier 2, SOMENTE single-plant, com filtros de plausibilidade.
--
-- Decisão arquitetural (2026-05-11): pureza > volume.
-- O produto atende apenas empresas single-plant (1 estab ativo na Receita
-- via cnpj_basico, qualquer UF). Multi-plant é descartado por instabilidade
-- da agregação (RAIS anonimizada → impossível desambiguar chave compartilhada).
--
-- Composição:
--   • Tier 1 (matches_v1): 72.813 matches únicos por chave composta
--   • Tier 2 (matches_tier2_v1): 9.345 desempates via cascata §4.4
--   • Filtro: cnpj_basico com exatamente 1 estab ativo na Receita (single-plant)
--   • Filtros de plausibilidade:
--      (a) drop se `capital_social < R$ 10k AND headcount > 100`
--      (b) drop se `porte = '1' (ME) AND headcount > 100`
--      (c) drop se `headcount > 50 AND capital_por_funcionario < R$ 100`

CREATE OR REPLACE TABLE `the-dumbers.dealflow.estimates_final` AS
WITH all_matches AS (
  SELECT
    cnpj, cnpj_basico, razao_social, cnae_2_subclasse, id_municipio, sigla_uf,
    bairro, headcount, porte, capital_social, data_inicio_atividade,
    natureza_juridica, simples_opcao_atual, data_exclusao_simples,
    cnae_fiscal_principal, cnae_fiscal_secundaria,
    'Tier 1' AS match_tier
  FROM `the-dumbers.dealflow.matches_v1`
  UNION ALL
  SELECT
    cnpj, cnpj_basico, razao_social, cnae_2_subclasse, id_municipio, sigla_uf,
    bairro, headcount, porte, capital_social, data_inicio_atividade,
    natureza_juridica, simples_opcao_atual, data_exclusao_simples,
    cnae_fiscal_principal, cnae_fiscal_secundaria,
    match_tier
  FROM `the-dumbers.dealflow.matches_tier2_v1`
),
plant_count AS (
  -- Quantos estabs ativos cada raiz CNPJ tem (em qualquer UF do Brasil)
  SELECT cnpj_basico, COUNT(*) AS n_estabs_ativos_br
  FROM `basedosdados.br_me_cnpj.estabelecimentos`
  WHERE data = DATE '2024-12-18' AND situacao_cadastral = '2'
  GROUP BY cnpj_basico
),
single_plant_matches AS (
  SELECT
    m.*,
    pc.n_estabs_ativos_br
  FROM all_matches m
  JOIN plant_count pc ON pc.cnpj_basico = m.cnpj_basico
  WHERE pc.n_estabs_ativos_br = 1
),
socios AS (
  SELECT cnpj_basico, n_socios, n_socios_pj, n_socios_pf, data_socio_mais_antigo
  FROM `the-dumbers.dealflow.socios_summary_v1`
),
base AS (
  SELECT
    spm.*,
    `the-dumbers.dealflow.cnae_secao`(spm.cnae_2_subclasse) AS cnae_secao,
    SUBSTR(spm.cnae_2_subclasse, 1, 4) AS cnae_4d,
    SUBSTR(spm.cnae_2_subclasse, 1, 2) AS cnae_2d,
    `the-dumbers.dealflow.faixa_pessoal`(spm.headcount) AS faixa_label,
    s.n_socios, s.n_socios_pj, s.n_socios_pf, s.data_socio_mais_antigo,
    DATE_DIFF(CURRENT_DATE(), spm.data_inicio_atividade, YEAR) AS idade_empresa_anos,
    SAFE_DIVIDE(spm.capital_social, spm.headcount) AS capital_por_funcionario,
    SAFE_DIVIDE(COALESCE(s.n_socios, 0), GREATEST(spm.headcount, 1)) AS socios_ratio
  FROM single_plant_matches spm
  LEFT JOIN socios s ON s.cnpj_basico = spm.cnpj_basico
),
with_benchmark AS (
  SELECT b.*,
    bs.salario_medio_brl,
    bs.n_vinculos AS n_vinculos_benchmark
  FROM base b
  LEFT JOIN `the-dumbers.dealflow.benchmark_salarial_v1` bs
    ON bs.cnae_2_subclasse = b.cnae_2_subclasse
   AND bs.id_municipio = b.id_municipio
),
with_razao AS (
  SELECT wb.*,
    COALESCE(rfr4.razao_folha_receita, rfr2.razao_folha_receita, rfr_def.razao_folha_receita, 0.25) AS razao_base,
    COALESCE(rfr4.source_precision, rfr2.source_precision, rfr_def.source_precision, 'baixa') AS razao_precision,
    COALESCE(rfr4.source_table, rfr2.source_table, rfr_def.source_table, 'HARD_DEFAULT') AS razao_source,
    COALESCE(rfr4.source_category_name, rfr2.source_category_name, rfr_def.source_category_name, '') AS razao_category
  FROM with_benchmark wb
  LEFT JOIN `the-dumbers.dealflow.razao_folha_receita_v1` rfr4
    ON rfr4.source_table = 'PIA_7242_7241'
   AND LPAD(CAST(rfr4.cnae_4d AS STRING), 4, '0') = wb.cnae_4d
  LEFT JOIN `the-dumbers.dealflow.razao_folha_receita_v1` rfr2
    ON rfr2.source_table IN ('PAS_2577', 'PAC_1418')
   AND LPAD(CAST(rfr2.cnae_2d AS STRING), 2, '0') = wb.cnae_2d
  LEFT JOIN `the-dumbers.dealflow.razao_folha_receita_v1` rfr_def
    ON rfr_def.source_table = 'DEFAULT_SECAO'
   AND CAST(rfr_def.source_category_code AS STRING) = wb.cnae_secao
),
with_size_factor AS (
  SELECT wr.*,
    CASE WHEN wr.cnae_secao = 'B' THEN 'Indústrias extrativas' ELSE 'Indústrias de transformação' END AS pia_tipo,
    rbs.razao_folha_receita AS razao_faixa,
    rbs500.razao_folha_receita AS razao_500plus
  FROM with_razao wr
  LEFT JOIN `the-dumbers.dealflow.razao_by_size_v1` rbs
    ON rbs.tipo_industria = (CASE WHEN wr.cnae_secao = 'B' THEN 'Indústrias extrativas' ELSE 'Indústrias de transformação' END)
   AND rbs.faixa_label = wr.faixa_label
  LEFT JOIN `the-dumbers.dealflow.razao_by_size_v1` rbs500
    ON rbs500.tipo_industria = (CASE WHEN wr.cnae_secao = 'B' THEN 'Indústrias extrativas' ELSE 'Indústrias de transformação' END)
   AND rbs500.faixa_label = '500 ou mais'
),
with_archetype AS (
  SELECT *,
    CASE
      WHEN razao_precision = 'alta' AND razao_faixa IS NOT NULL AND razao_500plus > 0
        THEN razao_faixa / razao_500plus
      ELSE 1.0
    END AS size_factor,
    CASE
      WHEN cnae_secao = 'K' THEN 'financeiro_out_scope'
      WHEN COALESCE(n_socios_pj, 0) > 0 AND COALESCE(n_socios, 0) <= 3 THEN 'holding_structure'
      WHEN idade_empresa_anos < 3 THEN 'recent_startup'
      WHEN capital_por_funcionario IS NOT NULL AND capital_por_funcionario > 200000 AND headcount > 50 THEN 'capital_intensive'
      WHEN capital_por_funcionario IS NOT NULL AND capital_por_funcionario < 30000 AND headcount BETWEEN 50 AND 500 THEN 'labor_intensive_midcap'
      WHEN socios_ratio > 0.1 AND cnae_secao IN ('M', 'J', 'K') THEN 'partnership_heavy_services'
      WHEN n_socios BETWEEN 2 AND 4 AND idade_empresa_anos >= 10 AND headcount BETWEEN 20 AND 200 THEN 'family_mature_sweet_spot'
      ELSE 'standard'
    END AS archetype
  FROM with_size_factor
),
plausibility_check AS (
  -- Aplicar 3 filtros DROP de plausibilidade (conservadores).
  -- Importante: `capital_social = 0` na Receita ≠ "empresa sem capital", muitas vezes
  -- é cadastro desatualizado. Por isso TODOS os critérios exigem capital_social > 0
  -- antes de avaliar — sem isso descartaríamos leads reais (ex: HAGA tem cap=0
  -- declarado mas é empresa industrial real com 149 funcs).
  SELECT *,
    -- Critério (a): capital declarado E ínfimo (não-zero) + headcount alto
    CAST(capital_social > 0 AND capital_social < 10000 AND headcount > 100 AS INT64) AS implausivel_capital_baixo,
    -- Critério (b): ME declarado + headcount muito alto (>100 implausível pra ME)
    CAST(porte = '1' AND headcount > 100 AS INT64) AS implausivel_me_grande,
    -- Critério (c): capital declarado E capital/funcionário ridículo
    CAST(capital_social > 0 AND headcount > 50 AND capital_por_funcionario IS NOT NULL
         AND capital_por_funcionario < 100 AS INT64) AS implausivel_cap_per_func
  FROM with_archetype
)
SELECT
  cnpj, cnpj_basico, razao_social,
  cnae_2_subclasse, cnae_secao, cnae_4d,
  id_municipio, sigla_uf, bairro,
  headcount, faixa_label, match_tier,
  -- Sinais Receita
  capital_social, data_inicio_atividade, idade_empresa_anos,
  capital_por_funcionario, porte, natureza_juridica,
  n_socios, n_socios_pj, n_socios_pf, socios_ratio,
  data_socio_mais_antigo, archetype,
  -- Benchmark
  salario_medio_brl, n_vinculos_benchmark,
  -- Razão
  razao_source, razao_category, razao_precision, razao_base, size_factor,
  razao_base * size_factor AS razao_final,
  `the-dumbers.dealflow.encargos_low`(cnae_secao) AS encargos_low,
  `the-dumbers.dealflow.encargos_high`(cnae_secao) AS encargos_high,
  -- Folha
  IF(salario_medio_brl IS NOT NULL,
     headcount * salario_medio_brl * 12 * `the-dumbers.dealflow.encargos_low`(cnae_secao),
     NULL) AS folha_low_brl,
  IF(salario_medio_brl IS NOT NULL,
     headcount * salario_medio_brl * 12 * `the-dumbers.dealflow.encargos_high`(cnae_secao),
     NULL) AS folha_high_brl,
  -- Receita
  IF(salario_medio_brl IS NOT NULL AND (razao_base * size_factor) > 0,
     headcount * salario_medio_brl * 12 * `the-dumbers.dealflow.encargos_low`(cnae_secao) / (razao_base * size_factor),
     NULL) AS receita_low_brl,
  IF(salario_medio_brl IS NOT NULL AND (razao_base * size_factor) > 0,
     headcount * salario_medio_brl * 12 * `the-dumbers.dealflow.encargos_high`(cnae_secao) / (razao_base * size_factor),
     NULL) AS receita_high_brl,
  IF(salario_medio_brl IS NOT NULL AND (razao_base * size_factor) > 0,
     headcount * salario_medio_brl * 12 *
       (`the-dumbers.dealflow.encargos_low`(cnae_secao) + `the-dumbers.dealflow.encargos_high`(cnae_secao)) / 2
       / (razao_base * size_factor),
     NULL) AS receita_point_brl,
  -- Confiança §6.4
  CASE
    WHEN salario_medio_brl IS NULL THEN 'sem_benchmark'
    WHEN archetype IN ('recent_startup', 'holding_structure', 'financeiro_out_scope') THEN 'baixa'
    WHEN cnae_secao IN ('J', 'K', 'M') AND headcount < 20 THEN 'baixa'
    WHEN razao_precision = 'baixa' THEN 'baixa'
    WHEN razao_precision = 'alta' AND n_vinculos_benchmark >= 100 THEN 'alta'
    WHEN n_vinculos_benchmark IS NULL OR n_vinculos_benchmark < 30 THEN 'baixa'
    ELSE 'media'
  END AS confidence,
  CURRENT_TIMESTAMP() AS estimated_at
FROM plausibility_check
WHERE implausivel_capital_baixo = 0
  AND implausivel_me_grande = 0
  AND implausivel_cap_per_func = 0;
