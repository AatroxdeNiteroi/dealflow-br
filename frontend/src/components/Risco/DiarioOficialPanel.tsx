import { useDiarioOficial } from "../../hooks/useDiarioOficial";

interface Props {
  cnpj: string;
}

/**
 * Querido Diário — menções ao CNPJ em Diários Oficiais municipais.
 *
 * Consulta on-demand (a API rate-limita batches): cada vez que o
 * DetailModal abre, dispara 1 call ao QD. Resultado é cacheado no
 * processo do backend até o reinício.
 */
export default function DiarioOficialPanel({ cnpj }: Props) {
  const { data, loading } = useDiarioOficial(cnpj);

  if (loading) {
    return (
      <div className="risco-panel">
        <h4>Menções em Diários Oficiais</h4>
        <div className="risco-loading sk sk-line" style={{ height: 60 }} />
      </div>
    );
  }
  if (!data) return null;

  const n = data.n_mencoes;
  const hasUltima = !!data.ultima_data && !!data.ultima_url;

  return (
    <div className="risco-panel">
      <h4>Menções em Diários Oficiais</h4>

      {n === 0 ? (
        <div className="risco-flag risco-flag--ok">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="risco-flag__icon">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M9 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="risco-flag__label">Sem menções</span>
          <span className="risco-flag__hint">
            Nenhuma aparição nos DOs municipais indexados pelo Querido Diário.
          </span>
        </div>
      ) : (
        <>
          <div className="risco-flag risco-flag--atencao">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="risco-flag__icon">
              <rect
                x="3"
                y="5"
                width="18"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M7 9h10M7 12h10M7 15h6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span className="risco-flag__label">
              {n.toLocaleString("pt-BR")} {n === 1 ? "menção" : "menções"}
            </span>
            {hasUltima && (
              <span className="risco-flag__hint">
                Última em {data.ultima_data} ·{" "}
                <a href={data.ultima_url!} target="_blank" rel="noopener noreferrer">
                  ver PDF
                </a>
              </span>
            )}
          </div>

          {data.territorios && data.territorios.length > 0 && (
            <div className="risco-grid">
              <div className="risco-row risco-row--full">
                <span className="risco-label">Territórios</span>
                <span className="risco-value">
                  {data.territorios.map((t) => (
                    <span key={t} className="risco-tag">
                      {t}
                    </span>
                  ))}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      <p className="risco-source">
        Fonte: Querido Diário (Open Knowledge BR) · API pública{" "}
        <code>api.queridodiario.ok.org.br</code>. Cobre Diários Oficiais
        municipais indexados pelo projeto — não cobre todos.
      </p>
    </div>
  );
}
