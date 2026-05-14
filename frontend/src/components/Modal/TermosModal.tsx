import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { LEGAL_VERSAO } from "../../legal/dpo";
import { TermosContent } from "../../legal/TermosContent";
import { TermosResumo } from "../../legal/TermosResumo";

interface Props {
  open: boolean;
  onClose: () => void;
}

type View = "resumo" | "completo";

export default function TermosModal({ open, onClose }: Props) {
  const [view, setView] = useState<View>("resumo");

  useEffect(() => {
    if (open) setView("resumo");
  }, [open]);

  const titulo = view === "resumo" ? "Termos de Uso" : "Termos de Uso · contrato integral";

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
            className="modal legal-modal"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>

            <div className="legal-body">
              <div className="legal-eyebrow">
                {view === "resumo" ? "Resumo executivo · 2 min" : `Documento integral · versão ${LEGAL_VERSAO.termos} · vigência ${LEGAL_VERSAO.vigencia}`}
              </div>
              <h2 className="legal-title">{titulo}</h2>

              {view === "completo" && (
                <button
                  type="button"
                  className="legal-back-link"
                  onClick={() => setView("resumo")}
                >
                  ← Voltar ao resumo
                </button>
              )}

              {view === "resumo" ? (
                <TermosResumo onAbrirCompleto={() => setView("completo")} />
              ) : (
                <TermosContent />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
