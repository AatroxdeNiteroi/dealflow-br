import type { QueryParams } from "../api/client";

export interface Preset {
  id: string;
  label: string;
  hint: string;
  apply: (base: QueryParams) => QueryParams;
}

/** Presets de tese M&A — fonte única para SearchView + FilterPanel. */
export const PRESETS: Preset[] = [
  {
    id: "sweet",
    label: "Sweet spot · família",
    hint: "Sucessão familiar",
    apply: (b) => ({
      ...b,
      archetype: ["family_mature_sweet_spot"],
      confidence: ["alta", "media"],
      receita_min_brl: 5_000_000,
      receita_max_brl: 50_000_000,
      headcount_min: 20,
      headcount_max: 200,
      offset: 0,
    }),
  },
  {
    id: "midmarket",
    label: "Mid-Market",
    hint: "R$ 25–250 M",
    apply: (b) => ({
      ...b,
      confidence: ["alta", "media"],
      receita_min_brl: 25_000_000,
      receita_max_brl: 250_000_000,
      headcount_min: 100,
      offset: 0,
    }),
  },
  {
    id: "startups",
    label: "Startups",
    hint: "Jovens · ≤ 7 anos",
    apply: (b) => ({
      ...b,
      idade_max: 7,
      headcount_min: 10,
      offset: 0,
    }),
  },
  {
    id: "industria",
    label: "Indústria mid-cap",
    hint: "Seção C · mid-cap",
    apply: (b) => ({
      ...b,
      cnae_secao: ["C"],
      confidence: ["alta", "media"],
      receita_min_brl: 10_000_000,
      receita_max_brl: 250_000_000,
      offset: 0,
    }),
  },
  {
    id: "altaconf",
    label: "Apenas alta confiança",
    hint: "Confiança = alta",
    apply: (b) => ({
      ...b,
      confidence: ["alta"],
      offset: 0,
    }),
  },
];

export function findPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
