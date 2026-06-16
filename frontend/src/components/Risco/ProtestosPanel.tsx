import { useProtestos } from "../../hooks/useProtestos";
import { fmtBrl } from "../../utils/labels";

interface Props {
  cnpj: string;
}

/**
 * Protestos em cartório (CENPROT/IEPTB) — consulta on-demand.
 *
 * A base de protestos não tem API pública livre (WAF + reCAPTCHA +
 * login GOV.BR), então a consulta passa por um provedor homologado, por
 * CNPJ, com cache no backend. Sem provedor configurado, o painel mostra
 * o estado "monitoramento sob demanda" — neutro, nunca um erro.
 *
 * Bandeira de gravidade (quando há protesto), por valor protestado:
 *   verde (sem protesto) · amarela (< R$ 50 mil) ·
 *   laranja (R$ 50–500 mil) · vermelha (> R$ 500 mil).
 */
export default function ProtestosPanel({ cnpj }: Props) {
  const { data, loading } = useProtestos(cnpj);

  if (loading) {
    return (
      <div className="risco-panel">
        <h4>Protestos em cartório</h4>
        <div className="risco-loading sk sk-line" style={{ height: 56 }} />
      </div>
    );
  }
  if (!data) return null;

  // Provedor não configurado / consulta indisponível → estado neutro.
  if (!data.disponivel) {
    return (
      <div className="risco-panel">
        <h4>Protestos em cartório</h4>
        <div className="risco-flag risco-flag--neutra">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="risco-flag__icon">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M12 7v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="16.5" r="1" fill="currentColor" />
          </svg>
          <span className="risco-flag__label">Monitoramento sob demanda</span>
          <span className="risco-flag__hint">
            Consulta de protestos por CNPJ, ao vivo, via cartórios (CENPROT/IEPTB).
          </span>
        </div>
        <p className="risco-source">
          Fonte: CENPROT/IEPTB — central dos cartórios de protesto. Consulta
          unitária (a base não permite varredura em massa).
        </p>
      </div>
    );
  }

  // Consultado e limpo → bandeira verde.
  if (!data.tem_protesto) {
    return (
      <div className="risco-panel">
        <h4>Protestos em cartório</h4>
        <div className="risco-flag risco-flag--ok">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="risco-flag__icon">
            <path
              d="M5 12.5l4.5 4.5L19 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="risco-flag__label">Sem protestos</span>
          <span className="risco-flag__hint">
            Nenhum protesto registrado nos cartórios consultados.
          </span>
        </div>
        <p className="risco-source">
          Fonte: {data.fonte}. Consultado ao vivo nos cartórios de protesto.
        </p>
      </div>
    );
  }

  const valor = data.valor_total_brl ?? 0;
  const n = data.n_protestos ?? 0;
  // gravidade: > R$ 500k = crítica; > R$ 50k = alerta; outros = atenção
  const grav = valor > 500_000 ? "critica" : valor > 50_000 ? "alerta" : "atencao";

  return (
    <div className="risco-panel">
      <h4>Protestos em cartório</h4>
      <div className={`risco-flag risco-flag--${grav}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="risco-flag__icon">
          <path d="M12 3 2 21h20Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M12 10v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="18" r="1" fill="currentColor" />
        </svg>
        <span className="risco-flag__label">{fmtBrl(valor)}</span>
        <span className="risco-flag__hint">
          {n} protesto{n === 1 ? "" : "s"}
          {data.ufs && data.ufs.length > 0 ? ` · ${data.ufs.join(", ")}` : ""}
        </span>
      </div>

      {data.cartorios && data.cartorios.length > 0 && (
        <div className="risco-grid">
          {data.cartorios.slice(0, 6).map((c, i) => (
            <div className="risco-row risco-row--full" key={i}>
              <span className="risco-label">
                {[c.cidade, c.uf].filter(Boolean).join(" / ") || c.cartorio || "Cartório"}
              </span>
              <span className="risco-value">
                {c.n_protestos > 0 && (
                  <span className="risco-tag">{c.n_protestos}×</span>
                )}
                {c.valor_brl > 0 && <span className="risco-tag">{fmtBrl(c.valor_brl)}</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="risco-source">
        Fonte: {data.fonte}. Consulta unitária por CNPJ — a base de cartórios
        não permite varredura em massa.
      </p>
    </div>
  );
}
