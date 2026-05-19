# Alavancas de precisão

Três fontes públicas e gratuitas adicionadas ao motor para aumentar a
precisão e a confiabilidade da estimativa.

---

## Alavanca 1 · PIA receita-por-pessoa — segunda fórmula independente

### O que é

Uma fórmula alternativa, calculada por um caminho independente da fórmula
folha/razão:

```
receita_pia = receita_por_pessoa_setorial × headcount
```

A `receita_por_pessoa` vem da mesma fonte IBGE (PIA/PAS/PAC), mas é uma
razão diferente — não passa pelos dois fatores ruidosos (salário e
encargos).

### Como usa

A PIA **não substitui** a estimativa principal. No agregado (n=125 ground
truths) ela é pior: mediana 42,3% vs 22,8% da folha. O valor dela é
**validação cruzada**:

| Convergência (`convergencia_pct`) | Flag | Efeito |
|---|---|---|
| PIA bate a folha ≤ 25% | `convergente` | **selo de confiança** + promove confidence um nível |
| PIA diverge da folha > 25% | `nao_convergente` | nada — sem penalização |
| sem cobertura PIA pro CNAE | `sem_pia` | nada |

> Decisão de produto: convergência **só adiciona confiança**. Não há selo
> de desconfiança. A folha continua sendo a estimativa de referência.

### Resultado

7.191 empresas (15,6% do universo) têm o selo de validação cruzada — a
estimativa é confirmada por dois métodos independentes. Concentram em
indústria (seção C) e comércio (G) de médio porte.

### Correção de unidade · fator CEMPRE 6449

A fórmula PIA tinha uma inconsistência: `receita_por_pessoa` é calculada
sobre **pessoal ocupado total** (a PIA conta sócios e proprietários), mas
o motor multiplica por `headcount` da RAIS = **só vínculos CLT**.

Correção via CEMPRE (IBGE, tabela 6449), que distingue pessoal ocupado
total de assalariado:

```
pessoal_ocupado_estimado = headcount_CLT × fator_pessoal(cnae)
receita_pia              = receita_por_pessoa × pessoal_ocupado_estimado
```

`fator_pessoal` = total ÷ assalariado por CNAE 4d. Mediano 1,12; em
low-CLT (consultoria, contabilidade) chega a 1,34+ — corrige justamente
onde a fórmula mais subestimava. Tabela: `data/reference/fator_pessoal_cempre_2021.csv`
(`build_fator_pessoal_cempre.py`). CEMPRE série encerrada em 2021 — a
razão é estrutural, defasagem aceitável.

Efeito: convergentes subiram de 7.191 → 11.733 (a PIA subestimava por
falta do fator; corrigida, bate melhor com a folha).

### Implementação

- Tabelas: `data/reference/receita_por_pessoa_2023.csv` + `fator_pessoal_cempre_2021.csv`
- Scripts: `build_receita_por_pessoa.py`, `build_fator_pessoal_cempre.py`
- Lógica: `loader.py` → `_apply_pia_second_estimate()`
- Colunas geradas: `receita_pia_brl`, `convergencia_pct`, `convergencia_flag`, `fator_pessoal`
- Lista: `data/empresas_convergentes_pia.csv`

---

## Alavanca 2 · Portal da Transparência — piso de receita oficial

### O que é

Empresas que fornecem ao governo federal têm o valor anual de contratos
declarado oficialmente (Lei 14.133/21 + LAI). Esse valor é um **piso de
receita**: empresa com R$ X/ano em contratos federais fatura no mínimo R$ X.

### Como usa

| Coluna gerada | Significado |
|---|---|
| `piso_federal_anual_brl` | valor total de contratos ÷ nº de anos |
| `n_contratos_federais` | quantidade de contratos |
| `flag_subestimacao_federal` | `True` quando piso > estimativa do motor |

Quando o piso oficial supera a estimativa, há **subestimação comprovada
por dado oficial** → confidence rebaixada + selo de "piso de receita
confirmado" na UI.

### Natureza do teste

É um teste **assimétrico**:
- ✅ Detecta subestimação com prova oficial
- ❌ Não detecta superestimação (piso baixo é compatível com receita maior)
- Cobre só ~5-6% do universo (quem fornece ao governo)

Mais útil em empresas **gov-dependentes** (contrato federal é fração
dominante da receita) — aí o piso ≈ receita real.

### Implementação

- Script: `scripts/active_validation/scrape_portal_transparencia.py`
- Endpoint: `api.portaldatransparencia.gov.br/api-de-dados/contratos/cpf-cnpj`
- Chave gratuita em env var `PORTAL_TRANSPARENCIA_API_KEY`
- Rate limit: 30 req/min (dia) · 90 req/min (madrugada)
- Resultado: `data/contratos_federais_por_cnpj.json`
- Lógica: `loader.py` → `_apply_federal_floor()`
- Cache incremental → `build_federal_from_cache.py` gera o JSON parcial

---

## Alavanca 3 · Comex Stat — exposição exportadora

### O que é (e o que NÃO é)

A intenção original era usar receita de exportação por CNPJ como piso.
**Reescopada** ao descobrir que o Comex Stat não publica volume por CNPJ
(sigilo fiscal, art. 198 CTN) — só agregados por município × NCM.

### Como ficou

Sinal de **exposição exportadora por setor × região**: município/CNAE com
alta exportação indica que empresas ali têm probabilidade de exportar — e
exportadora típica fatura mais que par doméstico (margem internacional).

Tag por par UF × NCM: `alta` (top 10%), `media` (top 25%), `baixa`.

### Status

Scaffolding pronto. Requer download manual do dump anual da SECEX
(`EXP_2024.csv`, ~500MB):

```
https://balanca.economia.gov.br/balanca/bd/comexstat-bd/ncm/EXP_2024.csv
```

Script: `scripts/active_validation/scrape_comex_stat.py`. É a alavanca de
menor impacto das três — sinal indireto, não ground truth.

---

## Resumo comparativo

| Alavanca | Tipo | Impacto | Status |
|---|---|---|---|
| 1 · PIA | 2ª fórmula → selo de confiança | 7.191 empresas com selo | ✅ em produção |
| 2 · Portal Transparência | piso de receita oficial | ~1.250 empresas (estimado) | ⏳ scraper rodando |
| 3 · Comex Stat | sinal de exposição exportadora | indireto | scaffolding |
