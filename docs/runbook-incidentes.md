# Runbook de Incidentes de Segurança · LGPD art. 48

> Procedimento operacional. Quem identifica um incidente segue este
> runbook do começo ao fim. Imprimir e manter acessível ao DPO. Atualizar
> após cada exercício de tabletop ou incidente real.

| Campo | Valor |
|---|---|
| Versão | 1.0 |
| Data | 14 de maio de 2026 |
| Próxima revisão | Trimestral ou pós-incidente |
| Canal de comunicação | privacidade@dealflowbr.com.br |

---

## 0. Definição

**Incidente de segurança** = qualquer evento, suspeita ou confirmado, que
acarrete (ou possa acarretar) acesso não autorizado, perda, destruição,
alteração, comunicação ou difusão indevida de dados pessoais tratados
pelo DealFlow BR.

**Exemplos do produto:**
- Vazamento de parquet com dados de contato em ambiente público.
- Comprometimento de chave de API.
- Acesso indevido ao endpoint `/socios/{key}/empresas` via bypass de auth.
- Exposição inadvertida de salt HMAC.
- Bug que retorne dados de uma empresa quando consultada outra.
- Sub-processador (Anthropic, hospedagem) reportar incidente envolvendo
  dados do DealFlow.

## 1. Detecção e triagem (T+0)

| Quem | O quê |
|---|---|
| Engenharia / DevOps | Identifica anomalia (alerta, log suspeito, contato externo) |
| Engenharia / DevOps | Notifica DPO IMEDIATAMENTE por canal direto (não esperar email) |
| DPO | Abre ticket no controle de incidentes com timestamp ISO |
| DPO | Aciona conferência de triagem em < 1h |

**Não diagnosticar publicamente.** Comunicar internamente primeiro.
Documentar tudo.

## 2. Contenção (T + 0 a T + 4h)

| Cenário | Ação imediata |
|---|---|
| Chave de API vazada | Rotacionar `DEALFLOW_API_KEY`; bloquear chave antiga |
| Endpoint vazando dados | Despublicar versão; reverter para anterior; manutenção |
| Parquet vazado em local público | Despublicar imediatamente; capturar logs de acesso |
| Salt HMAC comprometido | Rotacionar salt; regenerar `socios_index.parquet`; invalidar URLs com socio_key |
| Sub-processador comprometido | Suspender uso do sub-processador; chave de API alternativa |
| Acesso indevido confirmado | Rotacionar todas as credenciais; revogar sessões; auditar audit log |

**Preservar evidências.** Não deletar logs ou rastros. Snapshot do estado
para análise posterior.

## 3. Avaliação (T + 4h a T + 24h)

DPO + Engenharia + Jurídico (advogado externo) avaliam em conjunto:

| Pergunta | Determinação |
|---|---|
| Quantos titulares afetados? | Estimativa documentada |
| Quais categorias de dados? | Lista exaustiva |
| Risco ou dano relevante? (art. 48) | Sim / Não / Indeterminado |
| Comunicação à ANPD obrigatória? | Sim se "risco ou dano relevante" |
| Comunicação aos titulares obrigatória? | Sim se "risco ou dano relevante" |
| Janela razoável para notificar | ANPD recomenda até 3 dias úteis |
| Reputacional / regulatório | Avaliação separada com diretoria |

**Critério para "risco ou dano relevante" (recomendação ANPD):**
- Dados sensíveis envolvidos? → SIM (notificar)
- Dados de crianças ou adolescentes? → SIM
- Volume significativo de titulares? → SIM
- Possibilidade de fraude financeira, discriminação ou outros danos? → SIM
- Apenas metadados pouco sensíveis e baixo volume? → Pode não notificar (documentar a decisão)

## 4. Notificação à ANPD (T + 72h, ideal)

Via portal oficial ANPD (gov.br/anpd), com os elementos do art. 48 §1º:

```
1. Descrição da natureza do incidente
2. Descrição dos dados pessoais afetados
3. Informações sobre os titulares envolvidos (categorias, número)
4. Indicação das medidas técnicas/segurança utilizadas (PRÉ-incidente)
5. Riscos relacionados ao incidente
6. Motivos da demora, se a comunicação não tiver sido imediata
7. Medidas que foram ou serão adotadas (PÓS-incidente)
```

Comunicação preliminar é aceitável quando ainda não há todos os dados;
complementar em até 20 dias.

## 5. Notificação aos titulares afetados (T + 72h, ideal)

Quando o canal direto existe (Usuários do produto): email + aviso UI no
próximo acesso.

Quando o canal direto NÃO existe (titulares que são sócios das bases
públicas): publicação em página dedicada do site + comunicado público,
respeitando dever de informar sem causar pânico injustificado.

**Conteúdo mínimo da comunicação:**
- O que aconteceu (em linguagem clara, sem jargão)
- Quando aconteceu
- Que dados foram afetados
- Riscos para o titular
- O que o controlador está fazendo
- O que o titular pode fazer
- Canal de contato (DPO)

## 6. Investigação (T + 7 dias)

- Análise forense (interna ou contratada)
- Identificação da causa raiz
- Documentação do caminho do ataque (kill chain) ou da falha
- Avaliação de outros sistemas potencialmente afetados

## 7. Resolução e prevenção (T + 30 dias)

- Patch / correção implementada
- Revisão de controles que falharam
- Atualização deste runbook se necessário
- Revisão do RAT, da LIA e da Política de Privacidade se incidente
  revelou ponto não coberto
- Treinamento adicional se a causa foi humana

## 8. Pós-mortem (T + 30 a 60 dias)

Documento estruturado:
- Cronologia precisa (timestamps ISO)
- O que funcionou na resposta
- O que não funcionou
- Mudanças aprovadas para implementação
- Lições aprendidas comunicadas à equipe

## 9. Exercícios de tabletop

Trimestrais. Cenário sorteado, equipe convocada, simulação completa do
runbook (sem comunicação real à ANPD). Resultado documentado.

## 10. Contatos

| Função | Pessoa | Canal direto |
|---|---|---|
| Encarregado (DPO) | [preencher] | privacidade@dealflowbr.com.br |
| Engenharia responsável | [preencher] | [preencher] |
| Advogado especialista LGPD | [preencher] | [preencher] |
| Provedor de hospedagem (suporte) | [preencher] | [preencher] |
| Anthropic (suporte) | trust@anthropic.com | [preencher conta] |
| ANPD (comunicação oficial) | comunicacao@anpd.gov.br | gov.br/anpd |

## 11. Anexos

- [docs/lia-legitimo-interesse.md](./lia-legitimo-interesse.md)
- [docs/registro-atividades-tratamento.md](./registro-atividades-tratamento.md)
- [docs/modelo-resposta-titular.md](./modelo-resposta-titular.md)
