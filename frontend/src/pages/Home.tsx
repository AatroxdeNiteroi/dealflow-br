import { useState } from "react";
import type { Empresa, QueryParams } from "../api/client";
import ArchetypeDonut from "../components/Charts/ArchetypeDonut";
import FilterPanel from "../components/Filters/FilterPanel";
import Header from "../components/Header/Header";
import IndexChart from "../components/IndexChart/IndexChart";
import DetailModal from "../components/Modal/DetailModal";
import MetodologiaModal from "../components/Modal/MetodologiaModal";
import ResultsTable from "../components/ResultsTable/ResultsTable";
import Ticker from "../components/Ticker/Ticker";
import CountUp from "../components/ui/CountUp";
import { useEmpresas } from "../hooks/useEmpresas";
import { useFiltros } from "../hooks/useFiltros";
import { useStats } from "../hooks/useStats";

export default function Home() {
  const domains = useFiltros();
  const stats = useStats();
  const [params, setParams] = useState<QueryParams>({ limit: 50, offset: 0 });
  const { data, loading } = useEmpresas(params);
  const [picked, setPicked] = useState<Empresa | null>(null);
  const [showMetodologia, setShowMetodologia] = useState(false);

  return (
    <>
      <Ticker onClickEmpresa={setPicked} />
      <Header onOpenMetodologia={() => setShowMetodologia(true)} totalEmpresas={domains?.total_empresas} />

      <div className="workspace">
        {domains ? (
          <FilterPanel domains={domains} value={params} onChange={setParams} />
        ) : (
          <aside className="sidebar"><div className="muted">carregando filtros…</div></aside>
        )}

        <div className="main-pane">
          {/* KPI row */}
          <div className="kpi-row">
            <div className="kpi">
              <div className="kpi-label">Universe</div>
              <div className="kpi-value">
                <CountUp to={stats?.total_empresas ?? 0} />
              </div>
              <div className="kpi-hint">empresas single-plant · Tier 1 + 2</div>
              <span className="kpi-trend up">▲ Tier 2</span>
            </div>
            <div className="kpi">
              <div className="kpi-label">Receita mediana</div>
              <div className="kpi-value mono">
                {stats ? `R$ ${(stats.receita_mediana_brl / 1e6).toFixed(1)}M` : "—"}
              </div>
              <div className="kpi-hint">sweet spot M&amp;A médio porte</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Receita agregada</div>
              <div className="kpi-value mono">
                {stats ? `R$ ${(stats.receita_total_brl / 1e9).toFixed(1)}B` : "—"}
              </div>
              <div className="kpi-hint">soma do universo coberto</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Headcount mediano</div>
              <div className="kpi-value mono">
                <CountUp to={stats?.headcount_mediano ?? 0} />
              </div>
              <div className="kpi-hint">funcionários CLT</div>
            </div>
          </div>

          {/* Index + Archetypes */}
          <div className="dashboard-grid">
            <IndexChart />
            {stats ? <ArchetypeDonut data={stats.by_archetype} /> : <div className="panel" />}
          </div>

          {/* Results */}
          <ResultsTable
            data={data}
            loading={loading}
            params={params}
            onChangeParams={setParams}
            onPickEmpresa={setPicked}
          />
        </div>
      </div>

      <DetailModal empresa={picked} onClose={() => setPicked(null)} />
      <MetodologiaModal open={showMetodologia} onClose={() => setShowMetodologia(false)} />
    </>
  );
}
