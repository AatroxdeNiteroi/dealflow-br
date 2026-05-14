import { useContext } from "react";
import { LegalContext } from "./legal-context";

/**
 * Hook para abrir os modais de Termos de Uso e Política de Privacidade
 * de qualquer ponto do app.
 *
 *   const { openTermos, openPrivacidade } = useLegal();
 *
 * Lança erro se chamado fora de <LegalProvider>.
 */
export function useLegal() {
  const ctx = useContext(LegalContext);
  if (!ctx) {
    throw new Error("useLegal precisa estar dentro de <LegalProvider>");
  }
  return ctx;
}
