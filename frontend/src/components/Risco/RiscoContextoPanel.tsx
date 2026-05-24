import { useRiscoContexto } from "../../hooks/useRiscoContexto";

interface Props {
  cnpj: string;
}

function trendBadge(pct: number | null | undefined): JSX.Element {
  if (pct === null || pct === undefined) return <span className="risco-trend risco-trend--neutral">—</span>;
  if (pct > 5) return <span className="risco-trend risco-trend--alta">▲ {pct.toFixed(1)}%</span>;
  if (pct < -5) return <span className="risco-trend risco-trend--baixa">▼ {Math.abs(pct).toFixed(1)}%</span>;
  return <span className="risco-trend risco-trend--neutral">→ {pct.toFixed(1)}%</span>;
}

/**
 * Contexto regional de risco — Datajud agregado.
 *
 * Mostra o volume de Recuperações Judiciais, Falências e RJs
 * Extrajudiciais abertas na UF da empresa nos últimos 12 meses,
 * comparado aos 12m anteriores. Sinal de ambiente — não diz que
 * ESTA empresa está em RJ, mas indica se o setor regional vive
 * um pico de insolvência.
 */
export default function RiscoContextoPanel({ cnpj }: Props) {
  const { data, loading } = useRiscoContexto(cnpj);

  if (loading) {
    return (
      <div className="risco-panel">
        <h4>Contexto regional · processos de RJ e falência</h4>
        <div className="risco-loading sk sk-line" style={{ height: 70 }} />
      </div>
    );
  }
  if (!data || !data.disponivel || !data.atual) return null;

  const { uf, atual, trend_pct } = data;

  return (
    <div className="risco-panel">
      <h4>Contexto regional · processos de RJ e falência</h4>
      <p className="risco-source" style={{ marginBottom: 8, marginTop: 0 }}>
        Em <strong>{uf}</strong>, nos últimos 12 meses — comparado aos 12m anteriores.
      </p>

      <div className="risco-grid risco-grid--tri">
        <div className="risco-row">
          <span className="risco-label">Recuperação Judicial</span>
          <span className="risco-value">
            <strong className="risco-num">{atual.recuperacao_judicial.toLocaleString("pt-BR")}</strong>
            {trendBadge(trend_pct?.recuperacao_judicial)}
          </span>
        </div>
        <div className="risco-row">
          <span className="risco-label">Falência</span>
          <span className="risco-value">
            <strong className="risco-num">{atual.falencia.toLocaleString("pt-BR")}</strong>
            {trendBadge(trend_pct?.falencia)}
          </span>
        </div>
        <div className="risco-row">
          <span className="risco-label">Total + Extrajudicial</span>
          <span className="risco-value">
            <strong className="risco-num">{atual.total.toLocaleString("pt-BR")}</strong>
            {trendBadge(trend_pct?.total)}
          </span>
        </div>
      </div>

      <p className="risco-source">
        Fonte: CNJ Datajud · API pública. Datajud mascara o nome das partes (LGPD),
        por isso este é um sinal regional/setorial, não por empresa específica.
      </p>
    </div>
  );
}
