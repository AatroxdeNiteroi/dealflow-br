/** Cliente HTTP + SSE pro backend FastAPI. */

const API_BASE = "/api/v1";

/**
 * fetch com tratamento de sessão/assinatura nas rotas de dados.
 *
 * Quando o ambiente exige auth (settings.auth_required=True), o gating
 * do backend responde 401 {detail:"NAO_AUTENTICADO"} sem sessão válida
 * e 403 {detail:"ASSINATURA_NECESSARIA"} sem assinatura ativa — nesses
 * casos devolvemos o usuário à landing (login ou planos). Qualquer
 * outro status segue para o caller tratar como erro normal.
 */
async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, { credentials: "same-origin", ...init });
  if (res.status === 401 || res.status === 403) {
    let detail: unknown;
    try {
      detail = ((await res.clone().json()) as { detail?: unknown }).detail;
    } catch {
      /* corpo não-JSON — sem redirecionamento */
    }
    if (res.status === 401 && detail === "NAO_AUTENTICADO") {
      window.location.href = "/landing.html?auth=login";
    } else if (res.status === 403 && detail === "ASSINATURA_NECESSARIA") {
      window.location.href = "/landing.html?auth=plans";
    }
  }
  return res;
}

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
  n_socios_pf: number | null;
  n_socios_pj: number | null;
  receita_low_brl: number | null;
  receita_high_brl: number | null;
  receita_point_brl: number | null;
  confidence: string;
  razao_precision: string;
  // ── Segunda estimativa · alavanca PIA receita-por-pessoa ──
  receita_pia_brl: number | null;
  convergencia_pct: number | null;
  convergencia_flag: string | null; // convergente | divergente_medio | divergente_forte | sem_pia
  // ── Piso de receita · contratos federais (Portal Transparência) ──
  piso_federal_anual_brl: number | null;
  n_contratos_federais: number | null;
  flag_subestimacao_federal: boolean | null;
}

export interface EmpresasResponse {
  items: Empresa[];
  total: number;
  limit: number;
  offset: number;
}

export interface Range {
  min: number;
  max: number;
}

export interface FiltrosDomains {
  ufs: string[];
  confidences: string[];
  archetypes: string[];
  cnae_secoes: string[];
  razao_precisions: string[];
  tiers: string[];
  total_empresas: number;
  ranges: {
    headcount: Range;
    idade_empresa: Range;
    capital_social: Range;
    n_socios: Range;
    receita: Range;
  };
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
  cnae_secao?: string[];
  razao_precision?: string[];
  match_tier?: string;
  receita_min_brl?: number;
  receita_max_brl?: number;
  headcount_min?: number;
  headcount_max?: number;
  idade_min?: number;
  idade_max?: number;
  capital_min_brl?: number;
  capital_max_brl?: number;
  n_socios_min?: number;
  n_socios_max?: number;
  n_socios_pj_min?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

function buildQs(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, String(x)));
    else qs.append(k, String(v));
  }
  return qs.toString();
}

export async function fetchEmpresas(params: QueryParams = {}): Promise<EmpresasResponse> {
  const res = await apiFetch(`${API_BASE}/empresas?${buildQs(params as Record<string, unknown>)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchFiltros(): Promise<FiltrosDomains> {
  const res = await apiFetch(`${API_BASE}/filtros`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchStats(): Promise<StatsResponse> {
  const res = await apiFetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchTop(n = 20): Promise<{ items: Empresa[] }> {
  const res = await apiFetch(`${API_BASE}/empresas/top?n=${n}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Histórico de headcount ────────────────────────────────────────

export interface HistoryPoint {
  ano: number;
  headcount: number;
}

export interface HistoryResponse {
  cnpj: string;
  points: HistoryPoint[];
}

export async function fetchHistory(cnpj: string): Promise<HistoryResponse> {
  const res = await apiFetch(`${API_BASE}/empresas/${encodeURIComponent(cnpj)}/history`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Contato oficial ───────────────────────────────────────────────

export interface Contato {
  cnpj: string;
  tipo_logradouro: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  sigla_uf: string | null;
  municipio_nome: string | null;
  ddd_1: string | null;
  telefone_1: string | null;
  ddd_2: string | null;
  telefone_2: string | null;
  email: string | null;
}

export async function fetchContato(cnpj: string): Promise<Contato | null> {
  const res = await apiFetch(`${API_BASE}/empresas/${encodeURIComponent(cnpj)}/contato`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Mapa de grupo · sócios ────────────────────────────────────────

export interface Socio {
  socio_key: string;
  iniciais: string;
  tipo: "PF" | "PJ" | "Estrangeiro";
  qualificacao: string | null;
  n_empresas: number;
}

export interface SociosResponse {
  cnpj: string;
  socios: Socio[];
}

export async function fetchSocios(cnpj: string): Promise<SociosResponse> {
  const res = await apiFetch(`${API_BASE}/empresas/${encodeURIComponent(cnpj)}/socios`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── PGFN Dívida Ativa da União · sinal de risco fiscal ───────────

export interface DividaAtiva {
  cnpj: string;
  tem_divida: boolean;
  valor_total_brl?: number;
  n_inscricoes?: number;
  n_ajuizadas?: number;
  tem_fgts?: boolean;
  tem_previdenciaria?: boolean;
  tem_tributaria?: boolean;
  receita_principal_mais_comum?: string | null;
  situacao_mais_comum?: string | null;
}

export async function fetchDividaAtiva(cnpj: string): Promise<DividaAtiva> {
  const res = await apiFetch(`${API_BASE}/empresas/${encodeURIComponent(cnpj)}/divida_ativa`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Contexto regional Datajud (RJ/Falência por UF) ───────────────

export interface RiscoContextoJanela {
  recuperacao_judicial: number;
  falencia: number;
  recuperacao_extrajudicial: number;
  total: number;
}
export interface RiscoContexto {
  cnpj: string;
  disponivel: boolean;
  uf?: string;
  janela_gte?: string;
  janela_lte?: string;
  atual?: RiscoContextoJanela;
  anterior?: RiscoContextoJanela;
  trend_pct?: {
    recuperacao_judicial: number | null;
    falencia: number | null;
    total: number | null;
  };
}

export async function fetchRiscoContexto(cnpj: string): Promise<RiscoContexto> {
  const res = await apiFetch(`${API_BASE}/empresas/${encodeURIComponent(cnpj)}/risco_contexto`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Querido Diário (menções em DO municipais) ────────────────────

export interface DiarioOficial {
  cnpj: string;
  disponivel: boolean;
  origem?: "cache" | "live";
  n_mencoes: number;
  fonte?: string;
  ultima_data?: string | null;
  ultima_url?: string | null;
  territorios?: string[];
  erro?: boolean;
}

export async function fetchDiarioOficial(cnpj: string): Promise<DiarioOficial> {
  const res = await apiFetch(`${API_BASE}/empresas/${encodeURIComponent(cnpj)}/diario_oficial`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Protestos em cartório (CENPROT/IEPTB · on-demand) ────────────

export interface ProtestoCartorio {
  uf?: string | null;
  cidade?: string | null;
  cartorio?: string | null;
  n_protestos: number;
  valor_brl: number;
}
export interface Protestos {
  cnpj: string;
  disponivel: boolean;
  consultado: boolean;
  tem_protesto: boolean;
  n_protestos: number;
  valor_total_brl: number;
  cartorios: ProtestoCartorio[];
  ufs: string[];
  provedor: string;
  fonte: string;
  erro?: boolean;
  mensagem?: string | null;
}

export async function fetchProtestos(cnpj: string): Promise<Protestos> {
  const res = await apiFetch(`${API_BASE}/empresas/${encodeURIComponent(cnpj)}/protestos`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface GrupoResponse {
  socio_key: string;
  empresas: Empresa[];
}

export async function fetchGrupoDoSocio(socioKey: string): Promise<GrupoResponse> {
  const res = await apiFetch(`${API_BASE}/socios/${encodeURIComponent(socioKey)}/empresas`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── AI Search ──────────────────────────────────────────────────────

export interface AISearchResponse {
  params: QueryParams;
  explain: string;
  warnings?: string[];
}

export async function searchAI(prompt: string): Promise<AISearchResponse> {
  const res = await apiFetch(`${API_BASE}/search/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}
