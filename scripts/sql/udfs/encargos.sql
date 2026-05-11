-- §6.2 — Multiplicador de encargos por bloco setorial (range low/high).
-- Aplicado na fórmula §6.1: folha = headcount × salário × 12 × encargos.

CREATE OR REPLACE FUNCTION `the-dumbers.dealflow.encargos_low`(secao STRING)
AS (
  CASE
    WHEN secao IN ('B', 'C') THEN 1.9  -- Indústria
    WHEN secao = 'F'         THEN 1.9  -- Construção
    WHEN secao = 'G'         THEN 1.6  -- Comércio
    WHEN secao IN ('H', 'I', 'N') THEN 1.6  -- Serviços gerais
    WHEN secao = 'J'         THEN 1.4  -- TI/telecom (com desoneração)
    WHEN secao IN ('K', 'M') THEN 1.7  -- Serviços profissionais
    ELSE                          1.6
  END
);

CREATE OR REPLACE FUNCTION `the-dumbers.dealflow.encargos_high`(secao STRING)
AS (
  CASE
    WHEN secao IN ('B', 'C') THEN 2.1
    WHEN secao = 'F'         THEN 2.0
    WHEN secao = 'G'         THEN 1.7
    WHEN secao IN ('H', 'I', 'N') THEN 1.8
    WHEN secao = 'J'         THEN 1.6
    WHEN secao IN ('K', 'M') THEN 1.9
    ELSE                          1.9
  END
);
