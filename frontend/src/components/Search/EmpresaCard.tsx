import { motion } from "framer-motion";
import type { Empresa } from "../../api/client";
import { fmtBrl, labelArchetype, labelConfidence, tickerSym } from "../../utils/labels";

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
          {empresa.cnpj} · {labelArchetype(empresa.archetype)}
        </div>
      </div>

      <div className="kpi-block">
        <div className="kpi-l">Receita Estimada</div>
        <div className="kpi-v large gold">{fmtBrl(empresa.receita_point_brl)}</div>
      </div>

      <div className="kpi-block card-col--hide-md">
        <div className="kpi-l">Vínculos Ativos</div>
        <div className="kpi-v">{empresa.headcount.toLocaleString("pt-BR")}</div>
      </div>

      <div className="kpi-block card-col--hide-md">
        <div className="kpi-l">Idade · Capital</div>
        <div className="kpi-v">
          {empresa.idade_empresa_anos ?? "—"}a · {fmtBrl(empresa.capital_social)}
        </div>
      </div>

      <div className={`conf-pill conf-${empresa.confidence}`}>
        {labelConfidence(empresa.confidence)}
      </div>

      <span className="arrow card-col--hide-sm">→</span>
    </motion.article>
  );
}
