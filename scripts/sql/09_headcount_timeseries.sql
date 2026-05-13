-- §9 — Série temporal de headcount por CNPJ Tier 1
--
-- Para cada empresa Tier 1 (72k), procura a mesma chave composta
-- (CEP + CNAE 7d + natureza_juridica + id_municipio) na RAIS Estabs em
-- cada ano-base 2018-2024. Se exatamente 1 estabelecimento bate a chave
-- naquele ano, registra `quantidade_vinculos_ativos`. Se 0 ou múltiplos,
-- pula — gap fica visível no front (honestidade > completude).
--
-- Snapshot 2026-05-13. Particionamento por ano na RAIS Estabs evita
-- scan full; custo estimado < US$ 1.

CREATE OR REPLACE TABLE `the-dumbers.dealflow.headcount_timeseries_v1` AS
WITH chaves AS (
  SELECT DISTINCT
    cnpj,
    cnpj_basico,
    rais_cep AS cep,
    cnae_2_subclasse,
    natureza_juridica,
    id_municipio
  FROM `the-dumbers.dealflow.matches_universe_v1`
),
rais_yearly AS (
  SELECT
    ano,
    cep,
    cnae_2_subclasse,
    natureza_juridica,
    id_municipio,
    SUM(quantidade_vinculos_ativos) AS headcount_sum,
    COUNT(*) AS n_estabs
  FROM `basedosdados.br_me_rais.microdados_estabelecimentos`
  WHERE ano BETWEEN 2018 AND 2024
    AND sigla_uf IN ('RJ', 'SP')
    AND indicador_atividade_ano = 1
    AND indicador_rais_negativa = 0
    AND tipo_estabelecimento IN ('1', '5')
    AND natureza_juridica LIKE '2%'
    AND quantidade_vinculos_ativos >= 1
  GROUP BY ano, cep, cnae_2_subclasse, natureza_juridica, id_municipio
)
SELECT
  c.cnpj,
  c.cnpj_basico,
  r.ano,
  CAST(r.headcount_sum AS INT64) AS headcount
FROM chaves c
JOIN rais_yearly r
  ON r.cep = c.cep
 AND r.cnae_2_subclasse = c.cnae_2_subclasse
 AND r.natureza_juridica = c.natureza_juridica
 AND r.id_municipio = c.id_municipio
WHERE r.n_estabs = 1
ORDER BY c.cnpj, r.ano;
