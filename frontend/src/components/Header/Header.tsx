export type ViewMode = "dashboard" | "screener" | "watchlist";

interface Props {
  onOpenFilters: () => void;
  onOpenAISearch: () => void;
  onOpenMetodologia: () => void;
  totalEmpresas?: number;
  activeFilters: number;
  view: ViewMode;
  watchlistCount: number;
  onGoDashboard: () => void;
  onGoScreener: () => void;
  onGoWatchlist: () => void;
}

const FilterIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);
const SearchIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const DashboardIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" />
    <rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
  </svg>
);

export default function Header({
  onOpenFilters,
  onOpenAISearch,
  onOpenMetodologia,
  totalEmpresas,
  activeFilters,
  view,
  watchlistCount,
  onGoDashboard,
  onGoScreener,
  onGoWatchlist,
}: Props) {
  return (
    <header className="header">
      <div className="brand">
        <span className="logo">DealFlow <em>BR</em></span>
        <span className="tag">M&amp;A · RJ/SP</span>
      </div>

      <nav className="header-nav" aria-label="Seções">
        <button type="button" data-active={view === "dashboard"} onClick={onGoDashboard}>Dashboard</button>
        <button type="button" data-active={view === "screener"} onClick={onGoScreener}>Screener</button>
        <button type="button" data-active={view === "watchlist"} onClick={onGoWatchlist}>
          Watchlist
          {watchlistCount > 0 && <span className="nav-count">{watchlistCount}</span>}
        </button>
        <button type="button" className="muted-nav" title="Em breve" aria-disabled="true" disabled>Reports</button>
      </nav>

      <div className="header-actions">
        {totalEmpresas !== undefined && (
          <span className="live-dot">
            UNIVERSO · {totalEmpresas.toLocaleString("pt-BR")}
          </span>
        )}

        <button className="header-btn ai-search-trigger" onClick={onOpenAISearch} title="Busca com IA · linguagem natural">
          ✦ Busca IA
        </button>

        <button className="header-btn" onClick={onOpenFilters}>
          <FilterIcon /> Filtros
          {activeFilters > 0 && <span className="badge">{activeFilters}</span>}
        </button>

        <button className="header-btn" onClick={onOpenMetodologia}>
          Metodologia
        </button>

        {view === "screener" ? (
          <button className="header-btn cta" onClick={onGoDashboard}>
            <DashboardIcon /> Voltar ao dashboard
          </button>
        ) : (
          <button className="header-btn cta" onClick={onGoScreener}>
            <SearchIcon /> Pesquisar empresas
          </button>
        )}
      </div>
    </header>
  );
}
