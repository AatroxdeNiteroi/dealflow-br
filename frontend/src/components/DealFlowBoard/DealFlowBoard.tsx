import { motion } from "framer-motion";
import { useTopEmpresas } from "../../hooks/useStats";
import type { Empresa } from "../../api/client";

function fmt(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e9) return `R$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `R$${(v / 1e6).toFixed(0)}M`;
  return `R$${(v / 1e3).toFixed(0)}k`;
}

interface Props {
  onPick: (e: Empresa) => void;
}

export default function DealFlowBoard({ onPick }: Props) {
  const top = useTopEmpresas(20);
  return (
    <div className="board">
      {top.map((e, i) => (
        <motion.div
          key={e.cnpj}
          className="board-row"
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ delay: Math.min(i * 0.03, 0.4), duration: 0.3 }}
          onClick={() => onPick(e)}
        >
          <div className="board-rank">{String(i + 1).padStart(2, "0")}</div>
          <div className="board-name">
            {e.razao_social}
            <small>{e.cnae_secao}</small>
          </div>
          <div className="board-uf">{e.sigla_uf}</div>
          <div className="board-value">
            {fmt(e.receita_point_brl)}
            <small>{e.headcount}f</small>
          </div>
          <div className={`board-conf conf-${e.confidence}`}>{e.confidence}</div>
        </motion.div>
      ))}
    </div>
  );
}
