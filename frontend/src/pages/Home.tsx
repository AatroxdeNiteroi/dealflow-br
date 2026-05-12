import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { Empresa, QueryParams } from "../api/client";
import ArchetypeDonut from "../components/Charts/ArchetypeDonut";
import FilterDrawer from "../components/Filters/FilterDrawer";
import Header from "../components/Header/Header";
import MarketDistribution from "../components/IndexChart/MarketDistribution";
import DetailModal from "../components/Modal/DetailModal";
import MetodologiaModal from "../components/Modal/MetodologiaModal";
import ResultsTable from "../components/ResultsTable/ResultsTable";
import SearchView from "../components/Search/SearchView";
import Ticker from "../components/Ticker/Ticker";
import CountUp from "../components/ui/CountUp";
import { useEmpresas } from "../hooks/useEmpresas";
import { useFiltros } from "../hooks/useFiltros";
import { useStats } from "../hooks/useStats";

function countActiveFilters(p: QueryParams): number {
  let n = 0;
  if (p.search) n++;
  if (p.uf?.length) n++;
  if (p.confidence?.length) n++;
  if (p.archetype?.length) n++;
  if (p.cnae_secao?.length) n++;
  if (p.razao_precision?.length) n++;
  if (p.match_tier) n++;
  if (p.receita_min_brl !== undefined || p.receita_max_brl !== undefined) n++;
  if (p.headcount_min !== undefined || p.headcount_max !== undefined) n++;
  if (p.idade_min !== undefined || p.idade_max !== undefined) n++;
  if (p.capital_min_brl !== undefined || p.capital_max_brl !== undefined) n++;
  if (p.n_socios_min !== undefined || p.n_socios_max !== undefined) n++;
  if (p.n_socios_pj_min !== undefined) n++;
  return n;
}

export default function Home() {
  const domains = useFiltros();
  const stats = useStats();
  const [params, setParams] = useState<QueryParams>({ limit: 50, offset: 0 });
  const { data, loading } = useEmpresas(params);
  const [picked, setPicked] = useState<Empresa | null>(null);
  const [showMetodologia, setShowMetodologia] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [inSearchMode, setInSearchMode] = useState(false);

  const activeFilters = useMemo(() => countActiveFilters(params), [params]);

  return (
    <>
      <Ticker onClickEmpresa={setPicked} />
      <Header
        onOpenFilters={() => setFiltersOpen(true)}
        onOpenMetodologia={() => setShowMetodologia(true)}
        totalEmpresas={domains?.total_empresas}
        activeFilters={activeFilters}
        inSearchMode={inSearchMode}
        onGoDashboard={() => setInSearchMode(false)}
        onGoScreener={() => setInSearchMode(true)}
      />

      <div className="workspace">
        <AnimatePresence mode="wait">
          {inSearchMode ? (
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
          ) : (
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
                  <div className="kpi-hint">Ltdas Single-Plant · Receita ≤ R$ 250M</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Receita Mediana</div>
                  <div className="kpi-value mono">
                    {stats ? `R$ ${(stats.receita_mediana_brl / 1e6).toFixed(1)} M` : "—"}
                  </div>
                  <div className="kpi-hint">Sweet Spot M&amp;A Médio Porte</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Receita Agregada</div>
                  <div className="kpi-value mono">
                    {stats ? `R$ ${(stats.receita_total_brl / 1e9).toFixed(1)} B` : "—"}
                  </div>
                  <div className="kpi-hint">Soma do Universo Coberto</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Vínculos Ativos · Mediana</div>
                  <div className="kpi-value mono">
                    <CountUp to={stats?.headcount_mediano ?? 0} />
                  </div>
                  <div className="kpi-hint">CLT · RAIS 2024</div>
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
    </>
  );
}
