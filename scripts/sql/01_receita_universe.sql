-- §4.1 — Universo Receita Federal (lado CNPJ da chave de match).
--
-- Filtros canônicos:
--   • situacao_cadastral = '2'                      (Ativa)
--   • sigla_uf IN ('RJ', 'SP')                      (escopo geográfico MVP)
--   • identificador_matriz_filial = '1'             (só matriz — §4.5 fica para v3)
--   • natureza_juridica LIKE '2%'                   (só entidades empresariais)
--   • Simples Nacional: sem opção ativa             (não excluído == elegível)
--   • Snapshot Receita: data = '2024-12-18'         (alinhado ao ano-base RAIS 2024)
--
-- Resultado típico: ~1.6M CNPJs ativos RJ/SP elegíveis para o match.
--
-- Princípio de design (§1 architecture.md): NÃO filtramos por porte aqui — porte
-- vira filtro de produto no consumo. Headcount também não — esse vem da RAIS.

CREATE OR REPLACE TABLE `the-dumbers.dealflow.receita_universe_v1` AS
SELECT
  e.cnpj,
  e.cnpj_basico,
  e.cnpj_ordem,
  e.cnpj_dv,
  e.identificador_matriz_filial,
  e.cnae_fiscal_principal,
  e.cnae_fiscal_secundaria,
  e.cep,
  e.sigla_uf,
  e.id_municipio,
  e.bairro,
  e.data_inicio_atividade,
  e.situacao_cadastral,
  emp.razao_social,
  emp.natureza_juridica,
  emp.porte,
  emp.capital_social,
  s.opcao_simples            AS simples_opcao_atual,
  s.data_opcao_simples,
  s.data_exclusao_simples
FROM `basedosdados.br_me_cnpj.estabelecimentos` e
JOIN `basedosdados.br_me_cnpj.empresas` emp
  ON e.cnpj_basico = emp.cnpj_basico
 AND emp.data = DATE '2024-12-18'
LEFT JOIN `basedosdados.br_me_cnpj.simples` s
  ON e.cnpj_basico = s.cnpj_basico
WHERE e.data = DATE '2024-12-18'
  AND e.situacao_cadastral = '2'
  AND e.sigla_uf IN ('RJ', 'SP')
  AND e.identificador_matriz_filial = '1'
  AND emp.natureza_juridica LIKE '2%'
  AND (
    s.opcao_simples IS NULL
    OR s.opcao_simples != 1
    OR s.data_exclusao_simples IS NOT NULL
  );
