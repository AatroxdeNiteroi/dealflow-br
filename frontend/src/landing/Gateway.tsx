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

  // entrada — antes do paint, para não piscar conteúdo. UMA timeline-mestre
  // que monta o instrumento: véu fecha a íris, halo acende, espiral calibra,
  // agulha varre, faíscas surgem, letreiro sobe mascarado, régua, frase, CTA.
  useLayoutEffect(() => {
    if (prefersReduced()) return;
    const ctx = gsap.context(() => {
      const spiral = rootRef.current?.querySelector<SVGPathElement>(".grl__spiral");
      const L = spiral ? spiral.getTotalLength() : 0;
      if (spiral && L) {
        gsap.set(spiral, { strokeDasharray: L, strokeDashoffset: L });
      }

      const tl = gsap.timeline({ defaults: { ease: "rk-expo" } });
      // (a) véu: íris fecha 118%->64% no centro
      tl.fromTo(
        ".gx-gate__veil",
        { "--veil-r": "118%" },
        { "--veil-r": "64%", duration: 1.2 },
        0,
      );
      // (b) halo acende — só até calor ambiente (a opacity 1 o box-shadow
      //     lia como um "círculo laranja" em volta da logo)
      tl.to(".grl__bloom", { opacity: 0.32, duration: 1.0 }, 0.15);
      // (c) espiral desenha (calibra) via strokeDashoffset medido
      if (spiral && L) {
        tl.to(spiral, { strokeDashoffset: 0, duration: 1.2, ease: "power2.inOut" }, 0.2);
      }
      // (d) agulha varre -120°->repouso; o offset decai a 0 e o bearing vivo
      //     (--sweep-bearing, próprio CSS) assume sem emenda nem salto
      tl.fromTo(
        ".grl__sweep",
        { "--boot-swing": -120 },
        { "--boot-swing": 0, duration: 1.1, ease: "rk-glide" },
        0.55,
      );
      // (e) faíscas surgem em ordem aleatória
      tl.from(
        ".grl__spark",
        {
          scale: 0,
          opacity: 0,
          transformOrigin: "50% 50%",
          duration: 0.5,
          ease: "back.out(2.4)",
          stagger: { each: 0.06, from: "random" },
        },
        0.95,
      );
      // (f) letreiro sobe, mascarado por palavra
      tl.from(".grl__word-i", { yPercent: 115, duration: 0.7, stagger: 0.1 }, 1.05);
      // (g) régua se abre
      tl.from(
        ".grl__rule-seg",
        { scaleX: 0, transformOrigin: "center", duration: 0.5, stagger: 0.08 },
        1.2,
      );
      tl.from(
        ".grl__rule-dia",
        { scale: 0, transformOrigin: "50% 50%", duration: 0.4, ease: "back.out(2)" },
        1.32,
      );
      // (h) frase · (i) CTA · (+) sussurro entra por último
      tl.from(".gx-gate__phrase", { autoAlpha: 0, y: 18, duration: 0.7 }, 1.35);
      tl.from(".gx-cta", { autoAlpha: 0, y: 16, duration: 0.6 }, 1.5);
      tl.from(".gx-cue", { autoAlpha: 0, y: 10, duration: 0.55 }, 1.72);
    }, rootRef);
    return () => ctx.revert();
  }, []);

  // vida ociosa — só p/ quem aceita movimento; revertida na limpeza.
  // Respiro do halo (único loop perceptível) + cintilar dessincronizado das
  // faíscas dentro do limite de sussurro (<=0.06 alpha). Começa após o boot.
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.to(".grl__bloom", {
        scale: 1.06,
        opacity: 0.26, // respira em torno do calor ambiente (0.32 do boot)
        transformOrigin: "50% 50%",
        duration: 4.2,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        delay: 2.3,
      });
      gsap.to(".grl__spark", {
        opacity: 0.94,
        duration: 2.8,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        delay: 2.3,
        stagger: { each: 0.5, from: "random" },
      });
    });
    return () => mm.revert();
  }, []);

  // saída — mergulho de câmera: o emblema cresce e gira atravessando a
  // espiral (svgOrigin no hub), a íris abre (--veil-r ->160%); o campo por
  // baixo continua (sem emenda — o cross-fade do estágio é do dono da página)
  useEffect(() => {
    if (!leaving) return;
    if (prefersReduced()) {
      onLeft();
      return;
    }
    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power2.in" }, onComplete: onLeft })
        .to(".gx-cue", { autoAlpha: 0, y: 8, duration: 0.3 }, 0)
        .to(".gx-cta", { autoAlpha: 0, y: 14, duration: 0.32 }, 0.04)
        .to(".gx-gate__phrase", { autoAlpha: 0, y: 14, duration: 0.34 }, 0.08)
        .to(".grl__word", { autoAlpha: 0, y: -10, duration: 0.4 }, 0.1)
        .to(".grl__rule", { autoAlpha: 0, duration: 0.3 }, 0.1)
        // íris abre em vez de fade chapado
        .to(".gx-gate__veil", { "--veil-r": "160%", duration: 0.85, ease: "power2.out" }, 0.05)
        // mergulho: cai ATRAVÉS da espiral (origem no hub ~ centro do viewBox)
        .to(
          ".grl__emblem",
          {
            scale: 3.2,
            rotation: "+=34",
            filter: "blur(6px)",
            autoAlpha: 0,
            transformOrigin: "50% 50.7%",
            duration: 0.8,
            ease: "power2.in",
          },
          0.14,
        )
        .to(".gx-gate", { autoAlpha: 0, duration: 0.34 }, 0.7);
    }, rootRef);
    return () => ctx.revert();
  }, [leaving, onLeft]);

  return (
    <div className="gx-gate" ref={rootRef}>
      <div className="gx-gate__veil" aria-hidden="true" />

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
        <p className="gx-cue" aria-hidden="true">
          mova o cursor — o campo responde
        </p>
      </div>
    </div>
  );
}
