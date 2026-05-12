import type { FiltrosDomains, QueryParams } from "../../api/client";

interface Props {
  domains: FiltrosDomains;
  value: QueryParams;
  onChange: (next: QueryParams) => void;
}

const ARCHETYPE_LABELS: Record<string, string> = {
  family_mature_sweet_spot: "family mature",
  labor_intensive_midcap: "labor midcap",
  capital_intensive: "capital int.",
  standard: "standard",
  holding_structure: "holding",
  recent_startup: "startup",
  partnership_heavy_services: "partnership",
  financeiro_out_scope: "financeiro",
};

export default function FilterPanel({ domains, value, onChange }: Props) {
  function toggle(field: "uf" | "confidence" | "archetype", v: string) {
    const cur = value[field] ?? [];
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    onChange({ ...value, [field]: next.length > 0 ? next : undefined, offset: 0 });
  }

  function setMagic() {
    onChange({
      ...value,
      archetype: ["family_mature_sweet_spot"],
      confidence: ["alta", "media"],
      receita_min_brl: 5_000_000,
      receita_max_brl: 50_000_000,
      offset: 0,
    });
  }

  function reset() {
    onChange({ limit: value.limit, offset: 0 });
  }

  return (
    <aside className="filter-panel">
      <div className="filter-group">
        <div className="filter-label">Buscar</div>
        <input
          type="text"
          className="filter-input"
          placeholder="CNPJ ou razão social"
          value={value.search ?? ""}
          onChange={(e) => onChange({ ...value, search: e.target.value || undefined, offset: 0 })}
        />
      </div>

      <div className="filter-group">
        <div className="filter-label">UF</div>
        <div className="chip-row">
          {domains.ufs.map((uf) => (
            <button
              key={uf}
              className="chip"
              data-active={value.uf?.includes(uf) ?? false}
              onClick={() => toggle("uf", uf)}
            >
              {uf}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-label">Confiança</div>
        <div className="chip-row">
          {domains.confidences.map((c) => (
            <button
              key={c}
              className="chip"
              data-active={value.confidence?.includes(c) ?? false}
              onClick={() => toggle("confidence", c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-label">Archetype</div>
        <div className="chip-row">
          {domains.archetypes.map((a) => (
            <button
              key={a}
              className="chip"
              data-active={value.archetype?.includes(a) ?? false}
              onClick={() => toggle("archetype", a)}
              title={a}
            >
              {ARCHETYPE_LABELS[a] ?? a}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-label">Receita (R$ milhões)</div>
        <div className="range-slider">
          <input
            type="number"
            className="filter-input"
            placeholder="min"
            value={value.receita_min_brl ? value.receita_min_brl / 1e6 : ""}
            onChange={(e) =>
              onChange({
                ...value,
                receita_min_brl: e.target.value ? Number(e.target.value) * 1e6 : undefined,
                offset: 0,
              })
            }
          />
          <span className="muted">→</span>
          <input
            type="number"
            className="filter-input"
            placeholder="max"
            value={value.receita_max_brl ? value.receita_max_brl / 1e6 : ""}
            onChange={(e) =>
              onChange({
                ...value,
                receita_max_brl: e.target.value ? Number(e.target.value) * 1e6 : undefined,
                offset: 0,
              })
            }
          />
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-label">Headcount</div>
        <div className="range-slider">
          <input
            type="number"
            className="filter-input"
            placeholder="min"
            value={value.headcount_min ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                headcount_min: e.target.value ? Number(e.target.value) : undefined,
                offset: 0,
              })
            }
          />
          <span className="muted">→</span>
          <input
            type="number"
            className="filter-input"
            placeholder="max"
            value={value.headcount_max ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                headcount_max: e.target.value ? Number(e.target.value) : undefined,
                offset: 0,
              })
            }
          />
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-label">Tier</div>
        <select
          className="filter-select"
          value={value.match_tier ?? ""}
          onChange={(e) =>
            onChange({ ...value, match_tier: e.target.value || undefined, offset: 0 })
          }
        >
          <option value="">Todos</option>
          <option value="Tier 1">Tier 1 (match único)</option>
          <option value="Tier 2">Tier 2 (cascata §4.4)</option>
        </select>
      </div>

      <button className="magic-filter" onClick={setMagic}>
        ✨ Magic Filter
      </button>
      <button className="chip" onClick={reset}>
        limpar filtros
      </button>
    </aside>
  );
}
