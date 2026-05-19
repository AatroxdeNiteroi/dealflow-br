# Modelos de resposta a requisições de titular · LGPD art. 18-19

> Templates operacionais para o DPO responder requisições em até
> **15 dias** (art. 19). Personalizar com nome do titular, data, etc.
> Mantém histórico de envios em planilha separada (controle DPO).

| Campo | Valor |
|---|---|
| Versão | 1.0 |
| Prazo de resposta | 15 dias corridos da requisição |
| Canal de retorno | E-mail ao titular |
| Idioma | Português (Brasil) |

---

## Acuse imediato (T + 0 a T + 2 dias úteis)

Disparar logo após receber a requisição, mesmo sem ainda ter a resposta
substantiva pronta:

```
Assunto: Recebimento da sua requisição LGPD · protocolo [PROT-AAAAMMDD-NNN]

Prezado(a) [nome],

Recebemos sua requisição relativa aos seus dados pessoais tratados pelo
Genesis Radar. Atribuímos o protocolo [PROT-AAAAMMDD-NNN] e a resposta
substantiva será enviada em até 15 dias corridos (LGPD art. 19), até
[data calculada].

Caso precisemos de informações adicionais para localizar o tratamento
referente a você, entraremos em contato em separado.

Atenciosamente,
[Nome do DPO]
Encarregado pelo Tratamento de Dados Pessoais · Genesis Radar
privacidade@dealflowbr.com.br
```

---

## Modelo 1 · Confirmação de tratamento (art. 18 I) e acesso (II)

```
Assunto: Resposta · protocolo [PROT-AAAAMMDD-NNN] · confirmação e acesso

Prezado(a) [nome],

Em resposta à sua requisição, confirmamos que dados pessoais a você
relacionados são tratados pelo Genesis Radar nas seguintes condições:

CATEGORIAS DE DADOS:
  - Iniciais do seu nome e identificador pseudonimizado, derivados de
    registros públicos da Receita Federal (Quadro Societário CNPJ) que
    indicam sua qualidade de [SÓCIO / ADMINISTRADOR / etc.] da empresa
    [RAZÃO SOCIAL] (CNPJ [00.000.000/0001-00]).
  - Qualificação societária e tipo (PF/PJ/EXT).
  - Caso o seu telefone ou e-mail conste como contato oficial do CNPJ
    desta empresa: também é tratado para fins de exibição como contato
    institucional.

ORIGEM DOS DADOS:
  Bases públicas oficiais — Receita Federal (CNPJ) e Ministério do
  Trabalho (RAIS) — acessadas por meio do projeto público Base dos Dados.
  Snapshot atualmente vigente: [DD/MM/AAAA].

FINALIDADE:
  Triagem inicial de oportunidades B2B de fusões e aquisições por
  profissionais qualificados (corretoras, fundos, family offices,
  assessores M&A).

BASE LEGAL:
  Legítimo interesse do controlador (LGPD art. 7º IX), ponderado à luz
  do art. 7º §3º (dados de acesso público mantêm a finalidade da
  publicização original).

COMPARTILHAMENTO:
  Os dados são acessíveis exclusivamente aos Usuários autenticados do
  produto. Não vendemos, alugamos ou compartilhamos com terceiros
  comerciais (bureaus de crédito, marketing, redes sociais).

Para acessar os dados específicos tratados sobre você, anexamos extrato
com os campos atualmente registrados nas nossas bases.

Você pode, a qualquer tempo, solicitar correção, eliminação, oposição,
portabilidade ou demais direitos do art. 18 da LGPD, pelos canais já
informados.

Atenciosamente,
[Nome do DPO]
```

---

## Modelo 2 · Correção (art. 18 III)

```
Assunto: Resposta · protocolo [PROT-AAAAMMDD-NNN] · correção

Prezado(a) [nome],

Em resposta à sua requisição de correção de [DADO ESPECÍFICO]:

[SE PROCEDENTE]:
  Procedemos à correção em [DD/MM/AAAA]. A base passa a refletir
  [NOVO VALOR]. A próxima atualização do produto (em [DATA]) propagará
  a correção a todos os Usuários.

[SE A FONTE É PÚBLICA E O DADO ESTÁ CORRETO NA FONTE]:
  Verificamos que o dado em nossas bases reflete fielmente o registro
  oficial da Receita Federal (snapshot de DD/MM/AAAA). Como tratamos
  dados públicos sem alteração, a correção precisaria ser feita na
  origem (RFB). Recomendamos que entre em contato com a Receita Federal
  para correção do registro oficial. Após a correção na fonte, o
  próximo snapshot do nosso produto (estimado em [DATA]) refletirá
  a mudança.

[SE INVIÁVEL]:
  Após análise, identificamos que [JUSTIFICATIVA]. Mantemos o registro
  atual, com os fundamentos a seguir: [FUNDAMENTAÇÃO]. Você pode
  recorrer à ANPD (gov.br/anpd) se discordar desta decisão.

Atenciosamente,
[Nome do DPO]
```

---

## Modelo 3 · Eliminação / anonimização (art. 18 IV, VI)

```
Assunto: Resposta · protocolo [PROT-AAAAMMDD-NNN] · eliminação

Prezado(a) [nome],

Em resposta à sua requisição de eliminação:

ANÁLISE:
  O tratamento dos seus dados é fundamentado em legítimo interesse
  (LGPD art. 7º IX), e não em consentimento. Portanto, a eliminação
  prevista no art. 18 VI (que se aplica a dados tratados com
  consentimento) não se aplica diretamente.

  Avaliamos, contudo, sua manifestação como **oposição ao tratamento**
  (art. 18 § 2º), conforme abaixo.

[SE A OPOSIÇÃO PROSPERAR]:
  Procedemos à exclusão das suas iniciais e do seu identificador
  pseudonimizado da base derivada do produto, em [DD/MM/AAAA]. Você
  deixará de aparecer no produto a partir do próximo deploy (estimado
  em [DATA]). Importante: como nossa base é regerada periodicamente a
  partir da fonte pública (RFB), seria possível que seu nome reaparecesse
  na próxima atualização. Para evitar, registramos sua oposição em
  lista de exclusão (allowlist negativa) que será aplicada a cada nova
  regeneração.

[SE A OPOSIÇÃO NÃO PROSPERAR]:
  Após ponderação, o legítimo interesse do controlador prevalece pelos
  seguintes motivos: [FUNDAMENTAÇÃO]. Você pode recorrer à ANPD se
  discordar.

Atenciosamente,
[Nome do DPO]
```

---

## Modelo 4 · Portabilidade (art. 18 V)

```
Assunto: Resposta · protocolo [PROT-AAAAMMDD-NNN] · portabilidade

Prezado(a) [nome],

Em resposta à sua requisição de portabilidade:

Enviamos em anexo seus dados pessoais tratados pelo Genesis Radar em
formato JSON estruturado, contendo:

  - identificador pseudonimizado
  - iniciais
  - qualificação societária
  - tipo
  - CNPJ(s) das empresas em que figura como sócio em nossa base
  - data e snapshot de origem dos dados

Não incluímos campos derivados de fontes externas que envolvam segredos
comerciais ou industriais (LGPD art. 18 V parte final).

Para portar a outro fornecedor de serviço, é necessário que o fornecedor
receptor aceite o formato JSON enviado.

Atenciosamente,
[Nome do DPO]
```

---

## Modelo 5 · Informação sobre compartilhamento (art. 18 VII)

```
Assunto: Resposta · protocolo [PROT-AAAAMMDD-NNN] · uso compartilhado

Prezado(a) [nome],

Em resposta à sua requisição sobre compartilhamento de seus dados:

CATEGORIAS DE TERCEIROS:
  Os seus dados pessoais não são compartilhados com terceiros
  comerciais. Não vendemos, alugamos ou cedemos dados.

ACESSO INTERNO:
  Os dados são acessíveis apenas aos Usuários autenticados do produto
  Genesis Radar. Estes são profissionais de M&A B2B vinculados a clientes
  contratantes (corretoras, fundos, family offices).

SUB-PROCESSADORES OPERACIONAIS:
  - Provedor de hospedagem [NOME], que armazena nossas bases derivadas
    em ambiente autenticado e criptografado.

AUTORIDADES PÚBLICAS:
  Podemos ser obrigados a compartilhar dados em cumprimento a ordem
  judicial ou requisição de autoridade competente. Caso isto ocorra,
  comunicamos o titular quando legalmente permitido.

Atenciosamente,
[Nome do DPO]
```

---

## Modelo 6 · Oposição (art. 18 § 2º)

Já coberto no Modelo 3 (eliminação por oposição). Manter consistência.

---

## Modelo 7 · Requisição genérica ou pouco precisa

```
Assunto: Recebimento · protocolo [PROT-AAAAMMDD-NNN] · informação adicional

Prezado(a) [nome],

Recebemos sua requisição mas precisamos de informações adicionais para
localizar seu tratamento em nossas bases:

  - Você é sócio ou administrador de alguma sociedade limitada
    brasileira? Em caso positivo, qual o CNPJ ou razão social?
  - Você é titular de algum contato (telefone, e-mail, endereço)
    declarado em registro CNPJ?
  - Qual direito específico do art. 18 da LGPD deseja exercer?

Aguardamos seu retorno para prosseguir. O prazo de 15 dias do art. 19
fica suspenso pelo período necessário para esta complementação, conforme
faculta o art. 19 § 1º.

Atenciosamente,
[Nome do DPO]
```

---

## Quando recusar atendimento

| Hipótese | Justificativa |
|---|---|
| Identidade do titular não confirmada | Pedir comprovação razoável |
| Requisição manifestamente abusiva | Documentar; pode recusar |
| Dado não está sob tratamento do controlador | Informar e encerrar |
| Direito de eliminação para dado com base ≠ consentimento | Reenquadrar como oposição |
| Direito conflita com obrigação legal | Manter; informar fundamento |

## Controle e auditoria

Manter planilha (interna, fora deste repositório) com:
- Protocolo
- Data de recebimento
- Tipo de requisição
- Decisão
- Data de resposta
- Tempo de resposta (cumprimento do prazo)
- Anexos enviados (criptografados)

Apresentável à ANPD em fiscalização.
