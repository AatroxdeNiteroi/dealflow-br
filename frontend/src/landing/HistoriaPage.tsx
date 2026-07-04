/* ============================================================
   HistoriaPage — "Nossa história", página completa sobre a landing.

   Mesmo idioma dos capítulos em fluxo (ch6-8): papel, colchetes
   de registro dourados, eyebrows mono, títulos Playfair, recipientes
   pontiagudos. Overlay full-screen com scroll próprio (data-lenis-
   prevent) — voltar fecha e devolve o usuário exatamente onde estava.
   Conteúdo espelha o "Quem somos" do app (QuemSomosModal).
   ============================================================ */

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import "./historia.css";

const FOUNDERS = [
  {
    initials: "DG",
    name: "Daniel Martins Gomes",
    degree: "Direito · UFF",
    role: "Jurídico · Arquitetura",
    bio: [
      "Daniel constrói com a disciplina de quem redige contrato: cada peça com propósito, cada limite defensável. Desenhou a espinha técnica e jurídica do Genesis Radar sob esse princípio — pseudonimização forte de identidades, conformidade LGPD documentada e auditável, pipeline que respeita rigorosamente as bases públicas que consome.",
      "Onde o produto precisa sustentar argumento — perante a ANPD, advogado de contraparte, comitê de compliance ou auditor — a defesa já está escrita. O que parece simples na superfície da interface é, debaixo dela, uma arquitetura desenhada para resistir a escrutínio.",
    ],
  },
  {
    initials: "RC",
    name: "Rafael Sobreiro Couto",
    degree: "Economia · UFF",
    role: "Mercado · Modelagem",
    bio: [
      "Rafael lê mercado pelas perguntas que ninguém faz. Foi ele quem traduziu a frustração recorrente de gestores em recorte operacional do produto: o que conta como empresa endereçável, qual arquétipo merece o funil, onde a estimativa entrega convicção e onde precisa admitir limite.",
      "A inteligência analítica do Genesis Radar — do universo coberto às razões setoriais, dos níveis de confiança aos avisos honestos — emergiu da forma como Rafael entende o ofício de investir: pelo sinal, não pelo ruído.",
    ],
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

  // entrada — a página assenta e o conteúdo sobe em escada (idioma dos
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
        stagger: 0.08,
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

          {/* origem — o cartão de registro */}
          <section className="hx-card hx-reveal" aria-label="Origem">
            <span className="hx-corner hx-corner--tl" aria-hidden="true" />
            <span className="hx-corner hx-corner--tr" aria-hidden="true" />
            <span className="hx-corner hx-corner--bl" aria-hidden="true" />
            <span className="hx-corner hx-corner--br" aria-hidden="true" />
            <p className="hx-text">
              A Genesis Labs nasceu de conversas com gestores de fundos de
              investimento, profissionais de M&amp;A e family offices. Sempre a
              mesma frustração vinha à mesa: o mercado de sociedades limitadas
              brasileiras é estruturalmente opaco — e as ferramentas
              disponíveis, bureaus pagos com faixas sem proveniência, não
              atendiam a um padrão analítico que se possa defender em um comitê
              de investimento.
            </p>
            <p className="hx-statement">Decidimos construir o que faltava.</p>
            <p className="hx-text">
              Acreditamos que o capital flui melhor quando o mercado enxerga
              melhor — e que a opacidade artificial sobre empresas privadas
              brasileiras é um atrito ineficiente da nossa economia. Empresas
              saudáveis em busca de sucessão merecem ser encontradas antes de
              fecharem por ausência de comprador. Investidores qualificados
              merecem ferramentas à altura. E o ecossistema empresarial
              brasileiro — base da geração de empregos no país — merece tese de
              investimento construída com rigor, não com palpite.
            </p>
            <p className="hx-text">
              Os dados que sustentam essa inteligência já existem —{" "}
              <strong>públicos, oficiais, gratuitos</strong> — aguardando quem
              os tratasse com o rigor de quem entende tanto o mercado quanto a
              estrutura jurídica que o rege.
            </p>
          </section>

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
                {f.bio.map((p, i) => (
                  <p className="hx-founder__bio" key={i}>
                    {p}
                  </p>
                ))}
              </article>
            ))}
          </div>

          <p className="hx-text hx-text--wide hx-reveal">
            As fórmulas, os arquétipos, os níveis de confiança, o tratamento de
            dados pseudonimizados, a metodologia versionada — todas as decisões
            substantivas emergiram do diálogo entre quem entende o mercado e
            quem entende a estrutura. Essa intersecção, acreditamos, é o único
            caminho honesto para fazer inteligência de mercado privado no
            Brasil.
          </p>

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
