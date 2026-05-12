import { AnimatePresence, motion } from "framer-motion";
import type { Empresa } from "../../api/client";

function fmtBrl(v: number | null | undefined): string {
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
    .join("")
    .substring(0, 8)
    .toUpperCase();
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
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close" onClick={onClose}>×</button>

            <div className="detail-head">
              <div className="ticker-line">
                <span className="sym">{tickerSym(empresa.razao_social)}</span>
                <span className="nome">{empresa.razao_social}</span>
              </div>
              <div className="meta">
                CNPJ {empresa.cnpj} · {empresa.sigla_uf} · CNAE {empresa.cnae_2_subclasse} ·
                seção {empresa.cnae_secao} · {empresa.archetype}
              </div>
            </div>

            <div className="detail-body">
              <div className="detail-grid">
                <div className="detail-field">
                  <div className="label">Receita estimada (point)</div>
                  <div className="value amber">{fmtBrl(empresa.receita_point_brl)}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Intervalo (low–high)</div>
                  <div className="value">{fmtBrl(empresa.receita_low_brl)} → {fmtBrl(empresa.receita_high_brl)}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Confiança · razão</div>
                  <div className={`value ${empresa.confidence === "alta" ? "up" : empresa.confidence === "baixa" ? "down" : "amber"}`}>
                    {empresa.confidence.toUpperCase()}
                  </div>
                  <div className="label" style={{ marginTop: 4 }}>{empresa.razao_precision}</div>
                </div>

                <div className="detail-field">
                  <div className="label">Headcount RAIS</div>
                  <div className="value">{empresa.headcount.toLocaleString("pt-BR")}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Capital social</div>
                  <div className="value">{fmtBrl(empresa.capital_social)}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Idade da empresa</div>
                  <div className="value">{empresa.idade_empresa_anos ?? "—"} anos</div>
                </div>

                <div className="detail-field">
                  <div className="label">Sócios</div>
                  <div className="value">{empresa.n_socios ?? "—"}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Porte declarado</div>
                  <div className="value">{empresa.porte ?? "—"}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Tier · match</div>
                  <div className="value">{empresa.match_tier}</div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
