# Metodologia e validação · Genesis Radar

Documento operacional. Captura **decisões de escopo, premissas do modelo e
resultados de validação** medidos contra fontes externas.

> **📁 Documentação técnica completa em [`../detalhes/`](../detalhes/)** —
> fórmula passo a passo, fontes de dados, tabelas de referência,
> classificações, archetypes, alavancas de precisão, pipeline e glossário.
> Este documento é o resumo executivo; `detalhes/` é a referência exaustiva.

Para a arquitetura legada do motor estatístico, ver `architecture.md` e
`DealFlow_BR_Metodologia_Consolidada.docx` (nome legado, anterior ao rebranding).

---

## 1. Escopo de produto

O universo final exposto pela API é o subconjunto do parquet
`data/estimates_final.parquet` que satisfaz, simultaneamente:

| Filtro | Critério | Justificativa |
|---|---|---|
| `natureza_juridica` | `= '2062'` (Sociedade Empresária Limitada) | Foco em Ltdas fechadas que não publicam DRE — onde o modelo agrega valor. |
| `receita_point_brl` | `≤ R$ 250.000.000` | M&A médio porte; remove conglomerados industriais e gigantes. |
| `archetype` | `≠ 'holding_structure'` | Validação contra DRE pública (n=50 SAs Abertas + n=4.933 holdings flagados) mostrou erro mediano >75% nesse arquétipo. Holding não opera diretamente — receita real são dividendos de controladas; reconstrução por folha/razão setorial sub-estima sistematicamente. |

**Tamanho do universo após filtros**: 46.255 LTDAs single-plant
(de 59.511 antes da exclusão de holdings).

Implementação: `backend/src/dealflow_api/data/loader.py` →
constantes `LTDA_NATUREZA`, `RECEITA_TETO_BRL`, `ARCHETYPES_EXCLUIDOS`
aplicadas centralmente em `_apply_scope()`. Single source of truth — todos
os endpoints (`/empresas`, `/stats`, `/filtros`, `/empresas/{cnpj}/socios`)
consomem o mesmo escopo.

---

## 2. Modelo de receita · resumo operacional

Reconstrução estatística a partir de sinais públicos cruzados:

```
folha_total = headcount × salario_mediano_setorial × 12 × encargos_setoriais
receita    = folha_total / razao_folha_sobre_receita_setorial
```

**Razão folha/receita** é calibrada por (CNAE × porte × ano-base) com base em
pesquisas estruturais do IBGE e PIA, complementadas por DRE pública de SAs
Abertas comparáveis. Fontes: `data/reference/razao_folha_receita_2023.csv`,
`data/reference/benchmark_salarial.csv`.

**Saída**: `(receita_low_brl, receita_point_brl, receita_high_brl,
confidence ∈ {alta, media, baixa, sem_benchmark})`. O intervalo carrega a
margem de erro setorial; o `point` é a média harmônica do par
(encargos_low, encargos_high).

**Arquétipos** (após exclusão de holdings, 7 perfis):
`standard`, `family_mature_sweet_spot`, `labor_intensive_midcap`,
`capital_intensive`, `partnership_heavy_services`, `recent_startup`,
`financeiro_out_scope`. Archetype **não é fator** do cálculo de receita —
é etiqueta de produto para guiar tese M&A e sinalizar onde o modelo perde
confiança (ex.: `partnership_heavy_services` carrega aviso de subestimação
sistemática porque parte da remuneração nesse setor ocorre fora do CLT).

---

## 3. Validação · resultados medidos

### 3.1 SA Aberta (CVM DFP 2024) · n=37/50

Comparação contra Receita Líquida (DRE consolidada, CD_CONTA = 3.01)
publicada na CVM. Script: `scripts/validation/validate_sa_abertas_vs_cvm.py`.

| Faixa de |desvio| | Empresas | % |
|---|---:|---:|
| ±25% | 3 | 8% |
| 25%–50% | 4 | 10% |
| > 50% | 30 | 81% |
| **Mediana** | | **84,3%** |

**Leitura honesta**: SA Aberta single-plant é amostra patológica — sobreviveram
ao filtro `n_estabs_ativos_br = 1` justamente as holdings puras (Itaúsa,
Bradespar, Natura &Co Holding), concessionárias de pedágio/metrô (Ecovias,
Anhanguera-Bandeirantes), securitizadoras (Casa de Pedra) e bancos (Cielo,
Banco Nacional) — perfis onde folha de pagamento não tem relação direta com
receita.

### 3.2 Hand-curated (M&A disclosures + releases) · n=86/104

Casos selecionados de Ltdas/SAs Fechadas com receita conhecida via fato
relevante de aquisição, declaração em release público ou DRE de SA Fechada
emissora de debênture. Lista em `data/cvm_cache/handcurated_dre.json`.
Script: `scripts/validation/validate_consolidado_vs_motor.py` (fonte A).

### 3.3 Consolidado · n=125

| Faixa de |desvio| | Empresas | % |
|---|---:|---:|
| ±25% | 68 | 54% |
| 25%–50% | 14 | 11% |
| > 50% | 43 | 34% |
| **Mediana** | | **22,8%** |

Removendo a cauda dominada por arquétipos fora-de-escopo (concessionárias,
holdings, securitizadoras, bancos — que **já foram retirados do produto**
após esta validação), a mediana cai para faixa de 12–15%.

**Top 40 da lista** (todos os arquétipos operacionais — manufatura, agro,
química, autopeças, serviços com folha proporcional) ficam abaixo de ±15%
de erro.

---

## 3-bis. Alavancas de precisão (2026-05-19)

Três fontes públicas gratuitas adicionadas ao motor. Detalhe completo em
[`../detalhes/alavancas-de-precisao.md`](../detalhes/alavancas-de-precisao.md).

| Alavanca | O que é | Status |
|---|---|---|
| **1 · PIA receita-por-pessoa** | 2ª fórmula independente (`receita_por_pessoa × headcount`). Quando converge ≤25% com a fórmula principal, gera **selo de validação cruzada** e promove confidence. Só adiciona confiança — nunca penaliza. 7.191 empresas (15,6%) têm o selo. | ✅ em produção |
| **2 · Portal da Transparência** | Contratos federais por CNPJ = **piso de receita oficial**. Quando piso > estimativa, há subestimação comprovada. | ⏳ scraper rodando |
| **3 · Comex Stat** | Exposição exportadora por UF×NCM (sigilo impede dado por CNPJ). Sinal indireto. | scaffolding |

**Decisão de produto:** a PIA **não** é exposta como segunda estimativa
(cliente M&A quer um número, não dois concorrentes). No agregado ela é
menos precisa que a fórmula folha (mediana 42% vs 23%). Seu valor é
validação cruzada: convergência de dois métodos independentes é sinal de
confiança real.

---

## 3-ter. Sinais de risco fiscal e judicial (2026-05-23)

Camada de **risco** sobre o universo do produto — não muda a estimativa
de receita, mas anexa bandeiras de saúde fiscal/judicial **só com fonte
pública oficial**. Posicionamento: o que o Serasa Consulta Completa cobra
R$ 45 por consulta (dívidas, RJ, falência, protestos), Genesis Radar
serve no plano mensal, auditável, da fonte primária.

| Sinal | O que é | Fonte | Status |
|---|---|---|---|
| **PGFN Dívida Ativa** | Total devido à União por CNPJ (Tributária + Previdenciária + FGTS), nº inscrições, % ajuizadas, situação. **22.845 LTDAs (39,9% do escopo)** têm dívida ativa federal — agregado R$ 112,9 bi. | `dadosabertos.pgfn.gov.br` (LAI, trimestral) | ✅ em produção |
| **Recuperação Judicial — sinal nominal** | LTDAs com `"EM RECUPERAÇÃO JUDICIAL"` no razão social RFB. Hoje **excluídas** do escopo (n=189). | RFB CNPJ | ✅ em produção (como filtro de escopo) |
| **Datajud agregado** | Volume de processos por classe (108 Falência, 129 RJ, 128 RJ Extrajudicial) por UF × janela atual/anterior. Sinal regional/setorial (Datajud mascara partes por LGPD, então não é per-CNPJ). | CNJ API pública | ✅ em produção |
| **Querido Diário (on-demand)** | Menções ao CNPJ em DOs municipais. API rate-limita batches, então estratégia é **consulta live** quando o usuário abre o DetailModal, com cache de processo no backend. | Open Knowledge BR (`api.queridodiario.ok.org.br`) | ✅ em produção |
| **DJEN scrap** | Publicações de admissão de RJ/Falência. API funciona (`comunicaapi.pje.jus.br`) mas matching per-CNPJ é frágil — texto cita partes por nome, não CNPJ. Mais útil como sinal agregado por tribunal/mês. | CNJ DJEN | ⏸️ deferred (cobertura redundante com Datajud agregado) |
| **SEFAZs estaduais (dívida ativa estadual)** | ICMS etc. — top 5 estados (SP, RJ, MG, RS, PR) cobrem ~80% do PIB. | Cada SEFAZ | ⏸️ bloqueio externo — nenhum estado expõe bulk download como a PGFN federal; só consulta unitária com captcha |
| **CENPROT (protestos)** | Por CPF/CNPJ, consulta unitária quando o usuário abre o DetailModal. A base nacional não tem API livre (WAF + reCAPTCHA + login GOV.BR), então a consulta passa por um **provedor homologado** (Infosimples/Direct Data), com cache de processo no backend. | CENPROT/IEPTB | ✅ on-demand (custo por consulta nova) |

**Pipeline PGFN:** `scripts/refresh_pgfn.py` baixa os 3 datasets
trimestrais (~1.3 GB comprimidos), processa com Polars lazy scan
(filter pushdown), e gera `data/pgfn_divida_ativa.parquet` (~0.3 MB)
agregado por CNPJ. Exposto via `/api/v1/empresas/{cnpj}/divida_ativa`
e painel `DividaAtivaPanel` no DetailModal.

**Bandeira de gravidade** (frontend): verde (sem dívida) · amarela
(< R$ 1 mi) · laranja (R$ 1–10 mi) · vermelha (> R$ 10 mi).

**Pipeline Protestos (on-demand):** `backend/src/dealflow_api/data/protestos.py`
expõe `get_protestos(cnpj)` atrás de uma abstração de provedor escolhida
por env (`DEALFLOW_PROTESTOS_PROVIDER` = `none` | `infosimples` |
`directd`; token em `DEALFLOW_PROTESTOS_API_TOKEN`). Exposto via
`GET /api/v1/empresas/{cnpj}/protestos` (sempre 200) e painel
`ProtestosPanel` no DetailModal. Sem provedor configurado degrada para
`disponivel:false` (estado neutro "monitoramento sob demanda"). Resultado
cacheado no processo (`lru_cache`) para não pagar 2× o mesmo CNPJ — custo
~R$ 0,01–0,10 por consulta nova. CLI de teste: `scripts/consulta_cenprot.py`.
Bandeira por valor protestado: verde (sem protesto) · amarela (< R$ 50 mil)
· laranja (R$ 50–500 mil) · vermelha (> R$ 500 mil).

> **Decisão de arquitetura.** A rota considerada no mapeamento original
> (scraper direto da CENPROT + captcha solver tipo 2Captcha) foi
> descartada: a base nacional fica atrás de WAF (403 em todo path da
> API) e o detalhe per-CNPJ exige login GOV.BR — um scraper seria
> frágil e parcialmente bloqueado. O provedor homologado entrega o
> mesmo dado, normalizado e estável, ao mesmo custo por consulta.

---

## 4. Limites conhecidos · documentados na UI

Cada arquétipo carrega aviso explícito na UI
(`frontend/src/components/Terms/terms.tsx`) e no painel de filtros
(`frontend/src/components/Filters/hints.tsx`):

| Arquétipo | Aviso |
|---|---|
| `family_mature_sweet_spot` | Sem aviso — zona de validade plena. |
| `labor_intensive_midcap` | Sem aviso — zona de validade plena. |
| `capital_intensive` | Viés residual em setores dominados por grandes players. Use como ordem de magnitude. |
| `partnership_heavy_services` | Remuneração fora do CLT não entra. Tratar estimativa como piso. |
| `recent_startup` | Fora da zona de validade (empresa < 3 anos). |
| `financeiro_out_scope` | CNAE K fora do escopo das pesquisas estruturais. |
| `standard` | Sem padrão estrutural identificado — maioria do universo. |

---

## 5. Validações futuras · roadmap honesto

Ground-truths investigados nesta sessão que **não entraram** no produto por
limites externos:

| Fonte | Resultado | Bloqueio |
|---|---|---|
| Datajud (CNJ, API pública) | Não retorna nome de parte (mascarado por LGPD). Inviável fuzzy-match. | Endpoint público propositalmente limitado. |
| DJEN (Diário Justiça Eletrônico) | Filtro `texto` quebrado — retorna mesmos 10k itens independente da query. | Limitação atual da API. |
| e-SAJ TJSP (busca por parte) | Captcha em cada query. | Bypass complexo, fora do escopo. |
| **Recuperação Judicial** (autos com DRE 3 anos, Lei 11.101/05 art. 51) | Acesso requer scrape PJe/eSAJ por tribunal + OCR + parser de PDF. **Maior leverage estimado** (~1.000 ground-truths grátis). | Multi-day, fora do escopo desta sessão. |
| Serasa Experian (relatório mensal RJ) | Pago. | Comercial. |

**Sinal mínimo já disponível**: 189 LTDAs com `"EM RECUPERACAO JUDICIAL"`
literal no `razao_social` (RFB registra quando a empresa altera o nome
societário oficial). Piso conhecido, não teto.

---

## 6. Histórico de decisões aplicadas

| Data | Decisão | Justificativa | Arquivos |
|---|---|---|---|
| 2026-05-15 | Holdings excluídas do universo | Validação CVM mostrou desvio mediano >75% no arquétipo. | `loader.py`, frontend cleanup |
| 2026-05-15 | TOC clicável + IDs nas seções Termos/Privacidade | Modal jurídico tinha 24 seções sem âncora — péssimo para due diligence interna do cliente. | `legal/LegalTOC.tsx`, IDs em `*Content.tsx` |
| 2026-05-15 | `<strong>` volta a ser bold semântico | Override global Playfair-italic destruía escaneabilidade em documento jurídico denso. | `tokens.css` |
| 2026-05-15 | Tipografia subiu (body 13→14, labels mono 9→11) | Ferramenta de leitura prolongada para analista M&A. | `tokens.css`, `dashboard.css`, `chrome.css` |
| 2026-05-15 | `:focus-visible` global + `prefers-reduced-motion` | Acessibilidade — navegação por teclado invisível antes. | `tokens.css` |
| 2026-05-15 | Confidence badges com background fill | Leitura instantânea ao varrer linhas. | `dashboard.css` |
| 2026-05-15 | KPI value unificado em IBM Plex Mono | Mistura Playfair/Mono na mesma row quebrava ritmo de comparação numérica. | `dashboard.css` |
| 2026-05-15 | AnimatePresence `mode="wait"` + duração 0.1s | Troca de view instantânea em ferramenta de uso diário. | `Home.tsx` |
| 2026-05-15 | Grid de fundo desligado na `.workspace` | Moiré em tabelas densas. | `chrome.css` |
| 2026-05-15 | Responsividade da tabela (820px, 560px) | Colunas degradam graciosamente em laptop 13". | `dashboard.css` |
| 2026-05-16 | Empresas em recuperação judicial excluídas | Operação degradada — folha não reflete receita real. | `loader.py` |
| 2026-05-16 | Intervalo low/high alargado por confidence | Intervalo nominal ±10% mentia sobre incerteza real ±20%+. | `loader.py` |
| 2026-05-16 | `capital_intensive` midcap rebaixado pra baixa | Viés residual +35-40% (PIA 1839 estratifica só até 500 funcs). | `loader.py` |
| 2026-05-19 | Rebranding → Genesis Radar (produto) / Genesis Labs (empresa) | Decisão de marca. Identificadores técnicos mantidos. | 29 arquivos |
| 2026-05-19 | 3 alavancas de precisão (PIA, Portal Transparência, Comex) | Aumentar precisão sem fonte paga. | `loader.py`, `scripts/` |
| 2026-05-19 | PIA vira selo de confiança aditivo, não 2ª estimativa | Cliente M&A quer um número. Convergência só adiciona confiança. | `loader.py`, `DetailModal.tsx` |
| 2026-05-19 | Pasta `detalhes/` — documentação técnica completa | Referência exaustiva de metodologia, fontes, tabelas. | `detalhes/` |
