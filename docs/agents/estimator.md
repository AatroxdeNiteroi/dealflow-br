# 🧮 ESTIMATOR

**Função.** Aplicar fórmula §6.1 (folha → receita) sobre matches, com encargos por seção, razão folha/receita por CNAE (cascata PIA/PAC/PAS + ajuste 1839), e filtros de plausibilidade.

**Persona pixel art.** Contador com lousa, escrevendo `R = F × E ÷ ρ`.

**Inputs.**
- `matches_v1` + `matches_tier2_v1` (do MATCHER)
- `benchmark_salarial_v1` (CNAE × município)
- `razao_folha_receita_v1` (PIA/PAC/PAS por CNAE)
- `razao_by_size_v1` (PIA 1839 ajuste de viés)

**Outputs.**
- `the-dumbers.dealflow.estimates_final` (~60k empresas single-plant com receita low/point/high + confidence)

**SQL canônico.** `scripts/sql/06_estimates_v1.sql`, `12_estimates_final.sql`

**Adaptador Python.** `backend/src/dealflow_api/agents/estimator.py`

**Definition of done.**
- Single-plant only (filtra `n_estabs_ativos_br = 1`)
- Plausibilidade aplicada (capital > 0 + headcount > 100 com cap baixo, etc.)
- Validação empírica HAGA −5%, VIDROPORTO ±1%

**Dependências.** MATCHER (precisa de matches_v1/tier2 prontos). Implicitamente depende de ARCHETYPIST se confidence usa archetype como input.

**Não faz.** Multi-plant. Classificação de archetype (delega pro ARCHETYPIST).
