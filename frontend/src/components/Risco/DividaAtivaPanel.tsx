import { useDividaAtiva } from "../../hooks/useDividaAtiva";
import { fmtBrl } from "../../utils/labels";

interface Props {
  cnpj: string;
}

/**
 * Sinal de risco fiscal — Dívida Ativa da União (PGFN).
 *
 * Fonte 100% pública oficial (dadosabertos.pgfn.gov.br, trimestral).
 * Sem cobrança: o que o Serasa cobra R$ 45 por consulta, aqui é
 * inscrição direta no parquet local.
 */
export default function DividaAtivaPanel({ cnpj }: Props) {
  const { data, loading } = useDividaAtiva(cnpj);

  if (loading) {
    return (
      <div className="risco-panel">
        <h4>Dívida ativa federal</h4>
        <div className="risco-loading sk sk-line" style={{ height: 50 }} />
      </div>
    );
  }
  if (!data) return null;

  if (!data.tem_divida) {
    return (
      <div className="risco-panel">
        <h4>Dívida ativa federal</h4>
        <div className="risco-flag risco-flag--ok">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="risco-flag__icon">
            <path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="risco-flag__label">Limpo na PGFN</span>
          <span className="risco-flag__hint">
            Sem inscrições ativas no último trimestre publicado.
          </span>
        </div>
        <p className="risco-source">
          Fonte: PGFN · Dívida Ativa da União (público, LAI). Atualizado trimestralmente.
        </p>
      </div>
    );
  }

  const valor = data.valor_total_brl ?? 0;
  const ajuiz = data.n_ajuizadas ?? 0;
  const total = data.n_inscricoes ?? 0;
  const datasets: string[] = [];
  if (data.tem_tributaria) datasets.push("Tributária");
  if (data.tem_previdenciaria) datasets.push("Previdenciária");
  if (data.tem_fgts) datasets.push("FGTS");

  // gravidade: > R$ 10M = crítica; > R$ 1M = alerta; outros = atenção
  const grav = valor > 10_000_000 ? "critica" : valor > 1_000_000 ? "alerta" : "atencao";

  return (
    <div className="risco-panel">
      <h4>Dívida ativa federal</h4>
      <div className={`risco-flag risco-flag--${grav}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="risco-flag__icon">
          <path d="M12 3 2 21h20Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M12 10v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="18" r="1" fill="currentColor" />
        </svg>
        <span className="risco-flag__label">{fmtBrl(valor)}</span>
        <span className="risco-flag__hint">
          {total} inscriç{total === 1 ? "ão" : "ões"} · {ajuiz} ajuizad{ajuiz === 1 ? "a" : "as"}
        </span>
      </div>

      <div className="risco-grid">
        {datasets.length > 0 && (
          <div className="risco-row">
            <span className="risco-label">Tipos</span>
            <span className="risco-value">
              {datasets.map((d) => (
                <span key={d} className="risco-tag">{d}</span>
              ))}
            </span>
          </div>
        )}
        {data.receita_principal_mais_comum && (
          <div className="risco-row">
            <span className="risco-label">Receita principal</span>
            <span className="risco-value">{data.receita_principal_mais_comum}</span>
          </div>
        )}
        {data.situacao_mais_comum && (
          <div className="risco-row">
            <span className="risco-label">Situação</span>
            <span className="risco-value">{data.situacao_mais_comum}</span>
          </div>
        )}
      </div>

      <p className="risco-source">
        Fonte: PGFN · Dívida Ativa da União, Previdenciária e FGTS (público, LAI).
        Atualizado trimestralmente em dadosabertos.pgfn.gov.br.
      </p>
    </div>
  );
}
