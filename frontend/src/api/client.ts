/**
 * Cliente HTTP + SSE pro backend FastAPI.
 *
 * Endpoints:
 *   GET  /api/v1/empresas      lista filtrada
 *   GET  /api/v1/filtros       domínios pra popular dropdowns
 *   GET  /api/v1/agents/stream SSE de status dos agentes
 */

const API_BASE = "/api/v1";

export interface Empresa {
  cnpj: string;
  razao_social: string;
  sigla_uf: string;
  receita_point_brl: number | null;
  archetype: string;
  confidence: string;
}

export interface EmpresasResponse {
  items: Empresa[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchEmpresas(
  params: Record<string, string | number | undefined> = {},
): Promise<EmpresasResponse> {
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  );
  const res = await fetch(`${API_BASE}/empresas?${qs}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface AgentStatusEvent {
  agent: string;
  state: "idle" | "working" | "done" | "error";
  detail?: string;
}

export function subscribeAgents(onMsg: (ev: AgentStatusEvent) => void): () => void {
  const es = new EventSource(`${API_BASE}/agents/stream`);
  es.addEventListener("agent_status", (e) => {
    onMsg(JSON.parse((e as MessageEvent).data) as AgentStatusEvent);
  });
  return () => es.close();
}
