# Cheat Sheet do Encarregado · checklists operacionais

> Documento de bolso para o DPO. Imprimir, manter à mão. Cobre rotina
> mensal, trimestral e anual + sinais de alarme + decisões frequentes.

| Campo | Valor |
|---|---|
| Versão | 1.0 |
| Data | 14 de maio de 2026 |
| Próxima revisão | Anual |

---

## Rotina mensal

- [ ] Conferir audit log: anomalias? IPs estranhos? Picos de uso? Tentativas de brute-force?
- [ ] Conferir caixa do email do DPO: alguma requisição não respondida?
- [ ] Conferir status do RAT: alguma nova atividade de tratamento iniciada que não foi registrada?
- [ ] Verificar sub-processadores: Anthropic mudou sub-processadores nos últimos 30 dias? (consulta no portal de confiança)
- [ ] Backup do registro de aceitações dos titulares: planilha de controle de protocolos em segurança

## Rotina trimestral

- [ ] Tabletop de incidente: convocar equipe, sortear cenário, executar runbook completo (sem comunicação real à ANPD), documentar resultado.
- [ ] Revisão do RAT: cada atividade ainda reflete o estado real do produto?
- [ ] Verificação de retenção: parquets antigos foram efetivamente descartados? Audit logs antigos rotacionados?
- [ ] Revisar este Cheat Sheet: precisa atualizar?

## Rotina anual

- [ ] Revisar LIA: a base legal de legítimo interesse ainda se sustenta? Há mudança regulatória? Há nova categoria de dados?
- [ ] Treinamento de todos os operadores (engenharia + comercial): novidades LGPD do último ano, casos relevantes da ANPD.
- [ ] Auditoria externa (recomendado): contratar advogado especialista para revisar conformidade.
- [ ] Atualizar Termos de Uso e Política de Privacidade se houver mudança material.
- [ ] Reassinar/atualizar DPA com sub-processadores se houver versão nova.

## Após qualquer mudança material no produto

- [ ] Atualizar RAT (`docs/registro-atividades-tratamento.md`)
- [ ] Revisar LIA (`docs/lia-legitimo-interesse.md`)
- [ ] Revisar Política de Privacidade (`frontend/src/legal/PrivacidadeContent.tsx`)
- [ ] Se mudança for material para o titular: bumpar `LEGAL_VERSAO` (força re-aceitação dos Usuários)
- [ ] Atualizar Resumo Executivo correspondente

---

## Sinais de alarme · acionar runbook imediato

| Sinal | Severidade | Ação |
|---|---|---|
| Repositório público GitHub com dado novo de PII | 🔴 Crítica | Runbook · contenção em < 1h |
| Endpoint vazando dados de empresa errada | 🔴 Crítica | Despublicar versão · runbook |
| Vazamento da chave de API ou do salt HMAC | 🔴 Crítica | Rotacionar · runbook |
| Acesso ao endpoint /socios sem auth | 🟠 Alta | Investigar · auditar |
| Spike de requisições de IP único | 🟡 Média | Conferir rate-limit · investigar |
| Anthropic reporta incidente | 🟠 Alta | Avaliar exposição · runbook se aplicável |
| Titular alega tratamento indevido | 🟡 Média | Modelo 1 + análise |
| Fiscalização ANPD | 🔴 Crítica | Acionar advogado externo IMEDIATAMENTE |

---

## Quando posso publicar / mudar / lançar algo novo?

Antes de qualquer lançamento de feature que envolva dado pessoal,
responda:

1. [ ] Está coberto pela LIA atual?
2. [ ] Está coberto pela Política de Privacidade vigente?
3. [ ] Está coberto pelos Termos de Uso vigentes?
4. [ ] Foi adicionado ao RAT?
5. [ ] Há novo sub-processador? Tem DPA?
6. [ ] Há transferência internacional nova? Tem cláusulas padrão?
7. [ ] Há mudança nos prazos de retenção?
8. [ ] Há mudança no canal de exercício de direitos?

Se algum "Não" ou "Não sei" → **bloquear lançamento** até resolver.

---

## Quando devo notificar a ANPD?

Resposta curta: **quando o incidente puder acarretar risco ou dano
relevante** (LGPD art. 48).

| Caso | Notificar? |
|---|---|
| Dados sensíveis vazaram | SIM |
| Volume grande de titulares (centenas+) | SIM |
| Possibilidade de fraude financeira | SIM |
| Dados de crianças/adolescentes | SIM |
| Apenas metadados de poucos titulares, sem risco financeiro | Pode não notificar; documentar decisão |
| Tentativa que NÃO obteve sucesso | Provavelmente não; manter no audit |
| Em dúvida | Notificar (melhor errar por excesso de transparência) |

Prazo recomendado pela ANPD: **até 3 dias úteis**. Comunicação preliminar
é aceitável; complementar em até 20 dias.

---

## Quem deve aparecer publicamente como controlador e Encarregado?

| Função | Quem |
|---|---|
| Controlador | Pessoa jurídica (CNPJ) que opera o Genesis Radar |
| Encarregado (DPO) | Pessoa física, com nome e email publicáveis |

**O DPO pode ser:**
- Funcionário da pessoa jurídica controladora.
- Contratado externo (DPO as a Service).
- Sócio ou diretor (não recomendado por conflito de interesse, mas possível).

**O DPO precisa:**
- Conhecimento técnico-jurídico em LGPD.
- Autonomia para reportar diretamente à alta direção.
- Tempo dedicado proporcional ao volume de tratamento.

---

## Documentos relacionados

| Documento | Quando consultar |
|---|---|
| [`lia-legitimo-interesse.md`](./lia-legitimo-interesse.md) | Avaliar nova feature; responder à ANPD |
| [`registro-atividades-tratamento.md`](./registro-atividades-tratamento.md) | Mudança no produto; fiscalização |
| [`runbook-incidentes.md`](./runbook-incidentes.md) | Incidente confirmado ou suspeito |
| [`modelo-resposta-titular.md`](./modelo-resposta-titular.md) | Requisição de titular recebida |
| [`lgpd-context-dossier.md`](./lgpd-context-dossier.md) | Onboarding de advogado externo ou novo DPO |
| [`lgpd-remediation.md`](./lgpd-remediation.md) | Itens pendentes de implementação |
| `frontend/src/legal/PrivacidadeContent.tsx` | Política publicada |
| `frontend/src/legal/TermosContent.tsx` | Termos publicados |
| `frontend/src/legal/dpo.ts` | Atualizar dados do controlador e do DPO |

---

## Não tente fazer sozinho

Em qualquer das situações abaixo, acionar advogado externo:
- Fiscalização ANPD
- Incidente com mais de 1.000 titulares
- Incidente envolvendo dado sensível
- Ação judicial relacionada ao tratamento
- Reorganização societária do controlador
- Lançamento de feature significativa
