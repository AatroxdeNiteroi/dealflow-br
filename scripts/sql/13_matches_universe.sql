-- §13 — Universo unificado do produto: Tier 1 + Tier 2 score 3/3.
--
-- Por que: o produto antes consumia `matches_v1` (Tier 1) em alguns lugares e
-- `matches_v1 ⋃ matches_tier2_v1` (todos os Tier 2) em outros. Resultado:
--   • estimates_final tinha 296 empresas Tier 2 score 2/3 com qualidade ruim
--   • history/socios/contato só cobriam Tier 1 (~73k)
--
-- Esta tabela é a única fonte de verdade do universo do produto:
--   • Tier 1 (matches_v1): 72.813 únicos por chave composta
--   • Tier 2 score 3/3 (matches_tier2_v1): ~9k desempates de qualidade alta
--     (matches_tier2 score 2/3 EXCLUÍDO por design)
--
-- match_tier exposto como string simples ("Tier 1" / "Tier 2"); detalhamento
-- completo da cascata fica em match_tier_detail.

CREATE OR REPLACE TABLE `the-dumbers.dealflow.matches_universe_v1` AS
SELECT
  cnpj, cnpj_basico, razao_social,
  cnae_2_subclasse, cnae_fiscal_principal, cnae_fiscal_secundaria,
  id_municipio, sigla_uf, bairro,
  headcount, quantidade_vinculos_clt,
  porte, capital_social, data_inicio_atividade, natureza_juridica,
  simples_opcao_atual, data_exclusao_simples,
  subsetor_ibge, subatividade_ibge,
  rais_cep, bairros_sp, bairros_rj, rais_tipo,
  'Tier 1' AS match_tier,
  'Tier 1 · chave composta única' AS match_tier_detail
FROM `the-dumbers.dealflow.matches_v1`
UNION ALL
SELECT
  cnpj, cnpj_basico, razao_social,
  cnae_2_subclasse, cnae_fiscal_principal, cnae_fiscal_secundaria,
  id_municipio, sigla_uf, bairro,
  headcount, quantidade_vinculos_clt,
  porte, capital_social, data_inicio_atividade, natureza_juridica,
  simples_opcao_atual, data_exclusao_simples,
  subsetor_ibge, subatividade_ibge,
  rais_cep, bairros_sp, bairros_rj, rais_tipo,
  'Tier 2' AS match_tier,
  match_tier AS match_tier_detail
FROM `the-dumbers.dealflow.matches_tier2_v1`
WHERE tier2_score = 3;
