import { AnimatePresence, motion } from "framer-motion";
import type { GenusDef } from "./terms";

interface Props {
  genus: GenusDef | null;
  onClose: () => void;
}

export default function GenusModal({ genus, onClose }: Props) {
  return (
    <AnimatePresence>
      {genus && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal genus-modal"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={onClose}>×</button>

            <div className="genus-body">
              <div className="term-eyebrow">{genus.eyebrow}</div>
              <h2 className="term-title">
                <em>{genus.title}</em>
              </h2>
              <p className="term-intro">{genus.intro}</p>

              <div className="genus-species-list">
                {genus.species.map((s, i) => (
                  <section className="genus-species" key={s.title + i}>
                    <header className="genus-species-head">
                      <span className="genus-species-num">
                        {(i + 1).toString().padStart(2, "0")}
                      </span>
                      <h3 className="genus-species-title">
                        <em>{s.title}</em>
                      </h3>
                      {s.eyebrow && (
                        <span className="genus-species-eyebrow">{s.eyebrow}</span>
                      )}
                    </header>
                    <p className="genus-species-intro">{s.intro}</p>

                    {s.criteria && s.criteria.length > 0 && (
                      <dl className="term-criteria genus-criteria">
                        {s.criteria.map((c, j) => (
                          <div key={j} className="term-criterion">
                            <dt>{c.label}</dt>
                            <dd>{c.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}

                    {s.warning && (
                      <div className="term-warning genus-species-warning">
                        <span className="warning-label">Limitação honesta</span>
                        <p>{s.warning}</p>
                      </div>
                    )}
                  </section>
                ))}
              </div>

              {genus.closing && (
                <p className="genus-closing">{genus.closing}</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
