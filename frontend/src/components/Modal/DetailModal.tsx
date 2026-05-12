import { AnimatePresence, motion } from "framer-motion";
import Fingerprint from "../Sparkline/Fingerprint";
import type { Empresa } from "../../api/client";
import { fmtBrl, labelArchetype, labelConfidence, labelPrecision, tickerSym } from "../../utils/labels";

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
            <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>

            <div className="modal-head">
              <div className="ticker-line">
                <span className="sym">{tickerSym(empresa.razao_social)}</span>
                <span className="nome">{empresa.razao_social}</span>
              </div>
              <div className="meta">
                {empresa.cnpj} · {empresa.sigla_uf} · CNAE {empresa.cnae_2_subclasse} ·
                Seção {empresa.cnae_secao} · {labelArchetype(empresa.archetype)}
              </div>
              <div className="modal-head-spark">
                <Fingerprint empresa={empresa} width={240} height={48} showLabels />
              </div>
            </div>

            <div className="modal-body">
              <h4>Estimativa</h4>
              <div className="detail-grid detail-grid--mb">

                <div className="detail-field">
                  <div className="label">Receita Estimada</div>
                  <div className="value large gold">{fmtBrl(empresa.receita_point_brl)}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Intervalo</div>
                  <div className="value">{fmtBrl(empresa.receita_low_brl)} → {fmtBrl(empresa.receita_high_brl)}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Confiança · razão</div>
                  <div className={`value ${empresa.confidence === "alta" ? "up" : empresa.confidence === "baixa" ? "down" : ""}`}>
                    {labelConfidence(empresa.confidence)}
                  </div>
                  <div className="label label--mt">Razão: {labelPrecision(empresa.razao_precision)}</div>
                </div>
              </div>

              <h4>Estrutura</h4>
              <div className="detail-grid">
                <div className="detail-field">
                  <div className="label">Vínculos Ativos</div>
                  <div className="value">{empresa.headcount.toLocaleString("pt-BR")}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Capital Social</div>
                  <div className="value">{fmtBrl(empresa.capital_social)}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Idade</div>
                  <div className="value">{empresa.idade_empresa_anos ?? "—"} Anos</div>
                </div>
                <div className="detail-field">
                  <div className="label">Sócios (Total)</div>
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
                  <div className="label">Porte Declarado</div>
                  <div className="value">{empresa.porte ?? "—"}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Tier · Match</div>
                  <div className="value">{empresa.match_tier}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Bairro · Município</div>
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
