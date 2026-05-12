import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import type { Empresa, QueryParams } from "../api/client";
import AgentRoom from "../components/AgentRoom/AgentRoom";
import FilterPanel from "../components/Filters/FilterPanel";
import DetailModal from "../components/ResultsTable/DetailModal";
import ResultsTable from "../components/ResultsTable/ResultsTable";
import CountUp from "../components/ui/CountUp";
import Teleport from "../components/ui/Teleport";
import { useEmpresas } from "../hooks/useEmpresas";
import { useFiltros } from "../hooks/useFiltros";

const SECTIONS = [
  { id: "hero", label: "Início" },
  { id: "pipeline", label: "Pipeline" },
  { id: "triagem", label: "Triagem" },
  { id: "metodologia", label: "Metodologia" },
];

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null!);
  const domains = useFiltros();
  const [params, setParams] = useState<QueryParams>({ limit: 50, offset: 0 });
  const { data, loading } = useEmpresas(params);
  const [picked, setPicked] = useState<Empresa | null>(null);

  // Parallax do hero baseado no scroll do container
  const { scrollY } = useScroll({ container: containerRef });
  const heroY = useTransform(scrollY, [0, 800], [0, -120]);
  const heroOpacity = useTransform(scrollY, [0, 400, 700], [1, 0.6, 0]);

  return (
    <>
      <Teleport sections={SECTIONS} containerRef={containerRef} />

      <div ref={containerRef} className="scroll-container">
        {/* ──────────── HERO ──────────── */}
        <section id="hero" className="section">
          <motion.div style={{ y: heroY, opacity: heroOpacity, flex: 1 }} className="flex-col">
            <div className="spacer" />
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="eyebrow">DealFlow BR · motor de triagem M&amp;A</div>
              <h1 className="display">
                Triagem<br />de empresas<br />reais.
              </h1>
              <p className="subtitle">
                Estimativa de faturamento sobre Ltdas single-plant em RJ/SP.
                Metodologia auditável: Receita Federal + RAIS + IBGE PIA/PAS/PAC.
                Cada número rastreável até a fonte primária.
              </p>
            </motion.div>

            {domains && (
              <motion.div
                className="stats"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                <div className="stat">
                  <div className="stat-value"><CountUp to={domains.total_empresas} /></div>
                  <div className="stat-label">Empresas single-plant</div>
                  <div className="stat-hint">Tier 1 + Tier 2 desempatado</div>
                </div>
                <div className="stat">
                  <div className="stat-value">8</div>
                  <div className="stat-label">Agentes</div>
                  <div className="stat-hint">3 motor · 3 produto · 2 suporte</div>
                </div>
                <div className="stat">
                  <div className="stat-value"><CountUp to={domains.archetypes.length} /></div>
                  <div className="stat-label">Archetypes</div>
                  <div className="stat-hint">Magic filter disponível</div>
                </div>
                <div className="stat">
                  <div className="stat-value">±20%</div>
                  <div className="stat-label">Erro mediano</div>
                  <div className="stat-hint">vs DRE pública confirmada</div>
                </div>
              </motion.div>
            )}
            <div className="spacer" />
            <motion.div
              className="muted"
              style={{ fontSize: 11, textAlign: "center" }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              ↓ role para ver o pipeline
            </motion.div>
          </motion.div>
        </section>

        {/* ──────────── PIPELINE / AGENTES ──────────── */}
        <section id="pipeline" className="section">
          <div className="eyebrow">Pipeline</div>
          <h2 className="section-title">Os 8 agentes</h2>
          <p className="subtitle">
            Pipeline visível em tempo real. Cada agente tem responsabilidade isolada e
            estado independente. Veja eles trabalhando.
          </p>
          <AgentRoom />
        </section>

        {/* ──────────── TRIAGEM ──────────── */}
        <section id="triagem" className="section">
          <div className="eyebrow">Filtros de produto</div>
          <h2 className="section-title">Triagem</h2>
          {!domains ? (
            <div className="muted">carregando filtros…</div>
          ) : (
            <div className="triagem-layout">
              <FilterPanel domains={domains} value={params} onChange={setParams} />
              <ResultsTable
                data={data}
                loading={loading}
                params={params}
                onChangeParams={setParams}
                onPickEmpresa={setPicked}
              />
            </div>
          )}
        </section>

        {/* ──────────── METODOLOGIA ──────────── */}
        <section id="metodologia" className="section section--auto">
          <div className="eyebrow">Auditoria</div>
          <h2 className="section-title">Metodologia</h2>
          <p className="subtitle">
            Fórmula §6.1: <strong>Receita = Headcount × Salário × 12 × Encargos ÷
            Razão_folha_receita(CNAE)</strong>. Headcount vem da RAIS. Salário do
            benchmark CNAE × município. Encargos por seção CNAE. Razão folha/receita
            do IBGE PIA/PAS/PAC com ajuste por faixa de pessoal (1839).
          </p>
          <div className="stats" style={{ marginTop: 32 }}>
            <div className="stat">
              <div className="stat-label">Fonte 1</div>
              <div className="stat-hint" style={{ fontSize: 14, color: "var(--text-1)", marginTop: 8 }}>
                Receita Federal CNPJ via Base dos Dados (snapshot 2024-12-18)
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Fonte 2</div>
              <div className="stat-hint" style={{ fontSize: 14, color: "var(--text-1)", marginTop: 8 }}>
                RAIS Estabelecimentos 2024 (MTE) — headcount CLT
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Fonte 3</div>
              <div className="stat-hint" style={{ fontSize: 14, color: "var(--text-1)", marginTop: 8 }}>
                RAIS Vínculos 2024 — salário médio CNAE × município
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Fonte 4</div>
              <div className="stat-hint" style={{ fontSize: 14, color: "var(--text-1)", marginTop: 8 }}>
                IBGE PIA/PAS/PAC 2023 — razão folha/receita setorial
              </div>
            </div>
          </div>
          <div className="muted" style={{ marginTop: 48, fontSize: 11, textAlign: "center" }}>
            docs completos em <code>docs/architecture.md</code> · validação em
            <code> scripts/validation/validate_final_vs_dre.py</code>
          </div>
        </section>
      </div>

      <DetailModal empresa={picked} onClose={() => setPicked(null)} />
    </>
  );
}
