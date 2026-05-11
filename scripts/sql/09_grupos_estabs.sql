-- §4.5 — Folha calculada planta-a-planta para cada estab do grupo.
--
-- Esta tabela é o intermediário entre estabs_universe_v1 e estimates_v3:
-- cada linha é UM estab (matriz ou filial), com:
--   • headcount do estab (já com deflator de chave compartilhada)
--   • salário médio do município do estab (benchmark_salarial_v2, BR)
--   • encargos da seção do CNAE
--   • folha_estab_low/high computados (intervalo de encargos)
--
-- v3 agrega isso por cnpj_basico em 10_estimates_v3.sql.

CREATE OR REPLACE TABLE `the-dumbers.dealflow.grupos_estabs_v1` AS
SELECT
  eu.cnpj,
  eu.cnpj_basico,
  eu.identificador_matriz_filial,
  eu.razao_social,
  eu.natureza_juridica,
  eu.porte,
  eu.capital_social,
  eu.data_inicio_atividade,
  eu.cnae_fiscal_principal,
  `the-dumbers.dealflow.cnae_secao`(eu.cnae_fiscal_principal) AS cnae_secao,
  eu.cep,
  eu.sigla_uf,
  eu.id_municipio,
  eu.bairro,
  eu.headcount_estab,
  eu.headcount_clt_estab,
  eu.n_receita_cnpjs_chave,
  -- Benchmark salarial DO MUNICÍPIO do estab (não da matriz).
  -- Fallback: se não há benchmark CNAE × município do estab, usa NULL.
  bs.salario_medio_brl                                    AS salario_estab_brl,
  bs.n_vinculos                                            AS n_vinculos_benchmark_estab,
  -- Encargos por seção do CNAE.
  `the-dumbers.dealflow.encargos_low`(
    `the-dumbers.dealflow.cnae_secao`(eu.cnae_fiscal_principal)
  ) AS encargos_low,
  `the-dumbers.dealflow.encargos_high`(
    `the-dumbers.dealflow.cnae_secao`(eu.cnae_fiscal_principal)
  ) AS encargos_high,
  -- Folha do estab (range low/high).
  IF(bs.salario_medio_brl IS NOT NULL,
     eu.headcount_estab * bs.salario_medio_brl * 12 *
       `the-dumbers.dealflow.encargos_low`(
         `the-dumbers.dealflow.cnae_secao`(eu.cnae_fiscal_principal)
       ),
     NULL) AS folha_estab_low_brl,
  IF(bs.salario_medio_brl IS NOT NULL,
     eu.headcount_estab * bs.salario_medio_brl * 12 *
       `the-dumbers.dealflow.encargos_high`(
         `the-dumbers.dealflow.cnae_secao`(eu.cnae_fiscal_principal)
       ),
     NULL) AS folha_estab_high_brl
FROM `the-dumbers.dealflow.estabs_universe_v1` eu
LEFT JOIN `the-dumbers.dealflow.benchmark_salarial_v2` bs
  ON bs.cnae_2_subclasse = eu.cnae_fiscal_principal
 AND bs.id_municipio = eu.id_municipio;
