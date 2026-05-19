# Registro de Atividades de Tratamento · RAT

> Documento exigido pelo art. 37 da LGPD. Mantido pelo controlador,
> apresentável à ANPD em fiscalização. Atualizar a cada nova atividade
> de tratamento ou mudança material em existentes.

| Campo | Valor |
|---|---|
| Versão | 1.0 |
| Data | 14 de maio de 2026 |
| Controlador | [preencher quando CNPJ criado] |
| Encarregado | privacidade@dealflowbr.com.br |
| Frequência de revisão | Trimestral |

---

## Atividade 1 · Estimativa de receita a partir de fontes públicas

| Campo | Valor |
|---|---|
| **Finalidade** | Triagem inicial de oportunidades M&A B2B |
| **Base legal** | Legítimo interesse (art. 7º IX) + art. 7º §3º |
| **LIA** | `docs/lia-legitimo-interesse.md` v1.0 |
| **Categorias de dados** | Iniciais de sócios PF, qualificação societária, tipo (PF/PJ/EXT), identificador pseudonimizado, dados de contato CNPJ (telefone, email, endereço) |
| **Categorias de titulares** | Sócios PF de Ltdas brasileiras; eventualmente PF cujo contato consta no registro CNPJ (contadores, ex-sócios) |
| **Origem** | RFB CNPJ + RAIS (Min. Trabalho) + IBGE (PIA/PAC/PAS) via Base dos Dados (espelho público no BigQuery) |
| **Forma de coleta** | Snapshot periódico via SQL sobre datasets públicos |
| **Periodicidade de atualização** | Ciclo aproximadamente anual |
| **Compartilhamento** | Nenhum (apenas Usuários autenticados do produto consomem) |
| **Sub-processadores** | Provedor de hospedagem (a definir) |
| **Transferência internacional** | Não para esta atividade |
| **Prazo de retenção** | Snapshot vigente + 1 snapshot anterior (até 24 meses); descarte automático em substituição |
| **Forma de eliminação** | Sobrescrita da base derivada |
| **Medidas de segurança** | Pseudonimização HMAC + auth + rate-limit + audit log + TLS |
| **Responsável técnico** | Engenharia Genesis Labs |
| **Risco residual** | Reidentificação por agregação — mitigado por k-anonimato no endpoint de grupo |

---

## Atividade 2 · Busca em linguagem natural (AI Search)

| Campo | Valor |
|---|---|
| **Finalidade** | Tradução de prompt em linguagem natural para filtros estruturados |
| **Base legal** | Execução de contrato (art. 7º V) |
| **Categorias de dados** | Texto livre digitado pelo Usuário (até 1.000 caracteres) |
| **Categorias de titulares** | Usuários do produto |
| **Origem** | Coleta direta na interface |
| **Compartilhamento** | Anthropic, PBC (operador internacional) |
| **Sub-processadores** | Anthropic — sub-processadores próprios disponíveis no portal de confiança Anthropic |
| **Transferência internacional** | EUA · base art. 33 II · DPA com SCC (status: a assinar antes do lançamento comercial) |
| **Prazo de retenção** | Anthropic: até 30 dias (padrão API). Controlador: não retém; cache LRU em memória (vida do processo) |
| **Forma de eliminação** | Expiração de cache + retenção máxima da Anthropic |
| **Medidas de segurança** | Limite de 1.000 chars; aviso UI antes do envio; não inclui dados de empresa/sócio/CNPJ no contexto |
| **Risco residual** | Usuário pode inserir dados sensíveis no prompt — mitigado por aviso explícito |

---

## Atividade 3 · Watchlist (notas e histórico de contato)

| Campo | Valor |
|---|---|
| **Finalidade** | Permitir ao Usuário organizar seu pipeline de prospecção M&A |
| **Base legal** | Execução de contrato (art. 7º V) |
| **Categorias de dados** | Lista de CNPJ, status do pipeline, notas livres, registros de canal de contato |
| **Categorias de titulares** | Usuário do produto (autor das notas) |
| **Origem** | Inserção direta pelo Usuário na interface |
| **Compartilhamento** | Nenhum |
| **Sub-processadores** | Nenhum (armazenamento exclusivamente client-side) |
| **Transferência internacional** | Não |
| **Prazo de retenção** | Indefinida — até o Usuário limpar o navegador ou usar "Apagar tudo" |
| **Forma de eliminação** | Botão "Apagar tudo" na tela Watchlist + auto-atendimento via limpeza de localStorage |
| **Local de armazenamento** | localStorage do navegador do Usuário, chave `dealflow:legal-accept:v1` e `dealflow:watchlist:v1` |
| **Medidas de segurança** | Sem cópia no servidor; sem cookies; export JSON disponível para portabilidade (art. 18 V) |
| **Risco residual** | Usuário inserir dados sensíveis na nota livre — mitigado por aviso UI no StatusModal |

---

## Atividade 4 · Audit log de requisições à API

| Campo | Valor |
|---|---|
| **Finalidade** | Cumprimento do art. 37 LGPD (registro das operações de tratamento), prevenção a abuso/fraude/scraping, suporte a investigação de incidente |
| **Base legal** | Cumprimento de obrigação legal (art. 7º II, Marco Civil 12.965/14 art. 15) + legítimo interesse de segurança (art. 7º IX) |
| **Categorias de dados** | Endereço IP, User-Agent, timestamp, método HTTP, path, query string, código de resposta, latência, indicador de presença de chave de API |
| **Categorias de titulares** | Usuários e potenciais atacantes |
| **Origem** | Coletado automaticamente pelo middleware da API |
| **Compartilhamento** | Não — apenas mediante ordem judicial/ANPD |
| **Sub-processadores** | Provedor de hospedagem (logs no host) |
| **Transferência internacional** | Conforme localização do provedor (a definir) |
| **Prazo de retenção** | Mínimo 6 meses (Marco Civil art. 15); máximo operacional 12 meses |
| **Forma de eliminação** | Rotação automática por idade |
| **Medidas de segurança** | Acesso restrito; não loga corpo de requisição/resposta; não loga chaves de API (apenas presence flag) |
| **Risco residual** | IP pode permitir geolocalização aproximada — mitigado por retenção limitada |

---

## Atividade 5 · Aceitação de Termos e Privacidade (consent gate)

| Campo | Valor |
|---|---|
| **Finalidade** | Comprovação documentada de aceitação contratual e ciência da Política de Privacidade pelo Usuário |
| **Base legal** | Execução de contrato (art. 7º V) + comprovação de transparência (art. 9º) |
| **Categorias de dados** | Versão aceita dos documentos, timestamp ISO |
| **Categorias de titulares** | Usuários do produto |
| **Origem** | Coleta direta na interface (gate de primeiro acesso) |
| **Compartilhamento** | Nenhum |
| **Sub-processadores** | Nenhum (client-side) |
| **Prazo de retenção** | Vida útil do navegador; resetada quando há revisão material dos documentos |
| **Local de armazenamento** | localStorage do navegador do Usuário |
| **Medidas de segurança** | Sem cópia no servidor |

---

## Histórico de alterações neste RAT

| Data | Versão | Alteração | Responsável |
|---|---|---|---|
| 2026-05-14 | 1.0 | Versão inicial | [preencher DPO] |
