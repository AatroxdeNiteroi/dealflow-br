import { AnimatePresence, motion } from "framer-motion";
import type { FiltrosDomains, QueryParams } from "../../api/client";
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
  const activeCount = (() => {
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
  })();

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
                Filtros <em>· {activeCount} ativo{activeCount !== 1 ? "s" : ""}</em>
              </div>
              <button className="drawer-close" onClick={onClose} aria-label="Fechar">×</button>
            </header>
            <div className="drawer-body">
              {domains ? (
                <FilterPanel domains={domains} value={value} onChange={onChange} resultsTotal={resultsTotal} />
              ) : (
                <div className="muted" style={{ padding: 24 }}>carregando filtros…</div>
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
