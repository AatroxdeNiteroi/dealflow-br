-- §4.4 — Tier 2: desempate de chaves ambíguas (2-5 candidatos Receita).
--
-- Cascata de 3 critérios (cada um vale 1 ponto):
--   1. COERÊNCIA DE PORTE: porte declarado Receita ≈ tamanho_estabelecimento RAIS
--      Mapeamento:
--        Receita '1' (ME)     ↔ RAIS '2','3','4'  (1-19 funcs)
--        Receita '3' (EPP)    ↔ RAIS '4','5','6'  (10-99 funcs)
--        Receita '5' (Demais) ↔ RAIS '5','6','7','8','9','10' (20+ funcs)
--        Receita '0'/NULL não pontua (porte não declarado)
--
--   2. COERÊNCIA TEMPORAL: empresa criada antes do ano-base RAIS (2024)
--      Empresa nova demais NÃO pode estar na RAIS 2024.
--
--   3. COERÊNCIA SIMPLES: opcao_simples != 1 (já filtrado no universe, mas reafirma)
--
-- Regra de confirmação Tier 2:
--   • Top candidato deve ter score >= 2 (dois critérios coerentes)
--   • Top candidato DEVE VENCER sozinho (sem empate no topo)
--   • Senão: chave descartada (não força match ruim)
--
-- Resultado esperado: ~15-22k matches Tier 2 (de 25.209 chaves 2-3 cand).

CREATE OR REPLACE TABLE `the-dumbers.dealflow.matches_tier2_v1` AS
WITH key_candidates AS (
  -- Pega chaves com 2-5 candidatos (Tier 2 razoável; >5 vira Tier 3 e fica fora).
  SELECT
    rk.rais_row_id,
    rk.cep,
    rk.cnae_2_subclasse,
    rk.natureza_juridica,
    rk.id_municipio,
    rk.sigla_uf,
    rk.quantidade_vinculos_ativos AS headcount,
    rk.quantidade_vinculos_clt,
    rk.tamanho_estabelecimento AS rais_tamanho,
    rk.subsetor_ibge,
    rk.subatividade_ibge,
    rk.bairros_sp,
    rk.bairros_rj,
    rk.tipo_estabelecimento AS rais_tipo,
    ARRAY_AGG(STRUCT(
      r.cnpj,
      r.cnpj_basico,
      r.razao_social,
      r.porte,
      r.capital_social,
      r.data_inicio_atividade,
      r.simples_opcao_atual,
      r.data_exclusao_simples,
      r.cnae_fiscal_principal,
      r.cnae_fiscal_secundaria,
      r.bairro
    ) ORDER BY r.cnpj) AS candidatos,
    COUNT(*) AS n_candidatos
  FROM `the-dumbers.dealflow.rais_universe_v1` rk
  JOIN `the-dumbers.dealflow.receita_universe_v1` r
    ON r.cep = rk.cep
   AND r.cnae_fiscal_principal = rk.cnae_2_subclasse
   AND r.natureza_juridica = rk.natureza_juridica
   AND r.id_municipio = rk.id_municipio
  GROUP BY
    rk.rais_row_id, rk.cep, rk.cnae_2_subclasse, rk.natureza_juridica, rk.id_municipio,
    rk.sigla_uf, rk.quantidade_vinculos_ativos, rk.quantidade_vinculos_clt,
    rk.tamanho_estabelecimento, rk.subsetor_ibge, rk.subatividade_ibge,
    rk.bairros_sp, rk.bairros_rj, rk.tipo_estabelecimento
  HAVING COUNT(*) BETWEEN 2 AND 5
),
scored AS (
  -- UNNEST candidatos e calcula score (0-3) por candidato
  SELECT
    kc.rais_row_id, kc.cep, kc.cnae_2_subclasse, kc.natureza_juridica, kc.id_municipio,
    kc.sigla_uf, kc.headcount, kc.quantidade_vinculos_clt, kc.rais_tamanho,
    kc.subsetor_ibge, kc.subatividade_ibge, kc.bairros_sp, kc.bairros_rj, kc.rais_tipo,
    kc.n_candidatos,
    c.cnpj, c.cnpj_basico, c.razao_social, c.porte, c.capital_social,
    c.data_inicio_atividade, c.simples_opcao_atual, c.data_exclusao_simples,
    c.cnae_fiscal_principal, c.cnae_fiscal_secundaria, c.bairro,
    -- Critério 1: coerência de porte
    CAST(
      (c.porte = '1' AND kc.rais_tamanho IN ('2','3','4'))
      OR (c.porte = '3' AND kc.rais_tamanho IN ('4','5','6'))
      OR (c.porte = '5' AND kc.rais_tamanho IN ('5','6','7','8','9','10'))
    AS INT64) AS coerencia_porte,
    -- Critério 2: coerência temporal
    CAST(c.data_inicio_atividade < DATE '2024-01-01' AS INT64) AS coerencia_temporal,
    -- Critério 3: coerência Simples (já garantida no universe, confirma)
    CAST(c.simples_opcao_atual IS NULL OR c.simples_opcao_atual != 1 OR c.data_exclusao_simples IS NOT NULL AS INT64) AS coerencia_simples
  FROM key_candidates kc, UNNEST(kc.candidatos) c
),
with_score AS (
  SELECT
    *,
    coerencia_porte + coerencia_temporal + coerencia_simples AS score
  FROM scored
),
with_max AS (
  SELECT
    *,
    MAX(score) OVER (PARTITION BY rais_row_id) AS max_score
  FROM with_score
),
with_ranking AS (
  SELECT
    *,
    COUNTIF(score = max_score) OVER (PARTITION BY rais_row_id) AS n_no_topo,
    ROW_NUMBER() OVER (PARTITION BY rais_row_id ORDER BY score DESC, cnpj) AS rk
  FROM with_max
)
SELECT
  -- RAIS
  rais_row_id,
  headcount,
  quantidade_vinculos_clt,
  cnae_2_subclasse,
  subsetor_ibge,
  subatividade_ibge,
  cep AS rais_cep,
  id_municipio,
  sigla_uf,
  rais_tipo,
  natureza_juridica,
  bairros_sp,
  bairros_rj,
  -- Receita
  cnpj,
  cnpj_basico,
  razao_social,
  bairro,
  cnae_fiscal_principal,
  cnae_fiscal_secundaria,
  porte,
  capital_social,
  data_inicio_atividade,
  simples_opcao_atual,
  data_exclusao_simples,
  -- Metadata Tier 2
  n_candidatos,
  score AS tier2_score,
  CONCAT(
    'Tier 2 — ', CAST(n_candidatos AS STRING), ' candidatos · score ',
    CAST(score AS STRING), '/3 (porte=', CAST(coerencia_porte AS STRING),
    ' temp=', CAST(coerencia_temporal AS STRING),
    ' simples=', CAST(coerencia_simples AS STRING), ')'
  ) AS match_tier,
  CURRENT_TIMESTAMP() AS matched_at
FROM with_ranking
WHERE rk = 1
  AND max_score >= 2
  AND n_no_topo = 1;
