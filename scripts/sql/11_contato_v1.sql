-- §11 — Dados de contato oficial da Receita para empresas Tier 1.
--
-- Extrai endereço completo, telefones, email do snapshot Receita 2024-12-18,
-- filtrado pelos CNPJs já identificados em matches_v1.
--
-- Caveat conhecido: telefone e email da Receita frequentemente estão
-- desatualizados ou pertencem ao contador, não à operação. Endereço é mais
-- confiável (é o registro oficial para correspondência).
--
-- Custo estimado: < US$ 0.05.

CREATE OR REPLACE TABLE `the-dumbers.dealflow.contato_v1` AS
WITH cnpjs AS (
  SELECT cnpj FROM `the-dumbers.dealflow.matches_universe_v1`
)
SELECT
  c.cnpj,
  e.tipo_logradouro,
  e.logradouro,
  e.numero,
  e.complemento,
  e.bairro,
  e.cep,
  e.sigla_uf,
  m.nome AS municipio_nome,
  e.ddd_1,
  e.telefone_1,
  e.ddd_2,
  e.telefone_2,
  e.email
FROM cnpjs c
JOIN `basedosdados.br_me_cnpj.estabelecimentos` e
  ON e.cnpj = c.cnpj
 AND e.data = DATE '2024-12-18'
LEFT JOIN `basedosdados.br_bd_diretorios_brasil.municipio` m
  ON m.id_municipio = e.id_municipio;
