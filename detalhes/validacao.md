# Validação e ground truth

Como o motor é testado, contra quê, e o que os números realmente dizem.

---

## O problema central da validação

Empresas Ltda. fechadas não publicam receita — é o motivo de o produto
existir. **Não existe** um conjunto de teste limpo, gratuito e completo
para o exato perfil do produto. Toda fonte de ground truth é parcial.

## Fontes de ground truth usadas

| Fonte | n | Qualidade | Limite |
|---|---|---|---|
| **Hand-curated** | 104 cases | média | receita de releases/M&A — ruído alto em <R$50M |
| **CVM DFP · SA Aberta** | ~50 | alta (DRE auditada) | SAs grandes, fora do escopo Ltda |
| **CVM DFP · SA Fechada** | ~6 | alta | volume baixo |
| **Contratos federais** | ~150 (parcial) | alta (dado oficial) | só piso, só quem fornece ao governo |

Consolidadas em `scripts/active_validation/teste_final.py`.

## Resultados medidos (snapshot 2026-05-19, n=134)

```
MOTOR (todos os ground truths · n=134):
  Mediana |desvio|:  ~23%
  Dentro de ±25%:    52%
  25-50%:            12%
  >50%:              34%
```

### Leitura honesta dos números

A mediana ~23% **é enganosa** se lida sozinha. Decompondo:

- **Top ~40 empresas** (manufatura/agro/química real, folha proporcional
  ao output): erro abaixo de ±15%. Esse é o motor funcionando.
- **Cauda >50%** (~46 empresas): quase toda composta de arquétipos que o
  produto **já exclui** — concessionárias, holdings, securitizadoras,
  bancos, empresas em recuperação judicial. Não é erro de calibração; é
  o motor sendo aplicado fora do domínio dele.

Removendo a cauda fora-de-escopo, a mediana real do produto fica em
**12-15%**.

## Por que a validação não consegue medir o "produto"

O validador mede o **motor** (qualquer empresa), não o **produto** (Ltdas
in-scope). Razão: o ground truth público é quase todo de SA grande. Das
134 empresas testadas, só ~10 são Ltdas no escopo do produto — amostra
pequena demais para conclusão estatística.

Por isso a alavanca 2 (contratos federais) importa: é a primeira fonte de
ground truth de **empresa pequena operacional no escopo do produto**.

## Validações descartadas

| Tentativa | Por que descartada |
|---|---|
| Scraper de Fato Relevante CVM (aquisições M&A) | 0/8 casaram com Tier 1 — empresas adquiridas são tech/multi-plant/SA, fora do escopo |
| Processos de Recuperação Judicial | Viés de declínio — empresa em RJ não reflete operação típica |
| Junta Comercial grande porte | Empresas >R$300M, fora do teto, multi-plant |

## Calibração de incerteza derivada da validação

Os resultados de validação alimentaram o pós-processamento (ver
[`archetypes-e-confianca.md`](archetypes-e-confianca.md)):

- O intervalo low/high nominal (±10%) não batia com o erro real medido
  (±20%+) → alargamento por confidence.
- `capital_intensive` midcap mostrou viés +35-40% sistemático → rebaixado.

## Validação cruzada interna (sem ground truth externo)

A alavanca 1 (PIA) é uma forma de validação que **não depende de ground
truth**: duas fórmulas independentes calculando a mesma empresa. Quando
convergem (≤25%), a probabilidade de erro grosseiro comum cai — é um sinal
estatístico de confiança real. 7.191 empresas têm essa convergência.

## Scripts de validação

| Script | O que faz |
|---|---|
| `validate_final_vs_dre.py` | 104 cases hand-curated vs motor (lê BigQuery — legado) |
| `validate_sa_abertas_vs_cvm.py` | SAs Abertas single-plant vs DRE CVM 2024 |
| `validate_consolidado_vs_motor.py` | agrega hand-curated + CVM, separa MOTOR vs PRODUTO |
| `teste_final.py` | consolida 3 fontes (hand-curated + CVM + federal) → lista NOME-% |

## Baselines preservados

`data/baselines/` guarda snapshots para comparação antes/depois:

- `validation_v1_pre_opt.txt` — antes das otimizações
- `validation_v2_pos_opt.txt` — após filtros + calibração de incerteza
- `validation_v3_pia_dual.txt` — após alavanca PIA (folha vs PIA lado a lado)

## O caminho para validação real

A única alavanca que transforma a validação é **acumular ground truth de
empresa in-scope**. Hoje: contratos federais (alavanca 2). Futuro
possível: DRE de SA Fechada emissora de debênture, fato relevante de
aquisição por PE/VC. Tudo documentado em `scripts/active_validation/README.md`.
