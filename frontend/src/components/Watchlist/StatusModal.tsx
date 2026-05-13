import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  CANAL_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
  type ContatoCanal,
  type ContatoLog,
  type WatchStatus,
} from "../../watchlist/types";

interface Props {
  open: boolean;
  fromStatus: WatchStatus | null;
  toStatus: WatchStatus | null;
  razaoSocial: string;
  onClose: () => void;
  onConfirm: (toStatus: WatchStatus, contato?: ContatoLog) => void;
}

const CANAIS: ContatoCanal[] = ["telefone", "email", "linkedin", "apresentacao", "outro"];

export default function StatusModal({
  open,
  fromStatus,
  toStatus,
  razaoSocial,
  onClose,
  onConfirm,
}: Props) {
  const [canal, setCanal] = useState<ContatoCanal>("telefone");
  const [nota, setNota] = useState("");

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setCanal("telefone");
      setNota("");
    }
  }, [open]);

  if (!open || !toStatus) return null;

  // Só pede canal de contato quando avança de "lead" para "contatado" ou
  // quando explicitamente entra em "contatado". Outras transições são silenciosas.
  const needsContact = toStatus === "contatado" && fromStatus !== "contatado";

  function confirm() {
    if (!toStatus) return;
    if (needsContact) {
      const log: ContatoLog = {
        data: new Date().toISOString(),
        canal,
        nota: nota.trim() || undefined,
      };
      onConfirm(toStatus, log);
    } else {
      onConfirm(toStatus);
    }
  }

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
            className="modal status-modal"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>

            <div className="status-body">
              <div className="status-eyebrow">Mudança de status · pipeline M&amp;A</div>
              <h2 className="status-title">
                {STATUS_LABELS[toStatus]}
              </h2>
              <p className="status-target">{razaoSocial}</p>

              {fromStatus && (
                <div className="status-transition">
                  <span className={`status-chip status-chip--${fromStatus}`}>
                    {STATUS_LABELS[fromStatus]}
                  </span>
                  <span className="status-transition-arrow">→</span>
                  <span className={`status-chip status-chip--${toStatus}`}>
                    {STATUS_LABELS[toStatus]}
                  </span>
                </div>
              )}

              {needsContact && (
                <>
                  <div className="status-section-label">Canal de contato</div>
                  <div className="status-canais">
                    {CANAIS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`status-canal-btn${canal === c ? " status-canal-btn--active" : ""}`}
                        onClick={() => setCanal(c)}
                      >
                        {CANAL_LABELS[c]}
                      </button>
                    ))}
                  </div>

                  <div className="status-section-label">Nota (opcional)</div>
                  <textarea
                    className="status-nota"
                    placeholder="Resumo da conversa · próximo passo · nome do interlocutor"
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    rows={3}
                    maxLength={500}
                  />
                </>
              )}

              <div className="status-actions">
                <button type="button" className="action-btn" onClick={onClose}>
                  Cancelar
                </button>
                <button type="button" className="action-btn primary" onClick={confirm}>
                  Confirmar mudança
                </button>
              </div>

              <div className="status-pipeline-hint">
                Pipeline: {STATUS_ORDER.map((s) => STATUS_LABELS[s]).join(" → ")}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
