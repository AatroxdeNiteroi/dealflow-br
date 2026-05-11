-- §4.5 — estimates_v3: receita agregada por grupo (matriz + filiais BR).
--
-- Diferenças vs estimates_v2:
--   • Folha calculada planta-a-planta (cada estab usa seu próprio salário
--     local) e somada por raiz CNPJ.
--   • Headcount = agregado de todos os estabs do grupo (matriz + filiais BR).
--   • Receita = folha_agregada_total ÷ razão_folha_receita_CNAE_matriz.
--   • Razão é do CNAE da matriz (Magazine Luiza tem 100 lojas: o CNAE da
--     matriz é varejo, todas as filiais herdam essa razão).
--   • Size factor (PIA 1839) usa o headcount AGREGADO — uma empresa com
--     matriz 80 funcs + 5 filiais de 80 funcs vira faixa 250-499 não 50-99.
--
-- Archetype classification (§6.5) — mesma lógica de v2, com sinais
-- ligeiramente diferentes em casos multi-plant:
--   • headcount nas regras usa o AGREGADO
--   • capital_por_funcionario usa headcount agregado também

CREATE OR REPLACE TABLE `the-dumbers.dealflow.estimates_v3` AS
WITH grupos_agregados AS (
  SELECT
    cnpj_basico,
    -- Matriz é o representante de cada grupo.
    MAX(IF(identificador_matriz_filial = '1',cnpj, NULL))               AS cnpj,
    MAX(IF(identificador_matriz_filial = '1',razao_social, NULL))        AS razao_social,
    MAX(IF(identificador_matriz_filial = '1',cnae_fiscal_principal, NULL)) AS cnae_2_subclasse,
    MAX(IF(identificador_matriz_filial = '1',cnae_secao, NULL))          AS cnae_secao,
    MAX(IF(identificador_matriz_filial = '1',id_municipio, NULL))        AS id_municipio,
    MAX(IF(identificador_matriz_filial = '1',sigla_uf, NULL))            AS sigla_uf,
    MAX(IF(identificador_matriz_filial = '1',bairro, NULL))              AS bairro,
    MAX(IF(identificador_matriz_filial = '1',capital_social, NULL))      AS capital_social,
    MAX(IF(identificador_matriz_filial = '1',data_inicio_atividade, NULL)) AS data_inicio_atividade,
    MAX(IF(identificador_matriz_filial = '1',porte, NULL))               AS porte,
    MAX(IF(identificador_matriz_filial = '1',natureza_juridica, NULL))   AS natureza_juridica,
    -- Headcount
    SUM(headcount_estab) AS headcount,
    SUM(IF(identificador_matriz_filial = '1', headcount_estab, 0)) AS headcount_matriz,
    SUM(IF(identificador_matriz_filial = '2', headcount_estab, 0)) AS headcount_filiais,
    SUM(IF(sigla_uf NOT IN ('RJ', 'SP'), headcount_estab, 0)) AS headcount_outras_ufs,
    -- Folha agregada planta-a-planta
    SUM(folha_estab_low_brl)  AS folha_total_low_brl,
    SUM(folha_estab_high_brl) AS folha_total_high_brl,
    -- Metadata do grupo
    COUNT(*) AS n_plantas,
    COUNTIF(identificador_matriz_filial = '2') AS n_filiais,
    COUNT(DISTINCT sigla_uf) AS n_ufs,
    STRING_AGG(DISTINCT sigla_uf ORDER BY sigla_uf) AS ufs_grupo,
    -- Benchmark dispobilidade
    MIN(n_vinculos_benchmark_estab) AS min_n_vinculos_benchmark,
    COUNTIF(salario_estab_brl IS NULL) AS n_estabs_sem_benchmark
  FROM `the-dumbers.dealflow.grupos_estabs_v1`
  GROUP BY cnpj_basico
),
with_socios AS (
  SELECT
    g.*,
    s.n_socios,
    s.n_socios_pj,
    s.n_socios_pf,
    s.data_socio_mais_antigo,
    DATE_DIFF(CURRENT_DATE(), g.data_inicio_atividade, YEAR) AS idade_empresa_anos,
    SAFE_DIVIDE(g.capital_social, g.headcount) AS capital_por_funcionario,
    SAFE_DIVIDE(COALESCE(s.n_socios, 0), GREATEST(g.headcount, 1)) AS socios_ratio
  FROM grupos_agregados g
  LEFT JOIN `the-dumbers.dealflow.socios_summary_v1` s ON s.cnpj_basico = g.cnpj_basico
),
with_razao AS (
  SELECT
    ws.*,
    SUBSTR(ws.cnae_2_subclasse, 1, 4) AS cnae_4d,
    SUBSTR(ws.cnae_2_subclasse, 1, 2) AS cnae_2d,
    COALESCE(rfr4.razao_folha_receita, rfr2.razao_folha_receita, rfr_def.razao_folha_receita, 0.25) AS razao_base,
    COALESCE(rfr4.source_precision, rfr2.source_precision, rfr_def.source_precision, 'baixa')      AS razao_precision,
    COALESCE(rfr4.source_table, rfr2.source_table, rfr_def.source_table, 'HARD_DEFAULT')            AS razao_source,
    COALESCE(rfr4.source_category_name, rfr2.source_category_name, rfr_def.source_category_name, '') AS razao_category
  FROM with_socios ws
  LEFT JOIN `the-dumbers.dealflow.razao_folha_receita_v1` rfr4
    ON rfr4.source_table = 'PIA_7242_7241'
   AND LPAD(CAST(rfr4.cnae_4d AS STRING), 4, '0') = SUBSTR(ws.cnae_2_subclasse, 1, 4)
  LEFT JOIN `the-dumbers.dealflow.razao_folha_receita_v1` rfr2
    ON rfr2.source_table IN ('PAS_2577', 'PAC_1418')
   AND LPAD(CAST(rfr2.cnae_2d AS STRING), 2, '0') = SUBSTR(ws.cnae_2_subclasse, 1, 2)
  LEFT JOIN `the-dumbers.dealflow.razao_folha_receita_v1` rfr_def
    ON rfr_def.source_table = 'DEFAULT_SECAO'
   AND CAST(rfr_def.source_category_code AS STRING) = ws.cnae_secao
),
with_size_factor AS (
  -- Size factor agora usa o headcount AGREGADO (faixa do grupo, não da matriz)
  SELECT
    wr.*,
    `the-dumbers.dealflow.faixa_pessoal`(wr.headcount) AS faixa_label,
    CASE WHEN wr.cnae_secao = 'B' THEN 'Indústrias extrativas' ELSE 'Indústrias de transformação' END AS pia_tipo,
    rbs.razao_folha_receita     AS razao_faixa,
    rbs500.razao_folha_receita  AS razao_500plus
  FROM with_razao wr
  LEFT JOIN `the-dumbers.dealflow.razao_by_size_v1` rbs
    ON rbs.tipo_industria = (CASE WHEN wr.cnae_secao = 'B' THEN 'Indústrias extrativas' ELSE 'Indústrias de transformação' END)
   AND rbs.faixa_label = `the-dumbers.dealflow.faixa_pessoal`(wr.headcount)
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
  headcount_matriz,
  headcount_filiais,
  headcount_outras_ufs,
  n_plantas,
  n_filiais,
  n_ufs,
  ufs_grupo,
  faixa_label,
  -- Signals
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
  -- Benchmark salarial (agregado — média ponderada já vem incorporada na folha)
  min_n_vinculos_benchmark AS n_vinculos_benchmark,
  n_estabs_sem_benchmark,
  -- Razão folha/receita do CNAE da matriz
  razao_source,
  razao_category,
  razao_precision,
  razao_base,
  size_factor,
  razao_base * size_factor AS razao_final,
  -- Folha já agregada planta-a-planta
  folha_total_low_brl  AS folha_low_brl,
  folha_total_high_brl AS folha_high_brl,
  -- Receita = folha agregada / razão da matriz
  IF((razao_base * size_factor) > 0 AND folha_total_low_brl > 0,
     folha_total_low_brl / (razao_base * size_factor),
     NULL) AS receita_low_brl,
  IF((razao_base * size_factor) > 0 AND folha_total_high_brl > 0,
     folha_total_high_brl / (razao_base * size_factor),
     NULL) AS receita_high_brl,
  IF((razao_base * size_factor) > 0 AND folha_total_low_brl > 0 AND folha_total_high_brl > 0,
     (folha_total_low_brl + folha_total_high_brl) / 2 / (razao_base * size_factor),
     NULL) AS receita_point_brl,
  CASE
    WHEN folha_total_low_brl IS NULL OR folha_total_low_brl <= 0 THEN 'sem_benchmark'
    WHEN archetype IN ('recent_startup', 'holding_structure', 'financeiro_out_scope') THEN 'baixa'
    WHEN cnae_secao IN ('J', 'K', 'M') AND headcount < 20 THEN 'baixa'
    WHEN razao_precision = 'baixa' THEN 'baixa'
    WHEN razao_precision = 'alta' AND min_n_vinculos_benchmark >= 100 THEN 'alta'
    WHEN min_n_vinculos_benchmark IS NULL OR min_n_vinculos_benchmark < 30 THEN 'baixa'
    ELSE 'media'
  END AS confidence,
  CURRENT_TIMESTAMP() AS estimated_at
FROM with_archetype;
