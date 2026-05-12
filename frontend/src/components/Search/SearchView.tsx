import { useEffect, useRef } from "react";
import type { Empresa, EmpresasResponse, QueryParams } from "../../api/client";
import EmpresaCard from "./EmpresaCard";

interface Props {
  data: EmpresasResponse | null;
  loading: boolean;
  params: QueryParams;
  onChangeParams: (next: QueryParams) => void;
  onPickEmpresa: (e: Empresa) => void;
  onOpenFilters: () => void;
  activeFilters: number;
}

const QUICK_PRESETS: { id: string; label: string; apply: (base: QueryParams) => QueryParams }[] = [
  {
    id: "sweet",
    label: "Sweet spot · família",
    apply: (b) => ({
      ...b, archetype: ["family_mature_sweet_spot"], confidence: ["alta", "media"],
      receita_min_brl: 5_000_000, receita_max_brl: 50_000_000, headcount_min: 20, headcount_max: 200,
    }),
  },
  {
    id: "midmarket",
    label: "Mid-market",
    apply: (b) => ({
      ...b, confidence: ["alta", "media"], receita_min_brl: 25_000_000, receita_max_brl: 250_000_000, headcount_min: 100,
    }),
  },
  {
    id: "industria",
    label: "Indústria mid-cap",
    apply: (b) => ({
      ...b, cnae_secao: ["C"], confidence: ["alta", "media"],
      receita_min_brl: 10_000_000, receita_max_brl: 250_000_000,
    }),
  },
  {
    id: "altaconf",
    label: "Apenas alta confiança",
    apply: (b) => ({ ...b, confidence: ["alta"] }),
  },
];

export default function SearchView({
  data,
  loading,
  params,
  onChangeParams,
  onPickEmpresa,
  onOpenFilters,
  activeFilters,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus no input ao entrar na search view
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="search-view">
      <div className="search-view-head">
        <h1>
          Pesquisar <em>empresas</em>
        </h1>
        <div className="meta">
          {total.toLocaleString("pt-BR")} matches
          {activeFilters > 0 && ` · ${activeFilters} filtro${activeFilters > 1 ? "s" : ""}`}
        </div>
      </div>

      <div className="search-hero">
        <svg className="search-hero-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="search-hero-input"
          placeholder="Digite CNPJ ou razão social…"
          value={params.search ?? ""}
          onChange={(e) => onChangeParams({ ...params, search: e.target.value || undefined, offset: 0 })}
          onKeyDown={(e) => { if (e.key === "Escape") inputRef.current?.blur(); }}
        />
        {params.search && (
          <button
            className="search-hero-clear"
            onClick={() => onChangeParams({ ...params, search: undefined, offset: 0 })}
            aria-label="limpar"
          >×</button>
        )}
      </div>

      <div className="search-quick-row">
        <span className="quick-label">Sugestões:</span>
        {QUICK_PRESETS.map((p) => (
          <button
            key={p.id}
            className="search-quick-chip"
            onClick={() => onChangeParams(p.apply({ limit: params.limit, offset: 0 }))}
          >
            {p.label}
          </button>
        ))}
        <button
          className="search-quick-chip"
          onClick={onOpenFilters}
          style={{ marginLeft: "auto" }}
        >
          ⚙ Filtros avançados{activeFilters > 0 ? ` · ${activeFilters}` : ""}
        </button>
      </div>

      <div className="search-results-header">
        <div className="search-results-count">
          {total.toLocaleString("pt-BR")} <em>empresas</em>
        </div>
        {items.length > 0 && (
          <div className="meta">
            mostrando {Math.min((params.offset ?? 0) + 1, total)}–
            {Math.min((params.offset ?? 0) + items.length, total)}
          </div>
        )}
      </div>

      <div className="search-cards">
        {loading && !data ? (
          <div className="search-empty">carregando…</div>
        ) : items.length === 0 ? (
          <div className="search-empty">
            {params.search
              ? "nenhuma empresa bate com essa busca · tente um nome diferente"
              : "comece digitando ou aplique um filtro acima"}
          </div>
        ) : (
          items.map((e, i) => (
            <EmpresaCard key={e.cnpj} empresa={e} index={i} onClick={() => onPickEmpresa(e)} />
          ))
        )}
      </div>

      {items.length > 0 && (
        <div className="pagination">
          <button
            onClick={() => onChangeParams({ ...params, offset: Math.max(0, (params.offset ?? 0) - (params.limit ?? 50)) })}
            disabled={(params.offset ?? 0) === 0}
          >
            ← anteriores
          </button>
          <span className="pg-meta">
            página {Math.floor((params.offset ?? 0) / (params.limit ?? 50)) + 1} de {Math.ceil(total / (params.limit ?? 50))}
          </span>
          <button
            onClick={() => onChangeParams({ ...params, offset: (params.offset ?? 0) + (params.limit ?? 50) })}
            disabled={(params.offset ?? 0) + (params.limit ?? 50) >= total}
          >
            próximas →
          </button>
        </div>
      )}
    </div>
  );
}
