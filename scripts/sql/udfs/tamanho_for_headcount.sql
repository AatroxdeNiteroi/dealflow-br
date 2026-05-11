-- Mapeia headcount → código `tamanho_estabelecimento` da RAIS (esquema oficial MTE).
-- Útil para desempate §4.4 cruzando porte declarado × headcount real.

CREATE OR REPLACE FUNCTION `the-dumbers.dealflow.tamanho_for_headcount`(headcount INT64)
AS (
  CASE
    WHEN headcount <= 4   THEN '2'   -- 1 a 4 funcs
    WHEN headcount <= 9   THEN '3'   -- 5 a 9
    WHEN headcount <= 19  THEN '4'   -- 10 a 19
    WHEN headcount <= 49  THEN '5'   -- 20 a 49
    WHEN headcount <= 99  THEN '6'   -- 50 a 99
    WHEN headcount <= 249 THEN '7'   -- 100 a 249
    WHEN headcount <= 499 THEN '8'   -- 250 a 499
    WHEN headcount <= 999 THEN '9'   -- 500 a 999
    ELSE                       '10'  -- 1000+
  END
);
