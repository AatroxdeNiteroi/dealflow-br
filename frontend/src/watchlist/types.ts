import type { Empresa } from "../api/client";

export type WatchStatus = "lead" | "contatado" | "nda" | "dd" | "walk_away";

export type ContatoCanal = "telefone" | "email" | "linkedin" | "apresentacao" | "outro";

export interface ContatoLog {
  data: string;        // ISO date
  canal: ContatoCanal;
  nota?: string;
}

export interface WatchEntry {
  // Snapshot dos campos relevantes (não dependemos do backend pra renderizar a lista)
  cnpj: string;
  razao_social: string;
  sigla_uf: string;
  cnae_secao: string;
  archetype: string;
  confidence: string;
  receita_point_brl: number | null;
  headcount: number;

  // Workflow
  status: WatchStatus;
  notas: string;
  contatos: ContatoLog[];

  // Auditoria
  added_at: string;   // ISO timestamp
  updated_at: string; // ISO timestamp
}

export function snapshotFromEmpresa(e: Empresa): Omit<WatchEntry, "status" | "notas" | "contatos" | "added_at" | "updated_at"> {
  return {
    cnpj: e.cnpj,
    razao_social: e.razao_social,
    sigla_uf: e.sigla_uf,
    cnae_secao: e.cnae_secao,
    archetype: e.archetype,
    confidence: e.confidence,
    receita_point_brl: e.receita_point_brl,
    headcount: e.headcount,
  };
}

export const STATUS_LABELS: Record<WatchStatus, string> = {
  lead: "Lead",
  contatado: "Contatado",
  nda: "NDA",
  dd: "Due Diligence",
  walk_away: "Walk-away",
};

export const STATUS_ORDER: WatchStatus[] = ["lead", "contatado", "nda", "dd", "walk_away"];

export const CANAL_LABELS: Record<ContatoCanal, string> = {
  telefone: "Telefone",
  email: "Email",
  linkedin: "LinkedIn",
  apresentacao: "Apresentação",
  outro: "Outro",
};
