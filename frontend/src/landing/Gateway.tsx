/* ============================================================
   Gateway — portal de entrada da Genesis Radar.

   Camada sobre o campo de radar (que já roda por baixo, vivo).
   Header real: marca Genesis Labs à esquerda, ações de conta à
   direita. Centro: logo do produto, frase-âncora, convite.
   "Quero conhecer o produto" sai e a jornada do mesmo campo
   começa — sem troca de tela.
   ============================================================ */

import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { GenesisRadarLogo } from "./GenesisRadarLogo";

interface GatewayProps {
  leaving: boolean;
  onEnter: () => void;
  onLeft: () => void;
}

function prefersReduced(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function Gateway({ leaving, onEnter, onLeft }: GatewayProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  // entrada — antes do paint, para não piscar conteúdo
  useLayoutEffect(() => {
    if (prefersReduced()) return;
    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from(".gx-gate__veil", { autoAlpha: 0, duration: 1.0 }, 0)
        .from(".gx-head", { autoAlpha: 0, y: -20, duration: 0.7 }, 0)
        .from(".gx-hero__logo", { autoAlpha: 0, scale: 0.88, duration: 1.05 }, 0.12)
        .from(".gx-gate__phrase", { autoAlpha: 0, y: 18, duration: 0.78 }, 0.5)
        .from(".gx-cta", { autoAlpha: 0, y: 16, duration: 0.66 }, 0.7);
    }, rootRef);
    return () => ctx.revert();
  }, []);

  // saída — a logo se expande; o campo por baixo continua (sem emenda)
  useEffect(() => {
    if (!leaving) return;
    if (prefersReduced()) {
      onLeft();
      return;
    }
    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power2.in" }, onComplete: onLeft })
        .to(".gx-head", { autoAlpha: 0, y: -20, duration: 0.36 }, 0)
        .to(".gx-gate__phrase", { autoAlpha: 0, y: 14, duration: 0.34 }, 0.04)
        .to(".gx-cta", { autoAlpha: 0, y: 14, duration: 0.32 }, 0)
        .to(".gx-gate__veil", { autoAlpha: 0, duration: 0.72, ease: "power2.out" }, 0.05)
        .to(
          ".gx-hero__logo",
          { scale: 2.3, autoAlpha: 0, duration: 0.76, ease: "power2.inOut" },
          0.12,
        )
        .to(".gx-gate", { autoAlpha: 0, duration: 0.32 }, 0.5);
    }, rootRef);
    return () => ctx.revert();
  }, [leaving, onLeft]);

  return (
    <div className="gx-gate" ref={rootRef}>
      <div className="gx-gate__veil" aria-hidden="true" />

      <header className="gx-head">
        <div className="gx-head__brand">
          Genesis<span className="gx-head__brand-it">Labs</span>
        </div>
        <nav className="gx-head__nav">
          <button type="button" className="gx-head__btn">
            <svg className="gx-ico" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="3.7" />
              <path d="M5.2 20c0-3.9 3-6.4 6.8-6.4s6.8 2.5 6.8 6.4" />
            </svg>
            Fazer login
          </button>
          <button type="button" className="gx-head__btn">
            <svg className="gx-ico" viewBox="0 0 26 24" aria-hidden="true">
              <circle cx="9.6" cy="8" r="3.7" />
              <path d="M3 20c0-3.9 3-6.4 6.6-6.4 1 0 2 .15 2.9.45" />
              <path d="M19 12.4v7.2M15.4 16h7.2" />
            </svg>
            Criar conta
          </button>
        </nav>
      </header>

      <div className="gx-gate__center">
        <GenesisRadarLogo className="gx-hero__logo" />
        <p className="gx-gate__phrase">
          Toda empresa fechada esconde um número.{" "}
          <span className="gx-em">O radar ilumina cada um.</span>
        </p>
        <button type="button" className="gx-cta" onClick={onEnter}>
          Quero conhecer o produto
          <svg className="gx-cta__arrow" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12h14M12 5.5 18.5 12 12 18.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
