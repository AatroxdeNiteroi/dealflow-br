/**
 * TOC clicável + meta de versão para documentos legais.
 *
 * Modal de Termos / Privacidade são muros de 20-24 seções. Sem âncoras
 * o cliente faz scroll cego — péssimo em due diligence interna.
 *
 * Como usar:
 *   <LegalTOC version="1.0" vigencia="14 de maio de 2026" sections={[
 *     { id: "sec-1", title: "1. Aceitação dos Termos" }, ...
 *   ]} />
 *
 * Cada <section> do documento deve ter id="sec-N" correspondente.
 */

import { useEffect, useState } from "react";

export interface TOCItem {
  id: string;
  title: string;
}

interface Props {
  version: string;
  vigencia: string;
  sections: TOCItem[];
}

export function LegalTOC({ version, vigencia, sections }: Props) {
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);

  useEffect(() => {
    const targets = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    targets.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [sections]);

  function jumpTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <aside className="legal-toc" aria-label="Sumário do documento">
      <div className="legal-toc-meta">
        <span className="legal-toc-meta-label">Versão</span>
        <span className="legal-toc-meta-value">{version}</span>
        <span className="legal-toc-meta-sep" aria-hidden>·</span>
        <span className="legal-toc-meta-label">Vigência</span>
        <span className="legal-toc-meta-value">{vigencia}</span>
      </div>
      <nav className="legal-toc-nav">
        <div className="legal-toc-eyebrow">Sumário</div>
        <ol className="legal-toc-list">
          {sections.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={`legal-toc-link${activeId === s.id ? " is-active" : ""}`}
                onClick={() => jumpTo(s.id)}
              >
                {s.title}
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </aside>
  );
}
