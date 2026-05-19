import { motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { getAcceptance, isAcceptanceCurrent, setAcceptance } from "../../legal/consent";
import { DPO } from "../../legal/dpo";
import { useLegal } from "../../legal/useLegal";

interface Props {
  children: ReactNode;
}

/**
 * Bloqueia o uso da aplicação até que o Usuário aceite explicitamente
 * Termos de Uso e Política de Privacidade. Persiste a aceitação no
 * navegador (localStorage). Se as versões dos documentos mudarem, o gate
 * reaparece para re-aceitação informada.
 *
 * Posicionado dentro do LegalProvider para que os modais de Termos e
 * Privacidade possam abrir ACIMA do gate (z-index mais alto), permitindo
 * que o Usuário leia o que está aceitando.
 */
export default function ConsentGate({ children }: Props) {
  const [accepted, setAccepted] = useState<boolean>(() =>
    isAcceptanceCurrent(getAcceptance()),
  );
  const [marcaTermos, setMarcaTermos] = useState(false);
  const [marcaPriv, setMarcaPriv] = useState(false);
  const { openTermos, openPrivacidade } = useLegal();

  const podeAceitar = marcaTermos && marcaPriv;

  function handleAceitar() {
    if (!podeAceitar) return;
    setAcceptance();
    setAccepted(true);
  }

  return (
    <>
      {children}
      {!accepted && (
        <motion.div
          className="consent-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.32, ease: "easeOut" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="consent-title"
        >
          <motion.div
            className="consent-card"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.38, ease: "easeOut", delay: 0.05 }}
          >
            <div className="consent-eyebrow">Primeiro acesso · aceitação necessária</div>

            <h1 id="consent-title" className="consent-title">
              Genesis <em>Radar</em>
            </h1>

            <p className="consent-lead">
              Antes de prosseguir, leia e aceite os documentos que regem o
              uso da plataforma e o tratamento de dados. Você pode abri-los
              completos a partir dos links abaixo.
            </p>

            <div className="consent-checks">
              <label className="consent-check">
                <input
                  type="checkbox"
                  checked={marcaTermos}
                  onChange={(e) => setMarcaTermos(e.target.checked)}
                />
                <span className="consent-check-text">
                  Li e aceito os{" "}
                  <button
                    type="button"
                    className="consent-doc-link"
                    onClick={openTermos}
                  >
                    Termos de Uso
                  </button>
                </span>
              </label>

              <label className="consent-check">
                <input
                  type="checkbox"
                  checked={marcaPriv}
                  onChange={(e) => setMarcaPriv(e.target.checked)}
                />
                <span className="consent-check-text">
                  Li e aceito a{" "}
                  <button
                    type="button"
                    className="consent-doc-link"
                    onClick={openPrivacidade}
                  >
                    Política de Privacidade
                  </button>
                </span>
              </label>
            </div>

            <button
              type="button"
              className="consent-cta"
              onClick={handleAceitar}
              disabled={!podeAceitar}
            >
              Aceitar e continuar
              <span className="consent-cta-arrow">→</span>
            </button>

            <p className="consent-foot">
              Plataforma profissional B2B de inteligência M&amp;A — uso
              destinado a corretoras, family offices, search funds e
              fundos de investimento. Dúvidas ou contato com o Encarregado:{" "}
              <a href={`mailto:${DPO.email}`} className="consent-foot-link">
                {DPO.email}
              </a>
            </p>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
