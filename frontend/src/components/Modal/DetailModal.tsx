import { AnimatePresence, motion } from "framer-motion";
import { fetchContato, fetchSocios, type Empresa } from "../../api/client";
import { useHistory } from "../../hooks/useHistory";
import { fmtBrl, labelArchetype, labelConfidence, labelPrecision, tickerSym } from "../../utils/labels";
import { downloadEmpresaPdf } from "../../utils/pdf";
import ContatoPanel from "../Contato/ContatoPanel";
import HeadcountTimeline from "../History/HeadcountTimeline";
import DividaAtivaPanel from "../Risco/DividaAtivaPanel";
import SociosPanel from "../Group/SociosPanel";
import WatchlistToggle from "../Watchlist/WatchlistToggle";

interface Props {
  empresa: Empresa | null;
  onClose: () => void;
}


export default function DetailModal({ empresa, onClose }: Props) {
  const history = useHistory(empresa?.cnpj);

  async function handleExportPdf() {
    if (!empresa) return;
    const [c, s] = await Promise.all([
      fetchContato(empresa.cnpj).catch(() => null),
      fetchSocios(empresa.cnpj).catch(() => ({ cnpj: empresa.cnpj, socios: [] })),
    ]);
    downloadEmpresaPdf({
      empresa,
      contato: c,
      history: history.data,
      socios: s.socios,
    });
  }

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
                <div className="modal-head-actions">
                  <button
                    type="button"
                    className="modal-head-btn"
                    onClick={handleExportPdf}
                    title="Exportar one-pager M&A em PDF"
                  >
                    PDF
                  </button>
                  <WatchlistToggle empresa={empresa} />
                </div>
              </div>
              <div className="meta">
                {empresa.cnpj} · {empresa.sigla_uf} · CNAE {empresa.cnae_2_subclasse} ·
                Seção {empresa.cnae_secao} · {labelArchetype(empresa.archetype)}
              </div>
              <HeadcountTimeline points={history.data} loading={history.loading} />
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

              {empresa.convergencia_flag === "convergente" && (
                <div className="cross-check-badge">
                  <span className="cross-check-mark" aria-hidden>✓</span>
                  <span className="cross-check-text">
                    <strong>Validação cruzada confirmada.</strong> Um segundo
                    método independente (receita por funcionário · PIA/IBGE)
                    converge com esta estimativa.
                  </span>
                </div>
              )}

              {empresa.piso_federal_anual_brl != null && (
                <div className="cross-check-badge">
                  <span className="cross-check-mark" aria-hidden>✓</span>
                  <span className="cross-check-text">
                    <strong>Piso de receita confirmado.</strong> Contratos
                    federais{empresa.n_contratos_federais ? ` (${empresa.n_contratos_federais})` : ""}{" "}
                    somam <strong>{fmtBrl(empresa.piso_federal_anual_brl)}/ano</strong> —
                    receita real é no mínimo este valor (fonte: Portal da Transparência).
                  </span>
                </div>
              )}

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

              <ContatoPanel empresa={empresa} />
              <DividaAtivaPanel cnpj={empresa.cnpj} />
              <SociosPanel cnpj={empresa.cnpj} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
