/**
 * Conteúdo da Política de Privacidade · stub para preenchimento jurídico.
 *
 * ⚠️ ESTE ARQUIVO É PLACEHOLDER. Substitua pelo documento final redigido
 * por advogado especialista em LGPD. A estrutura de seções segue o roteiro
 * típico exigido pela ANPD (art. 9º): controlador, finalidade, base legal,
 * dados tratados, retenção, direitos do titular, transferência internacional,
 * canal do Encarregado.
 *
 * O estilo CSS está em `styles/modules/legal.css` (.legal-content).
 */

import { CONTROLADOR, DPO, LEGAL_VERSAO, dpoMailto } from "./dpo";

export function PrivacidadeContent() {
  return (
    <div className="legal-content">
      <p className="legal-meta">
        Versão {LEGAL_VERSAO.privacidade} · vigência {LEGAL_VERSAO.vigencia} ·
        controlador {CONTROLADOR.razao_social}
      </p>

      <p className="legal-placeholder-warn">
        <strong>Rascunho — substituir pelo documento final.</strong> Esta
        política só passa a ter validade legal após revisão por advogado e
        publicação formal pelo controlador.
      </p>

      <section className="legal-section">
        <h3 className="legal-section-title">1. Controlador e Encarregado</h3>
        <p>
          Controlador: {CONTROLADOR.razao_social} — CNPJ {CONTROLADOR.cnpj}.<br />
          Encarregado pelo Tratamento de Dados (DPO, LGPD art. 41):{" "}
          {DPO.nome} — <a href={`mailto:${DPO.email}`} className="legal-link">{DPO.email}</a>.
        </p>
      </section>

      <section className="legal-section">
        <h3 className="legal-section-title">2. Quais dados tratamos</h3>
        <p>[preencher — categorias de dados pessoais tratados: identificação de sócios PF de Ltdas via RFB (em forma pseudonimizada), dados de contato declarados ao registro empresarial (telefone, email, endereço), notas livres inseridas pelo usuário na watchlist]</p>
      </section>

      <section className="legal-section">
        <h3 className="legal-section-title">3. De onde vêm os dados</h3>
        <p>[preencher — bases públicas oficiais: Receita Federal (Cadastro Nacional da PJ), Ministério do Trabalho (RAIS), IBGE (PIA/PAC/PAS), reunidos via projeto Base dos Dados. Aplicamos pseudonimização antes do uso comercial]</p>
      </section>

      <section className="legal-section">
        <h3 className="legal-section-title">4. Finalidade do tratamento</h3>
        <p>[preencher — finalidade exclusiva de triagem M&amp;A B2B; vedação de uso para marketing direto a PF, scoring de crédito, decisões automatizadas que afetem direitos do titular]</p>
      </section>

      <section className="legal-section">
        <h3 className="legal-section-title">5. Base legal (LGPD art. 7º)</h3>
        <p>[preencher — provavelmente legítimo interesse (art. 7º IX) para dados de sócios extraídos de fonte pública; documentar Avaliação de Legítimo Interesse (LIA) considerando art. 7º §3º (dado de acesso público mantém a finalidade da publicização original)]</p>
      </section>

      <section className="legal-section">
        <h3 className="legal-section-title">6. Compartilhamento</h3>
        <p>[preencher — quais terceiros recebem dados; descrever a integração com Anthropic (AI Search) e que apenas o prompt do usuário é enviado, sem dados de empresas no contexto]</p>
      </section>

      <section className="legal-section">
        <h3 className="legal-section-title">7. Transferência internacional (LGPD art. 33)</h3>
        <p>[preencher — declarar que a funcionalidade "Busca com IA" envia o texto do prompt para servidor da Anthropic localizado nos EUA; garantias contratuais aplicáveis (DPA, SCC ou equivalente); recomendação ao usuário de não incluir dados sensíveis no prompt]</p>
      </section>

      <section className="legal-section">
        <h3 className="legal-section-title">8. Retenção e eliminação</h3>
        <p>[preencher — prazo de retenção das bases derivadas (atualizadas a cada novo snapshot RFB), retenção do cache em memória do backend (vida útil do processo), retenção da watchlist (armazenada localmente no navegador do usuário, sem cópia no servidor)]</p>
      </section>

      <section className="legal-section">
        <h3 className="legal-section-title">9. Direitos do titular (LGPD art. 18)</h3>
        <p>
          O titular pode requisitar: confirmação da existência de tratamento;
          acesso aos dados; correção; anonimização, bloqueio ou eliminação;
          portabilidade; informação sobre uso compartilhado; revogação de
          consentimento; oposição ao tratamento.
        </p>
        <p>
          Canal de exercício:{" "}
          <a href={dpoMailto("exercício de direitos do titular")} className="legal-link">
            {DPO.email}
          </a>
          . Prazo de resposta: 15 dias (art. 19).
        </p>
      </section>

      <section className="legal-section">
        <h3 className="legal-section-title">10. Segurança (LGPD art. 46)</h3>
        <p>[preencher — medidas técnicas e administrativas: pseudonimização de identificadores de PF, armazenamento em ambiente autenticado, rate-limit, audit log, política de acesso]</p>
      </section>

      <section className="legal-section">
        <h3 className="legal-section-title">11. Incidentes (LGPD art. 48)</h3>
        <p>[preencher — procedimento de notificação ao titular e à ANPD em caso de incidente de segurança envolvendo dados pessoais]</p>
      </section>

      <section className="legal-section">
        <h3 className="legal-section-title">12. Atualizações desta política</h3>
        <p>[preencher — política de versionamento e comunicação de mudanças relevantes]</p>
      </section>
    </div>
  );
}
