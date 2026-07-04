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

// o que o radar entrega além do faturamento — 1 linha por card, direto
const INFO = [
  {
    title: "Saúde fiscal",
    text: "Dívida ativa e regularidade — o selo verde de quem está em dia.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l7 2.8v5.4c0 4.4-2.9 7.4-7 8.8-4.1-1.4-7-4.4-7-8.8V5.8z" />
        <path d="M8.8 11.6l2.2 2.2 4.2-4.6" />
      </svg>
    ),
  },
  {
    title: "Reputação pública",
    text: "Menções em Diários Oficiais e protestos em cartório.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="15" height="14" />
        <path d="M18 9h3v8a2 2 0 0 1-2 2H5" />
        <path d="M6.5 9h8M6.5 12.5h8M6.5 16h5" />
      </svg>
    ),
  },
  {
    title: "Grupo econômico",
    text: "O mapa e o histórico por trás de cada CNPJ.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="6" cy="6" r="2.4" />
        <circle cx="18" cy="7.5" r="2.4" />
        <circle cx="12" cy="17.5" r="2.4" />
        <path d="M8.4 6.7l7.2.6M7.2 8.2l3.6 7M16.9 9.7l-3.5 5.7" />
      </svg>
    ),
  },
  {
    title: "Recorte cirúrgico",
    text: "CNAE, UF e porte — chegue direto ao alvo.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="7" />
        <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

const STATS = [
  { num: "46.255", label: "empresas LTDA no radar" },
  { num: "0", label: "dado comprado, cinza ou vazado" },
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
              O faturamento de 46.255 empresas fechadas,
              <br />
              <em>no seu radar.</em>
            </h1>
          </div>

          <div className="hx-label hx-reveal" aria-hidden="true">
            <span className="hx-label__rule" />
            <span className="hx-label__txt">O que o radar entrega</span>
            <span className="hx-label__rule" />
          </div>

          {/* a oferta — o espécime do faturamento (protagonista) + as
              outras inteligências, uma linha cada */}
          <div className="hx-offer hx-reveal">
            <article className="hx-spec" aria-label="Faturamento anual estimado">
              <span className="hx-corner hx-corner--tl" aria-hidden="true" />
              <span className="hx-corner hx-corner--tr" aria-hidden="true" />
              <span className="hx-corner hx-corner--bl" aria-hidden="true" />
              <span className="hx-corner hx-corner--br" aria-hidden="true" />
              <span className="hx-spec__label">Faturamento anual estimado</span>
              <span className="hx-spec__num">R$ 24,3 mi</span>
              <span className="hx-spec__range" aria-hidden="true">
                <span className="hx-spec__end">
                  <b>mín</b>
                  R$ 20,7 mi
                </span>
                <span className="hx-spec__bar">
                  <span className="hx-spec__mark" />
                </span>
                <span className="hx-spec__end">
                  <b>máx</b>
                  R$ 27,9 mi
                </span>
              </span>
              <span className="hx-spec__seal">
                ✓ Fonte pública oficial · auditável
              </span>
              <p className="hx-spec__caption">
                Empresa a empresa. Nunca a faixa genérica de bureau.
              </p>
            </article>

            <div className="hx-infos">
              {INFO.map((c) => (
                <article className="hx-info" key={c.title}>
                  <span className="hx-info__icon">{c.icon}</span>
                  <h2 className="hx-info__title">{c.title}</h2>
                  <p className="hx-info__text">{c.text}</p>
                </article>
              ))}
            </div>
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

          {/* a origem, em uma linha — a ponte para os fundadores */}
          <p className="hx-bridge hx-reveal">
            Gestores pediam. O mercado não tinha.{" "}
            <em>Decidimos construir o que faltava.</em>
          </p>

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
