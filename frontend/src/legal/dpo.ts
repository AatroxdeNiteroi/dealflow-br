/**
 * Identificação do controlador de dados (LGPD art. 5º VI) e do Encarregado
 * pelo tratamento de dados pessoais (LGPD art. 41).
 *
 * ⚠️ PREENCHER antes de qualquer exposição comercial do produto. Os campos
 * abaixo são placeholders — eles aparecem no rodapé do app, nos modais legais
 * e nos `mailto:` de exercício de direitos do titular.
 */

export const CONTROLADOR = {
  /** Razão social ou nome completo do controlador. */
  razao_social: "[NOME DA EMPRESA — preencher]",
  /** CNPJ (ou CPF se PF) — exibido no rodapé. */
  cnpj: "[CNPJ — preencher]",
  /** Endereço para correspondência formal (LGPD/ANPD). */
  endereco: "[Endereço — preencher]",
  /** Site institucional. */
  website: "[https://dealflowbr.com.br — preencher]",
} as const;

/** Encarregado pelo Tratamento de Dados Pessoais (LGPD art. 41). */
export const DPO = {
  nome: "[Nome do Encarregado — preencher]",
  email: "[dpo@dealflowbr.com.br — preencher]",
} as const;

/** Controle de versão dos documentos legais. Incremente a cada revisão. */
export const LEGAL_VERSAO = {
  termos: "1.0 · pendente revisão jurídica",
  privacidade: "1.0 · pendente revisão jurídica",
  /** Data em que a versão atual entrou em vigor (formato pt-BR). */
  vigencia: "14/05/2026",
} as const;

/** Helper para construir mailto:DPO?subject=... padronizado. */
export function dpoMailto(assunto: string): string {
  return `mailto:${DPO.email}?subject=${encodeURIComponent(`LGPD · ${assunto}`)}`;
}
