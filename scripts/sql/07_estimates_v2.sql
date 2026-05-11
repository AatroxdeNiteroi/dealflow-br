-- §6.5 — Enriquecimento com sinais Receita e classificação archetype.
--
-- IMPORTANTE — Decisão arquitetural "Opção A" (2026-05-11):
--   A receita estimada numérica em v2 é IDÊNTICA à v1. Archetype entra como
--   metadado (filtro de produto) mas NÃO altera o cálculo de receita.
--
--   Por que: experimentos com ajuste numérico por archetype
--   (`archetype_razao_factor` em v2_numeric) pioraram tanto quanto melhoraram
--   nos casos validados (HAGA -5%→-21%, ROMI -18%→-10%, BAUMER +35%→+58%).
--   Conclusão: o sinal estrutural é real para FILTRAR leads (sucessão familiar,
--   holding, financeiro out-of-scope), mas o público RJ/SP é heterogêneo demais
--   dentro de cada archetype para virar coeficiente.
--
-- Archetypes definidos (8):
--   • financeiro_out_scope        — seção K (PIA/PAS/PAC não cobre)
--   • holding_structure           — sócio PJ + n_socios pequeno
--   • recent_startup              — idade < 3 anos
--   • capital_intensive           — capital/funcionário > R$200k & headcount > 50
--   • labor_intensive_midcap      — capital/funcionário < R$30k & headcount 50-500
--   • partnership_heavy_services  — socios_ratio > 0.1 em M/J/K
--   • family_mature_sweet_spot    — 2-4 sócios PF, idade ≥10, headcount 20-200
--   • standard                    — resto
--
-- Confidence em v2 inclui archetypes "fora de escopo" como 'baixa':
--   recent_startup, holding_structure, financeiro_out_scope.

CREATE OR REPLACE TABLE `the-dumbers.dealflow.estimates_v2` AS
WITH base AS (
  SELECT
    m.cnpj,
    m.cnpj_basico,
    m.razao_social,
    m.cnae_2_subclasse,
    `the-dumbers.dealflow.cnae_secao`(m.cnae_2_subclasse) AS cnae_secao,
    SUBSTR(m.cnae_2_subclasse, 1, 4) AS cnae_4d,
    SUBSTR(m.cnae_2_subclasse, 1, 2) AS cnae_2d,
    m.id_municipio,
    m.sigla_uf,
    m.bairro,
    m.headcount,
    `the-dumbers.dealflow.faixa_pessoal`(m.headcount) AS faixa_label
  FROM `the-dumbers.dealflow.matches_v1` m
),
with_signals AS (
  SELECT
    b.*,
    r.capital_social,
    r.data_inicio_atividade,
    r.porte,
    r.natureza_juridica,
    s.n_socios,
    s.n_socios_pj,
    s.n_socios_pf,
    s.data_socio_mais_antigo,
    DATE_DIFF(CURRENT_DATE(), r.data_inicio_atividade, YEAR) AS idade_empresa_anos,
    SAFE_DIVIDE(r.capital_social, b.headcount)                AS capital_por_funcionario,
    SAFE_DIVIDE(COALESCE(s.n_socios, 0), GREATEST(b.headcount, 1)) AS socios_ratio
  FROM base b
  LEFT JOIN `the-dumbers.dealflow.receita_universe_v1` r ON r.cnpj = b.cnpj
  LEFT JOIN `the-dumbers.dealflow.socios_summary_v1` s   ON s.cnpj_basico = b.cnpj_basico
),
with_benchmark AS (
  SELECT
    ws.*,
    bs.salario_medio_brl,
    bs.n_vinculos AS n_vinculos_benchmark
  FROM with_signals ws
  LEFT JOIN `the-dumbers.dealflow.benchmark_salarial_v1` bs
    ON bs.cnae_2_subclasse = ws.cnae_2_subclasse
   AND bs.id_municipio = ws.id_municipio
),
with_razao AS (
  SELECT
    wb.*,
    COALESCE(rfr4.razao_folha_receita, rfr2.razao_folha_receita, rfr_def.razao_folha_receita, 0.25) AS razao_base,
    COALESCE(rfr4.source_precision, rfr2.source_precision, rfr_def.source_precision, 'baixa')      AS razao_precision,
    COALESCE(rfr4.source_table, rfr2.source_table, rfr_def.source_table, 'HARD_DEFAULT')            AS razao_source,
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
  SELECT
    wr.*,
    CASE WHEN wr.cnae_secao = 'B' THEN 'Indústrias extrativas' ELSE 'Indústrias de transformação' END AS pia_tipo,
    rbs.razao_folha_receita    AS razao_faixa,
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
  SELECT
    *,
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
      WHEN capital_por_funcionario IS NOT NULL AND capital_por_funcionario < 30000  AND headcount BETWEEN 50 AND 500 THEN 'labor_intensive_midcap'
      WHEN socios_ratio > 0.1 AND cnae_secao IN ('M', 'J', 'K') THEN 'partnership_heavy_services'
      WHEN n_socios BETWEEN 2 AND 4 AND idade_empresa_anos >= 10 AND headcount BETWEEN 20 AND 200 THEN 'family_mature_sweet_spot'
      ELSE 'standard'
    END AS archetype
  FROM with_size_factor
)
SELECT
  cnpj,
  cnpj_basico,
  razao_social,
  cnae_2_subclasse,
  cnae_secao,
  cnae_4d,
  id_municipio,
  sigla_uf,
  bairro,
  headcount,
  faixa_label,
  -- Sinais Receita (metadata)
  capital_social,
  data_inicio_atividade,
  idade_empresa_anos,
  capital_por_funcionario,
  porte,
  natureza_juridica,
  n_socios,
  n_socios_pj,
  n_socios_pf,
  socios_ratio,
  data_socio_mais_antigo,
  archetype,
  -- Benchmark
  salario_medio_brl,
  n_vinculos_benchmark,
  -- Razão (IGUAL v1: base × size_factor, SEM archetype factor)
  razao_source,
  razao_category,
  razao_precision,
  razao_base,
  size_factor,
  razao_base * size_factor AS razao_final,
  `the-dumbers.dealflow.encargos_low`(cnae_secao)  AS encargos_low,
  `the-dumbers.dealflow.encargos_high`(cnae_secao) AS encargos_high,
  IF(salario_medio_brl IS NOT NULL,
     headcount * salario_medio_brl * 12 * `the-dumbers.dealflow.encargos_low`(cnae_secao),
     NULL) AS folha_low_brl,
  IF(salario_medio_brl IS NOT NULL,
     headcount * salario_medio_brl * 12 * `the-dumbers.dealflow.encargos_high`(cnae_secao),
     NULL) AS folha_high_brl,
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
FROM with_archetype;
