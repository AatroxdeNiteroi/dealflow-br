# BigQuery — schemas das 5 tabelas

Referência canônica dos nomes de coluna usados nas queries do pipeline §4–§5. Preencher colando a saída das queries `INFORMATION_SCHEMA.COLUMNS` rodadas no BigQuery Studio.

## Contexto deste arquivo (para o Claude ler)

O usuário está executando o tutorial de exploração do BigQuery passo a passo. Os **passos 1 e 2 já foram concluídos com sucesso** — o smoke test rodou e a query de listagem de tabelas (`INFORMATION_SCHEMA.TABLES`) confirmou que os datasets `basedosdados.br_me_cnpj` e `basedosdados.br_me_rais` existem e contêm as tabelas esperadas (`estabelecimentos`, `empresas`, `simples`, `microdados_estabelecimentos`, `microdados_vinculos` — entre outras).

A partir do **passo 3** o usuário começa a colar resultados aqui. Cada seção numerada abaixo recebe a saída de UMA query `INFORMATION_SCHEMA.COLUMNS` rodada para a tabela correspondente. Quando o usuário envia mensagens sobre "resultados", refere-se ao conteúdo a partir desta seção.

## Como o usuário preenche

Para cada tabela abaixo, ele roda no BigQuery Studio:
```sql
SELECT column_name, data_type
FROM `<dataset>.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = '<tabela>'
ORDER BY ordinal_position;
```
E cola a saída (ou só as colunas mais relevantes) na seção correspondente.

---

## 1. `basedosdados.br_me_cnpj.estabelecimentos`

**Papel.** §4.1 lado Receita — universo + chave de match. Carrega CEP, CNAE 7d, natureza jurídica, tipo (matriz/filial), município, situação cadastral.

column_name	data_type
ano	INT64
mes	INT64
data	DATE
cnpj	STRING
cnpj_basico	STRING
cnpj_ordem	STRING
cnpj_dv	STRING
identificador_matriz_filial	STRING
nome_fantasia	STRING
situacao_cadastral	STRING
data_situacao_cadastral	DATE
motivo_situacao_cadastral	STRING
nome_cidade_exterior	STRING
id_pais	STRING
data_inicio_atividade	DATE
cnae_fiscal_principal	STRING
cnae_fiscal_secundaria	STRING
sigla_uf	STRING
id_municipio	STRING
id_municipio_rf	STRING
tipo_logradouro	STRING
logradouro	STRING
numero	STRING
complemento	STRING
bairro	STRING
cep	STRING
ddd_1	STRING
telefone_1	STRING
ddd_2	STRING
telefone_2	STRING
ddd_fax	STRING
fax	STRING
email	STRING
situacao_especial	STRING
data_situacao_especial	DATE

---

## 2. `basedosdados.br_me_cnpj.empresas`

**Papel.** Porte declarado, razão social, natureza jurídica, capital social. Join via `cnpj_basico`.

column_name	data_type
ano	INT64
mes	INT64
data	DATE
cnpj_basico	STRING
razao_social	STRING
natureza_juridica	STRING
qualificacao_responsavel	STRING
capital_social	FLOAT64
porte	STRING
ente_federativo	STRING

---

## 3. `basedosdados.br_me_cnpj.simples`

**Papel.** Opção/exclusão Simples — primeiro passo do roteamento §3.1.

column_name	data_type
cnpj_basico	STRING
opcao_simples	INT64
data_opcao_simples	DATE
data_exclusao_simples	DATE
opcao_mei	INT64
data_opcao_mei	DATE
data_exclusao_mei	DATE

---

## 4. `basedosdados.br_me_rais.microdados_estabelecimentos`

**Papel.** §4.1 lado RAIS — chave composta + `quantidade_vinculos_ativos` (headcount).

column_name	data_type
ano	INT64
sigla_uf	STRING
id_municipio	STRING
quantidade_vinculos_ativos	INT64
quantidade_vinculos_clt	INT64
quantidade_vinculos_estatutarios	INT64
natureza_estabelecimento	STRING
natureza_juridica	STRING
tamanho_estabelecimento	STRING
tipo_estabelecimento	STRING
indicador_cei_vinculado	INT64
indicador_pat	INT64
indicador_simples	STRING
indicador_rais_negativa	INT64
indicador_atividade_ano	INT64
cnae_1	STRING
cnae_2	STRING
cnae_2_subclasse	STRING
subsetor_ibge	STRING
subatividade_ibge	STRING
cep	STRING
bairros_sp	STRING
distritos_sp	STRING
bairros_fortaleza	STRING
bairros_rj	STRING
regioes_administrativas_df	STRING

---

## 5. `basedosdados.br_me_rais.microdados_vinculos`

**Papel.** §5 — benchmark salarial CNAE × município (query agregada §5.2).

column_name	data_type
ano	INT64
sigla_uf	STRING
id_municipio	STRING
tipo_vinculo	STRING
vinculo_ativo_3112	STRING
tipo_admissao	STRING
mes_admissao	INT64
mes_desligamento	INT64
motivo_desligamento	STRING
causa_desligamento_1	STRING
causa_desligamento_2	STRING
causa_desligamento_3	STRING
faixa_tempo_emprego	STRING
faixa_horas_contratadas	STRING
tempo_emprego	FLOAT64
quantidade_horas_contratadas	INT64
id_municipio_trabalho	STRING
quantidade_dias_afastamento	INT64
indicador_cei_vinculado	STRING
indicador_trabalho_parcial	STRING
indicador_trabalho_intermitente	STRING
indicador_vinculo_abandonado	STRING
faixa_remuneracao_media_sm	STRING
valor_remuneracao_media_sm	FLOAT64
valor_remuneracao_media	FLOAT64
faixa_remuneracao_dezembro_sm	STRING
valor_remuneracao_dezembro_sm	FLOAT64
valor_remuneracao_janeiro	FLOAT64
valor_remuneracao_fevereiro	FLOAT64
valor_remuneracao_marco	FLOAT64
valor_remuneracao_abril	FLOAT64
valor_remuneracao_maio	FLOAT64
valor_remuneracao_junho	FLOAT64
valor_remuneracao_julho	FLOAT64
valor_remuneracao_agosto	FLOAT64
valor_remuneracao_setembro	FLOAT64
valor_remuneracao_outubro	FLOAT64
valor_remuneracao_novembro	FLOAT64
valor_remuneracao_dezembro	FLOAT64
tipo_salario	STRING
valor_salario_contratual	FLOAT64
subatividade_ibge	STRING
subsetor_ibge	STRING
cbo_1994	STRING
cbo_2002	STRING
cnae_1	STRING
cnae_2	STRING
cnae_2_subclasse	STRING
faixa_etaria	STRING
idade	INT64
grau_instrucao_1985_2005	STRING
grau_instrucao_apos_2005	STRING
nacionalidade	STRING
sexo	STRING
raca_cor	STRING
indicador_portador_deficiencia	STRING
tipo_deficiencia	STRING
ano_chegada_brasil	INT64
tamanho_estabelecimento	STRING
tipo_estabelecimento	STRING
natureza_juridica	STRING
indicador_simples	STRING
bairros_sp	STRING
distritos_sp	STRING
bairros_fortaleza	STRING
bairros_rj	STRING
regioes_administrativas_df	STRING
---

## Divergências encontradas vs. arquitetura (corrigidas em 2026-05-11)

Estas divergências foram detectadas comparando os schemas reais (queries acima) com o que `docs/architecture.md` v3.1 assumia. O `architecture.md` foi atualizado; esta seção mantém o registro do que mudou.

### Críticas (quebrariam a query)

| Arquitetura original | Realidade no BigQuery | Tabela |
|---|---|---|
| `uf` STRING | `sigla_uf` STRING | estabelecimentos |
| `municipio` (código IBGE) | `id_municipio` STRING | estabelecimentos |
| `situacao_cadastral = '02'` | `'2'`=Ativa (confirmado 2022-05-12) | estabelecimentos |
| `porte ∈ {'01','03','05','00'}` (arch original errada) | `'1'`=ME, `'3'`=EPP, `'5'`=Demais, `'0'`/NULL=Não informado (confirmado) | empresas |
| `identificador_matriz_filial = '1'` | `'1'`=matriz, `'2'`=filial (confirmado) | estabelecimentos |
| `opcao_simples` STRING `'S'/'N'` | **INT64** (1 = optante, 2 = não optante) | simples |
| `opcao_mei` STRING `'S'/'N'` | **INT64** | simples |
| `indicador_atividade_ano` STRING `'S'/'N'` | **INT64** (1 / 0) | microdados_estabelecimentos |
| `indicador_rais_negativa` STRING `'S'/'N'` | **INT64** (1 / 0) | microdados_estabelecimentos |
| `indicador_cei_vinculado`, `indicador_pat` STRING | **INT64** | microdados_estabelecimentos |
| `vinculo_ativo_31_12` | `vinculo_ativo_3112` (sem underscore central) | microdados_vinculos |

**Regra geral.** Códigos numéricos STRING no Base dos Dados perdem o zero à esquerda. Antes de qualquer filtro novo em coluna STRING numérica, rodar `SELECT col, COUNT(*) FROM ... GROUP BY 1` para ver valores reais.

### Datas reais de partição

- Base dos Dados parou de atualizar `estabelecimentos` em **2022-05-12** (snapshot único acessível).
- Filtrar sempre por `WHERE data = DATE '2022-05-12'` — outras datas estão vazias.
- Para produto futuro: precisamos de fonte mais fresca (Receita direto em `dadosabertos.rfb.gov.br/CNPJ/`).

**Pegadinha de sintaxe.** `indicador_simples` na RAIS Estabelecimentos é STRING `'S'/'N'` — único indicador que se manteve string. Não generalizar.

### Achados estruturais (afetam lógica do pipeline)

1. **`estabelecimentos` e `empresas` são versionadas mensalmente** — têm colunas `ano`, `mes`, `data`. Sem filtrar pelo snapshot mais recente, o JOIN duplica linhas. Sempre filtrar:
   ```sql
   WHERE (ano, mes) = (
       SELECT ano, mes FROM ... ORDER BY ano DESC, mes DESC LIMIT 1
   )
   ```
2. **`simples` NÃO tem `ano`/`mes`** — é snapshot único. Não precisa filtrar.
3. **`simples` não tem `cnpj` direto** — só `cnpj_basico`. Para checar Simples de um CNPJ específico, JOIN via `cnpj_basico`.
4. **`id_municipio_rf` ≠ `id_municipio`** — Receita tem código próprio (`id_municipio_rf`) e código IBGE (`id_municipio`). **Sempre usar `id_municipio`** (IBGE) — é o que casa com a RAIS.

### Confirmações a favor

- RAIS Estabelecimentos **tem `cep`** ✅ — chave composta §4.2 funciona.
- RAIS Estabelecimentos **tem `bairros_sp` e `bairros_rj`** ✅ — desempate §4.5 nas capitais funciona.
- RAIS Vínculos **não tem `cep`** ✅ — confirma §5.1 (benchmark fica em CNAE × município).
- `valor_remuneracao_media` na Vínculos é **FLOAT64** ✅ — pode usar direto em `AVG`.
- `cnae_2_subclasse` existe nos dois lados da RAIS ✅ — granularidade de 7 dígitos preservada.
