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
            <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>

            <div className="modal-body modal-body--lg">
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
                Cruzamos múltiplas fontes públicas oficiais — registros
                empresariais, vínculos trabalhistas e pesquisas estruturais
                setoriais — e aplicamos razões oficiais de receita por pessoal
                ocupado para reconstruir o faturamento operacional. O modelo
                é <strong>versionado e validado</strong> contra DRE de S.A. abertas
                comparáveis (erros documentados na metodologia técnica v3.1).
              </p>

              <div className="metodologia-pillars">
                <div className="pillar">
                  <div className="step">i.</div>
                  <h5>Identidade</h5>
                  <p>
                    Reconciliamos sinais fragmentados com chave composta
                    multidimensional. Cada empresa passa por teste de unicidade
                    e cascata de coerência cruzada — o mesmo rigor de uma due
                    diligence formal.
                  </p>
                </div>
                <div className="pillar">
                  <div className="step">ii.</div>
                  <h5>Operação</h5>
                  <p>
                    Reconstruímos a receita a partir de sinais oficiais cruzados
                    e razões setoriais publicadas em pesquisas estruturais
                    oficiais — metodologia técnica versionada e revisável.
                  </p>
                </div>
                <div className="pillar">
                  <div className="step">iii.</div>
                  <h5>Auditoria</h5>
                  <p>
                    Cada estimativa carrega janela de variação explícita,
                    nível de confiança contextual e classe das fontes
                    consultadas — rastreabilidade verificável sem opacidade.
                  </p>
                </div>
              </div>

              <p className="metodologia-closing">
                Inteligência de mercado privado,<br />
                <em>com metodologia auditável.</em>
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
