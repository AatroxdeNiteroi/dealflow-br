/* ============================================================
   Gateway — portal de entrada da Genesis Radar (WP-GW).

   Camada sobre o campo de radar (que já roda por baixo, vivo). O
   header/footer são os da landing. Centro: logo do produto, frase-
   âncora, convite. "Quero conhecer o produto" sai e a jornada do
   MESMO campo começa — sem troca de tela.

   G1 · boot (~1.9 s, rk-expo): o véu pré-renderizado fecha por
        escala (1.84 → 1), o halo acende, a espiral se desenha
        (DrawSVG), a agulha calibra rumo ao feixe vivo, as faíscas
        surgem, letreiro, régua, frase, CTA e — por último — a
        legenda passiva. Câmera do campo 3.5 unidades atrás
        (field.time.entryZ), anéis externos e dial nas bordas.
   G2 · saída "a logo é o radar" (1.1 s): o texto sai para CIMA
        (subida + alpha, sem blur — QA PERF-4 —, em onda de cima p/ baixo, à frente do emblema
        que mergulha pela coluna); o emblema plana até o hub do campo
        e escala até o raio do anel[0] (alvo VIVO, medido no mesmo
        frame do GL — inclui o empurrão e o baque de FOV, que a pose-
        herói fixa erraria em ~8 px no contato), a espiral abre no anel
        (MorphSVG), a câmera empurra (entryZ 3.5 → 0), o FOV dá o
        "baque"; no contato (0.72 s) o emblema some em 120 ms — a
        geometria é idêntica, o olho lê UM objeto — o campo acende
        (flare) e a onda de choque acorda os anéis em sequência.
        Saída silenciosa (quiet): mesmo texto + planeio, o véu de
        papel cobre em 0.30 s (runtime.veil.cover) e onLeft em 0.65 s;
        o teleporte pendente assume com o véu já fechado.
   Reduced motion: sem boot; o clique chama onLeft() na hora.

   v3 "Sonar Líquido" (WP5, spec rev 3.1 §3 G1/G2, §5, §7 E13–E16):
   - letreiro, frase e legenda DERRAMAM glifo a glifo (gramática INK,
     variante de tempo do motor de glifos: cinema/type/glyphs.ts) em vez
     da janela de máscara por palavra; nada recorta o texto;
   - o CTA é uma pílula que CONDENSA (opacity, scale .94 → 1, y 10 → 0,
     cx-pour); o anel armado é uma pílula concêntrica que mantém o ping;
   - a régua termina numa gota redonda (era um losango);
   - na saída o texto EVAPORA da borda final (rtl), numa onda de cima
     para baixo à frente do emblema; o CTA e a régua se dissolvem;
   - uTextMask: retângulo 0 = letreiro + régua + frase, 1 = CTA +
     legenda (field.setTextMask), medidos no boot, no fonts.ready e no
     resize; sob eles o campo não tem véu, rastro nem pings (papel limpo).
     Na saída os dois se fecham para o centro enquanto o texto some.

   Escritores únicos:
   - field.time: SÓ a timeline de campo deste módulo (fieldTl) e o
     settle hook "gw.field" (runtime.settle, persistente). A fieldTl
     vive fora do componente: a onda de choque passa do onLeft.
   - DOM do portal: boot/ocioso (gsap.context do layout effect) e a
     saída (timeline própria, morta — nunca revertida — na limpeza).
   - --sweep-bearing em .grl: o campo (cinema CH1, slot Labels).
   ============================================================ */

import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { GenesisRadarLogo, GRL_GEOMETRY, GRL_RING_PATH } from "./GenesisRadarLogo";
import { runtime } from "./cinema/runtime";
import { prewarmFilters } from "./cinema/prewarm";
import { GATEWAY_TIMING, RING_WORLD_R } from "./cinema/beats";
import { GATEWAY_COPY } from "./cinema/copy";
import { MaskWords, splitWords, type MaskWord } from "./cinema/MaskWords";
import { playGlyphs, primeGlyphs } from "./cinema/type/glyphs";
import type { Rect } from "./cinema/types";
// registra as eases cx-* (idempotente): cx-pour / cx-flow / cx-evap abaixo
import "./cinema/eases";

// os mesmos plugins que o cinema registra (idempotente; sem depender da
// ordem de import do Landing)
gsap.registerPlugin(DrawSVGPlugin, MorphSVGPlugin);

/** A frase-âncora: a parte final em itálico (.gx-em) — copy verbatim (copy.ts). */
const PHRASE_WORDS: readonly MaskWord[] = [
  ...splitWords(GATEWAY_COPY.phrase),
  ...splitWords(GATEWAY_COPY.phraseEm).map((w) => ({ ...w, em: true })),
];

interface GatewayProps {
  leaving: boolean;
  /** entrada silenciosa (Ver planos em fila / ?auth=plans): a saída cobre com o véu */
  quiet?: boolean;
  onEnter: (quiet?: boolean) => void;
  onLeft: () => void;
}

function prefersReduced(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ── geometria e tempos ────────────────────────────────────── */

const G2 = GATEWAY_TIMING.G2;
const CONTACT = G2.contact; // 0.72 s — o emblema É o anel[0]
/** Frente da onda de choque: anel[0] → 14 unidades (além do dial). */
const SHOCK_END_R = 14;
/** Hub do emblema no box do <svg>: (100 − 34)/132, (100 − 32)/134. */
const HUB_FX = (GRL_GEOMETRY.cx - GRL_GEOMETRY.vbX) / GRL_GEOMETRY.vbW;
const HUB_FY = (GRL_GEOMETRY.cy - GRL_GEOMETRY.vbY) / GRL_GEOMETRY.vbH;
const HUB_ORIGIN = `${(HUB_FX * 100).toFixed(3)}% ${(HUB_FY * 100).toFixed(3)}%`;
/** Espessuras NA TELA (px CSS) no contato: o traço do anel do GL é um fio. */
const AT_CONTACT = { spiral: 1.1, needle: 2, hub: 4, tip: 2.2 } as const;
/** Legenda: some após 240 px de viagem do ponteiro; glifo deriva ≤ 3 px. */
const CUE_TRAVEL_PX = 240;
const CUE_DRIFT_PX = 3;
/** Pulso "armado" do CTA: 2.6 s após o boot, a cada 7 s, no máx. 3×. */
const PULSE = { first: 2.6, every: 7, max: 3 } as const;

/* ── texto (v3, §3 G1/G2 · §5.3 variantes de tempo) ────────────── */

/** Boot: derramamentos INK (s por glifo / s entre glifos) e quando começam. */
const POUR = {
  title: { at: 1.05, dur: 0.9, stagger: 0.018 },
  phrase: { at: 1.35, dur: 0.9, stagger: 0.012 },
  cue: { at: 1.72, dur: 0.5, stagger: 0.01 },
} as const;
/** Saída: o texto evapora (rtl) numa onda de CIMA para BAIXO, à frente do
 *  emblema que mergulha pela coluna (nunca a espiral sobre texto opaco). */
const EVAP = {
  title: { at: 0, dur: 0.2, stagger: 0.006 },
  rule: 0.03,
  phrase: { at: 0.05, dur: 0.24, stagger: 0.006 },
  cta: 0.08,
  cue: { at: 0.1, dur: 0.2, stagger: 0.006 },
} as const;
/** Legenda: evapora depois de 240 px de viagem do ponteiro. */
const CUE_OUT = { dur: 0.3, stagger: 0.008 } as const;
/** uTextMask: folga em volta dos blocos; os retângulos se fecham na saída. */
const MASK_PAD = 6;
const MASK_CLOSE = { at: 0.28, dur: 0.5 } as const;

function unionRect(els: ReadonlyArray<Element | null | undefined>, pad: number): Rect | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const el of els) {
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0) || !(r.height > 0)) continue;
    x0 = Math.min(x0, r.left);
    y0 = Math.min(y0, r.top);
    x1 = Math.max(x1, r.right);
    y1 = Math.max(y1, r.bottom);
  }
  if (!Number.isFinite(x0)) return null;
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
}

/** Os dois retângulos de texto do portal (CSS px de viewport), ou null. */
function measureTextRects(root: HTMLElement): [Rect | null, Rect | null] {
  const q = (s: string) => root.querySelector(s);
  return [
    unionRect([q(".grl__word"), q(".grl__rule"), q(".gx-gate__phrase")], MASK_PAD),
    unionRect([q(".gx-cta"), q(".gx-cue")], MASK_PAD),
  ];
}

/** field.setTextMask para os retângulos 0 e 1, encolhidos para o centro por k ∈ [0, 1]. */
function writeTextMask(rects: [Rect | null, Rect | null], k = 1): void {
  const f = runtime.fieldOrNull();
  if (!f) return;
  rects.forEach((r, i) => {
    if (!r || k <= 0) {
      f.setTextMask(i, null);
      return;
    }
    const w = r.w * k;
    const h = r.h * k;
    f.setTextMask(i, { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h });
  });
}

/* ── camada de tempo do campo (field.time) ─────────────────── */

interface TimeState {
  entryZ: number;
  shockR: number;
  fovGate: number;
  b0: number;
  b1: number;
  b2: number;
  b3: number;
}
/** Repouso do portal: câmera 3.5 atrás, sem choque. */
const GATE_REST: Readonly<TimeState> = {
  entryZ: GATEWAY_TIMING.entryZ,
  shockR: -1,
  fovGate: 0,
  b0: 0,
  b1: 0,
  b2: 0,
  b3: 0,
};
/** Neutro (radar e planos). */
const NEUTRAL: Readonly<TimeState> = { ...GATE_REST, entryZ: 0 };

function writeTime(s: Readonly<TimeState>): void {
  const f = runtime.fieldOrNull();
  if (!f) return;
  const t = f.time;
  t.entryZ = s.entryZ;
  t.shockR = s.shockR;
  t.fovGate = s.fovGate;
  t.ringBoost[0] = s.b0;
  t.ringBoost[1] = s.b1;
  t.ringBoost[2] = s.b2;
  t.ringBoost[3] = s.b3;
}

/** A timeline de campo da saída — sobrevive ao desmonte do Gateway. */
let fieldTl: gsap.core.Timeline | null = null;
function killFieldTl(): void {
  fieldTl?.kill();
  fieldTl = null;
}

// settle hook PERSISTENTE (o Gateway desmonta no radar; o retorno ao portal
// chama settle(0) com ele desmontado): start = repouso do portal, end = neutro.
// Escopo `.gx-gate`: os nós `.cx-*` do portal (camadas do motor de glifos)
// pertencem a este módulo — o estado do DOM do portal é por tempo (boot,
// saída), nunca do master, então settle não tem nada a escrever nele.
runtime.settle.register(
  "gw.field",
  {
    start() {
      killFieldTl();
      writeTime(GATE_REST);
    },
    end() {
      killFieldTl();
      writeTime(NEUTRAL);
    },
  },
  ".gx-gate",
);

/** x tal que ease(x) = y (bisseção; eases do portal são monótonas). */
function invertEase(ease: (t: number) => number, y: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if (ease(m) < y) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/**
 * G2 no campo: empurrão de câmera, baque de FOV, flare no contato, onda de
 * choque com os anéis acendendo quando a frente passa por eles. Quiet: só o
 * empurrão (o resto aconteceria sob o véu de papel).
 */
function playFieldExit(quiet: boolean): void {
  killFieldTl();
  const f = runtime.fieldOrNull();
  const s: TimeState = { ...GATE_REST, entryZ: f ? f.time.entryZ : GATE_REST.entryZ };
  const tl = gsap.timeline({
    onUpdate: () => writeTime(s),
    onComplete: () => {
      writeTime(NEUTRAL);
      if (fieldTl === tl) fieldTl = null;
    },
  });
  tl.to(s, { entryZ: 0, duration: 0.9, ease: "rk-expo" }, 0);
  if (!quiet) {
    // baque: o FOV fecha 3° e reabre (o olho "cai" pela espiral)
    tl.to(s, { fovGate: -3, duration: 0.09, ease: "rk-expo" }, 0.6);
    tl.to(s, { fovGate: 0, duration: 0.55, ease: "rk-settle" }, 0.69);
    // contato: o radar acorda
    tl.call(() => runtime.fieldOrNull()?.flare(), undefined, CONTACT);
    tl.fromTo(s, { b0: 1.5 }, { b0: 0, duration: 0.9, ease: "rk-settle", immediateRender: false }, CONTACT);
    const shockDur = 0.9;
    tl.fromTo(
      s,
      { shockR: RING_WORLD_R[0] },
      { shockR: SHOCK_END_R, duration: shockDur, ease: "rk-expo", immediateRender: false },
      CONTACT,
    );
    tl.set(s, { shockR: -1 }, CONTACT + shockDur);
    // cada anel acende no frame em que a frente o cruza (mesma ease do choque)
    const ease = gsap.parseEase("rk-expo" as gsap.EaseString);
    const keys = ["b1", "b2", "b3"] as const;
    keys.forEach((key, k) => {
      const frac = (RING_WORLD_R[k + 1] - RING_WORLD_R[0]) / (SHOCK_END_R - RING_WORLD_R[0]);
      const at = CONTACT + shockDur * invertEase(ease, frac);
      tl.fromTo(s, { [key]: 1 }, { [key]: 0, duration: 0.6, ease: "rk-settle", immediateRender: false }, at);
    });
  }
  fieldTl = tl;
}

/** Centro e raio (px) do anel[0] NA TELA, com a câmera viva deste frame. */
function ringTarget(): { x: number; y: number; r: number } {
  const f = runtime.fieldOrNull();
  if (f) {
    const c = f.projectToScreen(0, 0, -1);
    const r = f.ringRadiusPx(RING_WORLD_R[0]);
    if (Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(r) && r > 1) return { x: c.x, y: c.y, r };
  }
  // sem campo: o centro do viewport e o raio de pose-herói do fallback
  return { x: window.innerWidth / 2, y: window.innerHeight / 2, r: window.innerHeight * 0.12 };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ── componente ────────────────────────────────────────────── */

export function Gateway({ leaving, quiet = false, onEnter, onLeft }: GatewayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  /** boot + vida ociosa (revertidos no desmonte; congelados na saída) */
  const bootCtxRef = useRef<gsap.Context | null>(null);
  const bootTlRef = useRef<gsap.core.Timeline | null>(null);
  /** desliga ouvintes/pulso ociosos (chamado na saída e na limpeza) */
  const stopIdleRef = useRef<() => void>(() => {});
  const leavingRef = useRef(false);
  const quietRef = useRef(quiet);
  quietRef.current = quiet;

  // ── G1 · boot — antes do paint, para não piscar conteúdo ──
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReduced()) return;
    // câmera do campo no repouso do portal (anéis externos + dial nas bordas)
    killFieldTl();
    writeTime(GATE_REST);

    const one = <T extends Element>(sel: string) => root.querySelector<T>(sel) ?? undefined;
    const veil = one<HTMLElement>(".gx-gate__veil");
    const bloom = one<HTMLElement>(".grl__bloom");
    const spiral = one<SVGPathElement>(".grl__spiral");
    const cta = one<HTMLButtonElement>(".gx-cta");
    const cue = one<HTMLElement>(".gx-cue");
    const cueRing = one<HTMLElement>(".gx-cue__ring");
    const sparks = Array.from(root.querySelectorAll(".grl__spark"));
    const title = one<HTMLElement>(".grl__word");
    const phrase = one<HTMLElement>(".gx-gate__phrase");
    const cueText = one<HTMLElement>(".gx-cue__text");

    // glyph geometry of the three text blocks, measured in an idle slot well
    // before the first pour (1.05 s); re-measured by the engine on font loads
    primeGlyphs([title, phrase, cueText].filter((el): el is HTMLElement => !!el), 600);

    // uTextMask (§3 G1): clean paper under the portal text. Measured now, when
    // the fonts land and on resize (rAF-throttled); never per frame.
    let maskRaf = 0;
    const remask = () => {
      maskRaf = 0;
      if (!leavingRef.current) writeTextMask(measureTextRects(root));
    };
    const onResize = () => {
      if (!maskRaf) maskRaf = requestAnimationFrame(remask);
    };
    remask();
    if (document.fonts?.ready) document.fonts.ready.then(() => !leavingRef.current && rootRef.current && remask());
    window.addEventListener("resize", onResize);

    const cleanups: Array<() => void> = [];
    stopIdleRef.current = () => {
      cleanups.splice(0).forEach((fn) => fn());
      cta?.classList.remove("is-armed");
    };

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: "rk-expo" },
        onComplete: () => {
          if (leavingRef.current) return;
          // every box is at rest now: the exact text rects
          remask();
          ctx.add(startIdle);
          // QA PERF-4 + v3: blur / mask / liquid-clip shader prewarm while the
          // portal is idle (stopIdleRef aborts it the moment the exit starts)
          cleanups.push(prewarmFilters(root));
        },
      });
      // (a) véu: camada pré-renderizada no raio de repouso; só escala
      if (veil) {
        gsap.set(veil, { willChange: "transform" });
        tl.fromTo(
          veil,
          { scale: 1.84 },
          { scale: 1, duration: 1.2, onComplete: () => gsap.set(veil, { willChange: "auto" }) },
          0,
        );
      }
      // (b) halo acende — só até calor ambiente
      tl.to(bloom ?? [], { opacity: 0.32, duration: 1.0 }, 0.15);
      // (c) espiral se desenha do hub para fora (calibra)
      if (spiral) tl.fromTo(spiral, { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.2, ease: "power2.inOut" }, 0.2);
      // (d) agulha liga e calibra: −120° → o feixe vivo, no mesmo sentido do giro
      tl.fromTo(".grl__sweep", { "--boot-swing": -120 }, { "--boot-swing": 0, duration: 1.1, ease: "rk-glide" }, 0.55);
      tl.fromTo([".grl__needle", ".grl__tip"], { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "rk-settle" }, 0.55);
      // (e) faíscas surgem em ordem aleatória — de .6, nunca de 0
      tl.fromTo(
        sparks,
        { scale: 0.6, opacity: 0, transformOrigin: "50% 50%" },
        { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2.4)", stagger: { each: 0.06, from: "random" } },
        0.95,
      );
      // (f) letreiro: derrama glifo a glifo (INK no papel, tempo) — sem janela
      if (title) tl.add(playGlyphs(title, "ink", { dur: POUR.title.dur, stagger: POUR.title.stagger }), POUR.title.at);
      // (g) régua se abre do centro; a gota cai de .6 (nunca de 0)
      tl.from(".grl__rule-seg", { scaleX: 0, transformOrigin: "50% 50%", duration: 0.5, stagger: 0.08, ease: "cx-flow" }, 1.2);
      tl.from(".grl__rule-dot", { scale: 0.6, autoAlpha: 0, duration: 0.4, ease: "cx-pour" }, 1.32);
      // (h) frase derrama na frente que corre pela linha (bleed, 0.65 de atraso por linha)
      if (phrase) tl.add(playGlyphs(phrase, "ink", { dur: POUR.phrase.dur, stagger: POUR.phrase.stagger }), POUR.phrase.at);
      // (i) CTA condensa no lugar: a pílula toma corpo (cx-pour, ≈ 1.5 % de menisco)
      tl.fromTo(
        ".gx-cta",
        { autoAlpha: 0, scale: 0.94, y: 10 },
        { autoAlpha: 1, scale: 1, y: 0, duration: 0.6, ease: "cx-pour" },
        1.5,
      );
      // (j) legenda passiva por último: o anel-glifo goteja, o texto derrama
      tl.from(".gx-cue__ring", { scale: 0.6, autoAlpha: 0, duration: 0.4, ease: "cx-pour" }, POUR.cue.at);
      if (cueText) tl.add(playGlyphs(cueText, "ink", { dur: POUR.cue.dur, stagger: POUR.cue.stagger }), POUR.cue.at);
      bootTlRef.current = tl;
    }, root);
    bootCtxRef.current = ctx;

    // vida ociosa (pós-boot, dentro do ctx): respiro do halo, cintilar das
    // faíscas, pulso armado do CTA, deriva do glifo + saída da legenda
    function startIdle() {
      gsap.to(bloom ?? [], {
        scale: 1.06,
        opacity: 0.26, // respira em torno do calor ambiente (0.32 do boot)
        transformOrigin: "50% 50%",
        duration: 4.2,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        delay: 0.2,
      });
      gsap.to(sparks, {
        opacity: 0.94,
        duration: 2.8,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        delay: 0.2,
        stagger: { each: 0.5, from: "random" },
      });

      const canHover = window.matchMedia("(hover: hover)").matches;
      if (!canHover) return;

      // pulso armado — ping do anel ::after (CSS), nunca sobre um CTA já em foco
      if (cta) {
        let pulses = 0;
        let pending: gsap.core.Tween | null = null;
        const onEnd = (e: AnimationEvent) => {
          if (e.animationName === "gx-armed") cta.classList.remove("is-armed");
        };
        cta.addEventListener("animationend", onEnd);
        const pulse = () => {
          pending = null;
          if (leavingRef.current) return;
          if (!cta.matches(":hover") && !cta.matches(":focus-visible")) {
            cta.classList.add("is-armed");
            pulses++;
          }
          if (pulses < PULSE.max) pending = gsap.delayedCall(PULSE.every, pulse);
        };
        pending = gsap.delayedCall(PULSE.first, pulse);
        cleanups.push(() => {
          pending?.kill();
          cta.removeEventListener("animationend", onEnd);
        });
      }

      // legenda: o glifo deriva ≤ 3 px rumo ao ponteiro; 240 px de viagem e ela
      // sai (400 ms) — o visitante já descobriu que o campo responde
      if (cue && cueRing) {
        const dx = gsap.quickTo(cueRing, "x", { duration: 0.6, ease: "power3.out" });
        const dy = gsap.quickTo(cueRing, "y", { duration: 0.6, ease: "power3.out" });
        let centre: { x: number; y: number } | null = null;
        const invalidate = () => (centre = null);
        let travel = 0;
        let last: { x: number; y: number } | null = null;
        let gone = false;
        const onMove = (e: PointerEvent) => {
          if (gone || e.pointerType === "touch") return;
          if (!centre) {
            // centro SEM a deriva atual (o rect inclui o transform do glifo)
            const r = cueRing.getBoundingClientRect();
            centre = {
              x: r.left + r.width / 2 - Number(gsap.getProperty(cueRing, "x")),
              y: r.top + r.height / 2 - Number(gsap.getProperty(cueRing, "y")),
            };
          }
          const vx = e.clientX - centre.x;
          const vy = e.clientY - centre.y;
          const d = Math.hypot(vx, vy);
          const k = d > 0.5 ? (CUE_DRIFT_PX * Math.min(1, d / 160)) / d : 0;
          dx(vx * k);
          dy(vy * k);
          if (last) travel += Math.hypot(e.clientX - last.x, e.clientY - last.y);
          last = { x: e.clientX, y: e.clientY };
          if (travel >= CUE_TRAVEL_PX) {
            gone = true;
            // o visitante já descobriu: a legenda evapora (rtl) e o anel se desfaz
            if (cueText) playGlyphs(cueText, "evaporate", { dur: CUE_OUT.dur, stagger: CUE_OUT.stagger });
            gsap.to(cueRing, { autoAlpha: 0, scale: 0.6, duration: 0.3, ease: "cx-evap" });
          }
        };
        window.addEventListener("pointermove", onMove, { passive: true });
        window.addEventListener("resize", invalidate);
        cleanups.push(() => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("resize", invalidate);
        });
      }
    }

    return () => {
      stopIdleRef.current();
      window.removeEventListener("resize", onResize);
      if (maskRaf) cancelAnimationFrame(maskRaf);
      // the portal is gone: no clean-paper rects left on the field
      writeTextMask([null, null]);
      ctx.revert();
      bootCtxRef.current = null;
      bootTlRef.current = null;
    };
  }, []);

  // ── G2 · saída — "a logo é o radar" ──
  useEffect(() => {
    if (!leaving) return;
    if (prefersReduced()) {
      onLeft();
      return;
    }
    const root = rootRef.current;
    if (!root) {
      onLeft();
      return;
    }
    leavingRef.current = true;
    root.classList.add("is-leaving");

    // o boot e a vida ociosa congelam onde estão (sem reverter: a saída parte
    // do estado visível, mesmo num clique em pleno boot)
    const boot = bootTlRef.current;
    const bootDone = !boot || boot.progress() >= 1;
    stopIdleRef.current();
    bootCtxRef.current?.kill(false);

    // a variante é fixada no início da saída: um segundo onEnter() durante ela
    // (Enter no CTA ainda focado) não reinicia nem troca a coreografia
    const quiet = quietRef.current;
    const one = <T extends Element>(sel: string) => root.querySelector<T>(sel) ?? undefined;
    const veil = one<HTMLElement>(".gx-gate__veil");
    const bloom = one<HTMLElement>(".grl__bloom");
    const emblem = one<SVGSVGElement>(".grl__emblem");
    const spiral = one<SVGPathElement>(".grl__spiral");
    const needle = one<SVGLineElement>(".grl__needle");
    const hub = one<SVGCircleElement>(".grl__hub");
    const tip = one<SVGCircleElement>(".grl__tip");
    const cta = one<HTMLElement>(".gx-cta");
    const title = one<HTMLElement>(".grl__word");
    const phrase = one<HTMLElement>(".gx-gate__phrase");
    const cueText = one<HTMLElement>(".gx-cue__text");
    const cueRing = one<HTMLElement>(".gx-cue__ring");
    // text rects as they stand at the click (the boot may still be running)
    const maskRects = measureTextRects(root);

    // camada de campo (sobrevive ao desmonte: o choque passa do onLeft)
    playFieldExit(quiet);

    const tl = gsap.timeline({ defaults: { ease: "rk-settle" } });

    // 0 · o press se mantém durante a saída (o :active CSS solta no mouseup)
    if (cta) tl.to(cta, { scale: 0.97, duration: 0.12 }, 0);

    // o texto EVAPORA da borda final (rtl: a linha se desfaz do fim), numa
    // onda de CIMA PARA BAIXO que antecede o emblema: ele mergulha pela coluna
    // (letreiro → régua → frase), então cada linha já está se desfazendo
    // quando o emblema chega nela — nunca a espiral sobre texto opaco. Cada
    // glifo parte do estado em que está (um clique em pleno boot não acende
    // nada). QA PERF-4: nenhum blur na saída (variante de tempo sem blur).
    if (title) tl.add(playGlyphs(title, "evaporate", { dur: EVAP.title.dur, stagger: EVAP.title.stagger }), EVAP.title.at);
    tl.to(root.querySelectorAll(".grl__rule-seg"), { scaleX: 0, transformOrigin: "50% 50%", duration: 0.24, ease: "cx-evap" }, EVAP.rule);
    tl.to(root.querySelectorAll(".grl__rule-dot"), { scale: 0.4, autoAlpha: 0, duration: 0.2, ease: "cx-evap" }, EVAP.rule);
    if (phrase) tl.add(playGlyphs(phrase, "evaporate", { dur: EVAP.phrase.dur, stagger: EVAP.phrase.stagger }), EVAP.phrase.at);
    // a pílula se dissolve no lugar (sobe um fio e some), sem escala de caixa
    if (cta) tl.to(cta, { y: -8, autoAlpha: 0, duration: 0.26, ease: "cx-evap" }, EVAP.cta);
    if (cueText) tl.add(playGlyphs(cueText, "evaporate", { dur: EVAP.cue.dur, stagger: EVAP.cue.stagger }), EVAP.cue.at);
    if (cueRing) tl.to(cueRing, { scale: 0.6, autoAlpha: 0, duration: 0.2, ease: "cx-evap" }, EVAP.cue.at);

    // uTextMask: com o texto indo embora, o papel limpo se fecha para o
    // centro de cada bloco e o campo volta a escurecer por baixo (sem degrau)
    const mk = { k: 1 };
    tl.to(
      mk,
      {
        k: 0,
        duration: MASK_CLOSE.dur,
        ease: "cx-flow",
        onUpdate: () => writeTextMask(maskRects, mk.k),
        onComplete: () => writeTextMask([null, null]),
      },
      MASK_CLOSE.at,
    );

    // halo e faíscas apagam cedo: só o instrumento (espiral + agulha) mergulha
    if (bloom) tl.to(bloom, { opacity: 0, duration: 0.3 }, 0);
    tl.to(root.querySelectorAll(".grl__spark"), {
      autoAlpha: 0,
      scale: 0.6,
      transformOrigin: "50% 50%",
      duration: 0.3,
      stagger: { each: 0.02, from: "random" },
    }, 0.06);

    // 0.05–0.75 · o véu se abre (escala) e some — caímos ATRAVÉS dele
    if (veil) {
      gsap.set(veil, { willChange: "transform" });
      tl.to(veil, { scale: 2.5, autoAlpha: 0, duration: 0.7 }, 0.05);
    }

    // 0.06–0.81 · planeio: hub do emblema → hub do campo, raio da espiral →
    // raio do anel[0]. Alvo VIVO (câmera deste frame, inclusive o empurrão de
    // entryZ); escrito num callback do ticker que roda DEPOIS do relógio do
    // cinema (field.update), então emblema e GL mostram o mesmo instante.
    let glide: (() => void) | null = null;
    if (emblem) {
      const er = emblem.getBoundingClientRect();
      const ppu = er.width / GRL_GEOMETRY.vbW; // px por unidade do viewBox, em repouso
      const hub0 = { x: er.left + er.width * HUB_FX, y: er.top + er.height * HUB_FY };
      const r0 = GRL_GEOMETRY.spiralR * ppu;
      gsap.set(emblem, { transformOrigin: HUB_ORIGIN, x: 0, y: 0, scale: 1 });
      // um setter de transform (x, y, scale juntos: um único write por frame)
      const setT = gsap.quickSetter(emblem, "css") as (v: { x: number; y: number; scale: number }) => void;
      const xf = { x: 0, y: 0, scale: 1 };
      const g = { p: 0 };
      tl.to(g, { p: 1, duration: 0.75, ease: "rk-expo" }, 0.06);
      const G = GRL_GEOMETRY;
      glide = () => {
        const e = g.p;
        const T = ringTarget();
        const s = 1 + (T.r / r0 - 1) * e;
        xf.x = (T.x - hub0.x) * e;
        xf.y = (T.y - hub0.y) * e;
        xf.scale = s;
        setT(xf);
        // traços em px DE TELA: a escala cresce, o fio afina até o do anel do GL
        const k = ppu * s;
        if (spiral) spiral.style.strokeWidth = (lerp(G.spiralStroke * ppu, AT_CONTACT.spiral, e) / k).toFixed(3) + "px";
        if (needle) needle.style.strokeWidth = (lerp(G.needleStroke * ppu, AT_CONTACT.needle, e) / k).toFixed(3) + "px";
        hub?.setAttribute("r", (lerp(G.hubR * ppu, AT_CONTACT.hub, e) / k).toFixed(3));
        tip?.setAttribute("r", (lerp(G.tipR * ppu, AT_CONTACT.tip, e) / k).toFixed(3));
      };
      gsap.ticker.add(glide);

      // 0.10–0.70 · a espiral abre no anel: cada ponto desliza só radialmente
      // (alvo = mesmo enrolamento, todas as voltas em r = 46)
      if (spiral && bootDone) {
        spiral.style.strokeDasharray = "";
        spiral.style.strokeDashoffset = "";
        tl.to(spiral, { morphSVG: { shape: GRL_RING_PATH, shapeIndex: 0 }, duration: 0.6, ease: "rk-io" }, 0.1);
      }

      if (!quiet) {
        // 0.72 · contato: geometria idêntica → o emblema some em 120 ms e o
        // anel do campo (acendido pelo flare/ringBoost) assume
        tl.to(emblem, { autoAlpha: 0, duration: 0.12, ease: "none" }, CONTACT);
        tl.call(() => glide && gsap.ticker.remove(glide), undefined, CONTACT + 0.14);
      }
    }

    if (quiet) {
      // "mergulho no papel": o véu da landing cobre; o teleporte pendente
      // encontra o véu fechado (alreadyCovered) — uma transição só
      // QA fix (QUIET-ENTRY-EXPOSED-FRAME): the cover lives ON this timeline
      // (one clock with onLeft). A timeline renders children in start order,
      // so even a long frame that jumps past .65 renders the veil to 1 before
      // onLeft unmounts the Gateway — never a half-open veil over Ch1.
      tl.add(runtime.veil.cover(G2.quietCoverDur), G2.quietCover);
      tl.call(onLeft, undefined, G2.quietLeft);
    } else {
      // 0.85 · a raiz apaga (nada pisca quando o portal desmonta)
      tl.to(root, { autoAlpha: 0, duration: 0.25 }, 0.85);
      tl.call(onLeft, undefined, G2.onLeft);
    }

    return () => {
      tl.kill();
      if (glide) gsap.ticker.remove(glide);
    };
  }, [leaving, onLeft]);

  return (
    <div className="gx-gate" ref={rootRef}>
      <div className="gx-gate__veil" aria-hidden="true" />

      <div className="gx-gate__center">
        <GenesisRadarLogo className="gx-hero__logo" />
        {/* frase-âncora: bloco do motor de glifos (.cx-sr lê a frase inteira) */}
        <MaskWords as="p" className="gx-gate__phrase" words={PHRASE_WORDS} emClassName="gx-em" />
        <button
          type="button"
          className="gx-cta"
          onClick={() => {
            if (!leaving) onEnter();
          }}
        >
          {GATEWAY_COPY.cta}
          <svg className="gx-cta__arrow" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12h14M12 5.5 18.5 12 12 18.5" />
          </svg>
        </button>
        <p className="gx-cue" aria-hidden="true">
          <span className="gx-cue__ring" />
          <MaskWords as="span" className="gx-cue__text" text={GATEWAY_COPY.caption} sr={false} />
        </p>
      </div>
    </div>
  );
}
