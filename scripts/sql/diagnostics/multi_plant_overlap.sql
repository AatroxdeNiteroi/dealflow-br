-- DIAGNÓSTICO — dimensionar impacto do multi-plant (§4.5).
--
-- Pergunta: das raízes CNPJ Tier 1, quantas têm 1+ filial RJ/SP com 5+
-- funcs CLT que estamos ignorando hoje?
--
-- Custo aproximado: ~6-8 GB processados (Receita estabelecimentos + RAIS estab
-- com filiais). Roda em ~30s.
--
-- Saída esperada: 1 linha com 11 colunas de métricas resumo.
--   • Se > 5.000 raízes multi-plant → implementar agregação é prioridade alta
--   • Se 1.000-5.000 → vale fazer, ROI médio
--   • Se < 1.000 → fenômeno nicho, foca em outra melhoria

WITH receita_with_filiais AS (
  -- Universo Receita expandido: matriz E filiais ativas RJ/SP (não-Simples,
  -- natureza empresarial). Diferença vs receita_universe_v1: SEM filtro
  -- identificador_matriz_filial = '1'.
  SELECT
    e.cnpj,
    e.cnpj_basico,
    e.identificador_matriz_filial,
    e.cnae_fiscal_principal,
    e.cep,
    e.sigla_uf,
    e.id_municipio,
    emp.natureza_juridica,
    emp.razao_social
  FROM `basedosdados.br_me_cnpj.estabelecimentos` e
  JOIN `basedosdados.br_me_cnpj.empresas` emp
    ON e.cnpj_basico = emp.cnpj_basico
   AND emp.data = DATE '2024-12-18'
  LEFT JOIN `basedosdados.br_me_cnpj.simples` s
    ON e.cnpj_basico = s.cnpj_basico
  WHERE e.data = DATE '2024-12-18'
    AND e.situacao_cadastral = '2'
    AND e.sigla_uf IN ('RJ', 'SP')
    AND emp.natureza_juridica LIKE '2%'
    AND (
      s.opcao_simples IS NULL
      OR s.opcao_simples != 1
      OR s.data_exclusao_simples IS NOT NULL
    )
),
estabs_matched AS (
  -- Cada CNPJ (matriz ou filial) que casa com 1+ estab RAIS via chave composta.
  -- NOTA: aqui aceitamos match não-único (a chave + cnpj_basico já restringe);
  -- a unicidade do Tier 1 só vale pra empresa única-CNPJ. Para multi-plant
  -- queremos visibilidade total dos estabs da raiz.
  SELECT
    rf.cnpj,
    rf.cnpj_basico,
    rf.razao_social,
    rf.identificador_matriz_filial,
    rf.sigla_uf,
    rais.quantidade_vinculos_ativos AS headcount
  FROM receita_with_filiais rf
  JOIN `basedosdados.br_me_rais.microdados_estabelecimentos` rais
    ON rais.cep = rf.cep
   AND rais.cnae_2_subclasse = rf.cnae_fiscal_principal
   AND rais.natureza_juridica = rf.natureza_juridica
   AND rais.id_municipio = rf.id_municipio
  WHERE rais.ano = 2024
    AND rais.sigla_uf IN ('RJ', 'SP')
    AND rais.indicador_atividade_ano = 1
    AND rais.indicador_rais_negativa = 0
    AND rais.indicador_simples = '0'
    AND rais.quantidade_vinculos_ativos >= 5
    AND rais.natureza_juridica LIKE '2%'
),
agg_por_raiz AS (
  SELECT
    cnpj_basico,
    ANY_VALUE(razao_social) AS razao_social,
    COUNT(*) AS n_estabs_matched,
    COUNTIF(identificador_matriz_filial = '1') AS n_matriz_matched,
    COUNTIF(identificador_matriz_filial = '2') AS n_filiais_matched,
    SUM(headcount) AS headcount_total,
    SUM(IF(identificador_matriz_filial = '1', headcount, 0)) AS headcount_matriz,
    SUM(IF(identificador_matriz_filial = '2', headcount, 0)) AS headcount_filiais_ignoradas,
    STRING_AGG(DISTINCT sigla_uf ORDER BY sigla_uf) AS ufs_do_grupo
  FROM estabs_matched
  GROUP BY cnpj_basico
)
SELECT
  -- Volume total
  COUNT(*)                                                          AS total_raizes_com_match,
  COUNTIF(n_filiais_matched > 0)                                    AS raizes_multi_plant,
  ROUND(100.0 * COUNTIF(n_filiais_matched > 0) / COUNT(*), 1)       AS pct_multi_plant,
  -- Distribuição do nº de filiais por raiz multi-plant
  COUNTIF(n_filiais_matched = 1)                                    AS com_1_filial,
  COUNTIF(n_filiais_matched = 2)                                    AS com_2_filiais,
  COUNTIF(n_filiais_matched BETWEEN 3 AND 5)                        AS com_3a5_filiais,
  COUNTIF(n_filiais_matched > 5)                                    AS com_6plus_filiais,
  -- Magnitude do headcount escondido
  SUM(headcount_filiais_ignoradas)                                  AS headcount_total_ignorado,
  ROUND(AVG(IF(n_filiais_matched > 0, headcount_filiais_ignoradas, NULL)), 1) AS headcount_medio_filiais_quando_existe,
  MAX(headcount_filiais_ignoradas)                                  AS pior_caso_headcount_ignorado,
  -- Quantas raízes multi-plant teriam mudança >50% se agregadas?
  COUNTIF(headcount_filiais_ignoradas > 0.5 * headcount_matriz AND headcount_matriz > 0) AS raizes_com_50pct_plus_extra
FROM agg_por_raiz;
