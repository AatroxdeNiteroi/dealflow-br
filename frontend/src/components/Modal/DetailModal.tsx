import { AnimatePresence, motion } from "framer-motion";
import Sparkline from "../Sparkline/Sparkline";
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
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={onClose}>×</button>

            <div className="modal-head">
              <div className="ticker-line">
                <span className="sym">{tickerSym(empresa.razao_social)}</span>
                <span className="nome">{empresa.razao_social}</span>
              </div>
              <div className="meta">
                {empresa.cnpj} · {empresa.sigla_uf} · CNAE {empresa.cnae_2_subclasse} ·
                seção {empresa.cnae_secao} · {empresa.archetype}
              </div>
              <div style={{ marginTop: 14 }}>
                <Sparkline seed={empresa.cnpj} width={240} height={48} points={48} />
              </div>
            </div>

            <div className="modal-body">
              <h4>Estimativa</h4>
              <div className="detail-grid" style={{ marginBottom: 24 }}>
                <div className="detail-field">
                  <div className="label">Receita estimada</div>
                  <div className="value large gold">{fmtBrl(empresa.receita_point_brl)}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Intervalo</div>
                  <div className="value">{fmtBrl(empresa.receita_low_brl)} → {fmtBrl(empresa.receita_high_brl)}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Confiança · razão</div>
                  <div className={`value ${empresa.confidence === "alta" ? "up" : empresa.confidence === "baixa" ? "down" : ""}`}>
                    {empresa.confidence.toUpperCase()}
                  </div>
                  <div className="label" style={{ marginTop: 6 }}>razão: {empresa.razao_precision}</div>
                </div>
              </div>

              <h4>Estrutura</h4>
              <div className="detail-grid">
                <div className="detail-field">
                  <div className="label">Headcount RAIS</div>
                  <div className="value">{empresa.headcount.toLocaleString("pt-BR")}</div>
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
                  <div className="label">Sócios (total)</div>
                  <div className="value">{empresa.n_socios ?? "—"}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Sócios PF</div>
                  <div className="value">{empresa.n_socios_pf ?? "—"}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Sócios PJ</div>
                  <div className="value">{empresa.n_socios_pj ?? "—"}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Porte declarado</div>
                  <div className="value">{empresa.porte ?? "—"}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Tier · match</div>
                  <div className="value">{empresa.match_tier}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Bairro · município</div>
                  <div className="value">{empresa.bairro ?? "—"}</div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
