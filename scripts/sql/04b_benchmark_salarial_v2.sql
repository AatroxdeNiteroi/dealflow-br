-- §5.2 — Benchmark salarial nacional (todas as UFs).
--
-- Diferença vs benchmark_salarial_v1 (que é RJ/SP only):
--   • Sem `sigla_uf IN ('RJ', 'SP')` — pega Brasil todo
--   • Mantida estrutura (CNAE 7d × município, AVG salário, n_vinculos)
--
-- Motivação (§4.5 multi-plant): empresas Tier 1 cuja matriz é RJ/SP podem ter
-- filiais em qualquer UF. Para calcular folha planta-a-planta corretamente,
-- precisamos do benchmark salarial do MUNICÍPIO de cada filial.
--
-- v1 (RJ/SP) é mantido para retrocompatibilidade da UI e estimates_v2.
-- v3 (multi-plant) consome v2 (nacional).
--
-- Custo aproximado: ~5GB processados (vs 1.4 GB do v1).

CREATE OR REPLACE TABLE `the-dumbers.dealflow.benchmark_salarial_v2` AS
SELECT
  cnae_2_subclasse,
  id_municipio,
  AVG(valor_remuneracao_media)                               AS salario_medio_brl,
  APPROX_QUANTILES(valor_remuneracao_media, 100)[OFFSET(50)] AS salario_mediano_brl,
  STDDEV(valor_remuneracao_media)                            AS salario_stddev,
  COUNT(*)                                                   AS n_vinculos
FROM `basedosdados.br_me_rais.microdados_vinculos`
WHERE ano = 2024
  AND vinculo_ativo_3112 = '1'
  AND tipo_vinculo IN ('10', '15')
  AND valor_remuneracao_media > 0
GROUP BY cnae_2_subclasse, id_municipio
HAVING COUNT(*) >= 10;
