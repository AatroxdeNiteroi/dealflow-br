/** Cliente HTTP + SSE pro backend FastAPI. */

const API_BASE = "/api/v1";

export interface Empresa {
  cnpj: string;
  cnpj_basico: string;
  razao_social: string;
  cnae_2_subclasse: string;
  cnae_secao: string;
  id_municipio: string;
  sigla_uf: string;
  bairro: string | null;
  headcount: number;
  match_tier: string;
  capital_social: number | null;
  idade_empresa_anos: number | null;
  porte: string | null;
  archetype: string;
  n_socios: number | null;
  receita_low_brl: number | null;
  receita_high_brl: number | null;
  receita_point_brl: number | null;
  confidence: string;
  razao_precision: string;
}

export interface EmpresasResponse {
  items: Empresa[];
  total: number;
  limit: number;
  offset: number;
}

export interface FiltrosDomains {
  ufs: string[];
  confidences: string[];
  archetypes: string[];
  tiers: string[];
  total_empresas: number;
}

export interface StatsResponse {
  total_empresas: number;
  receita_hist: { bucket: string; n: number; lo: number; hi: number }[];
  by_archetype: { archetype: string; n: number; receita_mediana_brl: number; headcount_mediano: number }[];
  by_uf: { sigla_uf: string; n: number; receita_mediana_brl: number; receita_total_brl: number }[];
  by_confidence: { confidence: string; n: number }[];
  by_cnae_secao: { cnae_secao: string; n: number; receita_mediana_brl: number }[];
  receita_mediana_brl: number;
  receita_total_brl: number;
  headcount_mediano: number;
}

export interface QueryParams {
  uf?: string[];
  confidence?: string[];
  archetype?: string[];
  match_tier?: string;
  receita_min_brl?: number;
  receita_max_brl?: number;
  headcount_min?: number;
  headcount_max?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

function buildQs(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, String(x)));
    else qs.append(k, String(v));
  }
  return qs.toString();
}

export async function fetchEmpresas(params: QueryParams = {}): Promise<EmpresasResponse> {
  const res = await fetch(`${API_BASE}/empresas?${buildQs(params as Record<string, unknown>)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchFiltros(): Promise<FiltrosDomains> {
  const res = await fetch(`${API_BASE}/filtros`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchStats(): Promise<StatsResponse> {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchTop(n = 20): Promise<{ items: Empresa[] }> {
  const res = await fetch(`${API_BASE}/empresas/top?n=${n}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export type AgentName =
  | "matcher" | "estimator" | "archetypist"
  | "designer" | "frontend" | "backend"
  | "archivist" | "auditor";

export type AgentState = "idle" | "working" | "done" | "error";

export interface AgentStatusEvent {
  agent: AgentName;
  state: AgentState;
  detail?: string;
}

export function subscribeAgents(onMsg: (ev: AgentStatusEvent) => void): () => void {
  const es = new EventSource(`${API_BASE}/agents/stream`);
  es.addEventListener("agent_status", (e) => {
    try {
      onMsg(JSON.parse((e as MessageEvent).data) as AgentStatusEvent);
    } catch {
      /* skip */
    }
  });
  return () => es.close();
}
