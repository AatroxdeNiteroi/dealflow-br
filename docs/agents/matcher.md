# 🕵️ MATCHER

**Função.** Cruzar RAIS (anonimizada) × Receita Federal (identificada) pela chave composta §4.2 + cascata §4.4 de desempate. Entrega CNPJs identificados com headcount confiável.

**Persona pixel art.** Detetive com lupa, examinando pistas (CEP, CNAE, natureza, município).

**Inputs.**
- `basedosdados.br_me_cnpj.estabelecimentos` (matriz/filial Receita)
- `basedosdados.br_me_rais.microdados_estabelecimentos` (RAIS anonimizada com headcount)
- Snapshot date Receita + ano-base RAIS

**Outputs.**
- `the-dumbers.dealflow.matches_v1` (~72k Tier 1 chave única)
- `the-dumbers.dealflow.matches_tier2_v1` (~9k Tier 2 desempatado)

**SQL canônico.**
- `scripts/sql/01_receita_universe.sql`
- `scripts/sql/02_rais_universe.sql`
- `scripts/sql/03_matches.sql`
- `scripts/sql/11_matches_tier2.sql`

**Adaptador Python.** `backend/src/dealflow_api/agents/matcher.py`

**Definition of done.** Match Tier 1 com 100% precisão de chave única; Tier 2 com score ≥2 e top único pela cascata. Qualidade ≈ Tier 1 (validado: 96% score 3/3).

**Dependências.** Nenhuma (primeiro agente do pipeline).

**Não faz.** Multi-plant (descartado §4.5 do produto). Estimativa de receita (delega pro ESTIMATOR).
