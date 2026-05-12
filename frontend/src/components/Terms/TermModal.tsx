import { AnimatePresence, motion } from "framer-motion";
import type { TermDef } from "./terms";

interface Props {
  term: TermDef | null;
  onClose: () => void;
}

export default function TermModal({ term, onClose }: Props) {
  return (
    <AnimatePresence>
      {term && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal term-modal"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={onClose}>×</button>

            <div className="term-body">
              {term.eyebrow && <div className="term-eyebrow">{term.eyebrow}</div>}
              <h2 className="term-title">
                <em>{term.title}</em>
              </h2>

              <p className="term-intro">{term.intro}</p>

              {term.criteria && term.criteria.length > 0 && (
                <>
                  <div className="term-section-label">Critérios</div>
                  <dl className="term-criteria">
                    {term.criteria.map((c, i) => (
                      <div key={i} className="term-criterion">
                        <dt>{c.label}</dt>
                        <dd>{c.value}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}

              {term.context && (
                <>
                  <div className="term-section-label">Contexto de uso</div>
                  <p className="term-text">{term.context}</p>
                </>
              )}

              {term.warning && (
                <div className="term-warning">
                  <span className="warning-label">Limitação honesta</span>
                  <p>{term.warning}</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
