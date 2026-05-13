import { useEffect, useState } from "react";
import { fetchSocios, type Socio } from "../../api/client";
import GroupModal from "./GroupModal";

interface Props {
  cnpj: string;
}

export default function SociosPanel({ cnpj }: Props) {
  const [socios, setSocios] = useState<Socio[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [openLabel, setOpenLabel] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSocios(cnpj)
      .then((r) => {
        if (!cancelled) setSocios(r.socios);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cnpj]);

  if (loading) {
    return (
      <div className="socios-panel">
        <h4>Quadro societário</h4>
        <div className="socios-list">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="socio-row socio-row--skeleton">
              <div className="sk sk-line sk-line-w40" style={{ height: 14, width: 80 }} />
              <div className="sk sk-line sk-line-w60" style={{ height: 12 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="socios-panel">
        <h4>Quadro societário</h4>
        <div className="socios-empty">Não foi possível carregar sócios · {error}</div>
      </div>
    );
  }

  if (!socios || socios.length === 0) {
    return (
      <div className="socios-panel">
        <h4>Quadro societário</h4>
        <div className="socios-empty">Sem registro de sócios no snapshot atual.</div>
      </div>
    );
  }

  return (
    <div className="socios-panel">
      <h4>Quadro societário · {socios.length}</h4>
      <ul className="socios-list">
        {socios.map((s) => {
          const isConnected = s.n_empresas > 1;
          return (
            <li
              key={s.socio_key}
              className={`socio-row${isConnected ? " socio-row--connected" : ""}`}
              onClick={() => {
                if (isConnected) {
                  setOpenKey(s.socio_key);
                  setOpenLabel(s.iniciais);
                }
              }}
              role={isConnected ? "button" : undefined}
              tabIndex={isConnected ? 0 : undefined}
            >
              <span className={`socio-tipo socio-tipo--${s.tipo.toLowerCase()}`}>{s.tipo}</span>
              <span className="socio-nome">{s.iniciais}</span>
              <span className="socio-qual">{s.qualificacao || "—"}</span>
              {isConnected && (
                <span className="socio-connection">
                  também em <strong>{s.n_empresas - 1}</strong> {s.n_empresas - 1 === 1 ? "empresa" : "empresas"}
                  <span className="socio-arrow">→</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <GroupModal
        socioKey={openKey}
        socioLabel={openLabel}
        onClose={() => setOpenKey(null)}
      />
    </div>
  );
}
