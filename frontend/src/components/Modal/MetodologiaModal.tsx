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

            <div className="modal-body" style={{ padding: "44px 48px 36px" }}>
              <div className="metodologia-hero">
                Reconstruímos a contabilidade<br />
                <em>do invisível.</em>
              </div>

              <p className="metodologia-text">
                Empresas privadas no Brasil não declaram faturamento publicamente.
                Bureaus pagos entregam faixas opacas, sem fonte.{" "}
                <strong>Nós fazemos diferente.</strong>
              </p>

              <p className="metodologia-text">
                Cruzamos sete fontes públicas oficiais — registros fiscais,
                vínculos trabalhistas, indicadores produtivos setoriais,
                pesquisas estruturais — e aplicamos uma fórmula auditável
                validada empiricamente contra demonstrações financeiras reais.
              </p>

              <div className="metodologia-pillars">
                <div className="pillar">
                  <div className="step">i.</div>
                  <h5>Identidade</h5>
                  <p>
                    Reconciliamos identificadores fragmentados via chave composta
                    multi-dimensional. Cada empresa do nosso universo passa por
                    teste de unicidade e cascata de coerência.
                  </p>
                </div>
                <div className="pillar">
                  <div className="step">ii.</div>
                  <h5>Operação</h5>
                  <p>
                    Reconstruímos a folha de pagamento a partir de microdados
                    trabalhistas, e a convertemos em receita usando razões
                    setoriais publicadas pelo IBGE em pesquisas anuais.
                  </p>
                </div>
                <div className="pillar">
                  <div className="step">iii.</div>
                  <h5>Auditoria</h5>
                  <p>
                    Cada estimativa carrega proveniência: você sabe de onde vem
                    cada número, qual a margem de erro, qual fonte primária
                    respalda o cálculo. Sem caixa-preta.
                  </p>
                </div>
              </div>

              <p className="metodologia-text" style={{ marginTop: 24, marginBottom: 0 }}>
                Faturamento privado, em luz pública.{" "}
                <span style={{ color: "var(--tan)" }}>
                  Para a metodologia técnica completa, consulte{" "}
                  <code style={{ fontFamily: "var(--f-mono)", fontSize: 12, background: "var(--paper-2)", padding: "2px 6px" }}>
                    docs/architecture.md
                  </code>{" "}
                  no repositório.
                </span>
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
