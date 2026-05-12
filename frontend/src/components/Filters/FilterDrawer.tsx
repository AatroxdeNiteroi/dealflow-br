import { AnimatePresence, motion } from "framer-motion";
import type { FiltrosDomains, QueryParams } from "../../api/client";
import { useActiveFilters } from "../../hooks/useActiveFilters";
import FilterPanel from "./FilterPanel";

interface Props {
  open: boolean;
  onClose: () => void;
  domains: FiltrosDomains | null;
  value: QueryParams;
  onChange: (next: QueryParams) => void;
  resultsTotal?: number;
}

export default function FilterDrawer({ open, onClose, domains, value, onChange, resultsTotal }: Props) {
  const activeCount = useActiveFilters(value);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="drawer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.aside
            className="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            role="dialog"
            aria-label="Filtros"
          >
            <header className="drawer-header">
              <div className="drawer-title">
                Filtros <em>· {activeCount} {activeCount !== 1 ? "ativos" : "ativo"}</em>
              </div>
              <button className="drawer-close" onClick={onClose} aria-label="Fechar">×</button>
            </header>
            <div className="drawer-body">
              {domains ? (
                <FilterPanel domains={domains} value={value} onChange={onChange} resultsTotal={resultsTotal} />
              ) : (
                <div className="muted" style={{ padding: 24 }}>Carregando Filtros…</div>
              )}
            </div>
            <footer className="drawer-footer">
              <button className="secondary" onClick={() => onChange({ limit: value.limit, offset: 0 })} disabled={activeCount === 0}>
                Limpar
              </button>
              <button className="primary" onClick={onClose}>
                Aplicar {resultsTotal !== undefined && `· ${resultsTotal.toLocaleString("pt-BR")} resultados`}
              </button>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
