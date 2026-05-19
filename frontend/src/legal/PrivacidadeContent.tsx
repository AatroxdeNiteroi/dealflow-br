/**
 * Política de Privacidade · DealFlow BR · v1.0
 *
 * Conformidade: Lei nº 13.709/2018 (LGPD), Resolução CD/ANPD nº 19/2024
 * (transferência internacional), Marco Civil da Internet (Lei 12.965/2014).
 */

import { CONTROLADOR, DPO, LEGAL_VERSAO, dpoMailto, presente } from "./dpo";
import { LegalTOC, type TOCItem } from "./LegalTOC";

const PRIVACIDADE_TOC: TOCItem[] = [
  { id: "priv-sec-1", title: "1. Identificação do controlador" },
  { id: "priv-sec-2", title: "2. Definições" },
  { id: "priv-sec-3", title: "3. A quem se aplica" },
  { id: "priv-sec-4", title: "4. Categorias de dados tratados" },
  { id: "priv-sec-5", title: "5. Origem dos dados" },
  { id: "priv-sec-6", title: "6. Finalidades do tratamento" },
  { id: "priv-sec-7", title: "7. Bases legais" },
  { id: "priv-sec-8", title: "8. Compartilhamento com terceiros" },
  { id: "priv-sec-9", title: "9. Transferência internacional" },
  { id: "priv-sec-10", title: "10. Cookies e localStorage" },
  { id: "priv-sec-11", title: "11. Prazos de retenção" },
  { id: "priv-sec-12", title: "12. Medidas de segurança" },
  { id: "priv-sec-13", title: "13. Direitos do titular" },
  { id: "priv-sec-14", title: "14. Como exercer seus direitos" },
  { id: "priv-sec-15", title: "15. Incidentes de segurança" },
  { id: "priv-sec-16", title: "16. Dados de crianças e adolescentes" },
  { id: "priv-sec-17", title: "17. Decisões automatizadas" },
  { id: "priv-sec-18", title: "18. Atualizações desta Política" },
  { id: "priv-sec-19", title: "19. Lei aplicável e foro" },
  { id: "priv-sec-20", title: "20. Histórico de versões" },
];

export function PrivacidadeContent() {
  const cnpj = presente(CONTROLADOR.cnpj);
  const endereco = presente(CONTROLADOR.endereco);
  const website = presente(CONTROLADOR.website);

  return (
    <div className="legal-content">
      <LegalTOC
        version={LEGAL_VERSAO.privacidade}
        vigencia={LEGAL_VERSAO.vigencia}
        sections={PRIVACIDADE_TOC}
      />

      {/* ───────────────────────── 1 · IDENTIFICAÇÃO ───────────────────────── */}
      <section className="legal-section" id="priv-sec-1">
        <h3 className="legal-section-title">1. Identificação do controlador e do Encarregado</h3>
        <p>
          Para os fins desta Política e da Lei nº 13.709/2018 (LGPD), o{" "}
          <strong>controlador</strong> dos dados pessoais tratados pelo
          produto DealFlow BR é:
        </p>
        <ul>
          <li><strong>Razão social:</strong> {CONTROLADOR.razao_social}</li>
          {cnpj && <li><strong>CNPJ:</strong> {cnpj}</li>}
          {endereco && <li><strong>Endereço:</strong> {endereco}</li>}
          {website && <li><strong>Site:</strong> {website}</li>}
        </ul>
        <p>
          Em cumprimento ao art. 41 da LGPD, indicamos o seguinte
          Encarregado pelo Tratamento de Dados Pessoais (DPO):
        </p>
        <ul>
          <li><strong>Nome:</strong> {DPO.nome}</li>
          <li>
            <strong>E-mail:</strong>{" "}
            <a href={`mailto:${DPO.email}`} className="legal-link">{DPO.email}</a>
          </li>
        </ul>
        <p>
          O Encarregado é a pessoa indicada para aceitar reclamações e
          comunicações dos titulares, prestar esclarecimentos e adotar
          providências, receber comunicações da Autoridade Nacional de
          Proteção de Dados (ANPD) e orientar funcionários e contratados
          sobre as práticas em relação à proteção de dados pessoais
          (art. 41, §2º).
        </p>
      </section>

      {/* ───────────────────────── 2 · DEFINIÇÕES ───────────────────────── */}
      <section className="legal-section" id="priv-sec-2">
        <h3 className="legal-section-title">2. Definições</h3>
        <p>Para os fins desta Política, aplicam-se as definições a seguir:</p>
        <ul>
          <li>
            <strong>Dado pessoal:</strong> informação relacionada a pessoa
            natural identificada ou identificável (LGPD art. 5º, I).
          </li>
          <li>
            <strong>Dado pessoal sensível:</strong> dado sobre origem racial
            ou étnica, convicção religiosa, opinião política, filiação a
            sindicato, dado referente à saúde, à vida sexual, dado genético
            ou biométrico (art. 5º, II). <strong>O DealFlow BR não trata
            dados pessoais sensíveis.</strong>
          </li>
          <li>
            <strong>Titular:</strong> pessoa natural a quem se referem os
            dados pessoais (art. 5º, V).
          </li>
          <li>
            <strong>Controlador:</strong> pessoa natural ou jurídica a quem
            competem as decisões referentes ao tratamento de dados pessoais
            (art. 5º, VI). Aqui, identificado na Seção 1.
          </li>
          <li>
            <strong>Operador:</strong> pessoa natural ou jurídica que realiza
            o tratamento em nome do controlador (art. 5º, VII).
          </li>
          <li>
            <strong>Tratamento:</strong> toda operação realizada com dados
            pessoais — coleta, classificação, utilização, acesso,
            armazenamento, eliminação, etc. (art. 5º, X).
          </li>
          <li>
            <strong>Pseudonimização:</strong> tratamento por meio do qual um
            dado perde a possibilidade de associação direta ou indireta a um
            indivíduo, senão pelo uso de informação adicional mantida
            separadamente em ambiente controlado e seguro (art. 5º, XI).
          </li>
          <li>
            <strong>Fonte pública:</strong> base de dados cujo acesso é
            franqueado por força de lei ou por ato administrativo. As
            principais utilizadas pelo DealFlow BR são as bases da Receita
            Federal (Cadastro Nacional da Pessoa Jurídica · CNPJ), da RAIS
            (Relação Anual de Informações Sociais · Ministério do Trabalho)
            e do IBGE (Pesquisas Industrial Anual, Anual de Comércio e Anual
            de Serviços).
          </li>
          <li>
            <strong>Usuário:</strong> pessoa natural que acessa o DealFlow BR
            em nome de Cliente contratante para fins profissionais B2B (M&amp;A).
          </li>
          <li>
            <strong>Cliente:</strong> pessoa jurídica que contrata o acesso
            ao DealFlow BR para seus Usuários.
          </li>
        </ul>
      </section>

      {/* ───────────────────────── 3 · APLICAÇÃO ───────────────────────── */}
      <section className="legal-section" id="priv-sec-3">
        <h3 className="legal-section-title">3. A quem se aplica esta Política</h3>
        <p>
          Esta Política se aplica a <strong>três grupos distintos de titulares</strong>:
        </p>
        <ol>
          <li>
            <strong>Sócios pessoa física</strong> de sociedades limitadas
            (Ltdas.) cujos dados constam nas bases públicas mencionadas na
            Seção 2 — tratados em forma pseudonimizada pelo DealFlow BR.
          </li>
          <li>
            <strong>Pessoas naturais incidentalmente identificáveis</strong>{" "}
            a partir de dados de contato do registro empresarial (telefone,
            e-mail, endereço da empresa quando esta é unipessoal, MEI ou
            quando o contato é declarado em nome de pessoa física, como
            frequentemente ocorre com contadores).
          </li>
          <li>
            <strong>Usuários do produto</strong> — profissionais que acessam
            o DealFlow BR em nome de seus Clientes (corretoras de M&amp;A,
            family offices, fundos, assessores).
          </li>
        </ol>
      </section>

      {/* ───────────────────────── 4 · CATEGORIAS DE DADOS ───────────────────────── */}
      <section className="legal-section" id="priv-sec-4">
        <h3 className="legal-section-title">4. Categorias de dados pessoais tratados</h3>

        <p><strong>4.1. Dados pseudonimizados de sócios pessoa física</strong></p>
        <ul>
          <li>
            <strong>Iniciais do nome</strong> (ex.: "J. M. S."), derivadas do
            nome completo registrado na Receita Federal.
          </li>
          <li>
            <strong>Identificador pseudonimizado (<code>socio_key</code>)</strong>:
            chave de 16 caracteres derivada pelo algoritmo HMAC-SHA256 do nome
            normalizado combinado com o documento, utilizando salt secreto
            mantido em vault separado do produto.
          </li>
          <li>
            <strong>Qualificação societária</strong> (administrador, sócio,
            etc.) e <strong>tipo</strong> (PF, PJ ou estrangeiro).
          </li>
        </ul>
        <p>
          <strong>O nome completo bruto e o documento (CPF) jamais são
          persistidos</strong> nas bases derivadas operadas pelo DealFlow
          BR — o pipeline de pré-processamento descarta esses campos após a
          geração da chave pseudonimizada.
        </p>

        <p><strong>4.2. Dados de contato oficial</strong></p>
        <ul>
          <li>Endereço completo (logradouro, número, complemento, bairro, município, UF, CEP).</li>
          <li>Telefones (DDD + número, podendo haver dois números por registro).</li>
          <li>E-mail.</li>
        </ul>
        <p>
          Estes dados são extraídos do cadastro oficial do CNPJ na Receita
          Federal. O DealFlow BR adverte expressamente, em sua interface, que
          o contato declarado ao registro empresarial pode pertencer a
          pessoa diversa da empresa-alvo (escritório de contabilidade,
          ex-sócio ou prestador de serviço administrativo), e que deve ser
          tratado como ponto de partida e não como canal validado.
        </p>

        <p><strong>4.3. Razão social e CNPJ</strong></p>
        <p>
          Em regra, razão social e CNPJ identificam pessoa jurídica e não
          se enquadram como dados pessoais. Reconhecemos, contudo, que:
        </p>
        <ul>
          <li>
            Em <strong>MEI e Ltda. unipessoal</strong>, o CNPJ está vinculado
            de modo unívoco ao CPF do empresário, podendo configurar
            identificação indireta.
          </li>
          <li>
            Em sociedades cuja <strong>razão social contém o nome do
            empresário</strong> (prática comum em pequenas Ltdas. — ex.:
            "João da Silva Comércio Ltda."), o nome se torna indiretamente
            identificável.
          </li>
        </ul>
        <p>
          Em ambas as hipóteses, tratamos o dado com as mesmas salvaguardas
          aplicáveis aos demais dados pessoais.
        </p>

        <p><strong>4.4. Dados do Usuário do produto</strong></p>
        <ul>
          <li>
            <strong>Dados de cadastro do Cliente</strong> (razão social,
            CNPJ, nome do responsável, e-mail corporativo, telefone) — quando
            aplicável ao contrato comercial.
          </li>
          <li>
            <strong>Credenciais de acesso</strong> (e-mail e/ou chave de API).
          </li>
          <li>
            <strong>Conteúdo da Watchlist</strong>: lista de empresas
            selecionadas pelo Usuário, notas livres em texto digitadas pelo
            próprio Usuário, histórico de status de pipeline (Lead →
            Contatado → NDA → DD → Walk-away) e registros de canal de
            contato (telefone, e-mail, LinkedIn, apresentação, outro).{" "}
            <strong>Estes dados ficam armazenados exclusivamente no
            navegador do Usuário (localStorage)</strong> e não trafegam para
            os servidores do controlador.
          </li>
          <li>
            <strong>Prompt digitado na Busca com IA</strong>: texto livre de
            até 1.000 caracteres digitado pelo Usuário, transmitido ao
            sub-processador Anthropic conforme detalhado nas Seções 9 e 10.
          </li>
        </ul>

        <p><strong>4.5. Dados de segurança, navegação e operação</strong></p>
        <ul>
          <li>
            <strong>Endereço IP, User-Agent, timestamps, métodos HTTP, paths
            requisitados e códigos de resposta</strong>, registrados em audit
            log estruturado para fins de segurança da informação,
            rastreabilidade e cumprimento do art. 37 da LGPD (registro das
            operações de tratamento).
          </li>
          <li>
            <strong>Indicador de presença</strong> do header de autenticação
            (sem registrar o valor da chave).
          </li>
        </ul>
      </section>

      {/* ───────────────────────── 5 · ORIGEM ───────────────────────── */}
      <section className="legal-section" id="priv-sec-5">
        <h3 className="legal-section-title">5. Origem dos dados (proveniência)</h3>
        <p>
          Os dados pessoais tratados pelo DealFlow BR possuem as seguintes
          origens, todas elas <strong>fontes públicas oficiais</strong>:
        </p>
        <ul>
          <li>
            <strong>Receita Federal do Brasil (RFB)</strong> — Cadastro
            Nacional da Pessoa Jurídica (CNPJ), incluindo dados de
            estabelecimentos, quadro societário e regime tributário.
            Acessado por meio de espelho público disponibilizado em
            ambiente de processamento analítico (projeto Base dos Dados).
          </li>
          <li>
            <strong>Ministério do Trabalho e Emprego — RAIS</strong>{" "}
            (Relação Anual de Informações Sociais), micro-dados de
            estabelecimentos e vínculos trabalhistas, acessados pelo mesmo
            espelho público.
          </li>
          <li>
            <strong>IBGE</strong> — Pesquisa Industrial Anual (PIA), Pesquisa
            Anual de Comércio (PAC) e Pesquisa Anual de Serviços (PAS),
            acessadas via API SIDRA do IBGE. Utilizadas apenas para razões
            setoriais de receita por pessoal ocupado; não contêm dados
            pessoais individualizados.
          </li>
          <li>
            <strong>Diretórios brasileiros</strong> (códigos IBGE de
            municípios) — não contêm dados pessoais.
          </li>
        </ul>
        <p>
          Os dados são obtidos por meio de <em>snapshots</em> periódicos
          (atualmente: snapshot da RFB de 18/12/2024 e ano-base RAIS 2024).
          Não realizamos scraping, ingestão contínua, nem coletamos dados
          diretamente do titular.
        </p>
      </section>

      {/* ───────────────────────── 6 · FINALIDADE ───────────────────────── */}
      <section className="legal-section" id="priv-sec-6">
        <h3 className="legal-section-title">6. Finalidades do tratamento</h3>
        <p>
          Em observância ao princípio da finalidade (LGPD art. 6º, I), o
          DealFlow BR trata dados pessoais exclusivamente para as seguintes
          finalidades:
        </p>
        <ul>
          <li>
            <strong>Triagem inicial de oportunidades de M&amp;A B2B</strong>:
            identificação, ordenação e filtragem de empresas brasileiras
            (sociedades limitadas de médio porte) para análise de
            profissionais de fusões e aquisições, search funds, family
            offices, fundos de private equity e assessores M&amp;A.
          </li>
          <li>
            <strong>Reconstrução estatística de receita</strong> a partir de
            sinais operacionais públicos cruzados.
          </li>
          <li>
            <strong>Classificação estrutural</strong> das empresas em
            arquétipos (sucessão familiar, capital intensiva, partnership,
            etc.) e em níveis de confiança estatística.
          </li>
          <li>
            <strong>Provimento do produto</strong> ao Usuário/Cliente, incluindo
            funcionalidades de busca, watchlist, exportação (CSV/PDF) e
            busca com IA.
          </li>
          <li>
            <strong>Segurança da informação, prevenção a fraude, abuso e
            scraping</strong>, incluindo registro de operações (art. 37),
            rate-limit e autenticação.
          </li>
          <li>
            <strong>Cumprimento de obrigações legais e regulatórias</strong>{" "}
            (art. 7º, II), incluindo atendimento a requisições da ANPD, do
            Poder Judiciário e de autoridades competentes.
          </li>
        </ul>
        <p>
          <strong>Vedações expressas de finalidade.</strong> O DealFlow BR{" "}
          <em>não</em> trata dados pessoais para nenhuma das finalidades a
          seguir, e seus Termos de Uso vedam que Usuários e Clientes o façam
          a partir de dados extraídos do produto:
        </p>
        <ul>
          <li>Cobrança ou recuperação de crédito.</li>
          <li>
            Análise ou definição de perfil de risco de crédito (credit scoring).
          </li>
          <li>
            Marketing direto, prospecção em massa, telemarketing ou disparo
            automatizado de mensagens a pessoas naturais.
          </li>
          <li>
            Decisões automatizadas que afetem interesses do titular,
            incluindo aquelas destinadas a definir seu perfil pessoal,
            profissional, de consumo, de crédito ou aspectos da
            personalidade (art. 20).
          </li>
          <li>
            Tratamento que viole o art. 11 da LGPD (dados sensíveis) ou que
            tenha qualquer finalidade discriminatória.
          </li>
        </ul>
      </section>

      {/* ───────────────────────── 7 · BASES LEGAIS ───────────────────────── */}
      <section className="legal-section" id="priv-sec-7">
        <h3 className="legal-section-title">7. Bases legais do tratamento</h3>

        <p><strong>7.1. Legítimo interesse (art. 7º, IX)</strong></p>
        <p>
          A base legal predominante do tratamento realizado pelo DealFlow BR
          é o <strong>legítimo interesse do controlador</strong>, ponderado
          em conjunto com o art. 7º, §3º da LGPD, segundo o qual "o
          tratamento de dados pessoais cujo acesso é público deve considerar
          a finalidade, a boa-fé e o interesse público que justificaram sua
          disponibilização".
        </p>
        <p>
          Em cumprimento ao art. 10 da LGPD, realizamos e mantemos
          documentada internamente a <strong>Avaliação de Legítimo Interesse
          (LIA — Legitimate Interest Assessment)</strong>, estruturada em
          três etapas:
        </p>
        <ol>
          <li>
            <strong>Identificação do interesse legítimo:</strong> o interesse
            do controlador é prover, a profissionais de M&amp;A B2B, uma
            ferramenta de triagem inicial de oportunidades a partir de dados
            já disponibilizados publicamente pelo Estado brasileiro. O
            interesse é específico, lícito e diretamente relacionado à
            finalidade pública original das bases consultadas
            (transparência empresarial e regulatória).
          </li>
          <li>
            <strong>Necessidade:</strong> o tratamento limita-se ao mínimo
            necessário para a finalidade (princípio da necessidade · art. 6º,
            III). Adotamos pseudonimização antes do uso comercial,
            descartamos campos brutos não essenciais (nome completo, CPF) e
            restringimos o detalhamento ao indispensável à triagem M&amp;A.
            Inexiste meio menos oneroso ao titular para atingir a mesma
            finalidade.
          </li>
          <li>
            <strong>Balanceamento (ponderação):</strong> ponderamos o
            interesse legítimo contra os direitos e liberdades fundamentais
            dos titulares. Reconhecemos que o titular sócio de Ltda. tem
            expectativa razoável de que dados de sua qualidade de sócio
            sejam acessados por terceiros para finalidades legítimas
            relacionadas a essa qualidade (a publicidade do CNPJ existe
            justamente para isso). Para mitigar riscos residuais,
            implementamos as salvaguardas descritas na Seção 12.
          </li>
        </ol>
        <p>
          O titular pode, a qualquer tempo, opor-se ao tratamento fundado em
          legítimo interesse (art. 18, §2º), conforme procedimento descrito
          na Seção 13.
        </p>

        <p><strong>7.2. Execução de contrato (art. 7º, V)</strong></p>
        <p>
          Para os dados do Usuário/Cliente (cadastro, credenciais, conteúdo
          da Watchlist, prompts de Busca com IA), a base legal é a execução
          de contrato de prestação do serviço DealFlow BR, do qual o
          Usuário/Cliente é parte.
        </p>

        <p><strong>7.3. Cumprimento de obrigação legal (art. 7º, II)</strong></p>
        <p>
          Os registros de segurança (audit log de requisições) são mantidos
          em cumprimento ao art. 15 do Marco Civil da Internet (Lei
          12.965/2014), que exige guarda de registros de acesso a aplicações
          pelo prazo mínimo de 6 (seis) meses, sob sigilo.
        </p>

        <p><strong>7.4. Bases não utilizadas</strong></p>
        <p>
          O DealFlow BR <strong>não</strong> utiliza consentimento (art. 7º,
          I) como base legal para o tratamento dos dados de sócios oriundos
          de fontes públicas — não há contato direto com o titular para
          obtenção de consentimento, e a coleta seria desproporcional à
          finalidade. Não realizamos tratamento de dados sensíveis (art. 11)
          em qualquer hipótese.
        </p>
      </section>

      {/* ───────────────────────── 8 · COMPARTILHAMENTO ───────────────────────── */}
      <section className="legal-section" id="priv-sec-8">
        <h3 className="legal-section-title">8. Compartilhamento de dados com terceiros</h3>
        <p>
          O DealFlow BR <strong>não vende, aluga, cede ou negocia dados
          pessoais</strong> com terceiros. O compartilhamento limita-se às
          hipóteses descritas a seguir.
        </p>

        <p><strong>8.1. Sub-processadores (operadores)</strong></p>
        <p>
          Para a operação do serviço, o controlador utiliza os seguintes
          sub-processadores, todos vinculados por instrumento contratual com
          cláusulas de proteção equivalentes a esta Política:
        </p>
        <ul>
          <li>
            <strong>Anthropic, PBC</strong> (EUA) — processamento da
            funcionalidade opcional "Busca com IA". Recebe exclusivamente o
            texto do prompt digitado pelo Usuário (limitado a 1.000
            caracteres), sem qualquer dado de empresas, sócios, contatos,
            CNPJ ou identificação do Usuário. A lista de sub-processadores
            da Anthropic e seu Data Processing Addendum, com Cláusulas
            Contratuais Padrão (SCC), são publicamente acessíveis no portal
            de confiança da Anthropic.
          </li>
          <li>
            <strong>Provedor de hospedagem / infraestrutura de nuvem</strong>{" "}
            (a ser identificado no momento da contratação comercial). Armazena
            as bases pseudonimizadas e processa as requisições de API.
            Vinculado por DPA específico.
          </li>
        </ul>
        <p>
          A lista atualizada de sub-processadores é mantida e disponibilizada
          mediante solicitação ao Encarregado. Mudanças materiais nesta lista
          serão informadas com antecedência razoável e, quando aplicável,
          mediante atualização desta Política.
        </p>

        <p><strong>8.2. Autoridades públicas</strong></p>
        <p>
          Poderemos compartilhar dados pessoais quando exigidos por
          autoridade competente em cumprimento a determinação legal,
          requisição administrativa válida ou ordem judicial, e nos limites
          estritos do que for requisitado.
        </p>

        <p><strong>8.3. Operações societárias</strong></p>
        <p>
          Em caso de reorganização societária do controlador (fusão,
          aquisição, cisão), os dados pessoais poderão ser transferidos à
          sucessora, com manutenção das obrigações de proteção desta
          Política. Mudanças desta natureza serão comunicadas aos titulares
          com a maior antecedência razoavelmente possível.
        </p>

        <p><strong>8.4. Não compartilhamos com</strong></p>
        <ul>
          <li>
            Bureaus de crédito (Serasa, Boa Vista, SPC, Quod e congêneres).
          </li>
          <li>Plataformas de marketing direto, e-mail marketing ou anúncios.</li>
          <li>Redes sociais (perfis e públicos personalizados).</li>
          <li>
            Brokers ou intermediários de dados ("data brokers").
          </li>
          <li>Anunciantes ou redes de publicidade.</li>
        </ul>
      </section>

      {/* ───────────────────────── 9 · TRANSFERÊNCIA INTERNACIONAL ───────────────────────── */}
      <section className="legal-section" id="priv-sec-9">
        <h3 className="legal-section-title">9. Transferência internacional de dados</h3>
        <p>
          A única transferência internacional de dados pessoais realizada
          rotineiramente pelo DealFlow BR ocorre na funcionalidade opcional{" "}
          <strong>"Busca com IA"</strong>: o texto digitado pelo Usuário é
          transmitido ao sub-processador Anthropic, PBC, com servidores
          localizados nos Estados Unidos da América.
        </p>
        <p><strong>9.1. Base legal da transferência (LGPD art. 33)</strong></p>
        <p>
          A transferência é fundamentada no art. 33, inciso II, da LGPD —
          oferta, pelo controlador, de garantias do cumprimento dos
          princípios e dos direitos do titular mediante <strong>cláusulas
          contratuais específicas</strong>, em consonância com a Resolução
          CD/ANPD nº 19/2024, que aprovou o modelo de Cláusulas Contratuais
          Padrão (CCP) para transferência internacional.
        </p>
        <p>
          O controlador firmou (ou compromete-se a firmar antes do uso
          comercial da funcionalidade) o <strong>Data Processing Addendum
          (DPA)</strong> da Anthropic, que incorpora Cláusulas Contratuais
          Padrão da União Europeia (EU SCC), aceitas internacionalmente como
          mecanismo equivalente. O processo de adequação à Resolução ANPD
          19/2024 (12 meses para incorporação das CCPs nacionais) está em
          andamento.
        </p>
        <p><strong>9.2. Dados efetivamente transferidos</strong></p>
        <p>
          Apenas o texto livre digitado pelo Usuário (até 1.000 caracteres)
          é transmitido. <strong>Não é incluído no contexto enviado</strong>{" "}
          qualquer dado de empresa, sócio, contato, CNPJ, identificação do
          Usuário ou conteúdo da Watchlist.
        </p>
        <p><strong>9.3. Salvaguardas</strong></p>
        <ul>
          <li>
            Aviso explícito ao Usuário, na interface, antes do envio,
            recomendando que não inclua dados pessoais sensíveis no prompt.
          </li>
          <li>Limitação técnica do tamanho do prompt (1.000 caracteres).</li>
          <li>
            Política da Anthropic de não utilizar dados de API para
            treinamento de modelos por padrão (declaração disponível no
            portal de privacidade da Anthropic).
          </li>
          <li>
            Cache local LRU no backend para reduzir o número de transmissões
            internacionais por prompts repetidos.
          </li>
        </ul>
        <p><strong>9.4. Outras tecnologias sem transferência internacional</strong></p>
        <p>
          As fontes tipográficas utilizadas no produto são servidas a partir
          da própria aplicação — não há requisição a redes de distribuição
          de conteúdo (CDN) externas que possam expor o endereço IP do
          Usuário a terceiros não contratualmente vinculados.
        </p>
      </section>

      {/* ───────────────────────── 10 · COOKIES E STORAGE ───────────────────────── */}
      <section className="legal-section" id="priv-sec-10">
        <h3 className="legal-section-title">10. Cookies, localStorage e tecnologias similares</h3>
        <p>
          O DealFlow BR <strong>não utiliza cookies</strong> (de sessão, de
          rastreamento ou de terceiros) para o funcionamento do produto.
          Também <strong>não utiliza ferramentas de analytics, pixels de
          rastreamento, telemetria comportamental, mapas de calor ou
          plataformas de marketing</strong> (Google Analytics, Meta Pixel,
          Mixpanel, Amplitude, Hotjar, PostHog e similares estão ausentes).
        </p>
        <p>
          Utilizamos exclusivamente o <strong>armazenamento local do
          navegador</strong> (localStorage) do Usuário para guardar —{" "}
          <em>no próprio navegador do Usuário, sem cópia em nossos
          servidores</em> — o conteúdo da Watchlist: lista de empresas
          selecionadas, status do pipeline M&amp;A, notas livres e
          histórico de canal de contato.
        </p>
        <p>
          O Usuário pode, a qualquer tempo, <strong>exportar essa lista em
          formato JSON</strong> (botão "Exportar JSON" na tela Watchlist)
          ou <strong>apagar todo o conteúdo</strong> (botão "Apagar tudo" na
          mesma tela), em atenção ao art. 18, incisos V e VI, da LGPD.
        </p>
      </section>

      {/* ───────────────────────── 11 · RETENÇÃO ───────────────────────── */}
      <section className="legal-section" id="priv-sec-11">
        <h3 className="legal-section-title">11. Prazos de retenção e eliminação</h3>
        <p>
          Em observância ao princípio da necessidade (art. 6º, III) e às
          hipóteses de término do tratamento (art. 15 e 16), aplicamos os
          seguintes prazos de retenção:
        </p>
        <ul>
          <li>
            <strong>Bases derivadas pseudonimizadas</strong> (estimates,
            socios_index, contato, headcount_history): mantidas enquanto
            forem necessárias à finalidade. Atualizadas a cada novo snapshot
            das fontes públicas (atualmente em ciclo aproximadamente anual,
            acompanhando a periodicidade da RFB e da RAIS). O snapshot
            substituído é descartado em até 12 meses após a substituição,
            preservada apenas a versão imediatamente anterior para fins de
            reprodutibilidade auditável.
          </li>
          <li>
            <strong>Cache LRU em memória do backend</strong>: vida útil do
            processo de servidor (segundos a horas); não persistido em disco.
          </li>
          <li>
            <strong>Audit log</strong> (registros de acesso à API): pelo
            menos 6 meses (Marco Civil art. 15) e até 12 meses, conforme
            política operacional. Conteúdo limitado aos metadados de
            requisição (IP, método, path, status, latência, User-Agent),
            sem corpo de requisição ou de resposta.
          </li>
          <li>
            <strong>Watchlist do Usuário</strong>: armazenada no navegador
            do próprio Usuário (localStorage), persistindo até que ele a
            exclua ou limpe os dados do navegador. O controlador não retém
            cópia.
          </li>
          <li>
            <strong>Prompts da Busca com IA</strong>: não retidos pelo
            controlador (cache LRU in-memory apenas). Anthropic, conforme
            sua política, retém por até 30 dias para fins de segurança e
            abuso (a menos que o cliente esteja em programa de Zero Data
            Retention, quando aplicável).
          </li>
          <li>
            <strong>Dados de cadastro do Cliente</strong>: enquanto vigente
            o contrato e por até 5 anos após o término, para cumprimento de
            obrigações fiscais, tributárias e prescricionais.
          </li>
        </ul>
        <p>
          Encerrado o prazo de retenção, os dados são eliminados ou
          definitivamente anonimizados, ressalvadas as hipóteses do art. 16
          da LGPD (cumprimento de obrigação legal, estudo por órgão de
          pesquisa com anonimização, transferência a terceiro com requisitos
          legais ou uso exclusivo do controlador vedado o acesso por
          terceiro e anonimizados).
        </p>
      </section>

      {/* ───────────────────────── 12 · SEGURANÇA ───────────────────────── */}
      <section className="legal-section" id="priv-sec-12">
        <h3 className="legal-section-title">12. Medidas de segurança (LGPD art. 46)</h3>
        <p>
          O controlador adota medidas técnicas e administrativas aptas a
          proteger os dados pessoais de acessos não autorizados e de
          situações acidentais ou ilícitas de destruição, perda, alteração,
          comunicação ou difusão. Em particular:
        </p>
        <p><strong>Medidas técnicas</strong></p>
        <ul>
          <li>
            <strong>Pseudonimização forte</strong> dos identificadores de
            sócios pessoa física por HMAC-SHA256, com chave (salt) mantida
            em vault separado e jamais versionada em código.
          </li>
          <li>
            <strong>Descarte de campos brutos</strong> (nome completo, CPF)
            no pipeline de pré-processamento — não persistem nas bases
            consultadas pelo produto.
          </li>
          <li>
            <strong>Autenticação por chave de API</strong> para acesso aos
            pontos de extremidade (endpoints) que retornam dados pessoais.
          </li>
          <li>
            <strong>Rate-limit por endereço IP</strong> (janela deslizante
            de 60 segundos), configurável, com o objetivo de dificultar
            scraping massivo.
          </li>
          <li>
            <strong>Whitelist de origens (CORS)</strong> configurada por
            ambiente, restringindo origens autorizadas a invocar a API.
          </li>
          <li>
            <strong>Transporte criptografado (HTTPS/TLS)</strong> em todas
            as comunicações entre cliente e servidor.
          </li>
          <li>
            <strong>Tipografia servida a partir da própria aplicação</strong>{" "}
            (sem CDN de terceiros que possam expor o IP do Usuário).
          </li>
        </ul>
        <p><strong>Medidas administrativas e organizacionais</strong></p>
        <ul>
          <li>
            <strong>Registro estruturado de operações de tratamento</strong>{" "}
            em cumprimento ao art. 37 da LGPD.
          </li>
          <li>
            <strong>Política de acesso por princípio de menor privilégio</strong>{" "}
            às bases internas.
          </li>
          <li>
            <strong>Gestão de segredos em vault</strong> (chaves de API,
            salt de pseudonimização, credenciais).
          </li>
          <li>
            <strong>Procedimento documentado</strong> de resposta a
            incidentes (Seção 14).
          </li>
          <li>
            <strong>Avaliação de Legítimo Interesse (LIA)</strong> documentada
            e revisitada a cada mudança material no tratamento.
          </li>
        </ul>
        <p>
          Reconhecemos que nenhuma medida de segurança é absoluta. Em caso
          de incidente que possa acarretar risco ou dano relevante aos
          titulares, observaremos o procedimento da Seção 14.
        </p>
      </section>

      {/* ───────────────────────── 13 · DIREITOS DO TITULAR ───────────────────────── */}
      <section className="legal-section" id="priv-sec-13">
        <h3 className="legal-section-title">13. Direitos do titular (LGPD art. 18)</h3>
        <p>
          O titular pode, a qualquer tempo, exercer perante o controlador os
          seguintes direitos:
        </p>
        <ol>
          <li>
            <strong>Confirmação</strong> da existência de tratamento de seus
            dados pessoais pelo controlador.
          </li>
          <li>
            <strong>Acesso</strong> aos seus dados.
          </li>
          <li>
            <strong>Correção</strong> de dados incompletos, inexatos ou
            desatualizados.
          </li>
          <li>
            <strong>Anonimização, bloqueio ou eliminação</strong> de dados
            desnecessários, excessivos ou tratados em desconformidade com a
            LGPD.
          </li>
          <li>
            <strong>Portabilidade</strong> a outro fornecedor de serviço ou
            produto, observados os segredos comercial e industrial.
          </li>
          <li>
            <strong>Eliminação</strong> dos dados pessoais tratados com
            consentimento (não aplicável às hipóteses do art. 16: cumprimento
            de obrigação legal, estudo por órgão de pesquisa com
            anonimização, transferência a terceiro com cumprimento de
            requisitos legais ou uso exclusivo do controlador, vedado o
            acesso por terceiro e desde que anonimizados).
          </li>
          <li>
            <strong>Informação</strong> das entidades públicas e privadas com
            as quais o controlador realizou uso compartilhado de dados.
          </li>
          <li>
            <strong>Informação</strong> sobre a possibilidade de não fornecer
            consentimento e sobre as consequências da negativa.
          </li>
          <li>
            <strong>Revogação do consentimento</strong>, quando este for a
            base legal aplicável (não é o caso geral do tratamento descrito
            nesta Política).
          </li>
          <li>
            <strong>Oposição</strong> ao tratamento realizado com fundamento
            em hipótese de dispensa de consentimento (art. 18, §2º), quando
            houver descumprimento da LGPD.
          </li>
          <li>
            <strong>Revisão de decisões automatizadas</strong> (art. 20) — o
            DealFlow BR não toma decisões automatizadas com efeitos sobre o
            titular.
          </li>
        </ol>
      </section>

      {/* ───────────────────────── 14 · COMO EXERCER OS DIREITOS ───────────────────────── */}
      <section className="legal-section" id="priv-sec-14">
        <h3 className="legal-section-title">14. Como exercer seus direitos</h3>
        <p>
          O titular pode formalizar requisição relativa a qualquer dos
          direitos da Seção 13 pelos canais a seguir:
        </p>
        <ul>
          <li>
            <strong>E-mail ao Encarregado:</strong>{" "}
            <a href={dpoMailto("exercício de direitos do titular")} className="legal-link">
              {DPO.email}
            </a>{" "}
            — recomenda-se incluir, no corpo da mensagem, identificação do
            titular, descrição do direito a ser exercido e elementos que
            permitam ao controlador localizar o tratamento (por exemplo,
            CNPJ da empresa em que figura como sócio, quando aplicável).
          </li>
          <li>
            <strong>Funcionalidades de auto-atendimento</strong> disponíveis
            no produto, na tela Watchlist, para Usuários do DealFlow BR:
            "Exportar JSON" (portabilidade, art. 18, V) e "Apagar tudo"
            (eliminação, art. 18, VI), aplicáveis ao conteúdo armazenado no
            navegador do Usuário.
          </li>
          <li>
            <strong>Petição direta à ANPD</strong>: o titular pode peticionar
            em face do controlador perante a Autoridade Nacional de Proteção
            de Dados (art. 18, §1º), pelos canais oficiais publicados pela
            Autoridade.
          </li>
        </ul>
        <p>
          <strong>Prazo de resposta.</strong> O controlador responderá às
          requisições em até <strong>15 (quinze) dias</strong> contados da
          data do requerimento, conforme art. 19 da LGPD, prorrogável em
          hipóteses fundamentadas e comunicadas ao titular.
        </p>
        <p>
          <strong>Gratuidade.</strong> O atendimento é gratuito, exceto nos
          casos em que houver requisição que demande esforços
          desproporcionais devidamente justificados.
        </p>
        <p>
          <strong>Verificação de identidade.</strong> Para impedir o
          atendimento de requisições fraudulentas, o controlador poderá
          solicitar comprovação razoável da identidade do titular ou de seu
          representante legalmente constituído antes de fornecer dados
          pessoais.
        </p>
      </section>

      {/* ───────────────────────── 15 · INCIDENTES ───────────────────────── */}
      <section className="legal-section" id="priv-sec-15">
        <h3 className="legal-section-title">15. Incidentes de segurança (LGPD art. 48)</h3>
        <p>
          Em caso de incidente de segurança que possa acarretar risco ou
          dano relevante aos titulares, o controlador adotará as seguintes
          providências:
        </p>
        <ol>
          <li>
            <strong>Contenção</strong> técnica imediata do incidente e
            preservação de evidências.
          </li>
          <li>
            <strong>Avaliação</strong> da gravidade, extensão e categorias
            de dados afetados.
          </li>
          <li>
            <strong>Comunicação à ANPD e aos titulares afetados</strong> em
            prazo razoável, conforme as diretrizes da Autoridade (a ANPD
            recomenda comunicação em até 3 dias úteis em incidentes
            relevantes), contendo no mínimo as informações exigidas pelo
            art. 48, §1º (descrição, dados envolvidos, riscos, medidas
            adotadas).
          </li>
          <li>
            <strong>Medidas de mitigação e revisão</strong> dos controles
            internos para prevenir recorrência.
          </li>
        </ol>
      </section>

      {/* ───────────────────────── 16 · CRIANÇAS ───────────────────────── */}
      <section className="legal-section" id="priv-sec-16">
        <h3 className="legal-section-title">16. Tratamento de dados de crianças e adolescentes</h3>
        <p>
          O produto é destinado exclusivamente a uso profissional B2B no
          contexto de operações de M&amp;A. <strong>O DealFlow BR não é
          dirigido a crianças ou adolescentes</strong>, não coleta
          conscientemente dados pessoais de menores de 18 anos para
          finalidades de marketing ou perfilamento, e não condiciona o acesso
          a quaisquer dados oriundos de fontes públicas que tenham menores
          como titulares.
        </p>
        <p>
          Caso seja identificado o tratamento incidental de dados de
          adolescente em razão de qualidade societária (situação possível em
          empresas familiares), aplicam-se as proteções reforçadas do art.
          14 da LGPD.
        </p>
      </section>

      {/* ───────────────────────── 17 · DECISÕES AUTOMATIZADAS ───────────────────────── */}
      <section className="legal-section" id="priv-sec-17">
        <h3 className="legal-section-title">17. Decisões automatizadas</h3>
        <p>
          O DealFlow BR <strong>não toma decisões unicamente automatizadas
          com efeitos jurídicos sobre o titular</strong> ou que de modo
          significativo afetem seus interesses. As estimativas e
          classificações geradas (receita estimada, archetype, nível de
          confiança) são instrumentos de triagem para análise humana
          subsequente, realizada por profissionais de M&amp;A. A decisão
          comercial — abordar ou não a empresa-alvo, iniciar tratativas,
          firmar carta de intenção — é integralmente humana.
        </p>
        <p>
          Em qualquer hipótese, o titular tem direito à revisão de decisões
          tomadas com base em tratamento automatizado, nos termos do art.
          20 da LGPD.
        </p>
      </section>

      {/* ───────────────────────── 18 · ATUALIZAÇÕES ───────────────────────── */}
      <section className="legal-section" id="priv-sec-18">
        <h3 className="legal-section-title">18. Atualizações desta Política</h3>
        <p>
          Esta Política pode ser revisada periodicamente para refletir
          mudanças regulatórias, operacionais ou de produto. A versão
          vigente está sempre acessível pelo botão "Política de
          Privacidade" no rodapé do produto, com indicação clara da versão
          e da data de vigência.
        </p>
        <p>
          Alterações materiais que ampliem o escopo do tratamento ou
          modifiquem a base legal serão precedidas de comunicação aos
          Usuários ativos por e-mail e/ou aviso destacado na interface do
          produto, com antecedência razoável.
        </p>
      </section>

      {/* ───────────────────────── 19 · LEI E FORO ───────────────────────── */}
      <section className="legal-section" id="priv-sec-19">
        <h3 className="legal-section-title">19. Lei aplicável e foro</h3>
        <p>
          Esta Política é regida pela legislação da República Federativa do
          Brasil, em especial pela Lei nº 13.709/2018 (LGPD), pelo Decreto
          nº 11.107/2022 (estrutura da ANPD), pela Lei nº 12.965/2014 (Marco
          Civil da Internet) e pelas Resoluções da ANPD.
        </p>
        <p>
          Para dirimir quaisquer controvérsias decorrentes desta Política,
          fica eleito o foro da Comarca da Capital do Estado de São Paulo,
          com renúncia expressa a qualquer outro, por mais privilegiado que
          seja, sem prejuízo da competência exclusiva da ANPD para questões
          de sua atribuição.
        </p>
      </section>

      {/* ───────────────────────── 20 · HISTÓRICO ───────────────────────── */}
      <section className="legal-section" id="priv-sec-20">
        <h3 className="legal-section-title">20. Histórico de versões</h3>
        <ul>
          <li>
            <strong>Versão {LEGAL_VERSAO.privacidade}</strong> — vigência{" "}
            {LEGAL_VERSAO.vigencia}. Redação inicial alinhada à LGPD e à
            Resolução CD/ANPD 19/2024.
          </li>
        </ul>
      </section>
    </div>
  );
}
