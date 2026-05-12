import { AnimatePresence, motion } from "framer-motion";
import type { Empresa, EmpresasResponse, QueryParams } from "../../api/client";
import Sparkline from "../Sparkline/Sparkline";

interface Props {
  data: EmpresasResponse | null;
  loading: boolean;
  params: QueryParams;
  onChangeParams: (next: QueryParams) => void;
  onPickEmpresa: (e: Empresa) => void;
}

function fmtBrl(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e9) return `R$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `R$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `R$${(v / 1e3).toFixed(0)}k`;
  return `R$${v.toFixed(0)}`;
}

export default function ResultsTable({ data, loading, params, onChangeParams, onPickEmpresa }: Props) {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  const total = data?.total ?? 0;
  const items = data?.items ?? [];

  function downloadCsv() {
    if (!items.length) return;
    const keys = Object.keys(items[0]);
    const lines = [
      keys.join(","),
      ...items.map((row) =>
        keys
          .map((k) => {
            const v = (row as unknown as Record<string, unknown>)[k];
            if (v == null) return "";
            const s = String(v).replace(/"/g, '""');
            return /[,\n"]/.test(s) ? `"${s}"` : s;
          })
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dealflow_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="results-panel">
      <header className="results-header">
        <div>
          <div className="results-title">
            Resultados <span className="results-count">· {total.toLocaleString("pt-BR")} empresas no recorte</span>
          </div>
        </div>
        <div className="results-actions">
          <button className="action-btn" onClick={downloadCsv} disabled={!items.length}>
            Export CSV
          </button>
          <button className="action-btn primary" disabled={!items.length}>
            Adicionar à watchlist
          </button>
        </div>
      </header>

      <div className="results-table">
        {loading && !data ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--tan)", fontSize: 11, letterSpacing: "0.2em" }}>
            CARREGANDO…
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--tan)", fontSize: 12 }}>
            nenhuma empresa bate com esse recorte · relaxe filtros
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {items.map((e, i) => (
              <motion.div
                key={e.cnpj}
                className="empresa-row"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: Math.min(i * 0.008, 0.2), duration: 0.18 }}
                onClick={() => onPickEmpresa(e)}
              >
                <div className="rank">{String(offset + i + 1).padStart(3, "0")}</div>
                <div>
                  <div className="nome">{e.razao_social}</div>
                  <div className="cnpj">{e.cnpj}</div>
                </div>
                <div className="uf">{e.sigla_uf}</div>
                <div className="hc col--hide-md">{e.headcount}f</div>
                <div className="receita">{fmtBrl(e.receita_point_brl)}</div>
                <div className="spark col--hide-md">
                  <Sparkline seed={e.cnpj} width={70} height={22} points={16} />
                </div>
                <div className="arc col--hide-md">{e.archetype}</div>
                <div className={`conf conf-${e.confidence}`}>{e.confidence}</div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="pagination">
        <button
          onClick={() => onChangeParams({ ...params, offset: Math.max(0, offset - limit) })}
          disabled={offset === 0}
        >
          ← anteriores
        </button>
        <span className="pg-meta">
          {offset + 1}–{Math.min(offset + limit, total)} / {total.toLocaleString("pt-BR")}
        </span>
        <button
          onClick={() => onChangeParams({ ...params, offset: offset + limit })}
          disabled={offset + limit >= total}
        >
          próximas →
        </button>
      </div>
    </section>
  );
}
