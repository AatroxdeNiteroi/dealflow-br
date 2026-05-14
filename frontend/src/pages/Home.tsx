import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { Empresa, QueryParams } from "../api/client";
import AISearchOverlay from "../components/AISearch/AISearchOverlay";
import ArchetypeDonut from "../components/Charts/ArchetypeDonut";
import FilterDrawer from "../components/Filters/FilterDrawer";
import Footer from "../components/Footer/Footer";
import Header, { type ViewMode } from "../components/Header/Header";
import MarketDistribution from "../components/IndexChart/MarketDistribution";
import DetailModal from "../components/Modal/DetailModal";
import MetodologiaModal from "../components/Modal/MetodologiaModal";
import ResultsTable from "../components/ResultsTable/ResultsTable";
import SearchView from "../components/Search/SearchView";
import Ticker from "../components/Ticker/Ticker";
import WatchlistView from "../components/Watchlist/WatchlistView";
import CountUp from "../components/ui/CountUp";
import { useLegal } from "../legal/useLegal";
import { useActiveFilters } from "../hooks/useActiveFilters";
import { useEmpresas } from "../hooks/useEmpresas";
import { useFiltros } from "../hooks/useFiltros";
import { useStats } from "../hooks/useStats";
import { useWatchlist } from "../hooks/useWatchlist";

const NB = " ";
function fmtMilhoesBR(v: number): string {
  return (v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function fmtBilhoesBR(v: number): string {
  return (v / 1e9).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export default function Home() {
  const domains = useFiltros();
  const stats = useStats();
  const [params, setParams] = useState<QueryParams>({ limit: 50, offset: 0 });
  const { data, loading } = useEmpresas(params);
  const [picked, setPicked] = useState<Empresa | null>(null);
  const [showMetodologia, setShowMetodologia] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [view, setView] = useState<ViewMode>("dashboard");

  const activeFilters = useActiveFilters(params);
  const { count: watchlistCount } = useWatchlist();
  const { openTermos, openPrivacidade } = useLegal();

  return (
    <>
      <Ticker onClickEmpresa={setPicked} />
      <Header
        onOpenFilters={() => setFiltersOpen(true)}
        onOpenAISearch={() => setAiOpen(true)}
        onOpenMetodologia={() => setShowMetodologia(true)}
        totalEmpresas={domains?.total_empresas}
        activeFilters={activeFilters}
        view={view}
        watchlistCount={watchlistCount}
        onGoDashboard={() => setView("dashboard")}
        onGoScreener={() => setView("screener")}
        onGoWatchlist={() => setView("watchlist")}
      />

      <div className="workspace">
        <AnimatePresence mode="wait">
          {view === "screener" && (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              style={{ display: "flex", flex: 1, minHeight: 0 }}
            >
              <SearchView
                data={data}
                loading={loading}
                params={params}
                onChangeParams={setParams}
                onPickEmpresa={setPicked}
                onOpenFilters={() => setFiltersOpen(true)}
                activeFilters={activeFilters}
              />
            </motion.div>
          )}

          {view === "watchlist" && (
            <motion.div
              key="watchlist"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              style={{ display: "flex", flex: 1, minHeight: 0 }}
            >
              <WatchlistView onPickEmpresa={setPicked} />
            </motion.div>
          )}

          {view === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="main-pane"
            >
              {/* KPI row */}
              <div className="kpi-row">
                <div className="kpi">
                  <div className="kpi-label">Universo</div>
                  <div className="kpi-value">
                    <CountUp to={stats?.total_empresas ?? 0} />
                  </div>
                  <div className="kpi-hint">Ltdas single-plant · receita ≤ R${NB}250{NB}M</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Receita mediana</div>
                  <div className="kpi-value mono">
                    {stats ? `R$${NB}${fmtMilhoesBR(stats.receita_mediana_brl)}${NB}M` : "—"}
                  </div>
                  <div className="kpi-hint">Sweet spot M&amp;A médio porte</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Receita agregada</div>
                  <div className="kpi-value mono">
                    {stats ? `R$${NB}${fmtBilhoesBR(stats.receita_total_brl)}${NB}B` : "—"}
                  </div>
                  <div className="kpi-hint">Soma do universo coberto</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Vínculos ativos · mediana</div>
                  <div className="kpi-value mono">
                    <CountUp to={stats?.headcount_mediano ?? 0} />
                  </div>
                  <div className="kpi-hint">CLT · ano-base mais recente</div>
                </div>
              </div>

              {/* Distribuição real do universo + Archetypes */}
              <div className="dashboard-grid">
                {stats ? (
                  <MarketDistribution
                    hist={stats.receita_hist}
                    total={stats.total_empresas}
                    receitaMediana={stats.receita_mediana_brl}
                  />
                ) : (
                  <div className="panel" />
                )}
                {stats ? <ArchetypeDonut data={stats.by_archetype} /> : <div className="panel" />}
              </div>

              {/* Results table (dashboard view) */}
              <ResultsTable
                data={data}
                loading={loading}
                params={params}
                onChangeParams={setParams}
                onPickEmpresa={setPicked}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Footer onOpenTermos={openTermos} onOpenPrivacidade={openPrivacidade} />

      <FilterDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        domains={domains}
        value={params}
        onChange={setParams}
        resultsTotal={data?.total}
      />

      <DetailModal empresa={picked} onClose={() => setPicked(null)} />
      <MetodologiaModal open={showMetodologia} onClose={() => setShowMetodologia(false)} />
      <AISearchOverlay
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onApply={(p) => {
          setParams(p);
          setView("screener");
        }}
      />
    </>
  );
}
