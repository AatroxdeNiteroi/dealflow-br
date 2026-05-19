import { AnimatePresence, motion } from "framer-motion";
import { fetchContato, fetchSocios, type Empresa } from "../../api/client";
import { useHistory } from "../../hooks/useHistory";
import { fmtBrl, labelArchetype, labelConfidence, labelPrecision, tickerSym } from "../../utils/labels";
import { downloadEmpresaPdf } from "../../utils/pdf";
import ContatoPanel from "../Contato/ContatoPanel";
import HeadcountTimeline from "../History/HeadcountTimeline";
import SociosPanel from "../Group/SociosPanel";
import WatchlistToggle from "../Watchlist/WatchlistToggle";

interface Props {
  empresa: Empresa | null;
  onClose: () => void;
}

const CONVERGENCIA_LABEL: Record<string, string> = {
  convergente: "Convergente",
  divergente_medio: "Divergência média",
  divergente_forte: "Divergência forte",
  sem_pia: "Sem cobertura PIA",
};

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

              {(empresa.receita_pia_brl != null || empresa.piso_federal_anual_brl != null) && (
                <>
                  <h4>Validação cruzada</h4>
                  <div className="detail-grid detail-grid--mb">
                    {empresa.receita_pia_brl != null && (
                      <div className="detail-field">
                        <div className="label">2ª Estimativa · PIA receita/funcionário</div>
                        <div className="value">{fmtBrl(empresa.receita_pia_brl)}</div>
                        {empresa.convergencia_flag && (
                          <div
                            className={`label label--mt ${
                              empresa.convergencia_flag === "convergente"
                                ? "up"
                                : empresa.convergencia_flag === "divergente_forte"
                                  ? "down"
                                  : ""
                            }`}
                          >
                            {CONVERGENCIA_LABEL[empresa.convergencia_flag] ?? empresa.convergencia_flag}
                            {empresa.convergencia_pct != null &&
                              ` · Δ ${empresa.convergencia_pct.toFixed(0)}%`}
                          </div>
                        )}
                      </div>
                    )}
                    {empresa.piso_federal_anual_brl != null && (
                      <div className="detail-field">
                        <div className="label">
                          Piso · contratos federais
                          {empresa.n_contratos_federais
                            ? ` (${empresa.n_contratos_federais})`
                            : ""}
                        </div>
                        <div className={`value ${empresa.flag_subestimacao_federal ? "down" : ""}`}>
                          {fmtBrl(empresa.piso_federal_anual_brl)}/ano
                        </div>
                        {empresa.flag_subestimacao_federal && (
                          <div className="label label--mt down">
                            Piso oficial &gt; estimativa — motor subestima
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
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
              <SociosPanel cnpj={empresa.cnpj} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
