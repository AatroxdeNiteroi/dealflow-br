/** Mapas de label canônicos + formatadores. Centralizado pra consistência. */

export const ARCHETYPE_LABELS: Record<string, string> = {
  family_mature_sweet_spot: "Family Mature",
  labor_intensive_midcap: "Labor Mid-Cap",
  capital_intensive: "Capital Intensive",
  standard: "Standard",
  holding_structure: "Holding",
  recent_startup: "Startup",
  partnership_heavy_services: "Partnership",
  financeiro_out_scope: "Financeiro",
};

export const CONFIDENCE_LABELS: Record<string, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
  sem_benchmark: "Sem Benchmark",
};

export const PRECISION_LABELS: Record<string, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const SECAO_LABELS: Record<string, string> = {
  A: "Agro", B: "Extrativa", C: "Indústria", D: "Energia", E: "Água",
  F: "Construção", G: "Comércio", H: "Transporte", I: "Aloj/Alim.",
  J: "TI/Telecom", K: "Financeiro", L: "Imobiliário", M: "Profissional",
  N: "Adm.", O: "Adm. Públ.", P: "Educação", Q: "Saúde", R: "Cultura",
  S: "Serviços", T: "Doméstico", U: "Org. Int.",
};

export function labelArchetype(v: string): string {
  return ARCHETYPE_LABELS[v] ?? v;
}
export function labelConfidence(v: string): string {
  return CONFIDENCE_LABELS[v] ?? v;
}
export function labelPrecision(v: string): string {
  return PRECISION_LABELS[v] ?? v;
}
export function labelSecao(v: string): string {
  return SECAO_LABELS[v] ?? v;
}

/* Formatadores — pt-BR (vírgula decimal) · NB-space entre número e unidade */
const NB = " ";

function ptDec(v: number, digits: number): string {
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtBrl(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1e9) return `R$${NB}${ptDec(v / 1e9, 2)}${NB}B`;
  if (v >= 1e6) return `R$${NB}${ptDec(v / 1e6, 1)}${NB}M`;
  if (v >= 1e3) return `R$${NB}${ptDec(v / 1e3, 0)}${NB}k`;
  return `R$${NB}${ptDec(v, 0)}`;
}
export function fmtBrlCompact(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1e9) return `R$${ptDec(v / 1e9, 2)}B`;
  if (v >= 1e6) return `R$${ptDec(v / 1e6, 1)}M`;
  if (v >= 1e3) return `R$${ptDec(v / 1e3, 0)}k`;
  return `R$${ptDec(v, 0)}`;
}
export function fmtInt(v: number | null | undefined): string {
  if (v == null) return "—";
  return Math.round(v).toLocaleString("pt-BR");
}
export function fmtAnos(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${Math.round(v)} anos`;
}

export function tickerSym(razao: string): string {
  return razao
    .replace(/(LTDA\.?|S\/?\.?A\.?|EIRELI|ME|EPP).*$/gi, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.substring(0, 2))
    .join("")
    .substring(0, 4)
    .toUpperCase();
}
