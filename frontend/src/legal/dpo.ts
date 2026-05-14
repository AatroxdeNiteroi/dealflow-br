/**
 * Identificação do controlador de dados (LGPD art. 5º VI) e do Encarregado
 * pelo tratamento de dados pessoais (LGPD art. 41).
 *
 * Atualize os valores abaixo com os dados oficiais da pessoa jurídica
 * que controla o produto. Onde estiver vazio (""), o documento legal
 * suprime a linha automaticamente.
 */

export const CONTROLADOR = {
  /** Razão social ou nome fantasia exibido como controlador. */
  razao_social: "DealFlow BR",
  /** CNPJ — formato 00.000.000/0000-00. Deixe vazio se ainda não registrado. */
  cnpj: "",
  /** Endereço completo para correspondência formal (LGPD/ANPD). */
  endereco: "",
  /** Site institucional. */
  website: "",
} as const;

/** Encarregado pelo Tratamento de Dados Pessoais (LGPD art. 41). */
export const DPO = {
  nome: "Encarregado de Proteção de Dados · DealFlow BR",
  email: "privacidade@dealflowbr.com.br",
} as const;

/** Controle de versão dos documentos legais. Incremente a cada revisão. */
export const LEGAL_VERSAO = {
  termos: "1.0",
  privacidade: "1.0",
  /** Data em que a versão atual entrou em vigor (formato pt-BR). */
  vigencia: "14 de maio de 2026",
} as const;

/** Helper para construir mailto:DPO?subject=... padronizado. */
export function dpoMailto(assunto: string): string {
  return `mailto:${DPO.email}?subject=${encodeURIComponent(`LGPD · ${assunto}`)}`;
}

/**
 * Retorna o valor se preenchido (não-vazio e não-placeholder),
 * ou null para suprimir a linha do documento.
 */
export function presente(valor: string): string | null {
  if (!valor) return null;
  const v = valor.trim();
  if (!v || v.startsWith("[")) return null;
  return v;
}
