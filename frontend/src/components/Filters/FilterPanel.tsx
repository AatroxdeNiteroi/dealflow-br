import { useMemo } from "react";
import type { FiltrosDomains, QueryParams } from "../../api/client";
import DualRangeSlider from "../ui/DualRangeSlider";
import HelpHint from "../ui/HelpHint";
import Section from "../ui/Section";
import { ARCHETYPE_HINTS, CNAE_HINTS, CONFIDENCE_HINTS, HINTS } from "./hints";

const ARCHETYPE_LABELS: Record<string, string> = {
  family_mature_sweet_spot: "Family Mature",
  labor_intensive_midcap: "Labor Mid-Cap",
  capital_intensive: "Capital Intensive",
  standard: "Standard",
  holding_structure: "Holding",
  recent_startup: "Startup",
  partnership_heavy_services: "Partnership",
  financeiro_out_scope: "Financeiro",
};

const SECAO_LABELS: Record<string, string> = {
  A: "Agro", B: "Extrativa", C: "Indústria", D: "Energia", E: "Água",
  F: "Construção", G: "Comércio", H: "Transporte", I: "Aloj/Alim.",
  J: "TI/Telecom", K: "Financeiro", L: "Imobiliário", M: "Profissional",
  N: "Adm.", O: "Adm. Públ.", P: "Educação", Q: "Saúde", R: "Cultura",
  S: "Serviços", T: "Doméstico", U: "Org. Int.",
};

const CONF_LABELS: Record<string, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
  sem_benchmark: "Sem Benchmark",
};

interface Props {
  domains: FiltrosDomains;
  value: QueryParams;
  onChange: (next: QueryParams) => void;
  resultsTotal?: number;
}

function fmtBrl(v: number): string {
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(2)} B`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)} M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)} k`;
  return `R$ ${v.toFixed(0)}`;
}
function fmtInt(v: number): string { return Math.round(v).toLocaleString("pt-BR"); }
function fmtAnos(v: number): string { return `${Math.round(v)} anos`; }

export default function FilterPanel({ domains, value, onChange, resultsTotal }: Props) {
  const activeCount = useMemo(() => {
    let n = 0;
    if (value.search) n++;
    if (value.uf?.length) n++;
    if (value.confidence?.length) n++;
    if (value.archetype?.length) n++;
    if (value.cnae_secao?.length) n++;
    if (value.razao_precision?.length) n++;
    if (value.match_tier) n++;
    if (value.receita_min_brl !== undefined || value.receita_max_brl !== undefined) n++;
    if (value.headcount_min !== undefined || value.headcount_max !== undefined) n++;
    if (value.idade_min !== undefined || value.idade_max !== undefined) n++;
    if (value.capital_min_brl !== undefined || value.capital_max_brl !== undefined) n++;
    if (value.n_socios_min !== undefined || value.n_socios_max !== undefined) n++;
    if (value.n_socios_pj_min !== undefined) n++;
    return n;
  }, [value]);

  function toggle(field: "uf" | "confidence" | "archetype" | "cnae_secao" | "razao_precision", v: string) {
    const cur = (value[field] as string[] | undefined) ?? [];
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    onChange({ ...value, [field]: next.length > 0 ? next : undefined, offset: 0 });
  }
  function setRange(loField: keyof QueryParams, hiField: keyof QueryParams) {
    return (lo: number | undefined, hi: number | undefined) => {
      onChange({ ...value, [loField]: lo, [hiField]: hi, offset: 0 } as QueryParams);
    };
  }
  function setNum(field: keyof QueryParams, raw: string) {
    onChange({ ...value, [field]: raw ? Number(raw) : undefined, offset: 0 });
  }
  function applyQuickFilter(preset: "sweet" | "midmarket" | "startups" | "industria") {
    const base: QueryParams = { limit: value.limit, offset: 0 };
    if (preset === "sweet") {
      onChange({ ...base, archetype: ["family_mature_sweet_spot"], confidence: ["alta", "media"],
        receita_min_brl: 5_000_000, receita_max_brl: 50_000_000, headcount_min: 20, headcount_max: 200 });
    } else if (preset === "midmarket") {
      onChange({ ...base, confidence: ["alta", "media"], receita_min_brl: 25_000_000,
        receita_max_brl: 250_000_000, headcount_min: 100 });
    } else if (preset === "startups") {
      onChange({ ...base, idade_max: 7, headcount_min: 10 });
    } else {
      onChange({ ...base, cnae_secao: ["C"], confidence: ["alta", "media"],
        receita_min_brl: 10_000_000, receita_max_brl: 250_000_000 });
    }
  }
  function reset() { onChange({ limit: value.limit, offset: 0 }); }

  const ufCount = value.uf?.length ?? 0;
  const confCount = value.confidence?.length ?? 0;
  const arcCount = value.archetype?.length ?? 0;
  const cnaeCount = value.cnae_secao?.length ?? 0;
  const precCount = value.razao_precision?.length ?? 0;
  const finCount = [
    value.receita_min_brl !== undefined || value.receita_max_brl !== undefined,
    value.headcount_min !== undefined || value.headcount_max !== undefined,
  ].filter(Boolean).length;
  const corpCount = [
    value.idade_min !== undefined || value.idade_max !== undefined,
    value.capital_min_brl !== undefined || value.capital_max_brl !== undefined,
    value.n_socios_min !== undefined || value.n_socios_max !== undefined,
    value.n_socios_pj_min !== undefined,
  ].filter(Boolean).length;
  const techCount = (value.match_tier ? 1 : 0) + precCount;

  return (
    <aside className="sidebar">
      <h3>Screener <em>· filtros</em></h3>

      <div className="filters-status">
        <span>
          {activeCount > 0 ? <span className="badge">{activeCount}</span> : ""}{" "}
          {activeCount === 0 ? "Sem filtros" : `${activeCount} ativo${activeCount > 1 ? "s" : ""}`}
        </span>
        <span className="filters-status-count">
          {resultsTotal !== undefined ? `${resultsTotal.toLocaleString("pt-BR")} matches` : ""}
        </span>
      </div>

      {/* Busca + Presets — sempre visíveis */}
      <div className="filter-group">
        <div className="filter-label">
          Busca <HelpHint title={HINTS.search.title}>{HINTS.search.body}</HelpHint>
        </div>
        <div className="search-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <line x1="20" y1="20" x2="16" y2="16" />
          </svg>
          <input
            type="text"
            className="filter-input search-input"
            placeholder="CNPJ ou razão social"
            value={value.search ?? ""}
            onChange={(e) => onChange({ ...value, search: e.target.value || undefined, offset: 0 })}
          />
          {value.search && (
            <button className="search-clear" onClick={() => onChange({ ...value, search: undefined, offset: 0 })}>×</button>
          )}
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-label">
          Presets <HelpHint title={HINTS.presets.title}>{HINTS.presets.body}</HelpHint>
        </div>
        <div className="quick-filters">
          <button className="quick-btn" onClick={() => applyQuickFilter("sweet")}>
            <span className="qb-label">Sweet spot</span>
            <span className="qb-hint">sucessão familiar</span>
          </button>
          <button className="quick-btn" onClick={() => applyQuickFilter("midmarket")}>
            <span className="qb-label">Mid-market</span>
            <span className="qb-hint">R$25-250M</span>
          </button>
          <button className="quick-btn" onClick={() => applyQuickFilter("startups")}>
            <span className="qb-label">Startups</span>
            <span className="qb-hint">jovens · ≤7 anos</span>
          </button>
          <button className="quick-btn" onClick={() => applyQuickFilter("industria")}>
            <span className="qb-label">Indústria</span>
            <span className="qb-hint">seção C · midcap</span>
          </button>
        </div>
      </div>

      {/* SEÇÕES COLAPSÁVEIS */}
      <Section title="Geografia" hint={HINTS.uf.body} hintTitle={HINTS.uf.title} badge={ufCount} defaultOpen>
        <div className="chip-row">
          {domains.ufs.map((uf) => (
            <button key={uf} className="chip" data-active={value.uf?.includes(uf) ?? false} onClick={() => toggle("uf", uf)}>
              {uf}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Confiança" hint={HINTS.confidence.body} hintTitle={HINTS.confidence.title} badge={confCount} defaultOpen>
        <div className="chip-row">
          {domains.confidences.map((c) => (
            <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <button className="chip" data-active={value.confidence?.includes(c) ?? false} onClick={() => toggle("confidence", c)}>
                {CONF_LABELS[c] ?? c}
              </button>
              {CONFIDENCE_HINTS[c] && <HelpHint title={CONF_LABELS[c] ?? c}>{CONFIDENCE_HINTS[c]}</HelpHint>}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Archetype · perfil" hint={HINTS.archetype.body} hintTitle={HINTS.archetype.title} badge={arcCount} defaultOpen>
        <div className="chip-row">
          {domains.archetypes.map((a) => (
            <span key={a} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <button className="chip archetype-chip" data-active={value.archetype?.includes(a) ?? false} onClick={() => toggle("archetype", a)}>
                {ARCHETYPE_LABELS[a] ?? a}
              </button>
              {ARCHETYPE_HINTS[a] && <HelpHint title={ARCHETYPE_LABELS[a] ?? a}>{ARCHETYPE_HINTS[a]}</HelpHint>}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Setor CNAE" hint={HINTS.cnae.body} hintTitle={HINTS.cnae.title} badge={cnaeCount}>
        <div className="chip-row">
          {domains.cnae_secoes.map((s) => (
            <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <button className="chip cnae-chip" data-active={value.cnae_secao?.includes(s) ?? false} onClick={() => toggle("cnae_secao", s)}>
                <strong>{s}</strong> {SECAO_LABELS[s] ?? s}
              </button>
              {CNAE_HINTS[s] && <HelpHint title={`Seção ${s}`}>{CNAE_HINTS[s]}</HelpHint>}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Financeiro · Receita & Headcount" badge={finCount} defaultOpen>
        <div className="filter-group">
          <div className="filter-label">
            Receita estimada
            <HelpHint title={HINTS.receita.title}>{HINTS.receita.body}</HelpHint>
          </div>
          <DualRangeSlider
            min={1_000_000} max={250_000_000} step={500_000} scale="log"
            valueMin={value.receita_min_brl} valueMax={value.receita_max_brl}
            onChange={setRange("receita_min_brl", "receita_max_brl")}
            format={fmtBrl}
          />
        </div>
        <div className="filter-group">
          <div className="filter-label">
            Headcount CLT
            <HelpHint title={HINTS.headcount.title}>{HINTS.headcount.body}</HelpHint>
          </div>
          <DualRangeSlider
            min={domains.ranges.headcount.min} max={Math.min(domains.ranges.headcount.max, 3000)} step={5}
            valueMin={value.headcount_min} valueMax={value.headcount_max}
            onChange={setRange("headcount_min", "headcount_max")}
            format={fmtInt}
          />
        </div>
      </Section>

      <Section title="Estrutura · Idade, Capital, Sócios" badge={corpCount}>
        <div className="filter-group">
          <div className="filter-label">
            Idade da empresa
            <HelpHint title={HINTS.idade.title}>{HINTS.idade.body}</HelpHint>
          </div>
          <DualRangeSlider
            min={0} max={Math.min(domains.ranges.idade_empresa.max, 100)} step={1}
            valueMin={value.idade_min} valueMax={value.idade_max}
            onChange={setRange("idade_min", "idade_max")}
            format={fmtAnos}
          />
        </div>
        <div className="filter-group">
          <div className="filter-label">
            Capital social
            <HelpHint title={HINTS.capital.title}>{HINTS.capital.body}</HelpHint>
          </div>
          <DualRangeSlider
            min={1_000} max={50_000_000} step={1_000} scale="log"
            valueMin={value.capital_min_brl} valueMax={value.capital_max_brl}
            onChange={setRange("capital_min_brl", "capital_max_brl")}
            format={fmtBrl}
          />
        </div>
        <div className="filter-group">
          <div className="filter-label">
            Quadro societário · nº sócios
            <HelpHint title={HINTS.socios.title}>{HINTS.socios.body}</HelpHint>
          </div>
          <DualRangeSlider
            min={0} max={Math.min(domains.ranges.n_socios.max, 30)} step={1}
            valueMin={value.n_socios_min} valueMax={value.n_socios_max}
            onChange={setRange("n_socios_min", "n_socios_max")}
            format={fmtInt}
          />
        </div>
        <div className="filter-group">
          <div className="filter-label">
            Sócios PJ mínimo
            <HelpHint title={HINTS.socios_pj.title}>{HINTS.socios_pj.body}</HelpHint>
          </div>
          <input
            type="number"
            className="filter-input"
            placeholder="0 (sem restrição)"
            value={value.n_socios_pj_min ?? ""}
            onChange={(e) => setNum("n_socios_pj_min", e.target.value)}
          />
        </div>
      </Section>

      <Section title="Técnico · Match & Razão" badge={techCount}>
        <div className="filter-group">
          <div className="filter-label">
            Match tier
            <HelpHint title={HINTS.tier.title}>{HINTS.tier.body}</HelpHint>
          </div>
          <select
            className="filter-select"
            value={value.match_tier ?? ""}
            onChange={(e) => onChange({ ...value, match_tier: e.target.value || undefined, offset: 0 })}
          >
            <option value="">Todos · Tier 1 + 2</option>
            <option value="Tier 1">Tier 1 · match único</option>
            <option value="Tier 2">Tier 2 · cascata §4.4</option>
          </select>
        </div>
        <div className="filter-group">
          <div className="filter-label">
            Precisão da razão folha/receita
            <HelpHint title={HINTS.razao_precision.title}>{HINTS.razao_precision.body}</HelpHint>
          </div>
          <div className="chip-row">
            {domains.razao_precisions.map((p) => (
              <button key={p} className="chip" data-active={value.razao_precision?.includes(p) ?? false} onClick={() => toggle("razao_precision", p)}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <button className="reset-btn" onClick={reset} disabled={activeCount === 0}>
        Limpar todos os filtros
      </button>
    </aside>
  );
}
