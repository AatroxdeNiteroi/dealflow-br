-- §6.3 — Mapeia headcount → faixa de pessoal ocupado (PIA tabela 1839).
-- Usada pelo ajuste de razão folha/receita por faixa (size_factor em estimates_v1/v2).

CREATE OR REPLACE FUNCTION `the-dumbers.dealflow.faixa_pessoal`(headcount INT64)
AS (
  CASE
    WHEN headcount <= 4   THEN 'Até 4'
    WHEN headcount <= 29  THEN '5 a 29'
    WHEN headcount <= 49  THEN '30 a 49'
    WHEN headcount <= 99  THEN '50 a 99'
    WHEN headcount <= 249 THEN '100 a 249'
    WHEN headcount <= 499 THEN '250 a 499'
    ELSE                       '500 ou mais'
  END
);
