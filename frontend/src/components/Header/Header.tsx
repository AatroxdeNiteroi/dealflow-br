interface Props {
  onOpenMetodologia: () => void;
  totalEmpresas?: number;
}

export default function Header({ onOpenMetodologia, totalEmpresas }: Props) {
  return (
    <header className="header">
      <div className="brand">
        <span className="logo">DealFlow <em>BR</em></span>
        <span className="tag">M&amp;A · RJ/SP</span>
      </div>

      <nav className="header-nav">
        <a data-active="true">Screener</a>
        <a>Watchlist</a>
        <a>Reports</a>
        <a>API</a>
      </nav>

      <div className="header-actions">
        {totalEmpresas !== undefined && (
          <span className="live-dot">
            UNIVERSE · {totalEmpresas.toLocaleString("pt-BR")}
          </span>
        )}
        <button className="header-btn" onClick={onOpenMetodologia}>
          Nossa metodologia
        </button>
        <button className="header-btn primary">Daniel M.</button>
      </div>
    </header>
  );
}
