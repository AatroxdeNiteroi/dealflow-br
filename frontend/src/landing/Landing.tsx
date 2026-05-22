/* ============================================================
   Landing — Genesis Radar (a experiência do radar).

   Existe desde o primeiro frame: o campo WebGL é o fundo vivo do
   portal. Enquanto `revealed` é falso, a cromática do radar (nav,
   HUD, cue) fica oculta e o scroll travado — só o campo e o
   hover do cursor rodam. Quando o portal libera, a cromática se
   revela e a jornada de scroll começa, sobre o MESMO campo.
   ============================================================ */

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { PointField } from "./three/PointField";
import { CONTROLADOR } from "../legal/dpo";
import TermosModal from "../components/Modal/TermosModal";
import PrivacidadeModal from "../components/Modal/PrivacidadeModal";

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

// Capítulo 2 — fragmentos de dado público que convergem sobre o
// dossiê. São anônimos e tarjados de propósito: vê-se o dado chegar,
// nunca o que ele é. Gerados uma vez, com semente fixa (estáveis).
const CH2_MOTES = (() => {
  let s = 0x9e3779b1;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  return Array.from({ length: 26 }, () => {
    const ang = rnd() * Math.PI * 2;
    const rx = 240 + rnd() * 200; // halo largo — o dado ladeia o dossiê
    const ry = 34 + rnd() * 96; // halo baixo — não invade rótulo/desfecho
    const k = 2.4 + rnd() * 1.5; // o quanto o fragmento começa longe
    const drift = (rnd() - 0.5) * 0.6; // leve curva na entrada
    return {
      x0: Math.cos(ang + drift) * rx * k,
      y0: Math.sin(ang + drift) * ry * k,
      x1: Math.cos(ang) * rx,
      y1: Math.sin(ang) * ry,
      w: 20 + Math.round(rnd() * 52),
      o: 0.4 + rnd() * 0.48,
    };
  });
})();

function formatBRL(mi: number): string {
  if (mi < 1) return "R$ " + Math.round(mi * 1000) + " mil";
  return "R$ " + mi.toFixed(1).replace(".", ",") + " mi";
}

export function Landing({ phase }: { phase: "gateway" | "entering" | "radar" }) {
  const revealed = phase === "radar";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelLayerRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const revealedRef = useRef(false);
  // modais legais do footer — abrem sobre toda a landing
  const [showTermos, setShowTermos] = useState(false);
  const [showPriv, setShowPriv] = useState(false);

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
        // ── Capítulo 1 — a jornada: a trilha dirige câmera + texto ──
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
          .to(".hero__cue", { autoAlpha: 0, duration: 0.08 }, 0)
          .to(".hero__hud", { autoAlpha: 0, duration: 0.12 }, 0.05)
          .to(".hero__frame", { autoAlpha: 0, duration: 0.2 }, 0.42)
          // dentro da esfera, no preto: as palavras surgem num fade
          // suave e escalonado — e só então o interior clareia
          .fromTo(".respiro__copy", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.035 }, 0.82)
          .fromTo(
            ".respiro__w",
            { opacity: 0 },
            { opacity: 1, ease: "power1.inOut", duration: 0.04, stagger: { amount: 0.03 } },
            0.86,
          )
          // o CTA surge quando a esfera clareia (journey ~0.93) e, fixo,
          // acompanha o usuário por todos os capítulos seguintes
          .fromTo(
            ".lp-cta",
            { autoAlpha: 0, y: 16 },
            { autoAlpha: 1, y: 0, duration: 0.05, ease: "power2.out" },
            0.93,
          );

        // ── Capítulo 2 — Convergência ───────────────────────────
        // a jornada parou no Interior; o campo desfocado vira pano
        // de fundo. O dado público — anônimo, tarjado — converge
        // sobre o dossiê. O faturamento segue oculto: gancho do Cap. 3.
        const ch2 = gsap.timeline({
          scrollTrigger: {
            trigger: ".ch2-track",
            start: "top bottom",
            end: "bottom bottom",
            scrub: 1,
          },
        });
        ch2
          .to({}, { duration: 1 }, 0)
          // o respiro do Capítulo 1 sai; a cena do dossiê entra
          .to(".respiro__copy", { autoAlpha: 0, duration: 0.05 }, 0)
          .fromTo(".ch2-stage", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.07 }, 0.02)
          .fromTo(
            ".ch2-eyebrow",
            { autoAlpha: 0, y: -12 },
            { autoAlpha: 1, y: 0, duration: 0.07 },
            0.04,
          )
          .fromTo(
            ".ch2-dossier",
            { autoAlpha: 0, scale: 0.92 },
            { autoAlpha: 1, scale: 1, duration: 0.12, ease: "power2.out" },
            0.06,
          )
          // o dado público converge — anônimo e tarjado, de toda parte;
          // posições por mote vêm do JS, sem ordem visível (from random)
          .fromTo(
            ".ch2-mote",
            {
              autoAlpha: 0,
              xPercent: -50,
              yPercent: -50,
              x: (i) => CH2_MOTES[i]!.x0,
              y: (i) => CH2_MOTES[i]!.y0,
            },
            {
              autoAlpha: (i) => CH2_MOTES[i]!.o,
              xPercent: -50,
              yPercent: -50,
              x: (i) => CH2_MOTES[i]!.x1,
              y: (i) => CH2_MOTES[i]!.y1,
              duration: 0.24,
              ease: "power2.out",
              stagger: { amount: 0.4, from: "random" },
            },
            0.12,
          )
          // convergência completa — um pulso dourado marca o número
          // que segue tarjado, e o desfecho entra (gancho do Cap. 3)
          .fromTo(
            ".ch2-dossier__redact",
            { boxShadow: "0 0 0 0 rgba(184, 134, 11, 0)" },
            {
              boxShadow: "0 0 0 3px rgba(184, 134, 11, 0.4)",
              duration: 0.1,
              repeat: 1,
              yoyo: true,
              ease: "power1.inOut",
            },
            0.78,
          )
          .fromTo(
            ".ch2-close",
            { autoAlpha: 0, y: 18 },
            { autoAlpha: 1, y: 0, duration: 0.1, ease: "power2.out" },
            0.84,
          );

        // ── Capítulo 3 — A estimativa ───────────────────────────
        // a tarja do faturamento finalmente resolve — mas como
        // intervalo honesto (mínimo · estimativa · máximo), nunca
        // um número cravado. O método (a fórmula) não aparece.
        const ch3 = gsap.timeline({
          scrollTrigger: {
            trigger: ".ch3-track",
            start: "top bottom",
            end: "bottom bottom",
            scrub: 1,
          },
        });
        ch3
          .to({}, { duration: 1 }, 0)
          // a cena do Capítulo 2 sai; a da estimativa entra
          .to(".ch2-stage", { autoAlpha: 0, duration: 0.06 }, 0)
          .fromTo(".ch3-stage", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.07 }, 0.02)
          .fromTo(
            ".ch3-eyebrow",
            { autoAlpha: 0, y: -12 },
            { autoAlpha: 1, y: 0, duration: 0.07 },
            0.05,
          )
          .fromTo(".ch3-company", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.06 }, 0.07)
          .fromTo(
            ".ch3-reveal__label",
            { autoAlpha: 0, y: 8 },
            { autoAlpha: 1, y: 0, duration: 0.06 },
            0.09,
          )
          // a resolução — a tarja se dissolve, o número entra em foco
          .to(
            ".ch3-amount__redact",
            { autoAlpha: 0, scale: 1.12, duration: 0.13, ease: "power2.in" },
            0.3,
          )
          .fromTo(
            ".ch3-amount__value",
            { autoAlpha: 0, scale: 0.9 },
            { autoAlpha: 1, scale: 1, duration: 0.16, ease: "power2.out" },
            0.33,
          )
          // o intervalo honesto — extremos, régua e a marca da estimativa
          .fromTo(
            ".ch3-range__end",
            { autoAlpha: 0, y: 10 },
            { autoAlpha: 1, y: 0, duration: 0.08, stagger: 0.03 },
            0.5,
          )
          .fromTo(
            ".ch3-range__track",
            { scaleX: 0 },
            { scaleX: 1, duration: 0.12, ease: "power2.inOut" },
            0.52,
          )
          .fromTo(".ch3-range__mark", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.07 }, 0.62)
          .fromTo(
            ".ch3-close",
            { autoAlpha: 0, y: 18 },
            { autoAlpha: 1, y: 0, duration: 0.1, ease: "power2.out" },
            0.8,
          );

        // ── Capítulo 4 — O universo ─────────────────────────────
        // a câmera recua: a empresa do Cap. 3 volta a ser um ponto,
        // um entre 46.255. O campo inteiro se revela. Beat de escala.
        // delta do canto até o centro — calculado do estilo computado
        // (imune a transform já aplicado); reavaliado a cada refresh
        const ctaTravelXY = () => {
          const cta = document.querySelector<HTMLElement>(".lp-cta");
          if (!cta) return { x: 0, y: 0 };
          const cs = getComputedStyle(cta);
          const restCx = window.innerWidth - (parseFloat(cs.right) || 0) - cta.offsetWidth / 2;
          const restCy = window.innerHeight - (parseFloat(cs.bottom) || 0) - cta.offsetHeight / 2;
          return {
            x: window.innerWidth / 2 - restCx,
            y: window.innerHeight / 2 - 72 - restCy,
          };
        };
        const ch4Counter = { v: 0 };
        const ch4 = gsap.timeline({
          scrollTrigger: {
            trigger: ".ch4-track",
            start: "top bottom",
            end: "bottom bottom",
            scrub: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => field.setUniverse(self.progress),
          },
        });
        ch4
          .to({}, { duration: 1 }, 0)
          .to(".ch3-stage", { autoAlpha: 0, duration: 0.06 }, 0)
          .fromTo(".ch4-stage", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.07 }, 0.02)
          .fromTo(
            ".ch4-eyebrow",
            { autoAlpha: 0, y: -12 },
            { autoAlpha: 1, y: 0, duration: 0.07 },
            0.05,
          )
          .fromTo(
            ".ch4-panel",
            { autoAlpha: 0, y: 24 },
            { autoAlpha: 1, y: 0, duration: 0.1, ease: "power2.out" },
            0.08,
          )
          // a contagem sobe enquanto o campo inteiro se revela
          .fromTo(
            ch4Counter,
            { v: 0 },
            {
              v: 46255,
              duration: 0.5,
              ease: "power1.out",
              onUpdate: () => {
                if (countRef.current) {
                  countRef.current.textContent = Math.round(ch4Counter.v).toLocaleString("pt-BR");
                }
              },
            },
            0.16,
          )
          .fromTo(
            ".ch4-close",
            { autoAlpha: 0, y: 18 },
            { autoAlpha: 1, y: 0, duration: 0.1, ease: "power2.out" },
            0.74,
          )
          // o conteúdo do universo recua...
          .to(
            [".ch4-eyebrow", ".ch4-panel", ".ch4-close"],
            { autoAlpha: 0, duration: 0.06 },
            0.86,
          )
          // ...o MESMO botão de canto é deslocado até o centro e cresce
          .to(
            ".lp-cta",
            {
              x: () => ctaTravelXY().x,
              y: () => ctaTravelXY().y,
              scale: 1.4,
              duration: 0.13,
              ease: "power3.inOut",
            },
            0.86,
          )
          // ...e a frase do convite entra logo abaixo
          .fromTo(
            ".ch4-finale",
            { autoAlpha: 0, y: 16 },
            { autoAlpha: 1, y: 0, duration: 0.09, ease: "power2.out" },
            0.93,
          )
          // header e footer ressurgem ao fim do último capítulo
          .to([".lp-nav", ".lp-footer"], { autoAlpha: 1, duration: 0.08, ease: "power2.out" }, 0.92);
        // estado inicial da contagem (com motion; em reduced fica 46.255)
        if (countRef.current) countRef.current.textContent = "0";
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
      gsap.set([".lp-nav", ".lp-footer", ".lp-stage", ".lp-cta"], { autoAlpha: 1 });
      if (countRef.current) countRef.current.textContent = "46.255";
      return;
    }

    const ctx = gsap.context(() => {
      // a cromática do radar (HUD, texto) surge sobre o campo já presente
      gsap.to(".lp-stage", { autoAlpha: 1, duration: 0.7, ease: "power2.out" });
    });
    return () => ctx.revert();
  }, [revealed]);

  // ── chrome (header + footer) — visível no Gateway, some ao entrar
  //    no radar; o fim do Cap. 4 o traz de volta (timeline do ch4) ──
  useEffect(() => {
    if (phase === "gateway") {
      gsap.to([".lp-nav", ".lp-footer"], { autoAlpha: 1, duration: 0.8, ease: "power2.out" });
    } else if (phase === "entering") {
      gsap.to([".lp-nav", ".lp-footer"], { autoAlpha: 0, duration: 0.5, ease: "power2.in" });
    }
  }, [phase]);

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
        <nav className="lp-nav__btns" aria-label="Conta">
          <button type="button" className="lp-nav__btn">
            <svg className="lp-nav__btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            <span className="lp-nav__btn-label">Nossa história</span>
          </button>
          <button type="button" className="lp-nav__btn">
            <svg className="lp-nav__btn-icon" viewBox="0 0 26 24" aria-hidden="true">
              <circle cx="9.6" cy="8" r="3.7" />
              <path d="M3 20c0-3.9 3-6.4 6.6-6.4 1 0 2 .15 2.9.45" />
              <path d="M19 12.4v7.2M15.4 16h7.2" />
            </svg>
            <span className="lp-nav__btn-label">Criar conta</span>
          </button>
          <button type="button" className="lp-nav__btn">
            <svg className="lp-nav__btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="3.7" />
              <path d="M5.2 20c0-3.9 3-6.4 6.8-6.4s6.8 2.5 6.8 6.4" />
            </svg>
            <span className="lp-nav__btn-label">Fazer login</span>
          </button>
        </nav>
      </header>

      <footer className="lp-footer">
        <span className="lp-footer__org">{CONTROLADOR.razao_social}</span>
        <nav className="lp-footer__links" aria-label="Documentos legais">
          <button type="button" className="lp-footer__link" onClick={() => setShowPriv(true)}>
            Política de Privacidade
          </button>
          <span className="lp-footer__sep" aria-hidden="true">
            ·
          </span>
          <button type="button" className="lp-footer__link" onClick={() => setShowTermos(true)}>
            Termos de Uso
          </button>
          <span className="lp-footer__sep" aria-hidden="true">
            ·
          </span>
          <a className="lp-footer__link" href="mailto:contato@genesislabs.com.br?subject=Fale%20conosco">
            Fale conosco
          </a>
        </nav>
      </footer>

      {/* CTA persistente — surge quando a esfera clareia, segue até o fim */}
      <button type="button" className="lp-cta">
        Ver planos
        <svg className="lp-cta__arrow" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12h14M12 5.5 18.5 12 12 18.5" />
        </svg>
      </button>

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

      {/* ── Capítulo 2 — Convergência ────────────────────────────── */}
      <section className="ch2-stage" aria-label="Capítulo 2 — Convergência">
        <span className="ch2-eyebrow">Convergência</span>

        <div className="ch2-scene">
          {CH2_MOTES.map((m, i) => (
            <span className="ch2-mote" key={i} aria-hidden="true" style={{ width: m.w }} />
          ))}

          <article className="ch2-dossier">
            <span className="ch2-dossier__corner ch2-dossier__corner--tl" aria-hidden="true" />
            <span className="ch2-dossier__corner ch2-dossier__corner--tr" aria-hidden="true" />
            <span className="ch2-dossier__corner ch2-dossier__corner--bl" aria-hidden="true" />
            <span className="ch2-dossier__corner ch2-dossier__corner--br" aria-hidden="true" />

            <span className="ch2-dossier__eyebrow">Empresa em análise</span>
            <span className="ch2-dossier__cnpj">CNPJ ██.███.███/0001-██</span>
            <span className="ch2-dossier__desc">
              Fabricação de esquadrias de metal · São Paulo / SP
            </span>

            <span className="ch2-dossier__rule" aria-hidden="true" />

            <span className="ch2-dossier__rev-label">Faturamento anual</span>
            <span className="ch2-dossier__redact" aria-hidden="true" />
            <span className="ch2-dossier__rev-note">valor que nenhuma base pública declara</span>
          </article>
        </div>

        <p className="ch2-close">
          <span className="ch2-close__lead">Nenhuma base pública declara o faturamento.</span>
          <span className="ch2-close__sub">Mas, juntas, todas o cercam.</span>
        </p>
      </section>
      <div className="ch2-track" aria-hidden="true" />

      {/* ── Capítulo 3 — A estimativa ────────────────────────────── */}
      <section className="ch3-stage" aria-label="Capítulo 3 — A estimativa">
        <span className="ch3-eyebrow">A estimativa</span>

        <div className="ch3-reveal">
          <span className="ch3-company">
            Fabricação de esquadrias de metal · CNPJ ██.███.███/0001-██
          </span>
          <span className="ch3-reveal__label">Faturamento anual estimado</span>
          <span className="ch3-amount">
            <span className="ch3-amount__value">R$ 24,3 mi</span>
            <span className="ch3-amount__redact" aria-hidden="true" />
          </span>
          <div className="ch3-range">
            <span className="ch3-range__end">
              <span className="ch3-range__tag">mínimo</span>
              <span className="ch3-range__num">R$ 20,7 mi</span>
            </span>
            <span className="ch3-range__bar" aria-hidden="true">
              <span className="ch3-range__track" />
              <span className="ch3-range__mark" />
            </span>
            <span className="ch3-range__end">
              <span className="ch3-range__tag">máximo</span>
              <span className="ch3-range__num">R$ 27,9 mi</span>
            </span>
          </div>
        </div>

        <p className="ch3-close">
          <span className="ch3-close__lead">
            A precisão do mercado de elite, sobre cada empresa fechada do país.
          </span>
          <span className="ch3-close__sub">
            Estudo financeiro caso a caso, auditável, para estimativa real.
          </span>
        </p>
      </section>
      <div className="ch3-track" aria-hidden="true" />

      {/* ── Capítulo 4 — O universo ──────────────────────────────── */}
      <section className="ch4-stage" aria-label="Capítulo 4 — O universo">
        <span className="ch4-eyebrow">O universo</span>

        <div className="ch4-panel">
          <span className="ch4-count" ref={countRef}>
            46.255
          </span>
          <span className="ch4-count__label">empresas de capital fechado no radar</span>
        </div>

        <p className="ch4-close">
          <span className="ch4-close__lead">Você esteve dentro de uma delas.</span>
          <span className="ch4-close__sub">
            As outras 46.254 já estão no radar — cada uma com seu número.
          </span>
        </p>
      </section>
      <div className="ch4-track" aria-hidden="true" />

      {/* convite final — a frase; o botão é o próprio CTA, deslocado
          dinamicamente do canto até o centro pela timeline do Cap. 4 */}
      <p className="ch4-finale">Seu próximo negócio está em um destes 46.255 pontos.</p>

      {/* modais legais — acionados pelos campos do footer */}
      <TermosModal open={showTermos} onClose={() => setShowTermos(false)} />
      <PrivacidadeModal open={showPriv} onClose={() => setShowPriv(false)} />
    </div>
  );
}
