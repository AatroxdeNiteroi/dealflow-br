# 🦉 ARCHETYPIST

**Função.** Classificar cada empresa em 1 dos 8 archetypes (§6.5) usando sinais Receita: capital_social, n_socios, idade, capital_por_funcionario, socios_ratio.

**Persona pixel art.** Naturalista com caderno e lupa, catalogando espécies.

**Inputs.**
- `socios_summary_v1` (agregado por raiz CNPJ)
- Sinais do `receita_universe_v1` (capital, idade, porte, natureza)
- Headcount do MATCHER

**Outputs.**
- Coluna `archetype` em `estimates_final` (8 valores: `family_mature_sweet_spot`, `labor_intensive_midcap`, `capital_intensive`, `holding_structure`, `recent_startup`, `partnership_heavy_services`, `financeiro_out_scope`, `standard`)
- Colunas auxiliares: `capital_por_funcionario`, `socios_ratio`, `idade_empresa_anos`

**SQL canônico.** `scripts/sql/05_socios_summary.sql`, `07_estimates_v2.sql`, `12_estimates_final.sql`

**Adaptador Python.** `backend/src/dealflow_api/agents/archetypist.py`

**Definition of done.**
- 8 archetypes presentes em ~60k linhas
- Magic filter `family_mature_sweet_spot` retorna ~5.886 empresas
- Archetype é METADATA, NÃO afeta cálculo de receita (Decisão arquitetural Opção A, §6.5)

**Dependências.** MATCHER (cnpj_basico + headcount). `socios_summary_v1` (que vem do `basedosdados.br_me_cnpj.socios`).

**Não faz.** Aplicar archetype como fator numérico na receita (foi testado e descartado — pioraria estimativa).
