// Mesmos types do client.ts, re-exportados pra import direto.
export type { AgentStatusEvent, Empresa, EmpresasResponse } from "../api/client";

export type AgentName =
  | "matcher"
  | "estimator"
  | "archetypist"
  | "designer"
  | "frontend"
  | "backend"
  | "archivist"
  | "auditor";
