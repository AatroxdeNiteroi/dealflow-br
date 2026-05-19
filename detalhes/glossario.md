# Glossário

Termos técnicos do projeto Genesis Radar.

---

**Archetype** — perfil estrutural da empresa (7 tipos), derivado de sinais
societários da Receita. Filtro de produto, não fator de cálculo.

**Benchmark salarial** — tabela de salário médio mensal por CNAE ×
município, construída da RAIS Vínculos. Fator da fórmula.

**Chave composta / chave de match** — combinação CEP + CNAE subclasse +
natureza jurídica + tipo de estabelecimento + município, usada para casar
um registro anonimizado da RAIS a um CNPJ da Receita.

**CNAE 2.0** — Classificação Nacional de Atividades Econômicas. Hierárquica:
seção (letra) › divisão (2d) › grupo (3d) › classe (4d) › subclasse (7d).

**Compartilha RFB** — API da Receita que entrega faturamento declarado
mediante consentimento da empresa. Descartada (exige consentimento).

**Confidence / confiança** — score qualitativo da estimativa: `alta`,
`media`, `baixa`, `sem_benchmark`. Combina 4 fatores.

**Convergência** — quando a 2ª fórmula (PIA receita-por-pessoa) bate a
estimativa principal em ≤25%. Gera o selo de validação cruzada.

**DFP** — Demonstrações Financeiras Padronizadas. Relatório anual auditado
que companhias entregam à CVM. Fonte de ground truth.

**Encargos (multiplicador de)** — fator que converte salário-base em folha
total (FGTS, 13º, férias, benefícios). 1,4–2,1 por seção CNAE.

**Estimates_final** — o parquet/tabela do produto final. 59.511 empresas
no bruto, 46.115 após escopo.

**Folha estimada** — `headcount × salário × 12 × encargos`. Numerador da
reconstrução de receita.

**Ground truth** — receita real conhecida de uma empresa, usada para
medir o erro do motor.

**Headcount** — número de vínculos CLT ativos. Vem da RAIS Estabelecimentos.

**Hand-curated** — conjunto de 104 empresas com receita coletada
manualmente de releases públicos e disclosures M&A.

**IPE** — Informações Periódicas e Eventuais. Categoria de documentos CVM
que inclui Fatos Relevantes.

**Match RAIS** — processo de identificar a qual CNPJ pertence um registro
anonimizado da RAIS, via chave composta.

**Natureza jurídica** — código de 4 dígitos da Receita. `2062` = Ltda
(o universo do produto).

**PIA / PAS / PAC** — Pesquisas Industrial Anual / Anual de Serviços /
Anual de Comércio, do IBGE. Fonte da razão folha/receita.

**Piso federal** — valor anual de contratos com o governo federal. Limite
inferior comprovado da receita real (alavanca 2).

**Razão folha/receita** — fração da receita representada pela folha de
pagamento, por setor. Divisor da fórmula. 3 camadas de precisão.

**RAIS** — Relação Anual de Informações Sociais (MTE). Duas tabelas:
Estabelecimentos (headcount) e Vínculos (salários). Anonimizadas.

**Receita point / low / high** — estimativa pontual e os limites do
intervalo de confiança.

**Selo de validação cruzada** — marca visível no produto quando a 2ª
fórmula PIA converge com a estimativa principal. Só adiciona confiança.

**SIDRA** — Sistema IBGE de Recuperação Automática. API de dados das
pesquisas estatísticas.

**Tier 1 / Tier 2** — qualidade do match RAIS. Tier 1 = chave única
(identidade confirmada). Tier 2 = chave ambígua resolvida por cascata.

**Universo (do produto)** — conjunto de empresas que o produto expõe:
Ltda + receita ≤ R$250M + sem holdings + sem recuperação judicial.
