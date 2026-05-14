import { useState, type ReactNode } from "react";
import ConsentGate from "../components/Legal/ConsentGate";
import PrivacidadeModal from "../components/Modal/PrivacidadeModal";
import TermosModal from "../components/Modal/TermosModal";
import { LegalContext } from "./legal-context";

/**
 * Disponibiliza globalmente os modais de Termos e Privacidade + bloqueia
 * o uso no primeiro acesso até a aceitação (ConsentGate).
 *
 * Estrutura:
 *   <LegalContext.Provider>
 *     <ConsentGate>{children}</ConsentGate>   ← bloqueia o produto
 *     <TermosModal />                          ← acima do gate (z 320)
 *     <PrivacidadeModal />                     ← acima do gate (z 320)
 *   </LegalContext.Provider>
 */
export function LegalProvider({ children }: { children: ReactNode }) {
  const [showTermos, setShowTermos] = useState(false);
  const [showPriv, setShowPriv] = useState(false);

  return (
    <LegalContext.Provider
      value={{
        openTermos: () => setShowTermos(true),
        openPrivacidade: () => setShowPriv(true),
      }}
    >
      <ConsentGate>{children}</ConsentGate>
      <TermosModal open={showTermos} onClose={() => setShowTermos(false)} />
      <PrivacidadeModal open={showPriv} onClose={() => setShowPriv(false)} />
    </LegalContext.Provider>
  );
}
