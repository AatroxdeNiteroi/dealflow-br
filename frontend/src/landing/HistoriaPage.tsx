/* ============================================================
   HistoriaPage — "Nossa história", página full-screen sobre a landing.

   Conta a história VISUALMENTE, com o mínimo de prosa: origem em
   3 momentos (fluxo com ícones, padrão do ch6), faixa escura de
   números do produto, fundadores compactos (1 linha + chips) e o
   diagrama da intersecção Mercado ∩ Estrutura. Mesmo idioma dos
   capítulos em fluxo: papel, colchetes dourados, Playfair, mono,
   recipientes pontiagudos. Overlay SPA com scroll próprio
   (data-lenis-prevent) — voltar devolve o usuário onde estava.
   ============================================================ */

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import "./historia.css";

const BEATS = [
  {
    n: "01",
    title: "As conversas",
    text: "Gestores de fundos, M&A e family offices — sempre a mesma frustração à mesa.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 5h11v8H8l-3 3v-3H3z" />
        <path d="M16 9h5v7h-2v2.5L16.5 16H12v-3" />
      </svg>
    ),
  },
  {
    n: "02",
    title: "A opacidade",
    text: "O mercado de limitadas é fechado — e faixas sem proveniência não se defendem em comitê.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="8" width="18" height="8" />
        <path d="M7 8l-2.5 8M12 8l-2.5 8M17 8l-2.5 8M21.5 9.5 20 14.5" />
      </svg>
    ),
  },
  {
    n: "03",
    title: "A decisão",
    text: "Decidimos construir o que faltava.",
    em: true,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <path d="M12 12l6.5-5" />
      </svg>
    ),
  },
];

const STATS = [
  { num: "46.255", label: "empresas LTDA no radar" },
  { num: "100%", label: "fonte pública oficial" },
  { num: "±15%", label: "intervalo honesto, auditável" },
];

const FOUNDERS = [
  {
    initials: "DG",
    name: "Daniel Martins Gomes",
    degree: "Direito · UFF",
    role: "Jurídico · Arquitetura",
    line: "Constrói com a disciplina de quem redige contrato — cada peça com propósito, cada limite defensável.",
    chips: ["Arquitetura técnica", "LGPD auditável", "Pseudonimização"],
  },
  {
    initials: "RC",
    name: "Rafael Sobreiro Couto",
    degree: "Economia · UFF",
    role: "Mercado · Modelagem",
    line: "Lê mercado pelas perguntas que ninguém faz — pelo sinal, não pelo ruído.",
    chips: ["Recorte operacional", "Arquétipos", "Níveis de confiança"],
  },
];

export function HistoriaPage({
  onClose,
  onPlans,
}: {
  onClose: () => void;
  onPlans: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  // entrada — a página assenta e os blocos sobem em escada (idioma dos
  // reveals do ch6-8). Estado-repouso do CSS é visível: sob reduced-motion
  // nada roda e a página simplesmente está lá.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelector<HTMLElement>(".hx-back")?.focus();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const ctx = gsap.context(() => {
      gsap.from(root, { autoAlpha: 0, duration: 0.4, ease: "power2.out" });
      gsap.from(".hx-reveal", {
        autoAlpha: 0,
        y: 24,
        duration: 0.75,
        ease: "power3.out",
        stagger: 0.09,
        delay: 0.12,
        clearProps: "transform",
      });
    }, root);
    return () => ctx.revert();
  }, []);

  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="hx-page"
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Nossa história"
    >
      <div className="hx-scroll" data-lenis-prevent>
        {/* chrome próprio — a página cobre o header da landing */}
        <header className="hx-bar">
          <button type="button" className="hx-back" onClick={onClose}>
            <svg className="hx-back__ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 12H5M11.5 5.5 5 12l6.5 6.5" />
            </svg>
            Voltar
          </button>
          <span className="hx-bar__brand">
            Genesis <em>Radar</em>
          </span>
        </header>

        <main className="hx-body">
          <div className="hx-hero hx-reveal">
            <span className="hx-eyebrow">Nossa história · Genesis Labs</span>
            <h1 className="hx-title">
              Inteligência de mercado privado
              <br />
              <em>feita por brasileiros.</em>
            </h1>
          </div>

          {/* a origem — 3 momentos, fluxo com setas (padrão do ch6) */}
          <div className="hx-beats hx-reveal">
            {BEATS.map((b, i) => (
              <div className="hx-beats__cell" key={b.n}>
                {i > 0 && (
                  <svg className="hx-beats__arrow" viewBox="0 0 34 12" aria-hidden="true">
                    <path d="M0 6h30M26 1.5 31 6l-5 4.5" />
                  </svg>
                )}
                <article className="hx-beat">
                  <span className="hx-corner hx-corner--tl" aria-hidden="true" />
                  <span className="hx-corner hx-corner--tr" aria-hidden="true" />
                  <span className="hx-corner hx-corner--bl" aria-hidden="true" />
                  <span className="hx-corner hx-corner--br" aria-hidden="true" />
                  <span className="hx-beat__n">{b.n}</span>
                  <span className="hx-beat__icon">{b.icon}</span>
                  <h2 className="hx-beat__title">{b.title}</h2>
                  <p className={b.em ? "hx-beat__text hx-beat__text--em" : "hx-beat__text"}>
                    {b.text}
                  </p>
                </article>
              </div>
            ))}
          </div>

          {/* o produto em números — faixa escura, aro dourado */}
          <div className="hx-strip hx-reveal">
            {STATS.map((s) => (
              <div className="hx-strip__stat" key={s.label}>
                <span className="hx-strip__num">{s.num}</span>
                <span className="hx-strip__label">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="hx-label hx-reveal" aria-hidden="true">
            <span className="hx-label__rule" />
            <span className="hx-label__txt">Fundadores</span>
            <span className="hx-label__rule" />
          </div>

          <div className="hx-founders">
            {FOUNDERS.map((f) => (
              <article className="hx-founder hx-reveal" key={f.name}>
                <span className="hx-corner hx-corner--tl" aria-hidden="true" />
                <span className="hx-corner hx-corner--tr" aria-hidden="true" />
                <span className="hx-corner hx-corner--bl" aria-hidden="true" />
                <span className="hx-corner hx-corner--br" aria-hidden="true" />
                <span className="hx-founder__role">{f.role}</span>
                <span className="hx-founder__avatar" aria-hidden="true">
                  {f.initials}
                </span>
                <h2 className="hx-founder__name">{f.name}</h2>
                <span className="hx-founder__degree">{f.degree}</span>
                <span className="hx-founder__rule" aria-hidden="true" />
                <p className="hx-founder__line">{f.line}</p>
                <div className="hx-founder__chips">
                  {f.chips.map((c) => (
                    <span className="hx-chip" key={c}>
                      {c}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>

          {/* a intersecção — o diagrama que carrega o argumento */}
          <div
            className="hx-venn hx-reveal"
            role="img"
            aria-label="A intersecção entre mercado e estrutura jurídica é o Genesis Radar"
          >
            <div className="hx-venn__diagram" aria-hidden="true">
              <span className="hx-venn__tag">Mercado</span>
              <span className="hx-venn__pair">
                <span className="hx-venn__dia hx-venn__dia--l" />
                <span className="hx-venn__dia hx-venn__dia--r" />
                <span className="hx-venn__core" />
              </span>
              <span className="hx-venn__tag">
                Estrutura
                <br />
                jurídica
              </span>
            </div>
            <p className="hx-venn__caption">
              Toda decisão substantiva do produto nasceu <em>dessa intersecção</em>.
            </p>
          </div>

          <div className="hx-closing hx-reveal">
            <span className="hx-ornament" aria-hidden="true">
              <span className="hx-ornament__seg" />
              <span className="hx-ornament__dia" />
              <span className="hx-ornament__seg" />
            </span>
            <p className="hx-closing__line">
              Um produto de fundadores,
              <br />
              <em>com convicção e método.</em>
            </p>
            <button type="button" className="hx-cta" onClick={onPlans}>
              Conhecer os planos
              <svg className="hx-cta__arrow" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 12h14M12 5.5 18.5 12 12 18.5" />
              </svg>
            </button>
          </div>
        </main>

        <footer className="hx-foot">
          <span className="hx-foot__brand">Genesis Labs Ltda.</span>
          <button type="button" className="hx-foot__back" onClick={onClose}>
            ← Voltar à página inicial
          </button>
        </footer>
      </div>
    </div>
  );
}
