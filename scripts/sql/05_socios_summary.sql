-- §6.5 — Agregado de sócios por raiz CNPJ (cnpj_basico).
--
-- A base Receita publica sócios em formato long (uma linha por sócio).
-- Aqui agregamos por cnpj_basico para enriquecer estimates_v2 com sinais
-- estruturais (quantos sócios, quantos PJ vs PF, há quanto tempo entrou
-- o mais antigo, etc.) usados na classificação de archetype.
--
-- Codes de `tipo` na Receita:
--   '1' = pessoa jurídica (sócio PJ — sinaliza holding/grupo)
--   '2' = pessoa física
--   '3' = estrangeiro
--
-- `faixa_etaria` >= 6 captura sócios 50+ (sinal de possível sucessão familiar).

CREATE OR REPLACE TABLE `the-dumbers.dealflow.socios_summary_v1` AS
SELECT
  cnpj_basico,
  COUNT(*) AS n_socios,
  COUNTIF(tipo = '2') AS n_socios_pf,
  COUNTIF(tipo = '1') AS n_socios_pj,
  COUNTIF(tipo = '3') AS n_socios_estrangeiro,
  MIN(data_entrada_sociedade) AS data_socio_mais_antigo,
  MAX(data_entrada_sociedade) AS data_socio_mais_recente,
  COUNTIF(SAFE_CAST(faixa_etaria AS INT64) >= 6) AS n_socios_50_plus
FROM `basedosdados.br_me_cnpj.socios`
WHERE data = DATE '2024-12-18'
GROUP BY cnpj_basico;
