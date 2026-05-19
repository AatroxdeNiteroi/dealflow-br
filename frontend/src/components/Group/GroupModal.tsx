import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { fetchGrupoDoSocio, type Empresa } from "../../api/client";
import { fmtBrlCompact, labelArchetype, labelConfidence, tickerSym } from "../../utils/labels";

interface Props {
  socioKey: string | null;
  socioLabel: string;
  onClose: () => void;
}

export default function GroupModal({ socioKey, socioLabel, onClose }: Props) {
  const [empresas, setEmpresas] = useState<Empresa[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!socioKey) {
      setEmpresas(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchGrupoDoSocio(socioKey)
      .then((r) => {
        if (!cancelled) setEmpresas(r.empresas);
      })
      .catch(() => {
        if (!cancelled) setEmpresas([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [socioKey]);

  const isPJ = socioKey?.startsWith("PJ:");
  const totalReceita = empresas?.reduce((acc, e) => acc + (e.receita_point_brl ?? 0), 0) ?? 0;

  return (
    <AnimatePresence>
      {socioKey && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal group-modal"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>

            <div className="group-body">
              <div className="group-eyebrow">
                {isPJ ? "Estrutura de grupo · sócio PJ" : "Sócios em comum · pessoa física"}
              </div>
              <h2 className="group-title">
                <em>{socioLabel}</em>
              </h2>
              <p className="group-intro">
                Empresas do universo DealFlow que compartilham este sócio no quadro
                societário oficial. {isPJ
                  ? "Sócio PJ tipicamente sinaliza estrutura de grupo empresarial."
                  : "Sinal de potencial estrutura familiar ou grupo informal."}
              </p>

              {loading ? (
                <div className="group-loading">Carregando empresas do grupo…</div>
              ) : !empresas || empresas.length === 0 ? (
                <div className="group-empty">Sem empresas adicionais encontradas.</div>
              ) : (
                <>
                  <div className="group-summary">
                    <div className="group-stat">
                      <div className="group-stat-label">Empresas no grupo</div>
                      <div className="group-stat-value">{empresas.length}</div>
                    </div>
                    {totalReceita > 0 && (
                      <div className="group-stat">
                        <div className="group-stat-label">Receita agregada estimada</div>
                        <div className="group-stat-value mono">{fmtBrlCompact(totalReceita)}</div>
                      </div>
                    )}
                  </div>

                  <ul className="group-list">
                    {empresas.map((e) => (
                      <li key={e.cnpj} className="group-row">
                        <div className="group-glyph">{tickerSym(e.razao_social)}</div>
                        <div className="group-nome-block">
                          <div className="group-nome">{e.razao_social}</div>
                          <div className="group-meta">
                            {e.sigla_uf} · {e.cnpj} · {labelArchetype(e.archetype)}
                          </div>
                        </div>
                        <div className="group-kpi">
                          <div className="group-kpi-label">Receita</div>
                          <div className="group-kpi-value gold">{fmtBrlCompact(e.receita_point_brl)}</div>
                        </div>
                        <div className={`conf-pill conf-${e.confidence}`}>
                          {labelConfidence(e.confidence)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
