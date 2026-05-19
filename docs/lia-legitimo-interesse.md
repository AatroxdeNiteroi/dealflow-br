# Avaliação de Legítimo Interesse · LIA

> Documento interno · LGPD art. 10. Embasa a escolha da base legal
> "legítimo interesse" (art. 7º IX) para o tratamento de dados pessoais
> oriundos das bases públicas pelo Genesis Radar.
>
> Não publica — fica disponível para fiscalização da ANPD. Revisar a
> cada mudança material no produto ou nas bases consultadas.

| Campo | Valor |
|---|---|
| Versão | 1.0 |
| Data | 14 de maio de 2026 |
| Controlador | [preencher quando o CNPJ for criado] |
| Encarregado | privacidade@dealflowbr.com.br |
| Próxima revisão | 14 de maio de 2027 (anual) |

---

## 1. Identificação do tratamento

| Item | Descrição |
|---|---|
| Categoria de dados | Pessoais (sócios PF de Ltdas) e potencialmente pessoais (contato extraído do CNPJ, razão social com nome de empresário) |
| Origem | Bases públicas oficiais: RFB CNPJ, RAIS, IBGE (acessadas via espelho público Base dos Dados) |
| Finalidade | Triagem inicial de oportunidades de M&A B2B para profissionais (corretoras, search funds, family offices, fundos de PE) |
| Operação | Cruzamento estatístico de sinais operacionais + pseudonimização + apresentação em interface |
| Volume | ~59.807 empresas single-plant (Tier 1 + Tier 2); cada uma com 1-N sócios |
| Periodicidade | Snapshot atualizado em ciclo aproximadamente anual |

## 2. Identificação do interesse legítimo

**Interesse:** prover, a profissionais legalmente habilitados a operar em
M&A, uma ferramenta de triagem inicial de oportunidades a partir de
dados que o Estado brasileiro já tornou públicos para fins de
transparência empresarial e regulatória.

**Por que é legítimo:**
- O interesse é **específico** (triagem M&A) e não genérico.
- É **lícito**: M&A é atividade regulada e ampla, sem impedimento legal.
- Está alinhado à **finalidade pública original** das bases consultadas
  (transparência fiscal e empresarial, art. 7º §3º da LGPD).
- É **real e atual**, não especulativo: existe demanda concreta no
  mercado de M&A boutique brasileiro por essa triagem.
- Não é **interesse exclusivo do controlador**: beneficia também o
  ecossistema (operações M&A mais rápidas, menor custo de prospecção,
  maior eficiência alocativa de capital em médio porte).

**Beneficiários do tratamento:**
- Controlador (operação comercial sustentável)
- Clientes (eficiência de triagem)
- Mercado (maior atividade de M&A em médio porte sub-atendido)
- Empresas-alvo (potencialmente expostas a propostas legítimas que de
  outra forma não receberiam)

## 3. Necessidade do tratamento

**Por que é necessário tratar dados pessoais (e não só de PJ):**
- O quadro societário identifica quem detém poder decisório na
  empresa-alvo. Sem ele, a triagem M&A perde a dimensão de decisão de
  venda (sucessão, perfil de proprietário).
- A apresentação por iniciais é o **mínimo necessário** para a finalidade
  — não exibimos nome completo, CPF nem qualquer atributo demográfico
  (idade, gênero, raça, etc.).

**Mínimo necessário (princípio da necessidade, art. 6º III):**
- Nome bruto e CPF são **descartados** no pipeline de export; não
  persistem nas bases derivadas operadas pelo produto.
- Apresentamos apenas: iniciais, qualificação, tipo (PF/PJ/EXT) e
  identificador pseudonimizado (`socio_key`).
- Idade, gênero, raça, religião, orientação política/sexual, saúde,
  filiação sindical: **nada disso é tratado** pelo produto.

**Existe meio menos oneroso para atingir a mesma finalidade?**

Não. As alternativas avaliadas e descartadas:
1. **Consentimento** (art. 7º I): inviável — não há contato direto com o
   titular para obter consentimento, e tentar obtê-lo seria
   desproporcional (~100k titulares).
2. **Cumprimento de obrigação legal** (art. 7º II): não há obrigação
   legal exigindo este tratamento.
3. **Apenas dados de PJ** (excluindo sócios PF): destrói a finalidade —
   a tese M&A depende da composição societária.
4. **Apenas iniciais sem identificador estável** (`socio_key`):
   inviabiliza o mapa de grupo econômico (sócios em comum entre Ltdas),
   feature essencial à triagem de holdings e estruturas familiares.

## 4. Balanceamento (teste de proporcionalidade)

### 4.1. Expectativa razoável do titular

O sócio de uma Ltda. brasileira tem **expectativa razoável** de que:
- Sua qualidade de sócio seja consultável publicamente — é a finalidade
  do registro CNPJ.
- Terceiros (clientes, fornecedores, advogados, investidores) acessem
  essa informação para fins legítimos relacionados à sua qualidade de
  sócio (validar contraparte, due diligence, avaliação de oportunidade).
- Não inclui expectativa de tratamento para marketing direto a sua PF,
  scoring de crédito ou decisões automatizadas — essas finalidades estão
  **expressamente vedadas** nos Termos de Uso e na Política de Privacidade.

### 4.2. Impactos potenciais ao titular

| Impacto | Avaliação | Mitigação |
|---|---|---|
| Identificação direta (nome, CPF) | Risco neutralizado | Não persistido, descartado no pipeline |
| Identificação indireta por agregação | Risco residual médio | HMAC com salt secreto; restrição de acesso ao endpoint de grupo econômico via auth + rate-limit |
| Recebimento de abordagem comercial não solicitada | Risco baixo | Vedação contratual de prospecção em massa; comunicação institucional ponto-a-ponto permanece lícita |
| Uso discriminatório | Risco neutralizado | Vedação expressa nos Termos; dados sensíveis não tratados |
| Decisão automatizada com efeitos | Risco neutralizado | Vedação expressa; o produto é triagem para análise humana |

### 4.3. Balanceamento final

O **interesse legítimo do controlador prevalece** sobre os riscos aos
direitos e liberdades dos titulares quando consideradas:
- A natureza pública das bases (titular já tem expectativa de consulta).
- A pseudonimização forte aplicada antes do uso comercial.
- A limitação ao mínimo necessário (sem dados sensíveis ou demográficos).
- As vedações contratuais aos Usuários.
- Os mecanismos de exercício de direitos (canal DPO, prazo 15 dias).
- A transparência total via Política de Privacidade publicada.

## 5. Salvaguardas adotadas

**Técnicas:**
- Pseudonimização HMAC-SHA256 com chave secreta em vault separado.
- Descarte de nome bruto e CPF no pipeline (nunca persistem).
- Autenticação por chave de API em endpoints com dados pessoais.
- Rate-limit por IP (60 req/min).
- Audit log estruturado em JSONL.
- CORS whitelist por ambiente.
- TLS em transporte (em produção).
- Tipografia self-hosted (sem leak de IP a terceiros).

**Administrativas:**
- Registro de Atividades de Tratamento (RAT · art. 37) mantido.
- Encarregado (DPO) indicado com canal público.
- Procedimento de resposta a incidente documentado (runbook).
- Política de retenção declarada.
- Treinamento de operadores sobre LGPD.
- Avaliação periódica deste LIA.

**Contratuais:**
- Termos de Uso vedam expressamente: prospecção em massa de PF, credit
  scoring, decisões automatizadas, redistribuição, engenharia reversa,
  inserção de dados sensíveis.
- DPA com sub-processadores (Anthropic, hospedagem) com cláusulas
  contratuais padrão.

## 6. Resultado da avaliação

✅ **Aprovado.** O tratamento de dados pessoais nas condições descritas é
**lícito** e fundamentado em legítimo interesse (LGPD art. 7º IX),
ponderado à luz do art. 7º §3º.

## 7. Direito de oposição do titular

O titular pode opor-se a este tratamento a qualquer tempo (art. 18, §2º),
pelos canais descritos na Política de Privacidade. A oposição será
analisada caso a caso, prevalecendo o direito do titular salvo
demonstração de motivos legítimos preponderantes do controlador.

## 8. Revisão

Esta LIA deve ser revisitada e atualizada quando ocorrer:
- Mudança material na finalidade do tratamento.
- Inclusão de novas categorias de dados pessoais.
- Inclusão de novos sub-processadores.
- Mudança regulatória relevante (resoluções ANPD, lei nova).
- Incidente de segurança com PII.
- A cada 12 meses, no mínimo.

## 9. Aprovação e assinaturas

| Papel | Nome | Data |
|---|---|---|
| Controlador (representante legal) | [preencher] | [preencher] |
| Encarregado (DPO) | [preencher] | [preencher] |
| Advogado revisor | [preencher] | [preencher] |
