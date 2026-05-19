# Active validation · ground truth dirigido

Pipeline pra construir dataset de validação contínua sem viés de declínio.

## Por que existe

Validação anterior (`scripts/validation/`) usa:
- Hand-curated (104 cases, ruído alto em <R$50M)
- DRE CVM de SA Aberta (50 cases, fora do escopo do produto)

Ambos enviesam contra arquétipos específicos. Esta pasta caça **ground
truth de Ltdas em operação normal** — empresas adquiridas/com debênture
emitida, onde a contraparte tinha responsabilidade jurídica de declarar
receita real.

## Scripts

| Script | Fonte | Status |
|---|---|---|
| `scrape_cvm_fato_relevante.py` | Fato Relevante CVM (IPE) | ✅ funcional |
| `match_active_with_tier1.py` | cruza FR extraído com parquet do motor | ✅ funcional |
| `scrape_pe_releases.py` | Press release de PE/VC em mídia M&A | ⏳ TODO |
| `scrape_cvm_debenture.py` | Prospecto de debênture Ltda emissora | ⏳ TODO |

## Como rodar

```powershell
uv run python scripts/active_validation/scrape_cvm_fato_relevante.py
uv run python scripts/active_validation/match_active_with_tier1.py
```

Saídas:
- `data/active_validation_v1.json` — todos os FRs com receita extraída
- `data/active_validation_matched.json` — subset que casou no Tier 1
- `data/cvm_cache/ipe_*.zip` — cache IPE da CVM (gitignored)
- `data/cvm_cache/fr_pdf_*.pdf` — cache de PDFs baixados (gitignored)

## Resultado do primeiro pass (snapshot 2026-05-19)

- FRs candidatos (2024-2026 com termos de aquisição): **539**
- FRs com receita extraída por regex: **8** (taxa 1.5%)
- Casaram no Tier 1 do parquet: **0**

**Taxa de extração baixa** é esperada no primeiro pass:
- Muitos FRs anunciam aquisição sem declarar receita do alvo
- Regex atual cobre padrões mais comuns mas falha em tabelas embutidas
- PDF layout complexo (warnings "wrong pointing object") dificulta extração

**0 matches com Tier 1** confirma o ponto estrutural:
- Targets de aquisições por SA aberta são frequentemente:
  - Tech/software (low-CLT, fora do motor)
  - Multi-plant (excluído por design do produto)
  - SA Fechada (não-Ltda)
  - Em outros estados (fora do escopo RJ/SP)

## Próximos passes pra subir o yield

1. **LLM para extração** (Claude Haiku · ~US$ 0.003/FR · custo total ~US$ 1.50 pra 539)
   - Extrai receita + nome + CNPJ do target com muito mais accuracy
   - Resolve casos onde regex falha (tabelas, narrativa)

2. **pdfplumber + OCR** para PDFs com layout complexo

3. **Press release PE/VC** — search funds têm taxa de match com Tier 1
   muito maior porque eles compram exatamente o perfil do produto (Ltda
   single-plant SP/RJ R$5-50M). Fontes:
   - Brazil Journal (paywall)
   - Pipeline Valor (paywall)
   - Bloomberg Línea (parcial paywall)
   - LinkedIn posts de search funds (rate-limit)
   - Press releases diretos via Google News

4. **Debêntures CVM** (já temos exemplos no `validate_consolidado_vs_motor`):
   ampliar pra Ltdas emissoras com prospecto público.

## Princípio

Fontes ativas de ground truth precisam combinar duas restrições simultâneas:
- **Receita real conhecida** (via comunicado oficial / mídia)
- **Empresa no Tier 1 do nosso pipeline** (motor produz estimativa)

A maioria dos ground truths públicos cumpre só a primeira. O segundo
critério é o gargalo real do programa de calibração.
