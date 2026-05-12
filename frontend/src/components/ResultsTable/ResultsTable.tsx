import { AnimatePresence, motion } from "framer-motion";
import type { Empresa, EmpresasResponse, QueryParams } from "../../api/client";

interface Props {
  data: EmpresasResponse | null;
  loading: boolean;
  params: QueryParams;
  onChangeParams: (next: QueryParams) => void;
  onPickEmpresa: (e: Empresa) => void;
}

function fmtBrl(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e9) return `R$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `R$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `R$${(v / 1e3).toFixed(0)}k`;
  return `R$${v.toFixed(0)}`;
}

export default function ResultsTable({ data, loading, params, onChangeParams, onPickEmpresa }: Props) {
  const limit = params.limit ?? 100;
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
    a.download = `dealflow_recorte_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="results-pane">
      <header className="results-header">
        <div>
          <div className="eyebrow">Resultado</div>
          <div className="results-count">
            {total.toLocaleString("pt-BR")}
            <small>empresas no recorte</small>
          </div>
        </div>
        <button className="download-btn" onClick={downloadCsv} disabled={!items.length}>
          ↓ CSV
        </button>
      </header>

      <div className="results-table">
        {loading && !data ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-2)" }}>
            carregando…
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-2)" }}>
            nenhuma empresa bate com esse recorte. Relaxe os filtros.
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {items.map((e, i) => (
              <motion.div
                key={e.cnpj}
                className="empresa-card"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: Math.min(i * 0.015, 0.4), duration: 0.25 }}
                onClick={() => onPickEmpresa(e)}
              >
                <div>
                  <div className="empresa-nome">{e.razao_social}</div>
                  <div className="empresa-cnpj">CNPJ {e.cnpj}</div>
                </div>
                <div className="empresa-uf">{e.sigla_uf}</div>
                <div className="empresa-receita">
                  {fmtBrl(e.receita_point_brl)}
                  <small> {e.headcount} func</small>
                </div>
                <div className="empresa-archetype col--hide-mobile">{e.archetype}</div>
                <div className={`empresa-conf conf-${e.confidence} col--hide-mobile`}>
                  {e.confidence}
                </div>
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
        <span style={{ alignSelf: "center", fontSize: 11, color: "var(--text-2)" }}>
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
