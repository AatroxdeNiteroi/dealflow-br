/**
 * Termos de Uso · Resumo executivo
 *
 * Versão curta, voltada ao profissional M&A. Mostra o essencial antes
 * do contrato integral.
 */

import { DPO } from "./dpo";

interface Props {
  onAbrirCompleto: () => void;
}

export function TermosResumo({ onAbrirCompleto }: Props) {
  return (
    <div className="legal-resumo">
      <p className="legal-resumo-lead">
        Para quê o DealFlow BR existe — e em que limites ele deve ser
        utilizado. Leitura: 2 minutos.
      </p>

      <div className="legal-resumo-block">
        <h4>O que é o DealFlow BR</h4>
        <p>
          Ferramenta de triagem inicial para profissionais de M&amp;A,
          family offices, search funds e fundos de private equity. Reconstrói
          estimativas de receita de sociedades limitadas brasileiras de médio
          porte a partir de fontes públicas oficiais.
        </p>
      </div>

      <div className="legal-resumo-block">
        <h4>O que <em>não</em> é</h4>
        <p>
          Não é auditoria, não é parecer contábil, não é <em>valuation</em>{" "}
          formal, não substitui due diligence. As estimativas carregam
          intervalo de confiança e margem de erro declarados — são insumo
          para sua análise, nunca a análise final.
        </p>
      </div>

      <div className="legal-resumo-block">
        <h4>O que você <strong>pode</strong> fazer</h4>
        <ul>
          <li>Triagem inicial de oportunidades M&amp;A B2B.</li>
          <li>Mapeamento de mercado e construção de tese de investimento.</li>
          <li>
            Comunicação institucional ponto-a-ponto com empresas-alvo, no
            contexto legítimo de uma operação.
          </li>
        </ul>
      </div>

      <div className="legal-resumo-block">
        <h4>O que você <strong>não pode</strong> fazer</h4>
        <ul>
          <li>
            Prospecção em massa para pessoas físicas (telemarketing, e-mail
            blast, SMS, WhatsApp automatizado).
          </li>
          <li>Credit scoring, análise de risco de crédito ou cobrança.</li>
          <li>
            Decisões automatizadas com efeitos sobre o titular (LGPD art. 20).
          </li>
          <li>
            Redistribuir as bases, as estimativas ou as exportações a
            terceiros não vinculados à operação em análise.
          </li>
          <li>Engenharia reversa do modelo ou da metodologia.</li>
          <li>Integrar o produto a serviço concorrente.</li>
        </ul>
      </div>

      <div className="legal-resumo-block">
        <h4>Sobre os contatos das empresas</h4>
        <p>
          Telefones e e-mails vêm do cadastro CNPJ na Receita Federal e
          frequentemente pertencem ao escritório de contabilidade, não à
          empresa-alvo diretamente. Trate-os como ponto de partida sujeito
          a verificação, jamais como canal validado.
        </p>
      </div>

      <div className="legal-resumo-block">
        <h4>Sua responsabilidade</h4>
        <p>
          As decisões comerciais que você tomar — abordar a empresa,
          iniciar tratativas, firmar carta de intenção, fazer oferta — são
          inteiramente suas. Quando o caso pedir, valide as estimativas
          com due diligence formal.
        </p>
      </div>

      <div className="legal-resumo-block">
        <h4>Confidencialidade e propriedade</h4>
        <p>
          O código, a metodologia e as bases derivadas são propriedade
          exclusiva do DealFlow BR. O seu uso da plataforma é mediante
          licença limitada e revogável, descrita no contrato integral.
        </p>
      </div>

      <div className="legal-resumo-cta">
        <button type="button" className="legal-resumo-btn" onClick={onAbrirCompleto}>
          Ler os Termos de Uso completos →
        </button>
        <p className="legal-resumo-cta-hint">
          Versão integral · 24 seções · cláusulas completas de licença,
          proteção de dados, limitação de responsabilidade, foro e demais
          disposições contratuais.
        </p>
      </div>

      <div className="legal-resumo-foot">
        <p>
          Dúvidas sobre estes Termos:{" "}
          <a href={`mailto:${DPO.email}`} className="legal-link">
            {DPO.email}
          </a>
        </p>
      </div>
    </div>
  );
}
