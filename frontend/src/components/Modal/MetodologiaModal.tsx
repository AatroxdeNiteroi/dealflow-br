import { AnimatePresence, motion } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function MetodologiaModal({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={onClose}>×</button>

            <div className="modal-body" style={{ padding: "48px 56px 40px" }}>
              <div className="metodologia-hero">
                Reconstruímos a contabilidade<br />
                <em>do invisível.</em>
              </div>

              <p className="metodologia-text">
                Empresas privadas no Brasil não declaram faturamento publicamente —
                é proteção legal por sigilo fiscal. Consultorias de inteligência de
                mercado entregam estimativas em faixas opacas, sem proveniência
                verificável.
              </p>

              <div className="metodologia-statement">
                Nós fazemos diferente.
              </div>

              <p className="metodologia-text">
                Aplicamos os mesmos métodos analíticos auditáveis utilizados pela
                elite do mercado financeiro — <strong>bancos de investimento</strong>,
                fundos de private equity, equipes de due diligence M&amp;A — para
                reconstruir a contabilidade operacional de empresas fechadas. Cruzamos
                diversas fontes públicas oficiais, e aplicamos um modelo validado
                contra demonstrações financeiras auditadas.
              </p>

              <div className="metodologia-pillars">
                <div className="pillar">
                  <div className="step">i.</div>
                  <h5>Identidade</h5>
                  <p>
                    Reconciliamos identificadores fragmentados com chave composta
                    multidimensional. Cada empresa passa por teste de unicidade e
                    cascata de verificação cruzada — o mesmo rigor de uma due
                    diligence formal.
                  </p>
                </div>
                <div className="pillar">
                  <div className="step">ii.</div>
                  <h5>Operação</h5>
                  <p>
                    Reconstruímos a folha de pagamento a partir de microdados
                    trabalhistas oficiais. Convertemos em receita usando razões
                    setoriais publicadas pelo IBGE — o padrão metodológico de equity
                    research e fundos quantitativos.
                  </p>
                </div>
                <div className="pillar">
                  <div className="step">iii.</div>
                  <h5>Auditoria</h5>
                  <p>
                    Cada estimativa carrega proveniência completa. Você sabe a fonte
                    primária de cada número, sua margem de erro e o método
                    estatístico aplicado. Transparência institucional, sem
                    caixa-preta.
                  </p>
                </div>
              </div>

              <p className="metodologia-closing">
                Inteligência de mercado privado,<br />
                <em>com rigor institucional.</em>
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
