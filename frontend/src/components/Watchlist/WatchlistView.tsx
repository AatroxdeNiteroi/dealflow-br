import { useMemo, useState } from "react";
import type { Empresa } from "../../api/client";
import { useWatchlist } from "../../hooks/useWatchlist";
import { useLegal } from "../../legal/useLegal";
import { fmtBrlCompact, labelArchetype, labelConfidence, tickerSym } from "../../utils/labels";
import {
  CANAL_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
  type WatchStatus,
} from "../../watchlist/types";
import StatusModal from "./StatusModal";

interface Props {
  onPickEmpresa: (e: Empresa) => void;
}

function entryToEmpresa(e: ReturnType<typeof useWatchlist>["list"][number]): Empresa {
  // Stub: reconstrói Empresa parcial a partir do snapshot guardado. Suficiente
  // para abrir o DetailModal — campos não-críticos vêm como defaults.
  return {
    cnpj: e.cnpj,
    cnpj_basico: e.cnpj.substring(0, 8),
    razao_social: e.razao_social,
    sigla_uf: e.sigla_uf,
    cnae_secao: e.cnae_secao,
    cnae_2_subclasse: "",
    id_municipio: "",
    bairro: null,
    headcount: e.headcount,
    match_tier: "",
    capital_social: null,
    idade_empresa_anos: null,
    porte: null,
    archetype: e.archetype,
    n_socios: null,
    n_socios_pf: null,
    n_socios_pj: null,
    receita_low_brl: null,
    receita_high_brl: null,
    receita_point_brl: e.receita_point_brl,
    confidence: e.confidence,
    razao_precision: "",
  };
}

export default function WatchlistView({ onPickEmpresa }: Props) {
  const { list, setStatus, remove, exportJson, clearAll } = useWatchlist();
  const { openPrivacidade } = useLegal();
  const [statusModalFor, setStatusModalFor] = useState<{ cnpj: string; razao: string; from: WatchStatus; to: WatchStatus } | null>(null);
  const [activeFilter, setActiveFilter] = useState<WatchStatus | "todos">("todos");

  /** LGPD art. 18 V · download da watchlist em JSON. */
  function handleExport() {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `dealflow_watchlist_${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** LGPD art. 18 VI · apaga todos os dados da watchlist localStorage. */
  function handleClearAll() {
    if (list.length === 0) return;
    const ok = confirm(
      `Apagar permanentemente todas as ${list.length} empresas da sua watchlist?\n\n` +
      `Esta ação não pode ser desfeita. Considere exportar antes (botão "Exportar JSON").`,
    );
    if (ok) clearAll();
  }

  const counts = useMemo(() => {
    const out: Record<WatchStatus, number> = {
      lead: 0, contatado: 0, nda: 0, dd: 0, walk_away: 0,
    };
    for (const e of list) out[e.status]++;
    return out;
  }, [list]);

  const filtered = useMemo(
    () => (activeFilter === "todos" ? list : list.filter((e) => e.status === activeFilter)),
    [list, activeFilter],
  );

  const totalReceita = filtered.reduce((acc, e) => acc + (e.receita_point_brl ?? 0), 0);

  if (list.length === 0) {
    return (
      <div className="watchlist-view">
        <div className="watchlist-head">
          <h1>Watchlist <em>· vazia</em></h1>
        </div>
        <div className="watchlist-empty">
          <p>Você ainda não adicionou empresas à watchlist.</p>
          <p className="watchlist-empty-hint">
            Pesquise no Screener, abra uma empresa e clique em <strong>Adicionar à watchlist</strong> no
            cabeçalho do modal. As empresas salvas ficam neste painel com status do pipeline M&amp;A —
            Lead → Contatado → NDA → DD → Walk-away.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="watchlist-view">
      <div className="watchlist-head">
        <h1>
          Watchlist <em>· {list.length} {list.length === 1 ? "empresa" : "empresas"}</em>
        </h1>
        <div className="meta">
          Receita agregada estimada · {fmtBrlCompact(totalReceita)}
        </div>
      </div>

      <div className="watchlist-data-rights">
        <span className="watchlist-data-rights-label">
          Seus dados (LGPD art. 18)
        </span>
        <div className="watchlist-data-rights-actions">
          <button type="button" className="watchlist-data-rights-btn" onClick={handleExport}>
            Exportar JSON
          </button>
          <button
            type="button"
            className="watchlist-data-rights-btn watchlist-data-rights-btn--danger"
            onClick={handleClearAll}
          >
            Apagar tudo
          </button>
          <button
            type="button"
            className="lgpd-inline-link"
            onClick={openPrivacidade}
          >
            Política de Privacidade
          </button>
        </div>
      </div>

      <div className="watchlist-filters">
        <button
          className={`watchlist-filter${activeFilter === "todos" ? " watchlist-filter--active" : ""}`}
          onClick={() => setActiveFilter("todos")}
        >
          Todos · {list.length}
        </button>
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            className={`watchlist-filter watchlist-filter--${s}${activeFilter === s ? " watchlist-filter--active" : ""}`}
            onClick={() => setActiveFilter(s)}
            disabled={counts[s] === 0}
          >
            {STATUS_LABELS[s]} · {counts[s]}
          </button>
        ))}
      </div>

      <ul className="watchlist-rows">
        {filtered.map((e) => (
          <li key={e.cnpj} className="watchlist-row">
            <div className="watchlist-row-main" onClick={() => onPickEmpresa(entryToEmpresa(e))}>
              <div className="watchlist-glyph">{tickerSym(e.razao_social)}</div>
              <div className="watchlist-nome-block">
                <div className="watchlist-nome">{e.razao_social}</div>
                <div className="watchlist-meta">
                  {e.sigla_uf} · {e.cnpj} · {labelArchetype(e.archetype)}
                </div>
              </div>
              <div className="watchlist-kpi">
                <div className="watchlist-kpi-label">Receita</div>
                <div className="watchlist-kpi-value">{fmtBrlCompact(e.receita_point_brl)}</div>
              </div>
              <div className={`conf-pill conf-${e.confidence}`}>
                {labelConfidence(e.confidence)}
              </div>
            </div>

            <div className="watchlist-pipeline">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`pipeline-step${e.status === s ? " pipeline-step--active" : ""} pipeline-step--${s}`}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (e.status === s) return;
                    setStatusModalFor({
                      cnpj: e.cnpj,
                      razao: e.razao_social,
                      from: e.status,
                      to: s,
                    });
                  }}
                  title={`Mudar para ${STATUS_LABELS[s]}`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
              <button
                type="button"
                className="watchlist-remove"
                onClick={(ev) => {
                  ev.stopPropagation();
                  if (confirm(`Remover ${e.razao_social} da watchlist?`)) {
                    remove(e.cnpj);
                  }
                }}
                title="Remover da watchlist"
              >
                ×
              </button>
            </div>

            {e.notas && (
              <div className="watchlist-notas">
                <span className="watchlist-notas-label">Nota</span>
                <span className="watchlist-notas-text">{e.notas}</span>
              </div>
            )}

            {e.contatos.length > 0 && (
              <div className="watchlist-contatos">
                <span className="watchlist-contatos-label">Histórico</span>
                <ul>
                  {e.contatos.map((c, i) => {
                    const d = new Date(c.data);
                    return (
                      <li key={i}>
                        <span className="contato-data">
                          {d.toLocaleDateString("pt-BR")}
                        </span>
                        <span className="contato-canal">{CANAL_LABELS[c.canal]}</span>
                        {c.nota && <span className="contato-nota">· {c.nota}</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>

      <StatusModal
        open={statusModalFor !== null}
        fromStatus={statusModalFor?.from ?? null}
        toStatus={statusModalFor?.to ?? null}
        razaoSocial={statusModalFor?.razao ?? ""}
        onClose={() => setStatusModalFor(null)}
        onConfirm={(to, contato) => {
          if (!statusModalFor) return;
          setStatus(statusModalFor.cnpj, to, contato);
          setStatusModalFor(null);
        }}
      />
    </div>
  );
}
