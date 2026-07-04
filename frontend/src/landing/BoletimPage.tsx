/* ============================================================
   BoletimPage — o boletim do radar, para quem tem conta.

   Gate: só logados chegam aqui (o botão do header convida o
   anônimo a criar conta; NÃO exige plano). Reusa o sistema
   visual hx- da página Nossa história (historia.css): papel,
   colchetes dourados, eyebrow mono, Playfair. Overlay SPA com
   scroll próprio — Voltar/Esc devolvem o usuário onde estava.
   ============================================================ */

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import "./historia.css";

export function BoletimPage({
  onClose,
  email,
}: {
  onClose: () => void;
  email?: string | null;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

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
      aria-label="Boletim"
    >
      <div className="hx-scroll" data-lenis-prevent>
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
            <span className="hx-eyebrow">Boletim · Genesis Radar</span>
            <h1 className="hx-title">
              O radar,
              <br />
              <em>na sua caixa de entrada.</em>
            </h1>
          </div>

          <p className="hx-bridge hx-reveal">
            Leituras do mercado fechado — movimentos, setores e sinais que o
            radar captou <em>entre uma varredura e outra</em>.
          </p>

          <article className="hx-spec hx-spec--solo hx-reveal" aria-label="Inscrição confirmada">
            <span className="hx-corner hx-corner--tl" aria-hidden="true" />
            <span className="hx-corner hx-corner--tr" aria-hidden="true" />
            <span className="hx-corner hx-corner--bl" aria-hidden="true" />
            <span className="hx-corner hx-corner--br" aria-hidden="true" />
            <span className="hx-spec__label">Primeira edição em preparação</span>
            <span className="hx-spec__seal">✓ Você está na lista</span>
            <p className="hx-spec__caption">
              {email
                ? `Chega direto em ${email}.`
                : "Chega direto no e-mail da sua conta."}
            </p>
          </article>
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
