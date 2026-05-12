import { useState } from "react";
import type { QueryParams } from "../../api/client";

interface Props {
  onSearch: (term: string) => void;
  onPreset: (preset: QueryParams) => void;
}

const PRESETS: { label: string; apply: QueryParams }[] = [
  {
    label: "Sweet Spot · Família",
    apply: {
      archetype: ["family_mature_sweet_spot"],
      confidence: ["alta", "media"],
      receita_min_brl: 5_000_000,
      receita_max_brl: 50_000_000,
      headcount_min: 20,
      headcount_max: 200,
    },
  },
  {
    label: "Mid-Market",
    apply: {
      confidence: ["alta", "media"],
      receita_min_brl: 25_000_000,
      receita_max_brl: 250_000_000,
      headcount_min: 100,
    },
  },
  {
    label: "Indústria Mid-Cap",
    apply: {
      cnae_secao: ["C"],
      confidence: ["alta", "media"],
      receita_min_brl: 10_000_000,
      receita_max_brl: 250_000_000,
    },
  },
  {
    label: "Apenas Alta Confiança",
    apply: { confidence: ["alta"] },
  },
  {
    label: "Startups · ≤7 Anos",
    apply: { idade_max: 7, headcount_min: 10 },
  },
];

export default function HeroSearchBar({ onSearch, onPreset }: Props) {
  const [term, setTerm] = useState("");

  function submit() {
    onSearch(term);
  }

  return (
    <section className="hero-search">
      <div className="hero-search-head">
        <div className="title">
          Pesquisar <em>Empresas</em>
        </div>
        <div className="subtitle">Universo · 51.017 Ltdas</div>
      </div>

      <div className="hero-search-input-wrap">
        <div className="hero-search-input-field">
          <svg className="hero-search-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="hero-search-input"
            placeholder="Digite CNPJ ou razão social…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          />
        </div>
        <button type="button" className="hero-search-submit" onClick={submit}>
          Buscar Empresas
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>

      <div className="hero-presets-row">
        <span className="preset-label">Atalhos:</span>
        {PRESETS.map((p) => (
          <button key={p.label} className="hero-preset" onClick={() => onPreset(p.apply)}>
            {p.label}
          </button>
        ))}
      </div>
    </section>
  );
}
