/* ============================================================
   cinema/copy.ts — every narrative string of the cinema, verbatim
   (spec §2, §3). pt-BR copy never changes here without sign-off.
   Guidance verbs live in beats.ts (VERB_SEGMENTS / RESTS), station
   names in beats.ts (STATIONS_V3) — one source each.
   ============================================================ */

/* ── Gateway ────────────────────────────────────────────────── */
export const GATEWAY_COPY = {
  phrase: "Toda empresa fechada esconde um número.",
  phraseEm: "O radar ilumina cada um.",
  cta: "Quero conhecer o produto",
  caption: "mova o cursor — o campo responde",
} as const;

/* ── Ch1 hero HUD ───────────────────────────────────────────── */
export const HUD_COPY = {
  /** "AZ ###°" */
  azimuth: (deg: number): string => "AZ " + String(Math.round(deg) % 360).padStart(3, "0") + "°",
  label: "varredura ativa",
  /** Reduced-motion static line (§9.1). */
  reducedLine: "AZ 247° · varredura ativa",
} as const;

/* ── cursor labels (fictitious companies; §2, §11.10) ───────── */
export const REDACTED = "R$ ███";
export const NAME_REDACTED = "██████ █████";
// item 4: nomes de empresa FICTÍCIOS (obviamente inventados — nenhuma empresa
// real). Os 6 primeiros aparecem INTEIROS ao revelar; os 6 últimos já trazem a
// tarja embutida — revelados, seguem "pela metade". Escolha estável por ponto (i % 12).
export const COMPANY_NAMES: readonly string[] = [
  "Aurora Beneficiamento LTDA",
  "Vento Norte Logística LTDA",
  "Fundição Meridiano LTDA",
  "Casa Serena Alimentos LTDA",
  "Trilho Azul Componentes LTDA",
  "Oficina Aurora Metais LTDA",
  "Marés ███████ LTDA",
  "Grupo Vértice ██████",
  "███████ Cerâmica LTDA",
  "Pedra ██████ Indústria",
  "Horizonte ███ LTDA",
  "██████ Ferragens LTDA",
];
/** Values are shown only above this label strength (§2). */
export const LABEL_VALUE_MIN_STRENGTH = 0.62;
/** Sweep-flash labels are always redacted (§5 C4c). */
export const SWEEP_FLASH_TEXT = NAME_REDACTED + " · " + REDACTED;

export function formatBRL(mi: number): string {
  if (mi < 1) return "R$ " + Math.round(mi * 1000) + " mil";
  return "R$ " + mi.toFixed(1).replace(".", ",") + " mi";
}

/* ── Ch1 respiro (italic from "—") ──────────────────────────── */
export interface RespiroWord {
  t: string;
  em?: boolean;
}
export const RESPIRO_WORDS: readonly RespiroWord[] = [
  { t: "São" },
  { t: "117.965" },
  { t: "pontos" },
  { t: "neste" },
  { t: "campo." },
  { t: "Cada" },
  { t: "um" },
  { t: "é" },
  { t: "uma" },
  { t: "empresa" },
  { t: "real" },
  { t: "—", em: true },
  { t: "e", em: true },
  { t: "dados", em: true },
  { t: "que", em: true },
  { t: "ninguém", em: true },
  { t: "publicou.", em: true },
];
export const RESPIRO_TEXT = RESPIRO_WORDS.map((w) => w.t).join(" ");

/* ── the dossier (Ch2 + Ch3 merged card; §2) ────────────────── */
export const DOSSIER_COPY = {
  eyebrow: "Empresa em análise",
  cnpj: "CNPJ ██.███.███/0001-██",
  desc: "Fabricação de esquadrias de metal · São Paulo / SP",
  revLabel: "Faturamento anual",
  /** Revealed in C3a: "Faturamento anual estimado". */
  revLabelEst: "estimado",
  revNote: "valor que nenhuma base pública declara",
  amount: "R$ 24,3 mi",
  minTag: "mínimo",
  min: "R$ 20,7 mi",
  maxTag: "máximo",
  max: "R$ 27,9 mi",
  seal: "Fonte pública oficial · auditável",
} as const;

/** §3.7 target tag — existing strings joined by " · " (sign-off item 3, approved). */
export const TARGET_TAG = DOSSIER_COPY.eyebrow + " · " + DOSSIER_COPY.cnpj;

export const CH2_COPY = {
  eyebrow: "Convergência",
  caption: "Fontes públicas oficiais",
  closeLead: "Nenhuma base pública declara esse faturamento.",
  closeSub: "Mas dezenas de fontes públicas oficiais o cercam.",
} as const;

export const CH3_COPY = {
  eyebrow: "A estimativa",
  label: "Faturamento anual estimado",
  closeLead: "A precisão do mercado de elite — só com fonte pública oficial.",
  closeSub: "Nenhum outro produto reconstrói esse número assim.",
} as const;

export const CH4_COPY = {
  eyebrow: "O universo",
  count: "117.965",
  /** Odometer pre-state (lifts out of redaction; never "00.000"). */
  countRedacted: "██.███",
  countLabel: "empresas de capital fechado no radar",
  closeLead: "Você esteve dentro de uma delas.",
  closeSub: "As outras 117.964 já estão no radar — cada uma com seu número.",
} as const;

/** One masked reel in a fixed top slot (§3.6). Cell order matters. */
export const EYEBROW_REEL: readonly string[] = [CH2_COPY.eyebrow, CH3_COPY.eyebrow, CH4_COPY.eyebrow];

/* ── guidance (§3) ──────────────────────────────────────────── */
export const GUIDE_COPY = {
  dockAria: "Avançar para a próxima etapa",
  /** Onboarding card — verbatim from the retired `.lp-hint`. */
  onboardTitle: "Role para baixo",
  onboardSub: "A jornada segue pelo scroll — até o fim da página.",
  cta: "Ver planos",
} as const;

/** QA M4 — landscape phones: the cinema asks to stand the phone up (new microcopy, needs sign-off). */
export const ROTATE_COPY = {
  title: "Gire o celular",
  sub: "A jornada foi feita para a tela em pé.",
} as const;

/** aria-live at rest arrivals: "Etapa N de 8 · Convergência. Role para reunir as fontes." */
export function ariaRestAnnouncement(step: number, total: number, station: string, verb: string): string {
  const imperative = verb.charAt(0).toUpperCase() + verb.slice(1);
  return `Etapa ${step} de ${total} · ${station}. ${imperative}.`;
}
