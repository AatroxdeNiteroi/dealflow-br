/**
 * Política de Privacidade · Resumo executivo
 *
 * Versão curta, em linguagem acessível ao profissional de M&A. Mostra o
 * essencial antes do documento completo. Não substitui o texto integral —
 * é só a porta de entrada.
 */

import { DPO } from "./dpo";

interface Props {
  onAbrirCompleto: () => void;
}

export function PrivacidadeResumo({ onAbrirCompleto }: Props) {
  return (
    <div className="legal-resumo">
      <p className="legal-resumo-lead">
        O DealFlow BR foi construído sobre bases públicas oficiais do
        Estado brasileiro. Esta página resume como tratamos dados pessoais
        — com integridade e dentro da LGPD. Leitura: 2 minutos.
      </p>

      <div className="legal-resumo-block">
        <h4>O que coletamos</h4>
        <p>
          Cruzamos dados públicos da Receita Federal (CNPJ), da RAIS
          (Ministério do Trabalho) e do IBGE (pesquisas estruturais) para
          estimar receita de sociedades limitadas de médio porte. Não
          coletamos nada diretamente do titular nem fazemos scraping.
        </p>
      </div>

      <div className="legal-resumo-block">
        <h4>Como tratamos sócios pessoa física</h4>
        <p>
          Você nunca verá nome completo nem CPF de sócio no produto.
          Apresentamos apenas <strong>iniciais</strong> (ex.: "J. M. S.").
          O vínculo entre essas iniciais e a pessoa real é pseudonimizado
          criptograficamente, com chave secreta guardada em ambiente
          separado da aplicação.
        </p>
      </div>

      <div className="legal-resumo-block">
        <h4>O que <em>não</em> fazemos</h4>
        <ul>
          <li>Não vendemos, não alugamos, não cedemos dados.</li>
          <li>
            Não compartilhamos com bureaus de crédito, plataformas de
            marketing, redes sociais ou brokers de dados.
          </li>
          <li>
            Não usamos cookies, analytics ou telemetria comportamental.
          </li>
          <li>
            Não tomamos decisões automatizadas que afetem o titular —
            somos ferramenta de triagem para análise humana subsequente.
          </li>
        </ul>
      </div>

      <div className="legal-resumo-block">
        <h4>Sua watchlist é sua</h4>
        <p>
          Empresas que você salva, suas notas e seu histórico de contato
          permanecem armazenados <strong>apenas no seu navegador</strong>,
          jamais nos nossos servidores. Você pode exportar em JSON ou
          apagar tudo a qualquer momento, pelos botões na tela Watchlist.
        </p>
      </div>

      <div className="legal-resumo-block">
        <h4>Busca com IA · transferência internacional</h4>
        <p>
          Quando você usa a funcionalidade <em>Busca com IA</em>, o texto
          que digitar é transmitido para servidores da Anthropic, nos
          Estados Unidos, sob cláusulas contratuais padrão (LGPD art. 33).
          Nenhum dado de empresa ou da sua watchlist é enviado junto.
          Recomendamos não incluir dados sensíveis no prompt.
        </p>
      </div>

      <div className="legal-resumo-block">
        <h4>Base legal</h4>
        <p>
          Tratamos os dados das fontes públicas com fundamento no{" "}
          <strong>legítimo interesse</strong> (LGPD art. 7º, IX), ponderado
          em conjunto com o art. 7º, §3º, que reconhece que dados de acesso
          público mantêm a finalidade da publicização original. Mantemos
          documentada internamente a Avaliação de Legítimo Interesse (LIA).
        </p>
      </div>

      <div className="legal-resumo-block">
        <h4>Seus direitos (LGPD art. 18)</h4>
        <p>
          Você pode, a qualquer tempo, solicitar confirmação de tratamento,
          acesso, correção, eliminação, anonimização, portabilidade ou
          informação sobre compartilhamento dos seus dados. Também pode
          opor-se ao tratamento. Resposta em até 15 dias.
        </p>
        <p>
          Canal:{" "}
          <a href={`mailto:${DPO.email}`} className="legal-link">
            {DPO.email}
          </a>
        </p>
      </div>

      <div className="legal-resumo-cta">
        <button type="button" className="legal-resumo-btn" onClick={onAbrirCompleto}>
          Ler a Política de Privacidade completa →
        </button>
        <p className="legal-resumo-cta-hint">
          Versão integral · 20 seções · cobertura LGPD detalhada e citação
          de todos os dispositivos legais aplicáveis.
        </p>
      </div>
    </div>
  );
}
