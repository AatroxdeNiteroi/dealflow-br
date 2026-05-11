-- §6.1 — Aplicação da fórmula folha → receita.
--
-- Pipeline em 4 CTEs:
--   1. base            → enriquece matches com cnae_secao, cnae_4d, cnae_2d, faixa_label (UDFs)
--   2. with_benchmark  → JOIN com benchmark_salarial_v1 (CNAE × município)
--   3. with_razao      → cascata L1/L2/L3 (PIA 4d → PAS/PAC 2d → DEFAULT_SECAO → 0.25)
--   4. with_size_factor → join PIA 1839 (faixa pessoal) para ajuste de viés "PIA dominada por grandes"
--
-- Fórmula final (§6.1):
--   folha   = headcount × salário_médio × 12 × encargos(seção)
--   receita = folha ÷ (razão_base × size_factor)
--
-- Encargos vem com range low/high (UDFs encargos_low/encargos_high) → produz
-- receita_low_brl, receita_high_brl, receita_point_brl (média).
--
-- Confiança (§6.4) — regra em cascata; primeira que casa decide:
--   • sem benchmark salarial → 'sem_benchmark'
--   • setor low-CLT (J/K/M) com headcount<20 → 'baixa' (§9.2)
--   • razão_precision='baixa' (DEFAULT) → 'baixa'
--   • razão_precision='alta' + n_vinculos>=100 → 'alta'
--   • n_vinculos<30 → 'baixa'
--   • resto → 'media'

CREATE OR REPLACE TABLE `the-dumbers.dealflow.estimates_v1` AS
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
with_benchmark AS (
  SELECT
    b.*,
    bs.salario_medio_brl,
    bs.n_vinculos AS n_vinculos_benchmark
  FROM base b
  LEFT JOIN `the-dumbers.dealflow.benchmark_salarial_v1` bs
    ON bs.cnae_2_subclasse = b.cnae_2_subclasse
   AND bs.id_municipio = b.id_municipio
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
final AS (
  SELECT
    *,
    CASE
      WHEN razao_precision = 'alta' AND razao_faixa IS NOT NULL AND razao_500plus > 0
        THEN razao_faixa / razao_500plus
      ELSE 1.0
    END AS size_factor
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
  salario_medio_brl,
  n_vinculos_benchmark,
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
    WHEN cnae_secao IN ('J', 'K', 'M') AND headcount < 20 THEN 'baixa'
    WHEN razao_precision = 'baixa' THEN 'baixa'
    WHEN razao_precision = 'alta' AND n_vinculos_benchmark >= 100 THEN 'alta'
    WHEN n_vinculos_benchmark IS NULL OR n_vinculos_benchmark < 30 THEN 'baixa'
    ELSE 'media'
  END AS confidence,
  CURRENT_TIMESTAMP() AS estimated_at
FROM final;
