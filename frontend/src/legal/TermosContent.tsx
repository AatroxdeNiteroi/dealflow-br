/**
 * Conteúdo dos Termos de Uso · stub para preenchimento jurídico.
 *
 * ⚠️ ESTE ARQUIVO É PLACEHOLDER. Substitua o texto abaixo pelo documento
 * final redigido por advogado especialista em LGPD/M&A. A estrutura de
 * seções é uma sugestão — ajuste conforme o documento real.
 *
 * O estilo CSS está em `styles/modules/legal.css` (.legal-content).
 * Use as classes `.legal-section`, `.legal-section-title` e markup HTML
 * padrão (h3/p/ul/li/strong/em) para herdar a tipografia do produto.
 */

import { CONTROLADOR, DPO, LEGAL_VERSAO } from "./dpo";

export function TermosContent() {
  return (
    <div className="legal-content">
      <p className="legal-meta">
        Versão {LEGAL_VERSAO.termos} · vigência {LEGAL_VERSAO.vigencia} ·
        controlador {CONTROLADOR.razao_social}
      </p>

      <p className="legal-placeholder-warn">
        <strong>Rascunho — substituir pelo documento final.</strong> Este texto
        existe apenas para reservar o espaço da rota legal. Não constitui
        contrato com o usuário enquanto não for revisado por advogado.
      </p>

      <section className="legal-section">
        <h3 className="legal-section-title">1. Aceitação dos Termos</h3>
        <p>[preencher — declaração de que o uso da plataforma implica concordância com estes termos]</p>
      </section>

      <section className="legal-section">
        <h3 className="legal-section-title">2. Descrição do Serviço</h3>
        <p>[preencher — natureza B2B de inteligência M&amp;A, escopo, limitações]</p>
      </section>

      <section className="legal-section">
        <h3 className="legal-section-title">3. Uso Permitido e Vedado</h3>
        <p>[preencher — restrições importantes: vedar prospecção dirigida a PF, vedar redistribuição, vedar uso para fins discriminatórios, vedar contato em massa não solicitado]</p>
      </section>

      <section className="legal-section">
        <h3 className="legal-section-title">4. Propriedade Intelectual</h3>
        <p>[preencher — titularidade do código, da metodologia e dos resultados gerados]</p>
      </section>

      <section className="legal-section">
        <h3 className="legal-section-title">5. Natureza Estatística das Estimativas</h3>
        <p>[preencher — disclaimer reforçando que estimativas de receita são reconstruções estatísticas a partir de fontes públicas, não substituem auditoria nem due diligence formal]</p>
      </section>

      <section className="legal-section">
        <h3 className="legal-section-title">6. Limitação de Responsabilidade</h3>
        <p>[preencher — limites de responsabilidade do controlador por decisões tomadas com base nas estimativas]</p>
      </section>

      <section className="legal-section">
        <h3 className="legal-section-title">7. Proteção de Dados (LGPD)</h3>
        <p>[preencher ou apontar para a Política de Privacidade]</p>
      </section>

      <section className="legal-section">
        <h3 className="legal-section-title">8. Foro e Lei Aplicável</h3>
        <p>[preencher — jurisdição brasileira, foro de eleição]</p>
      </section>

      <section className="legal-section">
        <h3 className="legal-section-title">9. Contato</h3>
        <p>
          Dúvidas sobre estes Termos: <a href={`mailto:${DPO.email}`} className="legal-link">{DPO.email}</a>
        </p>
      </section>
    </div>
  );
}
