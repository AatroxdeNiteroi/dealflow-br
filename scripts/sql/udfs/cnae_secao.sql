-- §4 — Mapeamento CNAE 2.0 (divisão 2d) → seção (A-U).
-- Tabela oficial IBGE: https://concla.ibge.gov.br/busca-online-cnae.html

CREATE OR REPLACE FUNCTION `the-dumbers.dealflow.cnae_secao`(cnae STRING)
AS (
  CASE
    WHEN SAFE_CAST(SUBSTR(cnae, 1, 2) AS INT64) BETWEEN 1 AND 3   THEN 'A'  -- Agricultura, pecuária, florestal
    WHEN SAFE_CAST(SUBSTR(cnae, 1, 2) AS INT64) BETWEEN 5 AND 9   THEN 'B'  -- Indústrias extrativas
    WHEN SAFE_CAST(SUBSTR(cnae, 1, 2) AS INT64) BETWEEN 10 AND 33 THEN 'C'  -- Indústrias de transformação
    WHEN SAFE_CAST(SUBSTR(cnae, 1, 2) AS INT64) = 35              THEN 'D'  -- Eletricidade e gás
    WHEN SAFE_CAST(SUBSTR(cnae, 1, 2) AS INT64) BETWEEN 36 AND 39 THEN 'E'  -- Água, esgoto, resíduos
    WHEN SAFE_CAST(SUBSTR(cnae, 1, 2) AS INT64) BETWEEN 41 AND 43 THEN 'F'  -- Construção
    WHEN SAFE_CAST(SUBSTR(cnae, 1, 2) AS INT64) BETWEEN 45 AND 47 THEN 'G'  -- Comércio
    WHEN SAFE_CAST(SUBSTR(cnae, 1, 2) AS INT64) BETWEEN 49 AND 53 THEN 'H'  -- Transporte
    WHEN SAFE_CAST(SUBSTR(cnae, 1, 2) AS INT64) IN (55, 56)       THEN 'I'  -- Alojamento e alimentação
    WHEN SAFE_CAST(SUBSTR(cnae, 1, 2) AS INT64) BETWEEN 58 AND 63 THEN 'J'  -- Informação e comunicação
    WHEN SAFE_CAST(SUBSTR(cnae, 1, 2) AS INT64) BETWEEN 64 AND 66 THEN 'K'  -- Financeiro e seguros
    WHEN SAFE_CAST(SUBSTR(cnae, 1, 2) AS INT64) = 68              THEN 'L'  -- Imobiliário
    WHEN SAFE_CAST(SUBSTR(cnae, 1, 2) AS INT64) BETWEEN 69 AND 75 THEN 'M'  -- Profissionais, científicas, técnicas
    WHEN SAFE_CAST(SUBSTR(cnae, 1, 2) AS INT64) BETWEEN 77 AND 82 THEN 'N'  -- Administrativas e serviços complementares
    WHEN SAFE_CAST(SUBSTR(cnae, 1, 2) AS INT64) = 84              THEN 'O'  -- Administração pública
    WHEN SAFE_CAST(SUBSTR(cnae, 1, 2) AS INT64) = 85              THEN 'P'  -- Educação
    WHEN SAFE_CAST(SUBSTR(cnae, 1, 2) AS INT64) BETWEEN 86 AND 88 THEN 'Q'  -- Saúde humana
    WHEN SAFE_CAST(SUBSTR(cnae, 1, 2) AS INT64) BETWEEN 90 AND 93 THEN 'R'  -- Artes, cultura, esporte
    WHEN SAFE_CAST(SUBSTR(cnae, 1, 2) AS INT64) BETWEEN 94 AND 96 THEN 'S'  -- Outras atividades de serviços
    WHEN SAFE_CAST(SUBSTR(cnae, 1, 2) AS INT64) IN (97, 98)       THEN 'T'  -- Serviços domésticos
    WHEN SAFE_CAST(SUBSTR(cnae, 1, 2) AS INT64) = 99              THEN 'U'  -- Organismos internacionais
  END
);
