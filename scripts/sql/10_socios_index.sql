-- §10 — Índice de sócios para o universo Tier 1 (mapa de grupo).
--
-- Extrai a lista de sócios da base Receita para cada cnpj_basico Tier 1.
-- A chave de agrupamento (socio_key) é gerada em Python a partir de
-- (nome_normalizado + documento) — ver scripts/export_socios.py.
--
-- Snapshot Receita: 2024-12-18 (alinhado com matches_v1).
-- Custo BQ: < US$ 0.05 (filtro por cnpj_basico Tier 1 e partição por data).

CREATE OR REPLACE TABLE `the-dumbers.dealflow.socios_index_v1` AS
WITH raizes AS (
  SELECT DISTINCT cnpj_basico FROM `the-dumbers.dealflow.matches_v1`
)
SELECT
  s.cnpj_basico,
  s.tipo,
  s.nome,
  s.documento,
  s.qualificacao,
  s.data_entrada_sociedade
FROM `basedosdados.br_me_cnpj.socios` s
JOIN raizes r USING (cnpj_basico)
WHERE s.data = DATE '2024-12-18'
  AND s.nome IS NOT NULL
ORDER BY s.cnpj_basico, s.nome;
