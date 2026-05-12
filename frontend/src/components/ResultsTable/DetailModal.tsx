import { AnimatePresence, motion } from "framer-motion";
import type { Empresa } from "../../api/client";

function fmtBrl(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
}

interface Props {
  empresa: Empresa | null;
  onClose: () => void;
}

export default function DetailModal({ empresa, onClose }: Props) {
  return (
    <AnimatePresence>
      {empresa && (
        <motion.div
          className="detail-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="detail-modal"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            style={{ position: "relative" }}
          >
            <button className="close" onClick={onClose}>×</button>
            <div className="eyebrow">{empresa.archetype}</div>
            <h3>{empresa.razao_social}</h3>
            <div className="muted">CNPJ {empresa.cnpj} · {empresa.sigla_uf} · CNAE {empresa.cnae_2_subclasse}</div>

            <div className="detail-grid">
              <div className="detail-field">
                <div className="label">Receita estimada</div>
                <div className="value">{fmtBrl(empresa.receita_point_brl)}</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                  intervalo: {fmtBrl(empresa.receita_low_brl)} → {fmtBrl(empresa.receita_high_brl)}
                </div>
              </div>
              <div className="detail-field">
                <div className="label">Confiança</div>
                <div className="value">{empresa.confidence}</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                  razão: {empresa.razao_precision}
                </div>
              </div>
              <div className="detail-field">
                <div className="label">Headcount (RAIS 2024)</div>
                <div className="value">{empresa.headcount.toLocaleString("pt-BR")} funcs</div>
              </div>
              <div className="detail-field">
                <div className="label">Capital social</div>
                <div className="value">{fmtBrl(empresa.capital_social)}</div>
              </div>
              <div className="detail-field">
                <div className="label">Idade</div>
                <div className="value">{empresa.idade_empresa_anos ?? "—"} anos</div>
              </div>
              <div className="detail-field">
                <div className="label">Sócios</div>
                <div className="value">{empresa.n_socios ?? "—"}</div>
              </div>
              <div className="detail-field">
                <div className="label">Tier</div>
                <div className="value">{empresa.match_tier}</div>
              </div>
              <div className="detail-field">
                <div className="label">Porte declarado</div>
                <div className="value">{empresa.porte ?? "—"}</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
