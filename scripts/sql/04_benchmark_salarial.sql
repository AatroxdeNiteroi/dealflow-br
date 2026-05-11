-- §5.2 — Benchmark salarial CNAE × município (RAIS Vínculos).
--
-- Construído UMA VEZ por ano-base. Custo ~1.4GB processados (~US$ 0.007).
--
-- Restrições deliberadas:
--   • CLT urbano e por prazo (tipo_vinculo IN ('10', '15')) — exclui pró-labore,
--     estatutário, etc. que distorcem o "salário médio" do setor.
--   • valor_remuneracao_media > 0 — descarta vínculos sem salário declarado.
--   • HAVING COUNT(*) >= 10 — amostra mínima por célula CNAE × município.
--     Células abaixo cairão em fallback de granularidade menor no consumo
--     (CNAE × UF, depois CNAE nacional) — não implementado ainda.
--
-- Por que AVG e não MEDIANA (§5.2): folha = soma de salários; folha/headcount = AVG
-- por definição. Mediana subestima sistematicamente (ignora cauda superior).
--
-- Resultado típico: ~70k células.

CREATE OR REPLACE TABLE `the-dumbers.dealflow.benchmark_salarial_v1` AS
SELECT
  cnae_2_subclasse,
  id_municipio,
  AVG(valor_remuneracao_media)                               AS salario_medio_brl,
  APPROX_QUANTILES(valor_remuneracao_media, 100)[OFFSET(50)] AS salario_mediano_brl,
  STDDEV(valor_remuneracao_media)                            AS salario_stddev,
  COUNT(*)                                                   AS n_vinculos
FROM `basedosdados.br_me_rais.microdados_vinculos`
WHERE ano = 2024
  AND sigla_uf IN ('RJ', 'SP')
  AND vinculo_ativo_3112 = '1'
  AND tipo_vinculo IN ('10', '15')
  AND valor_remuneracao_media > 0
GROUP BY cnae_2_subclasse, id_municipio
HAVING COUNT(*) >= 10;
