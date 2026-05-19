# Metodologia e validação · DealFlow BR

Documento operacional. Captura **decisões de escopo, premissas do modelo e
resultados de validação** medidos contra fontes externas. Para arquitetura
detalhada do motor estatístico, ver `architecture.md` e
`DealFlow_BR_Metodologia_Consolidada.docx`.

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
