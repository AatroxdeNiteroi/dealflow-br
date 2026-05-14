import { createContext } from "react";

export interface LegalCtx {
  openTermos: () => void;
  openPrivacidade: () => void;
}

export const LegalContext = createContext<LegalCtx | null>(null);
