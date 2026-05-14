import { AnimatePresence, motion } from "framer-motion";
import { LEGAL_VERSAO } from "../../legal/dpo";
import { PrivacidadeContent } from "../../legal/PrivacidadeContent";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function PrivacidadeModal({ open, onClose }: Props) {
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
              <div className="legal-eyebrow">Documento legal · versão {LEGAL_VERSAO.privacidade}</div>
              <h2 className="legal-title">Política de Privacidade</h2>
              <PrivacidadeContent />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
