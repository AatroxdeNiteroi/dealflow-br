import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import type { Empresa, QueryParams } from "../api/client";
import AgentRoom from "../components/AgentRoom/AgentRoom";
import ArchetypeDonut from "../components/Charts/ArchetypeDonut";
import ReceitaHistogram from "../components/Charts/ReceitaHistogram";
import SectorBars from "../components/Charts/SectorBars";
import UfBreakdown from "../components/Charts/UfBreakdown";
import DealFlowBoard from "../components/DealFlowBoard/DealFlowBoard";
import FilterPanel from "../components/Filters/FilterPanel";
import TopNav from "../components/Nav/TopNav";
import DetailModal from "../components/ResultsTable/DetailModal";
import ResultsTable from "../components/ResultsTable/ResultsTable";
import TickerTape from "../components/Ticker/TickerTape";
import CountUp from "../components/ui/CountUp";
import { useEmpresas } from "../hooks/useEmpresas";
import { useFiltros } from "../hooks/useFiltros";
import { useStats } from "../hooks/useStats";

const SECTIONS = [
  { id: "hero", label: "Overview" },
  { id: "market", label: "Market" },
  { id: "board", label: "Deal Flow" },
  { id: "agents", label: "Pipeline" },
  { id: "screener", label: "Screener" },
];

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null!);
  const domains = useFiltros();
  const stats = useStats();
  const [params, setParams] = useState<QueryParams>({ limit: 50, offset: 0 });
  const { data, loading } = useEmpresas(params);
  const [picked, setPicked] = useState<Empresa | null>(null);

  const { scrollY } = useScroll({ container: containerRef });
  const heroY = useTransform(scrollY, [0, 600], [0, -80]);
  const heroOpacity = useTransform(scrollY, [0, 350, 600], [1, 0.6, 0.1]);

  function deepDive(e: Empresa) {
    setPicked(e);
  }

  return (
    <>
      <TickerTape onClickEmpresa={deepDive} />
      <TopNav sections={SECTIONS} containerRef={containerRef} totalEmpresas={domains?.total_empresas} />

      <div ref={containerRef} className="scroll-container">
        {/* ───────── HERO ───────── */}
        <section id="hero" className="section">
          <motion.div style={{ y: heroY, opacity: heroOpacity }} className="flex spacer" />
          <motion.div
            style={{ y: heroY, opacity: heroOpacity }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <div className="eyebrow">M&amp;A Triage Engine · RJ/SP single-plant</div>
            <h1 className="display">
              Reconstruindo<br />o <em>faturamento</em><br />de Ltdas privadas.
            </h1>
            <p className="subtitle">
              Estimativa auditável construída sobre Receita Federal CNPJ + RAIS Estabelecimentos/Vínculos
              + IBGE PIA/PAS/PAC. Cada empresa rastreável até a fonte primária. Sem caixa-preta,
              sem bureau pago.
            </p>
          </motion.div>

          {stats && (
            <motion.div
              className="kpi-grid"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
            >
              <div className="kpi">
                <div className="kpi-label">Universo</div>
                <div className="kpi-value amber"><CountUp to={stats.total_empresas} /></div>
                <div className="kpi-hint">empresas single-plant · Tier 1+2</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Receita mediana</div>
                <div className="kpi-value up">
                  R$ <CountUp to={stats.receita_mediana_brl / 1e6} format={(n) => n.toFixed(1) + "M"} />
                </div>
                <div className="kpi-hint">sweet spot M&amp;A</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Receita agregada</div>
                <div className="kpi-value">
                  R$ <CountUp to={stats.receita_total_brl / 1e9} format={(n) => n.toFixed(1) + "B"} />
                </div>
                <div className="kpi-hint">soma do universo coberto</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Headcount mediano</div>
                <div className="kpi-value"><CountUp to={stats.headcount_mediano} /></div>
                <div className="kpi-hint">funcionários CLT</div>
              </div>
            </motion.div>
          )}

          <div className="spacer" />
          <motion.div
            className="muted"
            style={{ fontSize: 10, textAlign: "center", letterSpacing: "0.3em" }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2.2, repeat: Infinity }}
          >
            ↓ SCROLL · MARKET OVERVIEW
          </motion.div>
        </section>

        {/* ───────── MARKET OVERVIEW ───────── */}
        <section id="market" className="section">
          <div className="eyebrow">Market Overview</div>
          <h2 className="section-title">
            Distribuição do <em>universo</em>
          </h2>
          <p className="subtitle">
            Visão agregada das 59 mil empresas que passaram pelo motor. Receita estimada por faixa,
            composição por archetype, geografia e setor.
          </p>

          {stats && (
            <div className="market-grid">
              <ReceitaHistogram data={stats.receita_hist} />
              <ArchetypeDonut data={stats.by_archetype} />
              <UfBreakdown data={stats.by_uf} />
              <div style={{ gridColumn: "2 / span 2" }}>
                <SectorBars data={stats.by_cnae_secao} />
              </div>
            </div>
          )}
        </section>

        {/* ───────── DEAL FLOW BOARD ───────── */}
        <section id="board" className="section">
          <div className="eyebrow">Deal Flow Board · top 20</div>
          <h2 className="section-title">
            Top picks por <em>receita estimada</em>
          </h2>
          <p className="subtitle">
            Maiores empresas single-plant em RJ/SP por faturamento estimado (alta + média confiança).
            Clique pra drill-down.
          </p>
          <DealFlowBoard onPick={deepDive} />
        </section>

        {/* ───────── PIPELINE / AGENTES ───────── */}
        <section id="agents" className="section">
          <div className="eyebrow">Engine Pipeline · 8 agents</div>
          <h2 className="section-title">
            Os <em>agentes</em>
          </h2>
          <p className="subtitle">
            Pipeline com responsabilidades isoladas. Motor (matcher · estimator · archetypist) +
            Produto (frontend · designer · backend) + Suporte (archivist · auditor). Status real via SSE.
          </p>
          <AgentRoom />
        </section>

        {/* ───────── SCREENER ───────── */}
        <section id="screener" className="section">
          <div className="eyebrow">Screener · filtros de produto</div>
          <h2 className="section-title">
            Triagem <em>customizável</em>
          </h2>
          {!domains ? (
            <div className="muted" style={{ marginTop: 16 }}>carregando filtros…</div>
          ) : (
            <div className="screener-layout">
              <FilterPanel domains={domains} value={params} onChange={setParams} />
              <ResultsTable
                data={data}
                loading={loading}
                params={params}
                onChangeParams={setParams}
                onPickEmpresa={deepDive}
              />
            </div>
          )}
          <div className="muted" style={{ marginTop: 24, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase" }}>
            metodologia · docs/architecture.md v3.1 · validação |erro| mediano 23%
          </div>
        </section>
      </div>

      <DetailModal empresa={picked} onClose={() => setPicked(null)} />
    </>
  );
}
