/**
 * Context global para abrir os modais de Termos de Uso e Política de
 * Privacidade de qualquer ponto do app sem prop-drilling.
 *
 * Uso:
 *   const { openTermos, openPrivacidade } = useLegal();
 *
 * O provider envolve o app em App.tsx e renderiza os dois modais no nível
 * raiz para que apareçam sobre qualquer outro conteúdo.
 */
import { createContext, useContext, useState, type ReactNode } from "react";
import ConsentGate from "../components/Legal/ConsentGate";
import PrivacidadeModal from "../components/Modal/PrivacidadeModal";
import TermosModal from "../components/Modal/TermosModal";

interface LegalCtx {
  openTermos: () => void;
  openPrivacidade: () => void;
}

const LegalContext = createContext<LegalCtx | null>(null);

export function useLegal(): LegalCtx {
  const ctx = useContext(LegalContext);
  if (!ctx) {
    throw new Error("useLegal precisa estar dentro de <LegalProvider>");
  }
  return ctx;
}

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
