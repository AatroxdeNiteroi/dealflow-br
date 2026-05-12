import { motion } from "framer-motion";
import type { Empresa } from "../../api/client";

function fmtBrl(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(2)} B`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)} M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)} k`;
  return `R$ ${v.toFixed(0)}`;
}

function tickerSym(razao: string): string {
  return razao
    .replace(/(LTDA\.?|S\/?\.?A\.?|EIRELI|ME|EPP).*$/gi, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.substring(0, 2))
    .join("")
    .substring(0, 4)
    .toUpperCase();
}

const ARCHETYPE_LABELS: Record<string, string> = {
  family_mature_sweet_spot: "Family Mature",
  labor_intensive_midcap: "Labor Mid-Cap",
  capital_intensive: "Capital Intensive",
  standard: "Standard",
  holding_structure: "Holding",
  recent_startup: "Startup",
  partnership_heavy_services: "Partnership",
  financeiro_out_scope: "Financeiro",
};

interface Props {
  empresa: Empresa;
  index: number;
  onClick: () => void;
}

export default function EmpresaCard({ empresa, index, onClick }: Props) {
  return (
    <motion.article
      className="empresa-card"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.025, 0.4), duration: 0.25, ease: "easeOut" }}
      onClick={onClick}
    >
      <div className="ticker-glyph">{tickerSym(empresa.razao_social)}</div>

      <div className="nome-block">
        <div className="nome">{empresa.razao_social}</div>
        <div className="cnpj-line">
          <span className="uf-tag">{empresa.sigla_uf}</span>
          {empresa.cnpj} · {ARCHETYPE_LABELS[empresa.archetype] ?? empresa.archetype}
        </div>
      </div>

      <div className="kpi-block">
        <div className="kpi-l">Receita estimada</div>
        <div className="kpi-v large gold">{fmtBrl(empresa.receita_point_brl)}</div>
      </div>

      <div className="kpi-block card-col--hide-md">
        <div className="kpi-l">Headcount · CLT</div>
        <div className="kpi-v">{empresa.headcount.toLocaleString("pt-BR")}</div>
      </div>

      <div className="kpi-block card-col--hide-md">
        <div className="kpi-l">Idade · Capital</div>
        <div className="kpi-v">
          {empresa.idade_empresa_anos ?? "—"}a · {fmtBrl(empresa.capital_social)}
        </div>
      </div>

      <div className={`conf-pill conf-${empresa.confidence}`}>
        {empresa.confidence}
      </div>

      <span className="arrow card-col--hide-sm">→</span>
    </motion.article>
  );
}
