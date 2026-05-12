import { AnimatePresence, motion } from "framer-motion";
import type { Empresa, EmpresasResponse, QueryParams } from "../../api/client";
import { fmtBrlCompact, labelArchetype, labelConfidence } from "../../utils/labels";
import { SkeletonRows } from "../ui/Skeleton";
import Fingerprint from "../Sparkline/Fingerprint";

interface Props {
  data: EmpresasResponse | null;
  loading: boolean;
  params: QueryParams;
  onChangeParams: (next: QueryParams) => void;
  onPickEmpresa: (e: Empresa) => void;
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
          <SkeletonRows count={8} />
        ) : items.length === 0 ? (
          <div className="results-empty">
            Nenhuma empresa bate com este recorte · relaxe os filtros
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
                <div className="receita">{fmtBrlCompact(e.receita_point_brl)}</div>
                <div className="spark col--hide-md">
                  <Fingerprint empresa={e} width={70} height={22} />
                </div>
                <div className="arc col--hide-md">{labelArchetype(e.archetype)}</div>
                <div className={`conf conf-${e.confidence}`}>{labelConfidence(e.confidence)}</div>
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
          ← Anteriores
        </button>
        <span className="pg-meta">
          {offset + 1}–{Math.min(offset + limit, total)} / {total.toLocaleString("pt-BR")}
        </span>
        <button
          onClick={() => onChangeParams({ ...params, offset: offset + limit })}
          disabled={offset + limit >= total}
        >
          Próximas →
        </button>
      </div>
    </section>
  );
}
