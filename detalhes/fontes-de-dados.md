# Fontes de dados

Todas as fontes públicas que o projeto consome. Nenhuma é paga.

---

## Fontes do motor (cálculo da estimativa)

### 1. Receita Federal — Cadastro Nacional da Pessoa Jurídica (CNPJ)

- **O que fornece:** universo de empresas + chave de identidade (razão
  social, CNAE, natureza jurídica, capital social, sócios, porte, data de
  abertura, situação cadastral, endereço/CEP).
- **Granularidade:** CNPJ individual (identificado).
- **Atualização:** mensal.
- **Acesso:** via Base dos Dados (`basedosdados.br_me_cnpj`) no BigQuery.
- **Snapshot usado:** 2024-12-18.
- **Papel:** define quem existe e é a base do Match RAIS.

### 2. Simples Nacional — Portal

- **O que fornece:** opção pelo Simples + data de exclusão.
- **Papel:** roteamento tributário. Empresa no Simples tem teto de receita
  conhecido (R$ 4,8M); fora do Simples entra no fluxo principal.

### 3. RAIS — Relação Anual de Informações Sociais · Estabelecimentos

- **O que fornece:** headcount (`quantidade_vinculos_ativos`), CEP, CNAE,
  natureza jurídica, tipo de estabelecimento, tamanho.
- **Granularidade:** estabelecimento, **anonimizado** (sem CNPJ).
- **Atualização:** anual.
- **Ano-base usado:** 2024.
- **Papel:** fonte do headcount. Casada ao CNPJ via chave composta.

### 4. RAIS — Vínculos

- **O que fornece:** `valor_remuneracao_media` por vínculo, CNAE, município.
- **Granularidade:** vínculo individual, **sem CEP nem identificador** de
  estabelecimento.
- **Papel:** só serve para agregados — benchmark salarial CNAE × município.

> **Limite estrutural das duas RAIS:** Estabelecimentos e Vínculos são
> tabelas independentes do MTE. Não há identificador comum entre elas.
> Por isso a Vínculos nunca enriquece um CNPJ — só constrói médias.

### 5. IBGE — pesquisas estruturais (via API SIDRA)

A razão folha/receita e a receita-por-pessoa vêm daqui.

| Pesquisa | Tabela SIDRA | Cobre | Granularidade |
|---|---|---|---|
| **PIA** (Pesquisa Industrial Anual) | 7241, 7242 | Indústria (seções B, C) | CNAE 4d real |
| **PIA tab. 1839** | 1839 | Indústria por faixa de pessoal | faixa de pessoal ocupado |
| **PAS** (Pesquisa Anual de Serviços) | 2577 | Serviços (seções H-N) | sub-agrupamento IBGE |
| **PAC** (Pesquisa Anual de Comércio) | 1418 | Comércio (seção G) | sub-agrupamento IBGE |

- **Ano-base usado:** 2023 (última publicação disponível).
- **API:** `https://apisidra.ibge.gov.br/values` e
  `https://servicodados.ibge.gov.br/api/v3/agregados`.
- **Scripts:** `scripts/build_razao_folha_receita.py`,
  `scripts/build_receita_por_pessoa.py`.

## Fontes de validação (ground truth)

### 6. CVM — Dados Abertos · DFP (Demonstrações Financeiras Padronizadas)

- **O que fornece:** DRE auditada de companhias abertas e de SAs fechadas
  com valores mobiliários registrados. Receita líquida (`CD_CONTA = 3.01`).
- **Acesso:** `https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/DADOS/`
  (ZIPs anuais, sem autenticação).
- **Papel:** ground truth de receita real auditada. Usado em
  `validate_sa_abertas_vs_cvm.py` e `teste_final.py`.
- **Limite:** só SAs (fora do escopo Ltda do produto) — serve para medir
  o motor, não o produto.

### 7. CVM — Dados Abertos · IPE (Informações Periódicas e Eventuais)

- **O que fornece:** metadados de todos os Fatos Relevantes publicados,
  com link para o PDF.
- **Acesso:** `https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE/DADOS/`.
- **Papel:** scraper de aquisições M&A (`scrape_cvm_fato_relevante.py`).
  Yield baixo — empresas adquiridas raramente estão no Tier 1.

### 8. Portal da Transparência — API de Contratos

- **O que fornece:** contratos federais por CNPJ — valor, objeto, datas,
  órgão contratante.
- **Acesso:** `https://api.portaldatransparencia.gov.br/api-de-dados/contratos/cpf-cnpj`
  — exige chave gratuita (`PORTAL_TRANSPARENCIA_API_KEY`).
- **Rate limit:** 30 req/min (06h-00h) · 90 req/min (00h-06h).
- **Papel:** **piso de receita oficial**. Empresa que recebe R$ X/ano em
  contratos federais fatura no mínimo R$ X. Ground truth de empresa em
  operação normal, no escopo do produto.
- **Script:** `scripts/active_validation/scrape_portal_transparencia.py`.

### 9. Comex Stat / SECEX — comércio exterior

- **O que fornece:** exportações por município × NCM × mês.
- **Limite:** **não publica por CNPJ** (sigilo fiscal). Só agregados.
- **Papel:** sinal de exposição exportadora por setor × região
  (alavanca 3, reescopada). Script: `scrape_comex_stat.py`.

## Fontes descartadas (e por quê)

| Fonte | Por que descartada |
|---|---|
| CAGED | Match RAIS já entrega headcount; defasagem aceitável |
| SPED Contábil/Fiscal | Privado, não público |
| DIPJ / ECF / DIRPF | Confidencial fiscal |
| Compartilha RFB | Exige consentimento individual da empresa |
| Processos de Recuperação Judicial | Viés de declínio — empresa em RJ ≠ operação típica |
| Junta Comercial (grande porte) | Empresas >R$300M, fora do teto do produto, multi-plant |
| Serasa / BoaVista | Pago |
