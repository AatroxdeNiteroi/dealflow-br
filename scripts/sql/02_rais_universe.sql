-- §4.1 — Universo RAIS Estabelecimentos (lado headcount da chave de match).
--
-- Filtros canônicos:
--   • ano = 2024                                    (último ano-base RAIS)
--   • sigla_uf IN ('RJ', 'SP')
--   • indicador_atividade_ano = 1                   (estab esteve ativo no ano)
--   • indicador_rais_negativa = 0                   (declarou vínculos > 0)
--   • indicador_simples = '0'                       (não-Simples — STRING aqui)
--   • tipo_estabelecimento IN ('1', '5')            (único ou matriz)
--   • quantidade_vinculos_ativos >= 5               (operação real, descarta ruído estatístico)
--   • natureza_juridica LIKE '2%'                   (só entidades empresariais)
--
-- Resultado típico: ~180k estabelecimentos.
--
-- ROW_NUMBER serve como `rais_row_id` estável usado pelo join em matches_v1
-- para contar candidatos por chave composta (§4.3).

CREATE OR REPLACE TABLE `the-dumbers.dealflow.rais_universe_v1` AS
SELECT
  ano,
  sigla_uf,
  id_municipio,
  quantidade_vinculos_ativos,
  quantidade_vinculos_clt,
  natureza_juridica,
  tipo_estabelecimento,
  tamanho_estabelecimento,
  indicador_simples,
  cnae_2_subclasse,
  cnae_2,
  cnae_1,
  subsetor_ibge,
  subatividade_ibge,
  cep,
  bairros_sp,
  bairros_rj,
  ROW_NUMBER() OVER (ORDER BY cep, cnae_2_subclasse, id_municipio) AS rais_row_id
FROM `basedosdados.br_me_rais.microdados_estabelecimentos`
WHERE ano = 2024
  AND sigla_uf IN ('RJ', 'SP')
  AND indicador_atividade_ano = 1
  AND indicador_rais_negativa = 0
  AND indicador_simples = '0'
  AND tipo_estabelecimento IN ('1', '5')
  AND quantidade_vinculos_ativos >= 5
  AND natureza_juridica LIKE '2%';
