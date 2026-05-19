/**
 * Termos de Uso · DealFlow BR · v1.0
 *
 * Conformidade: LGPD 13.709/18, Marco Civil 12.965/14, Código Civil
 * 10.406/02, Lei do Software 9.609/98, Lei de Direitos Autorais 9.610/98,
 * Lei de Propriedade Industrial 9.279/96, Lei de Arbitragem 9.307/96.
 */

import { CONTROLADOR, DPO, LEGAL_VERSAO, dpoMailto, presente } from "./dpo";
import { LegalTOC, type TOCItem } from "./LegalTOC";

const TERMOS_TOC: TOCItem[] = [
  { id: "termos-sec-1", title: "1. Aceitação dos Termos" },
  { id: "termos-sec-2", title: "2. Definições" },
  { id: "termos-sec-3", title: "3. Descrição do Serviço" },
  { id: "termos-sec-4", title: "4. Cadastro e credenciais" },
  { id: "termos-sec-5", title: "5. Licença de uso" },
  { id: "termos-sec-6", title: "6. Uso permitido" },
  { id: "termos-sec-7", title: "7. Uso vedado" },
  { id: "termos-sec-8", title: "8. Natureza das Estimativas" },
  { id: "termos-sec-9", title: "9. Conteúdo do Usuário" },
  { id: "termos-sec-10", title: "10. Busca com IA" },
  { id: "termos-sec-11", title: "11. Exportações" },
  { id: "termos-sec-12", title: "12. Propriedade intelectual" },
  { id: "termos-sec-13", title: "13. Confidencialidade" },
  { id: "termos-sec-14", title: "14. Proteção de dados (LGPD)" },
  { id: "termos-sec-15", title: "15. Garantias e disclaimers" },
  { id: "termos-sec-16", title: "16. Limitação de responsabilidade" },
  { id: "termos-sec-17", title: "17. Indenização" },
  { id: "termos-sec-18", title: "18. Suspensão e rescisão" },
  { id: "termos-sec-19", title: "19. Modificações" },
  { id: "termos-sec-20", title: "20. Comunicações" },
  { id: "termos-sec-21", title: "21. Cessão e sucessão" },
  { id: "termos-sec-22", title: "22. Disposições gerais" },
  { id: "termos-sec-23", title: "23. Lei aplicável e foro" },
  { id: "termos-sec-24", title: "24. Histórico de versões" },
];

export function TermosContent() {
  const cnpj = presente(CONTROLADOR.cnpj);
  const qualificacaoTitular = cnpj
    ? `${CONTROLADOR.razao_social}, CNPJ ${cnpj}`
    : CONTROLADOR.razao_social;

  return (
    <div className="legal-content">
      <LegalTOC
        version={LEGAL_VERSAO.termos}
        vigencia={LEGAL_VERSAO.vigencia}
        sections={TERMOS_TOC}
      />

      {/* ───────────────────────── 1 · ACEITAÇÃO ───────────────────────── */}
      <section className="legal-section" id="termos-sec-1">
        <h3 className="legal-section-title">1. Aceitação dos Termos</h3>
        <p>
          Estes Termos de Uso ("Termos") regem o acesso e o uso da
          plataforma <strong>DealFlow BR</strong> ("Plataforma" ou
          "Produto"), titularizada por {qualificacaoTitular}{" "}
          ("DealFlow", "nós" ou "Titular").
        </p>
        <p>
          Ao acessar a Plataforma, criar conta, utilizar credenciais de API
          fornecidas ou de qualquer modo utilizar o Produto, o Usuário e o
          Cliente declaram ter lido, compreendido e aceitado integralmente
          estes Termos e a <strong>Política de Privacidade</strong>{" "}
          (acessível pelo rodapé), os quais formam, em conjunto, o contrato
          vinculante entre as partes.
        </p>
        <p>
          Caso o Usuário discorde de qualquer disposição destes Termos,
          deve abster-se de utilizar a Plataforma.
        </p>
        <p>
          A Plataforma destina-se exclusivamente a <strong>uso
          profissional B2B</strong> no contexto de operações de fusões e
          aquisições (M&amp;A). Não constitui produto ou serviço destinado
          ao consumidor final nos termos do art. 2º da Lei nº 8.078/1990
          (CDC), sem prejuízo da aplicação interpretativa de princípios de
          boa-fé objetiva, transparência e equidade contratual.
        </p>
      </section>

      {/* ───────────────────────── 2 · DEFINIÇÕES ───────────────────────── */}
      <section className="legal-section" id="termos-sec-2">
        <h3 className="legal-section-title">2. Definições</h3>
        <ul>
          <li>
            <strong>Plataforma / Produto:</strong> a aplicação web e a API
            DealFlow BR, incluindo todos os seus componentes, bases de
            dados derivadas, metodologia e materiais correlatos.
          </li>
          <li>
            <strong>Cliente:</strong> pessoa jurídica que contrata o acesso
            à Plataforma.
          </li>
          <li>
            <strong>Usuário:</strong> pessoa natural autorizada pelo
            Cliente a acessar a Plataforma, utilizando credenciais
            próprias ou compartilhadas conforme o contrato.
          </li>
          <li>
            <strong>Estimativas:</strong> valores numéricos e qualitativos
            (receita estimada, intervalo, archetype, nível de confiança,
            granularidade do modelo, tier de identidade) produzidos pelo
            modelo proprietário do DealFlow BR a partir de fontes públicas.
          </li>
          <li>
            <strong>Conteúdo do Usuário:</strong> dados inseridos pelo
            Usuário no Produto, incluindo notas livres, histórico de
            contato, anotações da Watchlist e prompts da Busca com IA.
          </li>
          <li>
            <strong>Exportações:</strong> arquivos gerados pelo Usuário a
            partir do Produto (CSV, PDF, JSON da Watchlist).
          </li>
          <li>
            <strong>LGPD:</strong> Lei nº 13.709/2018 — Lei Geral de
            Proteção de Dados Pessoais.
          </li>
          <li>
            <strong>Empresa-alvo:</strong> sociedade limitada (ou figura
            societária equivalente) listada no universo da Plataforma.
          </li>
        </ul>
      </section>

      {/* ───────────────────────── 3 · DESCRIÇÃO DO SERVIÇO ───────────────────────── */}
      <section className="legal-section" id="termos-sec-3">
        <h3 className="legal-section-title">3. Descrição do Serviço</h3>
        <p>
          A Plataforma é uma ferramenta de inteligência de mercado para
          triagem inicial de oportunidades M&amp;A em sociedades limitadas
          brasileiras de médio porte (preferencialmente nos estados do RJ
          e SP). O serviço inclui, entre outras funcionalidades:
        </p>
        <ul>
          <li>
            <strong>Universo curado</strong> de empresas com identidade
            confirmada por chave composta multidimensional sobre registros
            oficiais.
          </li>
          <li>
            <strong>Estimativas de receita</strong> reconstruídas
            estatisticamente a partir de sinais operacionais públicos
            cruzados, com intervalo (low/high), nível de confiança e
            granularidade declarados.
          </li>
          <li>
            <strong>Classificação por archetype</strong> estrutural
            (sucessão familiar, capital intensiva, partnership, startup,
            etc.) com avisos honestos sobre limites do modelo em cada
            categoria.
          </li>
          <li>
            <strong>Filtros e screener</strong> (UF, archetype, receita,
            headcount, idade, capital, confiança, granularidade, número de
            sócios).
          </li>
          <li>
            <strong>Watchlist</strong> com pipeline M&amp;A (Lead →
            Contatado → NDA → DD → Walk-away), notas livres e histórico de
            contato, armazenados localmente no navegador do Usuário.
          </li>
          <li>
            <strong>Mapa de grupo</strong> (sócios em comum) baseado em
            chave pseudonimizada.
          </li>
          <li>
            <strong>Contato oficial</strong> extraído do cadastro CNPJ, com
            avisos sobre uso responsável.
          </li>
          <li>
            <strong>Busca com IA</strong>: tradução de linguagem natural
            para filtros do screener, processada por modelo da Anthropic
            (sub-processador internacional).
          </li>
          <li>
            <strong>Exportações</strong> em CSV (planilha) e PDF (one-pager
            por empresa).
          </li>
        </ul>
      </section>

      {/* ───────────────────────── 4 · CADASTRO ───────────────────────── */}
      <section className="legal-section" id="termos-sec-4">
        <h3 className="legal-section-title">4. Cadastro e credenciais de acesso</h3>
        <p>
          O Cliente contratante é responsável por fornecer informações
          verdadeiras, completas e atualizadas no momento do cadastro e
          por manter atualizadas as informações dos Usuários autorizados.
        </p>
        <p>
          <strong>Credenciais de acesso</strong> (chaves de API, senhas,
          tokens) são pessoais e intransferíveis. O Cliente é integralmente
          responsável pela confidencialidade das credenciais e por todas as
          atividades realizadas em sua conta, ainda que por terceiros,
          incluindo quaisquer consequências decorrentes de uso indevido ou
          de compartilhamento.
        </p>
        <p>
          <strong>Notificação de comprometimento.</strong> O Cliente deve
          comunicar imediatamente o DealFlow ({DPO.email}) ao tomar
          conhecimento de qualquer uso não autorizado de credenciais ou de
          incidente de segurança relacionado à conta.
        </p>
      </section>

      {/* ───────────────────────── 5 · LICENÇA ───────────────────────── */}
      <section className="legal-section" id="termos-sec-5">
        <h3 className="legal-section-title">5. Licença de uso</h3>
        <p>
          Sujeito ao cumprimento integral destes Termos e ao pagamento das
          contraprestações eventualmente devidas, o DealFlow concede ao
          Cliente <strong>licença não exclusiva, intransferível,
          revogável e limitada</strong> de acesso e uso da Plataforma para
          a finalidade descrita na Seção 6, pelo prazo de vigência do
          contrato comercial.
        </p>
        <p>
          Esta licença <strong>não transfere</strong> ao Cliente qualquer
          direito de propriedade sobre o código, a metodologia, as bases de
          dados derivadas, os modelos estatísticos, a documentação técnica
          ou quaisquer outros elementos da Plataforma, os quais permanecem
          como propriedade exclusiva do DealFlow (Seção 11).
        </p>
        <p>
          A licença é restrita ao número de Usuários, volume de
          requisições, ambiente e funcionalidades expressamente
          contratados, e cessa imediatamente nas hipóteses da Seção 17.
        </p>
      </section>

      {/* ───────────────────────── 6 · USO PERMITIDO ───────────────────────── */}
      <section className="legal-section" id="termos-sec-6">
        <h3 className="legal-section-title">6. Uso permitido</h3>
        <p>
          O Cliente e o Usuário comprometem-se a utilizar a Plataforma
          exclusivamente para:
        </p>
        <ul>
          <li>
            <strong>Triagem inicial de oportunidades M&amp;A B2B</strong>,
            tais como mapeamento de mercado, identificação de
            empresas-alvo, priorização de funil de prospecção institucional
            e produção de relatórios internos de tese de investimento.
          </li>
          <li>
            <strong>Análises de inteligência setorial</strong> e estudos
            agregados sobre o universo de empresas coberto.
          </li>
          <li>
            <strong>Comunicação institucional e profissional</strong> com
            empresas-alvo, observados os limites da Seção 7 e da Política
            de Privacidade.
          </li>
        </ul>
      </section>

      {/* ───────────────────────── 7 · USO VEDADO ───────────────────────── */}
      <section className="legal-section" id="termos-sec-7">
        <h3 className="legal-section-title">7. Uso vedado</h3>
        <p>
          É expressamente <strong>vedado</strong> ao Cliente, ao Usuário e
          a qualquer terceiro com acesso à Plataforma ou aos dados dela
          extraídos:
        </p>
        <ol>
          <li>
            <strong>Redistribuir, sublicenciar, vender, alugar ou
            comercializar</strong> a Plataforma, suas bases de dados, seu
            modelo, sua metodologia ou subconjuntos significativos, no todo
            ou em parte, a terceiros não autorizados.
          </li>
          <li>
            <strong>Realizar engenharia reversa</strong>, descompilar,
            desmontar ou tentar derivar o código-fonte, a estrutura
            interna ou as fórmulas da Plataforma, ressalvadas as hipóteses
            expressamente permitidas pelo art. 6º da Lei nº 9.609/1998.
          </li>
          <li>
            <strong>Realizar scraping, crawling, mirroring ou bulk
            download</strong> não autorizado, ou utilizar técnicas que
            sobrecarreguem, danifiquem, sondem vulnerabilidades ou
            interfiram no funcionamento normal da Plataforma.
          </li>
          <li>
            <strong>Contornar mecanismos de segurança</strong>, autenticação,
            rate-limit, audit log ou controles de acesso.
          </li>
          <li>
            <strong>Utilizar dados pessoais extraídos do Produto para
            qualquer finalidade discriminatória</strong>, nos termos do art.
            6º, IX, da LGPD, ou que envolva tratamento de dados sensíveis
            (art. 11 da LGPD).
          </li>
          <li>
            <strong>Realizar prospecção de pessoas naturais</strong>{" "}
            (telemarketing, e-mail marketing, SMS, WhatsApp ou qualquer
            outro canal) com base em dados extraídos do Produto, ressalvada
            a comunicação institucional, ponto-a-ponto, dirigida à
            empresa-alvo no contexto legítimo de M&amp;A e respeitando a
            recusa do destinatário.
          </li>
          <li>
            <strong>Utilizar os dados para credit scoring, análise de
            risco de crédito, cobrança ou recuperação de crédito</strong>.
          </li>
          <li>
            <strong>Tomar decisões automatizadas com efeitos sobre
            titulares</strong>, especialmente as destinadas a definir perfil
            pessoal, profissional, de consumo, de crédito ou aspectos da
            personalidade (LGPD art. 20).
          </li>
          <li>
            <strong>Inserir, na Watchlist ou no prompt da Busca com IA,
            dados pessoais sensíveis</strong> de qualquer pessoa (saúde,
            origem racial ou étnica, convicção religiosa, opinião política,
            filiação sindical, vida sexual, dado biométrico ou genético).
          </li>
          <li>
            <strong>Integrar a Plataforma a produto concorrente</strong> ou
            utilizá-la para desenvolver, treinar ou aprimorar serviços que
            disputem mercado com o DealFlow BR.
          </li>
          <li>
            <strong>Remover, alterar ou ocultar avisos de propriedade
            intelectual</strong>, marcas, rodapés ou demais indicações
            constantes da Plataforma e das Exportações.
          </li>
          <li>
            <strong>Utilizar a Plataforma em violação a qualquer norma
            aplicável</strong>, incluindo, sem limitação, LGPD, Marco Civil
            da Internet, legislação consumerista, anticorrupção,
            antitruste, lavagem de dinheiro e sanções internacionais.
          </li>
        </ol>
        <p>
          O descumprimento de quaisquer dessas vedações constitui infração
          grave, autorizando a suspensão imediata do acesso (Seção 17) e
          podendo ensejar responsabilização cível, criminal e regulatória,
          além do dever de indenizar (Seção 16).
        </p>
      </section>

      {/* ───────────────────────── 8 · NATUREZA DAS ESTIMATIVAS ───────────────────────── */}
      <section className="legal-section" id="termos-sec-8">
        <h3 className="legal-section-title">8. Natureza estatística das Estimativas · limites metodológicos</h3>
        <p>
          As <strong>Estimativas produzidas pela Plataforma são, por
          natureza, reconstruções estatísticas</strong> a partir de fontes
          públicas oficiais (Receita Federal, RAIS, IBGE). Não constituem,
          em nenhuma hipótese:
        </p>
        <ul>
          <li>
            Demonstrações financeiras auditadas da empresa-alvo;
          </li>
          <li>Pareceres contábeis ou de auditoria independente;</li>
          <li>Substituto de due diligence formal (financeira, tributária, trabalhista, regulatória, ambiental ou jurídica);</li>
          <li>Avaliação (valuation) para fins de operação societária;</li>
          <li>Análise de risco de crédito ou avaliação patrimonial.</li>
        </ul>
        <p>
          O Cliente reconhece e aceita que:
        </p>
        <ul>
          <li>
            As Estimativas carregam <strong>intervalos de confiança e
            margens de erro</strong> declarados na interface do Produto e na
            metodologia técnica (documento de arquitetura, atualmente em
            versão v3.1).
          </li>
          <li>
            A precisão das Estimativas <strong>varia por setor, porte e
            arquétipo</strong>, sendo conhecidamente menos robusta em
            setores com remuneração predominantemente fora do regime CLT
            (TI, consultoria, atividades financeiras), em empresas
            multi-planta e em setores dominados por grandes players
            capital-intensivos.
          </li>
          <li>
            A validade das Estimativas é diretamente proporcional à
            atualidade dos snapshots das bases públicas. A defasagem
            estrutural da RAIS pode chegar a 12-18 meses em relação ao
            momento corrente.
          </li>
          <li>
            Quaisquer <strong>decisões comerciais, de investimento ou de
            qualquer outra natureza</strong> tomadas com base nas
            Estimativas são de responsabilidade exclusiva do Cliente e do
            Usuário, devendo ser sempre precedidas e/ou validadas por
            análise humana qualificada e, quando o caso, por due diligence
            formal.
          </li>
        </ul>
      </section>

      {/* ───────────────────────── 9 · CONTEÚDO DO USUÁRIO ───────────────────────── */}
      <section className="legal-section" id="termos-sec-9">
        <h3 className="legal-section-title">9. Conteúdo do Usuário (Watchlist)</h3>
        <p>
          O Conteúdo do Usuário inserido na Watchlist (notas livres,
          histórico de contato, anotações) é armazenado <strong>localmente
          no navegador do Usuário</strong> (localStorage), sem cópia nos
          servidores do DealFlow. O Usuário é integralmente responsável
          pelo Conteúdo que insere e pelas finalidades a que o destina.
        </p>
        <p>
          O Usuário compromete-se a:
        </p>
        <ul>
          <li>
            Não inserir dados pessoais sensíveis nem dados de menores;
          </li>
          <li>
            Não inserir conteúdo difamatório, ilícito ou que viole
            direitos de terceiros;
          </li>
          <li>
            Manter cópia de segurança própria de Conteúdo cuja preservação
            lhe seja relevante, ciente de que a limpeza do navegador, a
            troca de dispositivo ou a desinstalação do navegador implicará
            perda local do Conteúdo.
          </li>
        </ul>
        <p>
          O Produto oferece, na própria interface, as funcionalidades de
          <strong> exportação (JSON)</strong> e de <strong>eliminação
          integral</strong> do conteúdo da Watchlist, em atenção aos
          direitos do titular nos termos do art. 18, V e VI, da LGPD.
        </p>
      </section>

      {/* ───────────────────────── 10 · AI SEARCH ───────────────────────── */}
      <section className="legal-section" id="termos-sec-10">
        <h3 className="legal-section-title">10. Funcionalidade "Busca com IA"</h3>
        <p>
          A funcionalidade <strong>Busca com IA</strong> traduz texto livre
          digitado pelo Usuário em filtros estruturados do screener,
          utilizando modelo de linguagem da Anthropic, PBC (Claude).
        </p>
        <p>
          Ao utilizá-la, o Usuário <strong>autoriza expressamente</strong>{" "}
          a transmissão do texto digitado para servidores da Anthropic
          localizados nos Estados Unidos da América, nos termos do art. 33
          da LGPD e da Resolução CD/ANPD nº 19/2024 (transferência
          internacional com cláusulas contratuais padrão).
        </p>
        <p>
          O Usuário compromete-se a <strong>não incluir</strong>, no texto
          do prompt: (i) dados pessoais sensíveis (LGPD art. 5º, II);
          (ii) dados de menores; (iii) informações confidenciais de
          terceiros que não tenham autorização de compartilhamento; (iv)
          credenciais, senhas, chaves de API ou segredos.
        </p>
        <p>
          As respostas geradas pela IA são, por natureza, probabilísticas
          e podem conter imprecisões. Cabe ao Usuário avaliar e validar a
          tradução do prompt antes de aplicar os filtros sugeridos.
        </p>
      </section>

      {/* ───────────────────────── 11 · EXPORTAÇÕES ───────────────────────── */}
      <section className="legal-section" id="termos-sec-11">
        <h3 className="legal-section-title">11. Exportações (CSV, PDF, JSON)</h3>
        <p>
          As Exportações são fornecidas <strong>exclusivamente para uso
          interno do Cliente e do Usuário</strong> no contexto de operações
          de M&amp;A B2B legítimas.
        </p>
        <p>
          O Cliente e o Usuário comprometem-se a:
        </p>
        <ul>
          <li>
            <strong>Não redistribuir</strong> as Exportações a terceiros não
            vinculados à operação M&amp;A específica em análise.
          </li>
          <li>
            <strong>Preservar</strong> todos os avisos de propriedade, rodapés
            e indicações de origem ("DealFlow BR · não substitui due
            diligence formal").
          </li>
          <li>
            <strong>Tratar os dados de contato</strong> contidos nas
            Exportações como ponto de partida sujeito a verificação, e não
            como canal validado, em respeito à advertência exibida no Produto.
          </li>
          <li>
            <strong>Não utilizar</strong> as Exportações para qualquer das
            finalidades vedadas na Seção 7.
          </li>
        </ul>
      </section>

      {/* ───────────────────────── 12 · PI ───────────────────────── */}
      <section className="legal-section" id="termos-sec-12">
        <h3 className="legal-section-title">12. Propriedade intelectual</h3>
        <p>
          Todos os direitos sobre a Plataforma — incluindo, sem limitação,
          código-fonte, código objeto, documentação técnica, metodologia,
          modelos estatísticos, bases de dados derivadas, marcas
          (registradas ou em curso de registro), nome de domínio, design,
          interface, fluxos de produto, materiais visuais e quaisquer
          outros elementos — são de titularidade exclusiva do DealFlow,
          protegidos pela Lei nº 9.610/1998 (Direitos Autorais), pela Lei
          nº 9.609/1998 (Software), pela Lei nº 9.279/1996 (Propriedade
          Industrial) e por tratados internacionais aplicáveis.
        </p>
        <p>
          Estes Termos não transferem ao Cliente qualquer direito de
          propriedade intelectual, ressalvada a licença limitada de uso
          descrita na Seção 5.
        </p>
        <p>
          As <strong>Estimativas</strong> e os <strong>relatórios</strong>{" "}
          gerados pelo Produto, na medida em que constituam obra derivada
          do modelo proprietário do DealFlow, permanecem como propriedade
          intelectual do Titular, sendo concedida ao Cliente licença de
          uso interno conforme as Seções 5, 6 e 11.
        </p>
        <p>
          As <strong>marcas, logotipos e identidade visual</strong> do
          DealFlow não podem ser utilizados pelo Cliente sem autorização
          escrita prévia, ressalvada menção factual em apresentações
          institucionais que indiquem a fonte das Estimativas.
        </p>
      </section>

      {/* ───────────────────────── 13 · CONFIDENCIALIDADE ───────────────────────── */}
      <section className="legal-section" id="termos-sec-13">
        <h3 className="legal-section-title">13. Confidencialidade</h3>
        <p>
          As partes obrigam-se a manter sob estrita confidencialidade
          quaisquer informações não públicas a que tenham acesso em razão
          do contrato, incluindo, no caso do Cliente, a <strong>metodologia
          técnica detalhada, os parâmetros internos do modelo, as
          credenciais de acesso e as informações comerciais do
          DealFlow</strong>; e, no caso do DealFlow, as informações
          comerciais sensíveis do Cliente eventualmente compartilhadas no
          curso da relação.
        </p>
        <p>
          A obrigação de confidencialidade subsiste por <strong>5 (cinco)
          anos</strong> após o término da relação contratual,
          independentemente do motivo de encerramento.
        </p>
      </section>

      {/* ───────────────────────── 14 · LGPD ───────────────────────── */}
      <section className="legal-section" id="termos-sec-14">
        <h3 className="legal-section-title">14. Proteção de dados pessoais (LGPD)</h3>
        <p>
          O tratamento de dados pessoais realizado pelo DealFlow no âmbito
          da Plataforma é integralmente disciplinado pela{" "}
          <strong>Política de Privacidade</strong> (acessível pelo rodapé do
          Produto), que constitui parte integrante destes Termos.
        </p>
        <p>
          O Cliente, ao utilizar a Plataforma, assume a posição de{" "}
          <strong>controlador conjunto ou operador independente</strong> dos
          dados pessoais que extrair do Produto e inserir em sistemas
          próprios, sendo responsável por:
        </p>
        <ul>
          <li>
            Definir base legal própria para o tratamento subsequente,
            documentar Avaliação de Legítimo Interesse (LIA) quando
            aplicável, e prestar contas aos titulares;
          </li>
          <li>
            Adotar medidas técnicas e administrativas de segurança
            adequadas à natureza dos dados;
          </li>
          <li>
            Atender requisições de titulares relativas ao tratamento
            realizado em seus sistemas;
          </li>
          <li>
            Comunicar incidentes de segurança envolvendo dados extraídos
            do Produto ao DealFlow e à ANPD, quando exigível.
          </li>
        </ul>
        <p>
          Nas situações em que ambas as partes figurem como controladores
          em relação aos mesmos titulares, comprometem-se a cooperar
          mutuamente para o cumprimento de obrigações decorrentes da LGPD.
        </p>
      </section>

      {/* ───────────────────────── 15 · DISCLAIMERS ───────────────────────── */}
      <section className="legal-section" id="termos-sec-15">
        <h3 className="legal-section-title">15. Garantias e disclaimers</h3>
        <p>
          A Plataforma é fornecida <strong>"no estado em que se encontra"
          (as-is)</strong>, com as funcionalidades disponíveis em cada
          momento. Sem prejuízo das obrigações expressamente assumidas
          nestes Termos e na Política de Privacidade, o DealFlow{" "}
          <strong>não garante</strong>:
        </p>
        <ul>
          <li>
            Que a Plataforma estará disponível de forma ininterrupta ou
            isenta de erros, bugs, falhas ou indisponibilidades temporárias
            (manutenção programada, contingências de provedores de
            infraestrutura ou eventos de força maior).
          </li>
          <li>
            Exatidão, completude ou atualidade absoluta das Estimativas,
            que são, por natureza, aproximações estatísticas (Seção 8).
          </li>
          <li>
            Adequação a finalidade específica do Cliente diversa daquela
            descrita na Seção 6.
          </li>
          <li>
            Resultados comerciais decorrentes do uso da Plataforma
            (geração de leads, conversão, retorno sobre investimento).
          </li>
        </ul>
        <p>
          Eventuais <strong>indicadores de SLA, suporte e disponibilidade</strong>{" "}
          serão objeto de contrato comercial específico.
        </p>
      </section>

      {/* ───────────────────────── 16 · LIMITAÇÃO DE RESPONSABILIDADE ───────────────────────── */}
      <section className="legal-section" id="termos-sec-16">
        <h3 className="legal-section-title">16. Limitação de responsabilidade</h3>
        <p>
          Na máxima extensão permitida pela legislação aplicável, e
          ressalvadas as hipóteses previstas no parágrafo final desta
          Seção, a responsabilidade total e agregada do DealFlow perante o
          Cliente, decorrente ou relacionada a estes Termos, ao uso ou à
          impossibilidade de uso da Plataforma, qualquer que seja a teoria
          jurídica invocada (contratual, extracontratual, objetiva), fica
          limitada ao <strong>valor efetivamente pago pelo Cliente ao
          DealFlow nos 12 (doze) meses anteriores</strong> ao fato gerador
          da reclamação.
        </p>
        <p>
          Em nenhuma hipótese o DealFlow responderá por:
        </p>
        <ul>
          <li>
            <strong>Danos indiretos, lucros cessantes, perda de chance,
            perda de receita ou danos morais</strong>, ainda que advertido
            da possibilidade de sua ocorrência;
          </li>
          <li>
            Decisões tomadas pelo Cliente ou pelo Usuário com base nas
            Estimativas (Seção 8);
          </li>
          <li>
            Uso indevido das credenciais de acesso por culpa do Cliente
            ou de seus Usuários (Seção 4);
          </li>
          <li>
            Conteúdo do Usuário (Seção 9) ou consequências decorrentes de
            sua manipulação fora da Plataforma;
          </li>
          <li>
            Indisponibilidade de serviços de terceiros sub-processadores
            (Anthropic, provedores de infraestrutura) cujo controle escape
            ao DealFlow;
          </li>
          <li>
            Eventos de força maior, caso fortuito ou fato exclusivo de
            terceiro.
          </li>
        </ul>
        <p>
          <strong>Ressalvas.</strong> As limitações desta Seção{" "}
          <strong>não se aplicam</strong> a (i) violações dolosas de
          obrigações de proteção de dados (LGPD); (ii) violações dolosas de
          obrigações de confidencialidade; (iii) violações dolosas de
          direitos de propriedade intelectual; (iv) responsabilidade
          decorrente de dolo ou má-fé.
        </p>
      </section>

      {/* ───────────────────────── 17 · INDENIZAÇÃO ───────────────────────── */}
      <section className="legal-section" id="termos-sec-17">
        <h3 className="legal-section-title">17. Indenização</h3>
        <p>
          O Cliente compromete-se a defender, indenizar e manter o DealFlow,
          seus sócios, administradores, empregados, prepostos e
          sub-processadores indenes de quaisquer reclamações, ações,
          procedimentos, perdas, danos, custas e honorários advocatícios
          decorrentes de:
        </p>
        <ul>
          <li>
            Uso da Plataforma pelo Cliente ou por seus Usuários em
            desconformidade com estes Termos ou com a legislação aplicável,
            em especial as vedações da Seção 7;
          </li>
          <li>
            Tratamento de dados extraídos do Produto pelo Cliente em
            desconformidade com a LGPD;
          </li>
          <li>
            Violação de direitos de terceiros (privacidade, propriedade
            intelectual, honra) decorrente de ação ou omissão do Cliente
            ou de seu Usuário;
          </li>
          <li>
            Inveracidade de declarações prestadas no cadastro ou
            informações falsas fornecidas ao DealFlow.
          </li>
        </ul>
      </section>

      {/* ───────────────────────── 18 · SUSPENSÃO E RESCISÃO ───────────────────────── */}
      <section className="legal-section" id="termos-sec-18">
        <h3 className="legal-section-title">18. Suspensão e rescisão</h3>
        <p>
          O DealFlow poderá <strong>suspender imediatamente</strong> o
          acesso do Cliente ou de Usuário específico, sem prévio aviso,
          quando:
        </p>
        <ul>
          <li>
            Houver indício razoável de violação às vedações da Seção 7;
          </li>
          <li>
            Houver indício de comprometimento de credenciais ou de uso
            fraudulento;
          </li>
          <li>
            For necessário para preservar a segurança da Plataforma ou de
            terceiros;
          </li>
          <li>
            For necessário para cumprir ordem judicial ou de autoridade
            competente;
          </li>
          <li>
            Houver inadimplência superior a 30 dias.
          </li>
        </ul>
        <p>
          A <strong>rescisão</strong> do contrato pode ser:
        </p>
        <ul>
          <li>
            <strong>Imotivada</strong>: por qualquer das partes, mediante
            aviso prévio escrito de 30 dias.
          </li>
          <li>
            <strong>Motivada</strong>: imediata, no caso de violação
            material destes Termos não sanada em 10 dias após notificação
            escrita.
          </li>
        </ul>
        <p>
          Em qualquer hipótese de rescisão, o Cliente compromete-se a
          cessar imediatamente o uso da Plataforma, excluir cópias locais
          de dados extraídos cujo prazo de retenção próprio tenha
          expirado, e cumprir as obrigações remanescentes (confidencialidade,
          LGPD, indenização), que sobrevivem à rescisão.
        </p>
      </section>

      {/* ───────────────────────── 19 · MODIFICAÇÕES ───────────────────────── */}
      <section className="legal-section" id="termos-sec-19">
        <h3 className="legal-section-title">19. Modificações ao Serviço e aos Termos</h3>
        <p>
          O DealFlow reserva-se o direito de modificar, evoluir,
          descontinuar ou substituir funcionalidades da Plataforma a
          qualquer tempo, observada a boa-fé contratual e a comunicação
          razoável de alterações materiais.
        </p>
        <p>
          Estes Termos podem ser revisados periodicamente. A versão vigente
          estará sempre acessível pelo rodapé do Produto, com indicação
          clara de versão e data de vigência. Alterações materiais serão
          comunicadas aos Clientes ativos com antecedência razoável.
          A continuidade do uso após a entrada em vigor da nova versão
          implica aceitação tácita das modificações.
        </p>
      </section>

      {/* ───────────────────────── 20 · COMUNICAÇÕES ───────────────────────── */}
      <section className="legal-section" id="termos-sec-20">
        <h3 className="legal-section-title">20. Comunicações</h3>
        <p>
          As comunicações entre as partes serão consideradas válidas e
          eficazes quando enviadas:
        </p>
        <ul>
          <li>
            <strong>Pelo DealFlow ao Cliente:</strong> ao e-mail
            cadastrado, aviso destacado na interface da Plataforma ou
            correspondência ao endereço informado.
          </li>
          <li>
            <strong>Pelo Cliente ao DealFlow:</strong> aos canais oficiais
            informados nestes Termos, em especial {DPO.email} para
            assuntos relacionados a proteção de dados.
          </li>
        </ul>
      </section>

      {/* ───────────────────────── 21 · CESSÃO ───────────────────────── */}
      <section className="legal-section" id="termos-sec-21">
        <h3 className="legal-section-title">21. Cessão e sucessão</h3>
        <p>
          O Cliente <strong>não poderá ceder</strong>, total ou parcialmente,
          os direitos e obrigações destes Termos a terceiros sem
          consentimento prévio e escrito do DealFlow.
        </p>
        <p>
          O DealFlow poderá ceder estes Termos, no todo ou em parte, em
          razão de reorganização societária (fusão, incorporação, cisão,
          aquisição de controle), mediante comunicação ao Cliente.
        </p>
      </section>

      {/* ───────────────────────── 22 · DISPOSIÇÕES GERAIS ───────────────────────── */}
      <section className="legal-section" id="termos-sec-22">
        <h3 className="legal-section-title">22. Disposições gerais</h3>
        <p>
          <strong>Integralidade.</strong> Estes Termos, em conjunto com a
          Política de Privacidade e com eventual contrato comercial
          específico, constituem o acordo integral entre as partes a
          respeito da matéria, prevalecendo sobre quaisquer entendimentos
          ou comunicações anteriores.
        </p>
        <p>
          <strong>Divisibilidade.</strong> A invalidade ou inexequibilidade
          de qualquer disposição não afetará a validade e a exequibilidade
          das demais, que permanecerão em pleno vigor.
        </p>
        <p>
          <strong>Tolerância.</strong> A tolerância de qualquer das partes
          ao descumprimento de qualquer obrigação pela outra parte não
          constituirá renúncia, novação ou alteração contratual.
        </p>
        <p>
          <strong>Força maior.</strong> Nenhuma das partes responderá por
          descumprimento decorrente de força maior ou caso fortuito (CC
          art. 393), incluindo, mas não limitado a, indisponibilidade de
          provedores de infraestrutura, eventos sismológicos, pandemias,
          determinações governamentais e ataques cibernéticos de grande
          escala originados de terceiros.
        </p>
        <p>
          <strong>Relação independente.</strong> Estes Termos não criam
          qualquer relação de mandato, sociedade, joint venture, vínculo
          empregatício, agência ou franquia entre as partes.
        </p>
      </section>

      {/* ───────────────────────── 23 · LEI E FORO ───────────────────────── */}
      <section className="legal-section" id="termos-sec-23">
        <h3 className="legal-section-title">23. Lei aplicável e foro</h3>
        <p>
          Estes Termos são regidos pela <strong>legislação da República
          Federativa do Brasil</strong>.
        </p>
        <p>
          Fica eleito o foro da <strong>Comarca da Capital do Estado de São
          Paulo</strong> para dirimir quaisquer controvérsias decorrentes
          destes Termos, com renúncia expressa a qualquer outro, por mais
          privilegiado que seja, ressalvadas as hipóteses de competência
          absoluta da Autoridade Nacional de Proteção de Dados (ANPD) e do
          Poder Judiciário em matéria reservada.
        </p>
        <p>
          As partes poderão, alternativamente e de comum acordo, submeter
          a controvérsia à <strong>mediação ou arbitragem</strong> (Lei nº
          9.307/1996), na forma e perante câmara que vierem a escolher.
        </p>
      </section>

      {/* ───────────────────────── 24 · HISTÓRICO ───────────────────────── */}
      <section className="legal-section" id="termos-sec-24">
        <h3 className="legal-section-title">24. Histórico de versões</h3>
        <ul>
          <li>
            <strong>Versão {LEGAL_VERSAO.termos}</strong> — vigência{" "}
            {LEGAL_VERSAO.vigencia}. Redação inicial alinhada à LGPD, Marco
            Civil, Código Civil, Lei de Software e Lei de Direitos Autorais.
          </li>
        </ul>
        <p>
          <strong>Contato:</strong> dúvidas sobre estes Termos podem ser
          encaminhadas a{" "}
          <a href={dpoMailto("dúvidas sobre Termos de Uso")} className="legal-link">
            {DPO.email}
          </a>.
        </p>
      </section>
    </div>
  );
}
