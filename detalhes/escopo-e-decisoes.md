# Escopo do produto e histórico de decisões

O que entra no universo do Genesis Radar, o que fica de fora, e por quê.

---

## O escopo — filtros do universo

Implementado em `backend/src/dealflow_api/data/loader.py` →
`_apply_scope()`. **Single source of truth** — todos os endpoints
consomem o mesmo escopo.

| Filtro | Critério | Constante no código |
|---|---|---|
| Natureza jurídica | `== '2062'` (Sociedade Ltda) | `LTDA_NATUREZA` |
| Teto de receita | `receita_point_brl ≤ R$ 250.000.000` | `RECEITA_TETO_BRL` |
| Exclui holdings | `archetype != 'holding_structure'` | `ARCHETYPES_EXCLUIDOS` |
| Exclui recuperação judicial | razão social não casa `(?i)em\s+recuperac?[aã]o` | `PATTERN_RJ_RAZAO` |

**Tamanho do universo:** parquet bruto 59.511 → após escopo **46.115**.

### Por que cada filtro

- **Só Ltda (2062):** Ltdas fechadas não publicam DRE — é onde o motor
  agrega valor. SAs têm dado público (CVM); não precisam de estimativa.
- **Teto R$ 250M:** foco em M&A de médio porte. Remove conglomerados.
- **Sem holdings:** holding não opera diretamente — receita real são
  dividendos de controladas. A fórmula folha/razão erra >75% nesse perfil.
- **Sem recuperação judicial:** operação degradada — folha não reflete
  a receita real da empresa em colapso.

## Princípio de design — dados vs produto

A **camada de dados** captura amplo: qualquer empresa estimável. A
**camada de produto** filtra. Headcount, porte e Simples Nacional **não
cortam empresas precocemente** — entram como insumo da estimativa ou como
dimensão de confiança. O filtro de "vale pra mim?" é do usuário (range de
receita, archetype, geografia, confiança mínima).

## Histórico de decisões aplicadas

Cronológico. Cada decisão tem o porquê.

| Data | Decisão | Motivo |
|---|---|---|
| 2026-05-11 | Multi-plant descartado do produto | Validação contra 21 DREs: erro médio 107%. Over-count em zonas comerciais densas é estrutural (RAIS anonimizada). |
| 2026-05-11 | Ajuste numérico por archetype descartado | Experimentos pioraram tanto quanto melhoraram. Archetype vira só metadado de filtro. |
| 2026-05-15 | **Holdings excluídas** do universo | Erro mediano >75% no arquétipo (validação CVM). |
| 2026-05-15 | TOC + âncoras nos modais legais | 24 seções sem navegação — péssimo para due diligence do cliente. |
| 2026-05-15 | `<strong>` volta a bold semântico | Override global Playfair-itálico destruía escaneabilidade. |
| 2026-05-15 | Tipografia +1px, focus rings, badges com bg | Ergonomia de ferramenta de uso diário. |
| 2026-05-16 | Empresas em recuperação judicial excluídas | Operação degradada — fora do escopo. |
| 2026-05-16 | Intervalo low/high alargado por confidence | Intervalo nominal ±10% mentia sobre incerteza real ±20%+. |
| 2026-05-16 | `capital_intensive` midcap rebaixado | Viés residual +35-40% conhecido (PIA 1839 estratifica só até 500 funcs). |
| 2026-05-19 | Rebranding DealFlow BR → Genesis Radar / Genesis Labs | Decisão de marca. |
| 2026-05-19 | **3 alavancas de precisão** implementadas | PIA receita-por-pessoa, contratos federais, Comex. Ver [`alavancas-de-precisao.md`](alavancas-de-precisao.md). |
| 2026-05-19 | PIA vira selo de confiança, não 2ª estimativa | Cliente M&A quer UM número. Duas estimativas confundem. PIA só adiciona confiança quando converge — nunca penaliza. |

## Identificadores técnicos mantidos no rebranding

Por decisão de não quebrar setups existentes, estes **não** foram
renomeados de `dealflow` para `genesis`:

- Pacote Python `dealflow_api` e `dealflow`
- Prefixo de env var `DEALFLOW_*`
- Diretório do repositório `dealflow-br/`
- Dataset BigQuery `the-dumbers.dealflow.*`
- Chaves de localStorage `dealflow:watchlist:v1`, `dealflow:legal-accept:v1`
- URL do repositório GitHub

Branding visível, documentos legais e copy de produto **foram** atualizados.

## O que está fora do escopo (e fica fora)

- **SA** (aberta ou fechada) — têm DRE pública, não precisam de estimativa
- **Multi-plant** — agregação falha estruturalmente
- **Holdings** — fórmula inaplicável
- **Empresas em recuperação judicial** — operação atípica
- **Fora de RJ/SP** — restrição geográfica do MVP (são as capitais com
  bairro na RAIS e onde se concentram search funds e boutiques M&A)
- **Financeiro (CNAE K)** — fora do escopo das pesquisas IBGE
