# Dossiê de contexto jurídico · Genesis Radar

> Documento de **insumo** para redigir Termos de Uso e Política de Privacidade.
> Compila TUDO que é juridicamente relevante no produto, na forma exigida para
> que advogado (ou IA com instrução de drafting) escreva documentos LGPD
> completos e defensáveis. Não é o documento final — é o briefing.
>
> Última atualização: 2026-05-14 · pós-audit pass LGPD.

---

## 1. Identidade do produto

| Campo | Valor |
|---|---|
| Nome comercial | Genesis Radar |
| Natureza | Plataforma B2B de inteligência M&A para médio porte |
| Mercado-alvo | Empresas de M&A boutique, search funds, family offices, investidores PE no Brasil |
| Geografia operacional | RJ + SP (universo coberto), uso pode ser nacional |
| Tipo de usuário | Profissional M&A (não consumidor final · CDC pode incidir como interpretativo, não como regente) |
| Stack | FastAPI (Python) + React/Vite (TypeScript) + parquets locais |
| Modelo de distribuição | A definir (SaaS hospedado · self-hosted on-prem · híbrido) |

## 2. Controlador e Encarregado (PLACEHOLDERS — preencher)

| Campo | Valor atual no código |
|---|---|
| Razão social do controlador | `[NOME DA EMPRESA — preencher]` (`frontend/src/legal/dpo.ts:CONTROLADOR.razao_social`) |
| CNPJ | `[CNPJ — preencher]` |
| Endereço | `[Endereço — preencher]` |
| Website | `[https://dealflowbr.com.br — preencher]` |
| Encarregado (DPO) | `[Nome do Encarregado — preencher]` |
| Email DPO | `[dpo@dealflowbr.com.br — preencher]` |
| Foro de eleição | A definir |

## 3. Bases normativas aplicáveis

| Lei | Por que importa |
|---|---|
| **LGPD (Lei 13.709/2018)** | Central — produto trata dados pessoais de sócios (PF) e contatos |
| **CTN art. 198** | Sigilo fiscal — citado pelo produto como justificativa para a existência da metodologia (empresas privadas não declaram faturamento) |
| **Lei 9.610/1998 (Direitos Autorais)** | Código, metodologia técnica, dados curados, derivações estatísticas |
| **Lei 9.609/1998 (Programa de Computador)** | Software Genesis Radar (API + frontend) |
| **CDC art. 37 (Publicidade)** | Claims sobre acurácia e metodologia precisam ser sustentáveis |
| **Marco Civil (Lei 12.965/2014)** | Guarda de logs (art. 15 — 6 meses), responsabilidade civil intermediária |
| **Resolução ANPD 2/2022** | Tratamento por pequeno porte (se aplicável) |
| **Lei 14.034/2020** | Limita telemarketing — o produto NÃO faz contato, mas seus usuários sim |

## 4. Inventário completo de dados pessoais

### 4.1 Sócios pessoa física (PF) e estrangeiros

| Campo | Origem | Forma armazenada | Onde aparece |
|---|---|---|---|
| `nome` raw | RFB Quadro Societário (via Base dos Dados BQ) | **Descartado** no script de export (`scripts/export_socios_index.py:99-115`) — nunca chega ao parquet local | — |
| `documento` raw (CPF mascarado da RFB) | Mesma | **Descartado** — nunca chega ao parquet local | — |
| `iniciais` (ex: "J. M. S.") | Derivado de `nome` (3 letras iniciais) | `data/socios_index.parquet` | `SociosPanel`, `GroupModal`, PDF export |
| `socio_key` | `HMAC-SHA256(DEALFLOW_SOCIOS_SALT, nome_norm + "\|" + documento)[:16]` | `data/socios_index.parquet` | URL path: `/api/v1/socios/{socio_key}/empresas` |
| `qualificacao` | RFB | parquet | painel sócios + PDF |
| `tipo` (PF/PJ/EXT) | RFB | parquet | painel sócios + PDF |

**Classificação LGPD:** dado pessoal pseudonimizado (LGPD art. 5º XI). Combinação `iniciais` + `qualificacao` + lista de empresas pode reidentificar — risco residual mitigado por HMAC com salt secreto.

### 4.2 Contato oficial das empresas (RFB cadastro)

| Campo | Origem | Onde aparece |
|---|---|---|
| `telefone_1`, `telefone_2`, `ddd_1`, `ddd_2` | RFB estabelecimentos | `ContatoPanel` (link `tel:`), PDF export, PDF rodapé com caveat |
| `email` | RFB | `ContatoPanel` (link `mailto:`), PDF export |
| `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `municipio`, `uf` | RFB | `ContatoPanel` (link Google Maps), `DetailModal`, PDF, CSV |

**Classificação LGPD:** dado pessoal **quando**: registro é MEI, Ltda. unipessoal, ou quando telefone/email pertence a contador/sócio. O produto **reconhece textualmente** essa possibilidade (`ContatoPanel.tsx:149-153`).

**Tratamento de terceiro:** o contato pode pertencer a alguém estranho à empresa (contador). Política de Privacidade precisa endereçar.

### 4.3 Razão social

- Pessoa jurídica em geral (não-PII), mas **vira PII** quando contém nome do empresário ("João da Silva Comércio Ltda.") — comum em MEIs e Ltdas pequenas.
- Aparece em: tabela de resultados, DetailModal, watchlist, PDF, CSV, AI Search (busca texto), nome do arquivo PDF exportado.

### 4.4 CNPJ

- Cadastro Nacional da PJ é público (RFB).
- **Vira identificador indireto de PF** em MEI e Ltda. unipessoal.
- Aparece em todo lugar do produto.

### 4.5 Watchlist do usuário (gerada pelo operador, não pelo controlador)

| Campo | Conteúdo | Armazenamento |
|---|---|---|
| `notas` (textarea livre 500 chars) | Usuário pode inserir nome de interlocutor, telefone alternativo, etc. — placeholder sugere "nome do interlocutor" | **localStorage** `dealflow:watchlist:v1` — server NUNCA recebe |
| `contatos[]` (`ContatoLog`: `data`, `canal`, `nota`) | Histórico de quando contatou cada empresa, por qual canal, com nota livre | localStorage |
| `status` (lead → contatado → nda → dd → walk_away) | Estado do funil M&A da empresa | localStorage |
| `added_at`, `updated_at` | Auditoria | localStorage |

**Classificação LGPD:** dado pessoal gerado pelo usuário no navegador dele. O controlador da plataforma não recebe nem armazena. Existe aviso UI (`StatusModal.tsx`) sobre não inserir dados sensíveis.

**Direitos implementados:** botões "Exportar JSON" (art. 18 V) e "Apagar tudo" (art. 18 VI) no `WatchlistView`.

### 4.6 AI Search (prompt do usuário)

- Texto livre até 1000 chars digitado pelo usuário.
- **Enviado para Anthropic (EUA)** via SDK Python no backend.
- **NÃO** é injetado contexto adicional — apenas o prompt cru + system prompt estático (regras de tradução).
- Cache LRU in-process de 128 entradas no backend (não persistente).
- Aviso UI explícito de transferência internacional + recomendação de não incluir dados sensíveis.

## 5. Origem dos dados (proveniência completa)

| Dataset | Origem upstream | Caminho local | Volume |
|---|---|---|---|
| `estimates_final.parquet` | BQ `the-dumbers.dealflow.estimates_final` (pipeline interno § metodologia v3.1) | `data/estimates_final.parquet` | 5.4 MB — vai pro Git (não-PII direto) |
| `contato.parquet` | BQ `basedosdados.br_me_cnpj.estabelecimentos` (Receita Federal) — snapshot 2024-12-18 | `data/contato.parquet` | 3.1 MB — **NÃO vai pro Git** (.gitignore) |
| `socios_index.parquet` | BQ `basedosdados.br_me_cnpj.socios` — mesmo snapshot | `data/socios_index.parquet` | 3.1 MB — **NÃO vai pro Git** |
| `headcount_history.parquet` | BQ `basedosdados.br_me_rais.microdados_vinculos` | `data/headcount_history.parquet` | 1.0 MB — **NÃO vai pro Git** |
| `data/reference/razao_folha_receita_*.csv` | IBGE SIDRA API (PIA/PAC/PAS) | `data/reference/` | KB — vai pro Git (output curado) |

**Snapshot:** RFB pinado em `DATE '2024-12-18'`; RAIS `ano = 2024`.

**Reciclagem:** parquets regenerados manualmente quando RFB/RAIS atualizam (≈ anual). Não há ingestão contínua.

## 6. Finalidade declarada

### Para a Política de Privacidade

> Tratamento de dados públicos empresariais com finalidade exclusiva de
> triagem inicial de oportunidades M&A B2B. Os resultados destinam-se a
> profissionais de M&A (corretores, advisors, family offices, fundos)
> e não constituem decisão automatizada com efeitos no titular (LGPD
> art. 20 § ressalvas).

### Vedações expressas (precisam estar nos Termos)

- ❌ Prospecção comercial dirigida a pessoa física (telemarketing)
- ❌ Scoring de crédito ou avaliação de risco financeiro
- ❌ Decisões automatizadas que afetem direitos do titular (art. 20)
- ❌ Redistribuição da base ou de subconjuntos
- ❌ Uso para fins discriminatórios (origem, raça, religião — art. 11)
- ❌ Engenharia reversa do modelo ou da metodologia
- ❌ Integração em produto concorrente

## 7. Base legal (LGPD art. 7º)

### Recomendada para dados de sócios PF (oriundos de fonte pública)

**Legítimo interesse — art. 7º IX**, combinado com art. 7º §3º (dado público
mantém a finalidade da publicização original).

**Exige LIA (Legitimate Interest Assessment) documentada:**
1. Finalidade declarada e legítima (inteligência M&A B2B)
2. Necessidade do tratamento (não há base mais branda exequível)
3. Balanceamento entre interesse do controlador e direitos do titular
4. Salvaguardas implementadas:
   - Pseudonimização HMAC com salt em vault
   - Nome raw nunca persistido localmente
   - Rate-limit + auth para impedir scraping
   - Audit log estruturado
   - Endpoint de grupo econômico (`/socios/{key}/empresas`) restrito por auth
   - Política de não-redistribuição
   - Aviso explícito ao usuário sobre uso permitido

A LIA fica como documento interno (não publica), mas precisa existir caso a
ANPD fiscalize (art. 10 § c/c art. 18).

### Para contato oficial (PJ + possivelmente PF de contador)

Mesma base legal, com salvaguarda adicional: aviso explícito ao usuário
(`ContatoPanel`) que o contato pode ser de terceiro estranho à empresa.

### Para watchlist do usuário (localStorage)

Não há tratamento pelo controlador — dado nasce e morre no navegador do
usuário. Mencionar na Política como cookies/storage local de cliente.

### Para AI Search

Execução de contrato (art. 7º V) com o usuário titular do prompt + base
legal específica para transferência internacional (art. 33).

## 8. Compartilhamento de dados

### Sub-processadores

| Parceiro | O que recebe | Onde | DPA assinado? |
|---|---|---|---|
| **Anthropic** | Prompt do usuário do AI Search (texto livre até 1000 chars) | EUA | **Pendente — assinar em console.anthropic.com** |
| Hospedagem (a definir: AWS/GCP/Vercel/etc.) | Tudo que passa pelo backend | A definir | Pendente |
| Google Fonts | ❌ Removido (self-hosted via @fontsource) | — | N/A |

### Não compartilhamos com

- Bureaus de crédito · Serasa · Boa Vista
- Plataformas de marketing
- Redes sociais
- Brokers de dados
- Anunciantes

## 9. Transferência internacional (LGPD art. 33)

**Única transferência ativa:** Anthropic (EUA), apenas para o AI Search,
apenas o prompt cru do usuário.

**Base legal aplicável (art. 33):**
- Inciso II — cláusulas contratuais específicas (DPA Anthropic)
- Combinado com inciso VIII — execução de contrato com o usuário

**Garantias:**
- Aviso explícito ao usuário antes do envio (`AISearchOverlay` LGPD notice)
- Recomendação textual de não incluir dados sensíveis
- Cache local LRU para reduzir round-trips
- Sem injeção de dados de empresas no contexto enviado

## 10. Retenção e eliminação

| Dado | Prazo de retenção |
|---|---|
| Parquets derivados (estimates, contato, socios_index, headcount) | Até próximo refresh do snapshot RFB (anual). Snapshot anterior arquivado por 1 ano para reprodutibilidade, depois descartado. |
| Cache LRU backend (in-memory) | Vida do processo (segundos a horas) |
| Audit log JSONL | A definir (recomendado 6 meses · Marco Civil art. 15) |
| Watchlist localStorage | Vida do navegador do usuário; usuário pode apagar a qualquer momento via botão UI |
| Prompts AI Search | Não retidos pelo controlador. Anthropic retém por 30 dias por padrão (verificar DPA para ZDR — Zero Data Retention). |

## 11. Segurança implementada (LGPD art. 46)

| Camada | Implementação |
|---|---|
| Pseudonimização | HMAC-SHA256 com salt secreto (`DEALFLOW_SOCIOS_SALT` em vault) |
| Autenticação | `X-Api-Key` header validado contra `DEALFLOW_API_KEY` env |
| Rate-limit | 60 req/min por IP (configurável `DEALFLOW_RATE_LIMIT_PER_MIN`) |
| Audit log | JSONL estruturado: ts, ip, method, path, status, ms, ua, key_present |
| CORS | Whitelist por env `DEALFLOW_CORS_ORIGINS` |
| Transporte | HTTPS (a configurar no deploy) |
| Storage de PII | Privado autenticado (após remediação Git pendente) |
| Princípio do menor privilégio | Nome raw e CPF raw nunca chegam ao parquet local |

## 12. Direitos do titular implementados (LGPD art. 18)

| Direito | Canal |
|---|---|
| I · Confirmação de tratamento | Email DPO |
| II · Acesso aos dados | Email DPO |
| III · Correção | Email DPO |
| IV · Anonimização/bloqueio/eliminação | Email DPO + botão UI "Apagar tudo" (watchlist) |
| V · Portabilidade | Botão UI "Exportar JSON" (watchlist) + email DPO (dados do servidor) |
| VI · Eliminação | Botão UI + email DPO |
| VII · Informação sobre uso compartilhado | Esta política · seção 8 |
| VIII · Revogação de consentimento | Não aplicável (base legal não é consentimento) |
| IX · Oposição | Email DPO |
| Prazo | 15 dias (art. 19) |

## 13. Incidentes de segurança (LGPD art. 48)

**Pendente:** procedimento formal de detecção, contenção, notificação à
ANPD e ao titular afetado em prazo razoável (ANPD recomenda 72h).

**Incidente histórico potencial:** parquets de PII (`contato.parquet`,
`socios_index.parquet`, `headcount_history.parquet`) ficaram commitados em
versões anteriores do repositório público
`https://github.com/AatroxdeNiteroi/dealflow-br`. Mitigação em andamento
(reescrita de histórico Git). Avaliar com jurídico se a exposição configura
incidente reportável.

## 14. Claims que o produto faz ao usuário (relevantes para CDC/contratos)

### Sustentados por documentação

| Claim | Onde aparece | Sustentação |
|---|---|---|
| "Metodologia auditável" | `MetodologiaModal`, README, footer PDF | `docs/architecture.md` v3.1 (canônica) |
| "Reconstrução a partir de fontes públicas" | Idem | Pipeline em `scripts/sql/` — Receita, RAIS, IBGE |
| "Validado contra DRE de S.A. abertas" | MetodologiaModal (após reescrita) | §9 metodologia: HAGA 0%, VIDROPORTO ±0%, ROMI −18%, BAUMER +35% |
| Bounds de erro por archetype | `Terms/terms.tsx` por archetype, com `warning` quando aplicável | Calibração interna documentada |
| "Não substitui due diligence formal" | PDF rodapé | Disclaimer presente |
| "Sigilo fiscal art. 198 CTN" | README + MetodologiaModal | Lei vigente |

### Removidos (eram publicidade enganosa em potencial)

- ~~"Mesmos métodos analíticos utilizados pela elite do mercado financeiro"~~
- ~~"Modelo proprietário validado contra demonstrações financeiras auditadas"~~ (era impreciso — agora "DRE de S.A. abertas comparáveis · v3.1")
- ~~"Padrão metodológico de equity research e fundos quantitativos"~~

## 15. Cookies, storage e telemetria

| Item | Status |
|---|---|
| Cookies | **Nenhum.** Grep zero matches em todo o frontend. |
| localStorage | Apenas `dealflow:watchlist:v1` — watchlist do usuário, controlador não acessa |
| sessionStorage | Nenhum |
| Analytics (GA, Mixpanel, PostHog, etc.) | **Nenhum.** Confirmado por audit. |
| Sentry / error tracking | Nenhum |
| CDN de terceiros (que vaza IP) | **Removido.** Google Fonts era a única, agora self-hosted via @fontsource |

## 16. Backlog jurídico — gaps que o doc legal deve cobrir

1. **LIA (Legitimate Interest Assessment)** — documento interno, escrito uma vez, revisitado por mudança material
2. **Política de retenção formal** com tabela por categoria
3. **Política de senhas / credenciais** (API keys, secrets em vault)
4. **Política de uso aceitável** (AUP) — operationaliza as vedações da §6
5. **Procedimento de notificação de incidentes** (art. 48)
6. **Modelo de resposta a requisição de titular** (art. 18-19)
7. **Modelo de DPA com sub-processadores** (hospedagem futura)
8. **Cláusula contratual com usuários** sobre uso responsável dos dados extraídos do produto
9. **Cláusula de propriedade intelectual** sobre os outputs gerados (PDFs, CSVs)
10. **Política de revisão e versionamento** dos próprios Termos/Privacidade
11. **Foro de eleição** e legislação aplicável (Brasil · LGPD/CDC)
12. **Limitação de responsabilidade** por decisões tomadas com base nas estimativas (já há disclaimer técnico, falta cláusula contratual)

## 17. Diferenças face a outros produtos similares (justificam a defensibilidade)

| Genesis Radar faz | Concorrentes (bureaus) fazem |
|---|---|
| Estimativa estatística sobre fontes públicas, com bounds de erro declarados | Faixas opacas sem proveniência |
| Pseudonimiza sócios antes do uso comercial | Frequentemente expõem CPF parcial |
| Aviso textual quando contato pode ser de terceiro | Não há |
| Sem dossiê comportamental, sem scoring | Construção de perfil + score crédito |
| Não compartilha com bureaus, marketing, redes sociais | Compartilham (modelo de receita) |
| Não decide automatizadamente nada | Algumas decisões automatizadas |

Esse posicionamento sustenta o argumento de **legítimo interesse balanceado**
no LIA: o tratamento é proporcional, mínimo necessário, com salvaguardas
acima do mercado.

## 18. Arquivos do código fonte que materializam estas afirmações

| Tema | Arquivo |
|---|---|
| Identidade do controlador / DPO | `frontend/src/legal/dpo.ts` |
| Termos de Uso (stub) | `frontend/src/legal/TermosContent.tsx` |
| Política de Privacidade (stub) | `frontend/src/legal/PrivacidadeContent.tsx` |
| Modais legais | `frontend/src/components/Modal/{Termos,Privacidade}Modal.tsx` |
| Provider de contexto legal | `frontend/src/legal/LegalProvider.tsx` |
| Footer global | `frontend/src/components/Footer/Footer.tsx` |
| Avisos LGPD UI | `AISearchOverlay.tsx`, `ContatoPanel.tsx`, `StatusModal.tsx`, `WatchlistView.tsx` |
| Pseudonimização HMAC | `scripts/export_socios_index.py` |
| Auth + rate-limit + audit | `backend/src/dealflow_api/security.py` |
| Settings + env vars | `backend/src/dealflow_api/settings.py`, `backend/.env.example` |
| Metodologia técnica canônica | `docs/architecture.md` v3.1 |
| Runbook de remediação | `docs/lgpd-remediation.md` |
| Licença | `LICENSE` |

## 19. Instruções para quem for redigir os documentos

1. Trate este dossiê como **único insumo confiável** sobre o produto. Não
   especule sobre features não listadas aqui.
2. **Nunca prometa** funcionalidades que não estão implementadas (ex: não
   prometa SSO, 2FA, log de acesso por usuário individual — não existem).
3. **Preserve as vedações da §6** — são salvaguardas que sustentam o LIA.
4. **Cite os arquivos da §18** quando o documento legal precisar apontar
   para mecanismo técnico ("conforme implementado em X").
5. **Versione** os documentos: atualizar `LEGAL_VERSAO` em `frontend/src/legal/dpo.ts`
   a cada revisão e comunicar mudanças materiais aos usuários.
6. **Tom**: B2B, técnico, sem patrulha; o usuário é profissional M&A, não
   consumidor leigo. Pode usar termos jurídicos diretamente.
