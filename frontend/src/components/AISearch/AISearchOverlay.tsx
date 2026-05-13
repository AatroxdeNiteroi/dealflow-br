import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { QueryParams } from "../../api/client";
import { searchAI, type AISearchResponse } from "../../api/client";

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (params: QueryParams) => void;
}

const EXAMPLE_PROMPTS = [
  "fabricantes de embalagens em São Paulo com 50–100 funcionários",
  "empresas de logística no RJ com mais de 10 anos e capital acima de 1 milhão",
  "sucessão familiar · indústria · sweet spot",
  "consultorias profissionais em SP com 5–10 sócios",
  "holdings com receita estimada acima de 50 milhões",
];

export default function AISearchOverlay({ open, onClose, onApply }: Props) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AISearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    } else {
      setResult(null);
      setError(null);
    }
  }, [open]);

  async function handleSubmit() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await searchAI(prompt.trim());
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleApply() {
    if (!result) return;
    onApply({ ...result.params, limit: 50, offset: 0 });
    onClose();
    setPrompt("");
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal ai-search-modal"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>

            <div className="ai-search-body">
              <div className="ai-search-eyebrow">Busca com IA · linguagem natural</div>
              <h2 className="ai-search-title">
                Descreva a empresa <em>que você procura</em>
              </h2>

              <textarea
                ref={textareaRef}
                className="ai-search-input"
                placeholder="Ex: indústrias em SP com 50–100 funcionários, 10+ anos, sucessão familiar"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKey}
                rows={3}
                maxLength={1000}
                disabled={loading}
              />

              <div className="ai-search-hint">
                <span>Cmd/Ctrl + Enter para enviar · Esc para fechar</span>
                <span>{prompt.length}/1000</span>
              </div>

              <div className="ai-search-examples">
                <div className="ai-search-examples-label">Exemplos</div>
                <div className="ai-search-examples-list">
                  {EXAMPLE_PROMPTS.map((ex) => (
                    <button
                      key={ex}
                      className="ai-search-example"
                      onClick={() => setPrompt(ex)}
                      disabled={loading}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ai-search-actions">
                <button
                  className="action-btn primary ai-search-submit"
                  onClick={handleSubmit}
                  disabled={!prompt.trim() || loading}
                >
                  {loading ? "Traduzindo…" : "✦ Traduzir e aplicar"}
                </button>
              </div>

              {error && (
                <div className="ai-search-error">
                  <strong>Não consegui processar:</strong> {error}
                </div>
              )}

              {result && (
                <div className="ai-search-result">
                  <div className="ai-search-explain">
                    <span className="ai-search-explain-label">Interpretação</span>
                    <p>{result.explain}</p>
                  </div>

                  <div className="ai-search-translated">
                    <span className="ai-search-translated-label">Filtros traduzidos</span>
                    <div className="ai-search-chips">
                      {Object.entries(result.params).length === 0 ? (
                        <span className="ai-search-chip muted">
                          Nenhum filtro · interpretação muito vaga
                        </span>
                      ) : (
                        Object.entries(result.params).map(([k, v]) => (
                          <span key={k} className="ai-search-chip">
                            <span className="chip-key">{k}</span>
                            <span className="chip-val">{formatValue(v)}</span>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {result.warnings && result.warnings.length > 0 && (
                    <div className="ai-search-warnings">
                      <span className="ai-search-warnings-label">Não traduzível</span>
                      <ul>
                        {result.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="ai-search-confirm">
                    <button className="action-btn" onClick={() => { setResult(null); setPrompt(""); }}>
                      Refinar prompt
                    </button>
                    <button className="action-btn primary" onClick={handleApply}>
                      Aplicar filtros
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function formatValue(v: unknown): string {
  if (Array.isArray(v)) return v.join(" · ");
  if (typeof v === "number") {
    if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} M`;
    if (v >= 1_000) return `${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} k`;
    return v.toLocaleString("pt-BR");
  }
  return String(v);
}
