/* ============================================================
   Landing — Genesis Radar (a experiência do radar).

   Existe desde o primeiro frame: o campo WebGL é o fundo vivo do
   portal. Enquanto `revealed` é falso, a cromática do radar (nav,
   manchete, HUD) fica oculta e o scroll travado — só o campo e o
   hover do cursor rodam. Quando o portal libera, a cromática se
   revela e a jornada de scroll começa, sobre o MESMO campo.
   ============================================================ */

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { PointField } from "./three/PointField";

gsap.registerPlugin(ScrollTrigger);

const LABEL_POOL = 4;
const REDACTED = "R$ ███";

const RESPIRO_WORDS: Array<{ t: string; em?: boolean }> = [
  { t: "São" },
  { t: "46.255" },
  { t: "pontos" },
  { t: "neste" },
  { t: "campo." },
  { t: "Cada" },
  { t: "um" },
  { t: "é" },
  { t: "uma" },
  { t: "empresa" },
  { t: "real" },
  { t: "—", em: true },
  { t: "e", em: true },
  { t: "dados", em: true },
  { t: "que", em: true },
  { t: "ninguém", em: true },
  { t: "publicou.", em: true },
];

function formatBRL(mi: number): string {
  if (mi < 1) return "R$ " + Math.round(mi * 1000) + " mil";
  return "R$ " + mi.toFixed(1).replace(".", ",") + " mi";
}

export function Landing({ revealed }: { revealed: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelLayerRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const revealedRef = useRef(false);

  // ── montagem — campo, jornada e interação ligam de imediato ──
  useEffect(() => {
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    const canvas = canvasRef.current!;
    const labelLayer = labelLayerRef.current!;
    const readout = readoutRef.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const field = new PointField(canvas, { reducedMotion: reduced });

    const labels: Array<{ el: HTMLDivElement; val: HTMLSpanElement }> = [];
    for (let i = 0; i < LABEL_POOL; i++) {
      const el = document.createElement("div");
      el.className = "lp-label";
      const dot = document.createElement("span");
      dot.className = "lp-label-dot";
      const val = document.createElement("span");
      val.className = "lp-label-val";
      el.append(dot, val);
      labelLayer.append(el);
      labels.push({ el, val });
    }

    field.onFrame = (f) => {
      // etiquetas de valor só dentro do radar — não no portal
      if (!revealedRef.current) {
        for (const lab of labels) lab.el.style.opacity = "0";
      } else {
        const cur = f.cursorLabels;
        for (let i = 0; i < labels.length; i++) {
          const lab = labels[i];
          const c = cur[i];
          if (!c) {
            lab.el.style.opacity = "0";
            continue;
          }
          lab.el.style.opacity = String(Math.min(1, c.strength * 1.4));
          lab.el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`;
          if (c.strength > 0.62) {
            lab.el.classList.remove("is-redacted");
            lab.val.textContent = formatBRL(c.value);
          } else {
            lab.el.classList.add("is-redacted");
            lab.val.textContent = REDACTED;
          }
        }
      }
      readout.textContent =
        "AZ " + String(Math.round(f.sweepBearing)).padStart(3, "0") + "°";
    };

    const onMove = (e: PointerEvent) => {
      field.setMouse(
        (e.clientX / window.innerWidth) * 2 - 1,
        -((e.clientY / window.innerHeight) * 2 - 1),
      );
    };
    const onLeave = () => field.clearMouse();
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);

    const onResize = () => {
      field.resize();
      ScrollTrigger.refresh();
    };
    window.addEventListener("resize", onResize);

    let tick: ((time: number) => void) | null = null;
    let ctx: ReturnType<typeof gsap.context> | null = null;

    if (!reduced) {
      const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
      lenisRef.current = lenis;
      lenis.stop(); // travado até "Quero conhecer o produto"
      lenis.on("scroll", ScrollTrigger.update);
      tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      ctx = gsap.context(() => {
        // jornada — trilha de scroll dirige câmera + texto
        const master = gsap.timeline({
          scrollTrigger: {
            trigger: ".lp-scroll",
            start: "top top",
            end: "bottom bottom",
            scrub: 1,
            onUpdate: (self) => field.setJourney(self.progress),
          },
        });
        master
          .to({}, { duration: 1 }, 0)
          .to(".hero__copy", { autoAlpha: 0, y: -64, ease: "power1.in", duration: 0.16 }, 0)
          .to(".hero__cue", { autoAlpha: 0, duration: 0.08 }, 0)
          .to(".hero__hud", { autoAlpha: 0, duration: 0.12 }, 0.05)
          .to(".hero__frame", { autoAlpha: 0, duration: 0.2 }, 0.42)
          .fromTo(".respiro__copy", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1 }, 0.8)
          .from(
            ".respiro__w",
            { opacity: 0.06, yPercent: 95, ease: "none", duration: 0.05, stagger: { amount: 0.12 } },
            0.83,
          );
      });
    }

    return () => {
      ctx?.revert();
      if (tick) gsap.ticker.remove(tick);
      lenisRef.current?.destroy();
      lenisRef.current = null;
      ScrollTrigger.getAll().forEach((t) => t.kill());
      field.dispose();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
      labels.forEach((lab) => lab.el.remove());
    };
  }, []);

  // ── revelação — quando o portal libera a entrada ─────────────
  useEffect(() => {
    if (!revealed) return;
    revealedRef.current = true;
    lenisRef.current?.start();

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      gsap.set([".lp-nav", ".lp-stage"], { autoAlpha: 1 });
      return;
    }

    const ctx = gsap.context(() => {
      // a cromática do radar surge sobre o campo já presente
      gsap.to(".lp-nav", { autoAlpha: 1, duration: 0.7, ease: "power2.out" });
      gsap.to(".lp-stage", { autoAlpha: 1, duration: 0.7, ease: "power2.out" });

      // a manchete se anuncia
      gsap
        .timeline({ delay: 0.3, defaults: { ease: "power3.out" } })
        .fromTo(
          ".hero__line-in",
          { yPercent: 116 },
          { yPercent: 0, duration: 0.95, stagger: 0.13 },
          0,
        )
        .fromTo(".hero__eyebrow", { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.7 }, 0)
        .fromTo(".hero__sub", { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.85 }, 0.4);
    });
    return () => ctx.revert();
  }, [revealed]);

  return (
    <div className="landing">
      <canvas className="lp-canvas" ref={canvasRef} />
      <div className="lp-labels" ref={labelLayerRef} aria-hidden="true" />

      <header className="lp-nav">
        <a
          className="lp-nav__brand"
          href="/landing.html"
          aria-label="Genesis Radar — voltar ao topo"
          onClick={(e) => {
            e.preventDefault();
            if (lenisRef.current) lenisRef.current.scrollTo(0, { duration: 1.6 });
            else window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <svg className="lp-nav__mark" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9.4" />
            <circle cx="12" cy="12" r="5.4" />
            <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
            <line x1="12" y1="12" x2="20.6" y2="6.6" />
          </svg>
          <span className="lp-nav__name">Genesis Radar</span>
        </a>
        <span className="lp-nav__meta">Inteligência de originação M&amp;A</span>
      </header>

      <div className="lp-stage">
        <div className="hero__frame" aria-hidden="true">
          <span className="hero__corner hero__corner--tl" />
          <span className="hero__corner hero__corner--tr" />
          <span className="hero__corner hero__corner--bl" />
          <span className="hero__corner hero__corner--br" />
        </div>

        <div className="hero__hud">
          <span className="hero__hud-dot" />
          <span className="hero__hud-read" ref={readoutRef}>
            AZ 247&deg;
          </span>
          <span className="hero__hud-label">varredura ativa</span>
        </div>

        <div className="hero__copy">
          <p className="hero__eyebrow">Originação de M&amp;A &middot; Rio + São Paulo</p>
          <h1 className="hero__title">
            <span className="hero__line">
              <span className="hero__line-in">Elas não contam.</span>
            </span>
            <span className="hero__line">
              <span className="hero__line-in">
                <em>Nós calculamos.</em>
              </span>
            </span>
          </h1>
          <p className="hero__sub">
            46.255 sociedades limitadas de médio porte em Rio e São Paulo. Nenhuma publica
            o faturamento &mdash; a Genesis Radar reconstrói o número, rastreável até a
            fonte primária.
          </p>
        </div>

        <div className="hero__cue">
          role para varrer o campo
          <span className="hero__cue-line" />
        </div>

        <div className="respiro__copy">
          <p className="respiro__line">
            {RESPIRO_WORDS.map((w, i) => (
              <span key={i} className={w.em ? "respiro__w respiro__w--em" : "respiro__w"}>
                {w.t}
              </span>
            ))}
          </p>
        </div>
      </div>

      <div className="lp-scroll" aria-hidden="true" />
    </div>
  );
}
