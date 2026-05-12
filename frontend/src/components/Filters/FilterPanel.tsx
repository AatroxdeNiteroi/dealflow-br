import type { FiltrosDomains, QueryParams } from "../../api/client";

const ARCHETYPE_LABELS: Record<string, string> = {
  family_mature_sweet_spot: "family mature",
  labor_intensive_midcap: "labor midcap",
  capital_intensive: "capital intensive",
  standard: "standard",
  holding_structure: "holding",
  recent_startup: "startup",
  partnership_heavy_services: "partnership",
  financeiro_out_scope: "financeiro",
};

const SECAO_LABELS: Record<string, string> = {
  A: "Agro", B: "Extr.", C: "Indústria", D: "Energia", E: "Água",
  F: "Construção", G: "Comércio", H: "Transporte", I: "Aloj/Alim.",
  J: "TI/Telecom", K: "Financeiro", L: "Imobiliário", M: "Profissional",
  N: "Adm.", O: "Adm.Públ.", P: "Educação", Q: "Saúde", R: "Cultura",
  S: "Serviços", T: "Doméstico", U: "Org.Int.",
};

interface Props {
  domains: FiltrosDomains;
  value: QueryParams;
  onChange: (next: QueryParams) => void;
}

export default function FilterPanel({ domains, value, onChange }: Props) {
  function toggle(field: "uf" | "confidence" | "archetype" | "cnae_secao" | "razao_precision", v: string) {
    const cur = (value[field] as string[] | undefined) ?? [];
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
      headcount_min: 20,
      headcount_max: 200,
      offset: 0,
    });
  }

  function reset() {
    onChange({ limit: value.limit, offset: 0 });
  }

  function setNum(field: keyof QueryParams, raw: string) {
    onChange({ ...value, [field]: raw ? Number(raw) : undefined, offset: 0 });
  }

  function setReceitaMillions(field: "receita_min_brl" | "receita_max_brl", raw: string) {
    onChange({ ...value, [field]: raw ? Number(raw) * 1e6 : undefined, offset: 0 });
  }

  function setCapitalThousands(field: "capital_min_brl" | "capital_max_brl", raw: string) {
    onChange({ ...value, [field]: raw ? Number(raw) * 1e3 : undefined, offset: 0 });
  }

  return (
    <aside className="sidebar">
      <h3>Screener <em>· filtros</em></h3>

      <div className="filter-group">
        <div className="filter-label">Busca rápida</div>
        <input
          type="text"
          className="filter-input"
          placeholder="CNPJ ou razão social…"
          value={value.search ?? ""}
          onChange={(e) => onChange({ ...value, search: e.target.value || undefined, offset: 0 })}
        />
      </div>

      <button className="magic-btn" onClick={setMagic}>
        Magic Filter · sucessão familiar
      </button>

      <div className="sidebar-divider" />

      <div className="filter-group">
        <div className="filter-label">Geografia · UF</div>
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
        <div className="filter-label">Confiança da estimativa</div>
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
        <div className="filter-label">Archetype · estrutura</div>
        <div className="chip-row">
          {domains.archetypes.map((a) => (
            <button
              key={a}
              className="chip"
              data-active={value.archetype?.includes(a) ?? false}
              onClick={() => toggle("archetype", a)}
            >
              {ARCHETYPE_LABELS[a] ?? a}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-label">Setor · CNAE seção</div>
        <div className="chip-row">
          {domains.cnae_secoes.map((s) => (
            <button
              key={s}
              className="chip"
              data-active={value.cnae_secao?.includes(s) ?? false}
              onClick={() => toggle("cnae_secao", s)}
              title={SECAO_LABELS[s] ?? s}
            >
              {s} · {SECAO_LABELS[s] ?? s}
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-divider" />

      <div className="filter-group">
        <div className="filter-label">Receita estimada · R$ milhões</div>
        <div className="range-2">
          <input
            type="number"
            placeholder="min"
            value={value.receita_min_brl ? value.receita_min_brl / 1e6 : ""}
            onChange={(e) => setReceitaMillions("receita_min_brl", e.target.value)}
          />
          <span className="sep">↔</span>
          <input
            type="number"
            placeholder="max"
            value={value.receita_max_brl ? value.receita_max_brl / 1e6 : ""}
            onChange={(e) => setReceitaMillions("receita_max_brl", e.target.value)}
          />
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-label">Headcount · funcionários CLT</div>
        <div className="range-2">
          <input
            type="number"
            placeholder={`min (${domains.ranges.headcount.min})`}
            value={value.headcount_min ?? ""}
            onChange={(e) => setNum("headcount_min", e.target.value)}
          />
          <span className="sep">↔</span>
          <input
            type="number"
            placeholder={`max (${domains.ranges.headcount.max})`}
            value={value.headcount_max ?? ""}
            onChange={(e) => setNum("headcount_max", e.target.value)}
          />
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-label">Idade da empresa · anos</div>
        <div className="range-2">
          <input
            type="number"
            placeholder="min"
            value={value.idade_min ?? ""}
            onChange={(e) => setNum("idade_min", e.target.value)}
          />
          <span className="sep">↔</span>
          <input
            type="number"
            placeholder="max"
            value={value.idade_max ?? ""}
            onChange={(e) => setNum("idade_max", e.target.value)}
          />
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-label">Capital social · R$ mil</div>
        <div className="range-2">
          <input
            type="number"
            placeholder="min"
            value={value.capital_min_brl ? value.capital_min_brl / 1e3 : ""}
            onChange={(e) => setCapitalThousands("capital_min_brl", e.target.value)}
          />
          <span className="sep">↔</span>
          <input
            type="number"
            placeholder="max"
            value={value.capital_max_brl ? value.capital_max_brl / 1e3 : ""}
            onChange={(e) => setCapitalThousands("capital_max_brl", e.target.value)}
          />
        </div>
      </div>

      <div className="sidebar-divider" />

      <div className="filter-group">
        <div className="filter-label">Quadro societário · nº de sócios</div>
        <div className="range-2">
          <input
            type="number"
            placeholder="min"
            value={value.n_socios_min ?? ""}
            onChange={(e) => setNum("n_socios_min", e.target.value)}
          />
          <span className="sep">↔</span>
          <input
            type="number"
            placeholder="max"
            value={value.n_socios_max ?? ""}
            onChange={(e) => setNum("n_socios_max", e.target.value)}
          />
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-label">Sócios PJ · mínimo (holding hint)</div>
        <input
          type="number"
          className="filter-input"
          placeholder="0"
          value={value.n_socios_pj_min ?? ""}
          onChange={(e) => setNum("n_socios_pj_min", e.target.value)}
        />
      </div>

      <div className="sidebar-divider" />

      <div className="filter-group">
        <div className="filter-label">Match tier</div>
        <select
          className="filter-select"
          value={value.match_tier ?? ""}
          onChange={(e) => onChange({ ...value, match_tier: e.target.value || undefined, offset: 0 })}
        >
          <option value="">Todos (Tier 1 + 2)</option>
          <option value="Tier 1">Tier 1 (match único)</option>
          <option value="Tier 2">Tier 2 (cascata §4.4)</option>
        </select>
      </div>

      <div className="filter-group">
        <div className="filter-label">Precisão da razão folha/receita</div>
        <div className="chip-row">
          {domains.razao_precisions.map((p) => (
            <button
              key={p}
              className="chip"
              data-active={value.razao_precision?.includes(p) ?? false}
              onClick={() => toggle("razao_precision", p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <button className="reset-btn" onClick={reset}>limpar todos os filtros</button>
    </aside>
  );
}
