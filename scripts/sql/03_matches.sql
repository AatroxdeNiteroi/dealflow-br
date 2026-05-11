-- §4.2 + §4.3 — Match RAIS Tier 1 via chave composta única.
--
-- Chave de match (§4.2): CEP + cnae_2_subclasse + natureza_juridica + id_municipio.
--   Doc original lista também `tipo_estabelecimento` na chave; foi removido aqui
--   porque o universo já filtra IN ('1', '5') dos dois lados, então não adiciona
--   poder de desambiguação dentro do conjunto resultante.
--
-- match_counts conta candidatos por linha RAIS. Tier 1 = exatamente 1 candidato
-- na Receita — identidade confirmada com alta confiança. Tier 2 (2-3 candidatos)
-- e Tier 3 (4+) entram em iteração futura via §4.4 (cascata de desempate).
--
-- Resultado típico: ~72.8k matches Tier 1 (≈40% dos ~180k estab RAIS).

CREATE OR REPLACE TABLE `the-dumbers.dealflow.matches_v1` AS
WITH match_counts AS (
  SELECT
    rais.rais_row_id,
    COUNT(r.cnpj) AS n_candidatos
  FROM `the-dumbers.dealflow.rais_universe_v1` rais
  LEFT JOIN `the-dumbers.dealflow.receita_universe_v1` r
    ON r.cep = rais.cep
   AND r.cnae_fiscal_principal = rais.cnae_2_subclasse
   AND r.natureza_juridica = rais.natureza_juridica
   AND r.id_municipio = rais.id_municipio
  GROUP BY rais.rais_row_id
)
SELECT
  -- RAIS
  rais.rais_row_id,
  rais.quantidade_vinculos_ativos AS headcount,
  rais.quantidade_vinculos_clt,
  rais.cnae_2_subclasse,
  rais.subsetor_ibge,
  rais.subatividade_ibge,
  rais.cep             AS rais_cep,
  rais.id_municipio,
  rais.sigla_uf,
  rais.tipo_estabelecimento AS rais_tipo,
  rais.natureza_juridica,
  rais.bairros_sp,
  rais.bairros_rj,
  -- Receita
  r.cnpj,
  r.cnpj_basico,
  r.razao_social,
  r.bairro,
  r.cnae_fiscal_principal,
  r.cnae_fiscal_secundaria,
  r.porte,
  r.capital_social,
  r.data_inicio_atividade,
  r.simples_opcao_atual,
  r.data_exclusao_simples,
  -- Metadata
  'Tier 1 — Alta'      AS match_tier,
  CURRENT_TIMESTAMP()  AS matched_at
FROM `the-dumbers.dealflow.rais_universe_v1` rais
JOIN `the-dumbers.dealflow.receita_universe_v1` r
  ON r.cep = rais.cep
 AND r.cnae_fiscal_principal = rais.cnae_2_subclasse
 AND r.natureza_juridica = rais.natureza_juridica
 AND r.id_municipio = rais.id_municipio
JOIN match_counts mc ON mc.rais_row_id = rais.rais_row_id
WHERE mc.n_candidatos = 1;
