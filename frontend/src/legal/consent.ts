/**
 * Registro de aceitação dos documentos legais (LGPD art. 8º · forma de
 * comprovação do consentimento contratual + transparência sobre os
 * Termos vinculantes).
 *
 * Persiste no localStorage do navegador a versão dos documentos que o
 * Usuário aceitou e a data/hora. Se a versão atual em `LEGAL_VERSAO`
 * mudar, a aceitação fica "vencida" e o gate é exibido novamente para
 * re-aceitação informada.
 */

import { LEGAL_VERSAO } from "./dpo";

const STORAGE_KEY = "dealflow:legal-accept:v1";

export interface LegalAcceptance {
  /** Versão dos Termos aceita. */
  termos_version: string;
  /** Versão da Privacidade aceita. */
  privacidade_version: string;
  /** Timestamp ISO da aceitação. */
  accepted_at: string;
}

export function getAcceptance(): LegalAcceptance | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.termos_version === "string" &&
      typeof parsed.privacidade_version === "string" &&
      typeof parsed.accepted_at === "string"
    ) {
      return parsed as LegalAcceptance;
    }
    return null;
  } catch {
    return null;
  }
}

export function setAcceptance(): LegalAcceptance {
  const acceptance: LegalAcceptance = {
    termos_version: LEGAL_VERSAO.termos,
    privacidade_version: LEGAL_VERSAO.privacidade,
    accepted_at: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(acceptance));
  }
  return acceptance;
}

/**
 * Verdadeiro quando o registro de aceitação cobre as versões atualmente
 * vigentes dos documentos legais. Útil para forçar re-aceitação quando
 * houver revisão material.
 */
export function isAcceptanceCurrent(a: LegalAcceptance | null): boolean {
  if (!a) return false;
  return (
    a.termos_version === LEGAL_VERSAO.termos &&
    a.privacidade_version === LEGAL_VERSAO.privacidade
  );
}

/** Limpa o registro · útil para testes ou para botão "esquecer aceite". */
export function clearAcceptance(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}
