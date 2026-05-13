import type { Empresa } from "../../api/client";
import { useWatchlist } from "../../hooks/useWatchlist";

interface Props {
  empresa: Empresa;
}

export default function WatchlistToggle({ empresa }: Props) {
  const { isIn, add, remove } = useWatchlist();
  const inList = isIn(empresa.cnpj);

  return (
    <button
      type="button"
      className={`watchlist-toggle${inList ? " watchlist-toggle--active" : ""}`}
      onClick={() => (inList ? remove(empresa.cnpj) : add(empresa))}
      title={inList ? "Remover da watchlist" : "Adicionar à watchlist"}
      aria-pressed={inList}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill={inList ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
      <span>{inList ? "Na watchlist" : "Adicionar"}</span>
    </button>
  );
}
