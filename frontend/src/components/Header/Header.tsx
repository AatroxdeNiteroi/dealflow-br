interface Props {
  onOpenFilters: () => void;
  onToggleSearch: () => void;
  onOpenMetodologia: () => void;
  totalEmpresas?: number;
  activeFilters: number;
  inSearchMode: boolean;
}

const FilterIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);
const DashboardIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" />
    <rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
  </svg>
);

export default function Header({
  onOpenFilters,
  onToggleSearch,
  onOpenMetodologia,
  totalEmpresas,
  activeFilters,
  inSearchMode,
}: Props) {
  return (
    <header className="header">
      <div className="brand">
        <span className="logo">DealFlow <em>BR</em></span>
        <span className="tag">M&amp;A · RJ/SP</span>
      </div>

      <nav className="header-nav">
        <a data-active={!inSearchMode}>Dashboard</a>
        <a data-active={inSearchMode}>Screener</a>
        <a>Watchlist</a>
        <a>Reports</a>
      </nav>

      <div className="header-actions">
        {totalEmpresas !== undefined && (
          <span className="live-dot">
            UNIVERSE · {totalEmpresas.toLocaleString("pt-BR")}
          </span>
        )}

        <button className="header-btn" onClick={onOpenFilters}>
          <FilterIcon /> Filtros
          {activeFilters > 0 && <span className="badge">{activeFilters}</span>}
        </button>

        {inSearchMode && (
          <button className="header-btn" onClick={onToggleSearch}>
            <DashboardIcon /> Voltar ao Dashboard
          </button>
        )}

        <button className="header-btn" onClick={onOpenMetodologia}>
          Nossa Metodologia
        </button>
      </div>
    </header>
  );
}
