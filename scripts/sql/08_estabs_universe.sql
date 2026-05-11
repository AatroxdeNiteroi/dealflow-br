-- §4.5 — Universo expandido para multi-plant.
--
-- Captura TODOS os estabs (matriz + filiais BR todo) das raízes CNPJ que já
-- têm match Tier 1 (matriz em RJ/SP). Cada filial pode estar em qualquer UF.
--
-- Diferença vs receita_universe_v1 + rais_universe_v1 + matches_v1:
--   • SEM filtro identificador_matriz_filial — pega filial também
--   • SEM filtro sigla_uf nos dois lados — pega Brasil
--   • Filial aceita match não-único, MAS divide headcount pelo número de
--     CNPJs Receita que compartilham a mesma chave (correção de over-count
--     em prédios comerciais densos)
--
-- Lógica de atribuição de headcount (deflator de chave compartilhada):
--   chave K = (CEP, CNAE, natureza_juridica, id_municipio)
--   sum_rais_K       = SUM(quantidade_vinculos_ativos) dos RAIS estabs com chave K
--   n_receita_cnpjs_K = COUNT(cnpj Receita ativo) com chave K nesta raiz e em outras
--   headcount_estab_atribuido = sum_rais_K / n_receita_cnpjs_K
--
-- Assim, se 5 RAIS estabs dividem a mesma chave e 3 CNPJs Receita também
-- dividem, cada CNPJ herda 5/3 = 1.67 estabs no headcount (5/3 da soma).

CREATE OR REPLACE TABLE `the-dumbers.dealflow.estabs_universe_v1` AS
WITH raizes_validas AS (
  SELECT DISTINCT cnpj_basico
  FROM `the-dumbers.dealflow.matches_v1`
),
receita_expandida AS (
  -- Todos os estabs ativos das raízes Tier 1 (em qualquer UF do Brasil).
  SELECT
    e.cnpj,
    e.cnpj_basico,
    e.identificador_matriz_filial,
    e.cnae_fiscal_principal,
    e.cep,
    e.sigla_uf,
    e.id_municipio,
    e.bairro,
    e.data_inicio_atividade,
    emp.razao_social,
    emp.natureza_juridica,
    emp.porte,
    emp.capital_social,
    s.opcao_simples
  FROM `basedosdados.br_me_cnpj.estabelecimentos` e
  JOIN `basedosdados.br_me_cnpj.empresas` emp
    ON e.cnpj_basico = emp.cnpj_basico
   AND emp.data = DATE '2024-12-18'
  JOIN raizes_validas rv ON rv.cnpj_basico = e.cnpj_basico
  LEFT JOIN `basedosdados.br_me_cnpj.simples` s
    ON e.cnpj_basico = s.cnpj_basico
  WHERE e.data = DATE '2024-12-18'
    AND e.situacao_cadastral = '2'
),
-- Para cada chave composta, agregamos do lado RAIS (todos os estabs ativos
-- 2024 com 1+ funcs) e contamos do lado Receita (todos os CNPJs ativos no
-- snapshot 2024-12-18, INCLUSIVE fora das raízes_validas — pois CNPJs de
-- outras empresas também podem dividir a chave).
rais_por_chave AS (
  SELECT
    cep,
    cnae_2_subclasse AS cnae,
    natureza_juridica,
    id_municipio,
    SUM(quantidade_vinculos_ativos) AS sum_headcount_chave,
    SUM(quantidade_vinculos_clt)    AS sum_clt_chave,
    COUNT(*)                         AS n_rais_estabs_chave
  FROM `basedosdados.br_me_rais.microdados_estabelecimentos`
  WHERE ano = 2024
    AND indicador_atividade_ano = 1
    AND indicador_rais_negativa = 0
    AND quantidade_vinculos_ativos >= 1
  GROUP BY cep, cnae_2_subclasse, natureza_juridica, id_municipio
),
receita_por_chave AS (
  -- Conta TODOS os CNPJs ativos (qualquer empresa, não só raízes válidas)
  -- que dividem a mesma chave. Usado como deflator do over-count.
  SELECT
    e.cep,
    e.cnae_fiscal_principal AS cnae,
    emp.natureza_juridica,
    e.id_municipio,
    COUNT(*) AS n_receita_cnpjs_chave
  FROM `basedosdados.br_me_cnpj.estabelecimentos` e
  JOIN `basedosdados.br_me_cnpj.empresas` emp
    ON e.cnpj_basico = emp.cnpj_basico
   AND emp.data = DATE '2024-12-18'
  WHERE e.data = DATE '2024-12-18'
    AND e.situacao_cadastral = '2'
  GROUP BY e.cep, e.cnae_fiscal_principal, emp.natureza_juridica, e.id_municipio
)
SELECT
  rx.cnpj,
  rx.cnpj_basico,
  rx.identificador_matriz_filial,
  rx.razao_social,
  rx.natureza_juridica,
  rx.porte,
  rx.capital_social,
  rx.data_inicio_atividade,
  rx.cnae_fiscal_principal,
  rx.cep,
  rx.sigla_uf,
  rx.id_municipio,
  rx.bairro,
  rx.opcao_simples,
  -- Headcount atribuído ao estab: deflator de chave compartilhada
  rk.sum_headcount_chave,
  rk.n_rais_estabs_chave,
  COALESCE(rpc.n_receita_cnpjs_chave, 1) AS n_receita_cnpjs_chave,
  CAST(
    ROUND(rk.sum_headcount_chave / GREATEST(rpc.n_receita_cnpjs_chave, 1))
    AS INT64
  ) AS headcount_estab,
  CAST(
    ROUND(rk.sum_clt_chave / GREATEST(rpc.n_receita_cnpjs_chave, 1))
    AS INT64
  ) AS headcount_clt_estab,
  CURRENT_TIMESTAMP() AS matched_at
FROM receita_expandida rx
JOIN rais_por_chave rk
  ON rk.cep = rx.cep
 AND rk.cnae = rx.cnae_fiscal_principal
 AND rk.natureza_juridica = rx.natureza_juridica
 AND rk.id_municipio = rx.id_municipio
LEFT JOIN receita_por_chave rpc
  ON rpc.cep = rx.cep
 AND rpc.cnae = rx.cnae_fiscal_principal
 AND rpc.natureza_juridica = rx.natureza_juridica
 AND rpc.id_municipio = rx.id_municipio;
